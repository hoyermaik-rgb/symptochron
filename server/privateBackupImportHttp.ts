import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import { closeDatabase, getDatabase, getDatabasePath } from "./database/connection";
import { analyzeBackupContent, runBackupImport } from "./database/backupImporter";
import {
  getPrivateBackupImportSummaryById,
  listPrivateBackupImportSummaries,
  markPrivateBackupImportExpired,
  updatePrivateBackupImportSummary,
  upsertPrivateBackupImportSummary,
  type PrivateBackupImportSummary,
} from "./database/repositories/privateBackupImportRepository";
import { withProductDbLock } from "./database/productDbLock";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const AUTH_COOKIE = "symptochron_private_import_auth";
const CSRF_HEADER = "x-symptochron-private-import-csrf";
const TOKEN_HEADER = "x-symptochron-admin-token";
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 6;
const FAILED_WINDOW_MS = 5 * 60 * 1000;

type AdminSession = { id: string; csrfToken: string; expiresAt: number };
type ImportSession = {
  id: string;
  sessionId: string;
  sourceFilename: string;
  sourceSizeBytes: number;
  sourceBackupVersion: string;
  sourceSchemaVersion: number;
  sourceHash: string;
  backupPath: string;
  tempDir: string;
  status: "analyzed" | "dry-run" | "applied" | "verified" | "failed" | "expired";
  expiresAt: number;
  analysis: ReturnType<typeof analyzeBackupContent>;
  dryRunResult?: Awaited<ReturnType<typeof runBackupImport>>;
  snapshotPath?: string | null;
  createdAt: string;
};

type FailedAttempt = { count: number; resetAt: number };

const adminSessions = new Map<string, AdminSession>();
const importSessions = new Map<string, ImportSession>();
const failedAttempts = new Map<string, FailedAttempt>();

export type PrivateBackupImportResult = ReturnType<typeof analyzeBackupContent> & {
  importSessionId?: string;
  error?: string;
};

export interface PrivateBackupHistoryListItem {
  importId: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  lastCompletedPhase: string;
  sourceFilename: string;
  sourceSizeBytes: number;
  sourceBackupVersion: string;
  sourceSchemaVersion: number;
  snapshotReference: string | null;
  applyStatus: string;
  verifyStatus: string;
  analysisSummary: Record<string, unknown>;
  dryRunSummary: Record<string, unknown>;
  errorCategory: string | null;
  errorMessage: string | null;
}

function safeFilename(name: string): string {
  const base = path.basename(name || "backup.json").replace(/[^\w.\-]+/g, "_");
  return base.slice(0, 120) || "backup.json";
}

function safeErrorCategory(error: unknown, phase: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/csrf|admin-sitzung|adminschutz/i.test(message)) return "auth_error";
  if (/snapshot/i.test(message)) return "snapshot_error";
  if (/verify/i.test(message)) return "verify_error";
  if (/apply/i.test(message)) return "apply_error";
  if (/abgelaufen|fehlte|sitzung/i.test(message)) return "session_error";
  if (/json|validierung|konflikt|blocker|ungültig|ungueltig/i.test(message)) return "validation_error";
  return `${phase}_error`;
}

function safeErrorMessage(phase: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${phase}: ${message.split("\n")[0].slice(0, 120)}`;
}

function summarizeAnalysis(analysis: ReturnType<typeof analyzeBackupContent>): Record<string, unknown> {
  return {
    importId: analysis.importId,
    status: analysis.status,
    schemaVersion: analysis.schemaVersion,
    importAllowed: analysis.importAllowed,
    sourceCounts: analysis.sourceCounts,
    expectedTargetCounts: analysis.expectedTargetCounts,
    warningsCount: analysis.warnings.length,
    blockersCount: analysis.blockers.length,
    plannedTables: analysis.plannedTables,
  };
}

function summarizeDryRun(analysis: ReturnType<typeof analyzeBackupContent>, result: Awaited<ReturnType<typeof runBackupImport>>): Record<string, unknown> {
  return {
    importId: analysis.importId,
    status: result.report.status,
    code: result.code,
    warningsCount: result.report.warnings.length,
    errorsCount: result.report.errors.length,
    blockersCount: (result.report.blockers ?? []).length,
    importAllowed: analysis.importAllowed && result.code === 0,
  };
}

function summarizeApply(result: Awaited<ReturnType<typeof runBackupImport>>, snapshotReference: string): Record<string, unknown> {
  return {
    status: result.report.status,
    snapshotReference,
    completedAt: result.report.completedAt,
    counts: result.report.counts,
    warningsCount: result.report.warnings.length,
    errorsCount: result.report.errors.length,
    matchedCounts: Object.fromEntries(Object.entries(result.report.matchedIds).map(([key, value]) => [key, value.length])),
  };
}

function summarizeVerify(result: Awaited<ReturnType<typeof runBackupImport>>): Record<string, unknown> {
  return {
    status: result.report.status,
    completedAt: result.report.completedAt,
    verificationChecks: result.report.verificationChecks ?? {},
  };
}

function toHistoryListItem(record: PrivateBackupImportSummary): PrivateBackupHistoryListItem {
  return {
    importId: record.importId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
    lastCompletedPhase: record.lastCompletedPhase,
    sourceFilename: record.sourceFilename,
    sourceSizeBytes: record.sourceSizeBytes,
    sourceBackupVersion: record.sourceBackupVersion,
    sourceSchemaVersion: record.sourceSchemaVersion,
    snapshotReference: record.snapshotReference,
    applyStatus: String(record.applySummary.status ?? record.applySummary.phase ?? record.status),
    verifyStatus: String(record.verifySummary.status ?? record.status),
    analysisSummary: record.analysisSummary,
    dryRunSummary: record.dryRunSummary,
    errorCategory: record.errorCategory,
    errorMessage: record.errorMessage,
  };
}

export function isPrivateBackupImportEnabled(): boolean {
  return process.env.ENABLE_PRIVATE_BACKUP_IMPORT === "true";
}

export function getPrivateAdminSessionCsrfToken(sessionId: string): string | null {
  return adminSessions.get(sessionId)?.csrfToken ?? null;
}

export function hasPrivateAdminSession(sessionId: string): boolean {
  cleanupExpiredSessions();
  const session = adminSessions.get(sessionId);
  return Boolean(session && session.expiresAt > Date.now());
}

function configuredToken(): string | null {
  return process.env.PRIVATE_BACKUP_IMPORT_ADMIN_TOKEN?.trim() || process.env.PRIVATE_BACKUP_IMPORT_TOKEN?.trim() || null;
}

function cookieHeader(req: Request): string {
  return String(req.headers.cookie ?? "");
}

function readCookie(req: Request, name: string): string | null {
  for (const part of cookieHeader(req).split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of adminSessions) if (session.expiresAt <= now) adminSessions.delete(id);
  for (const [id, session] of importSessions) {
    if (session.expiresAt <= now) {
      try {
        markPrivateBackupImportExpired(session.id);
      } catch {
        // Best effort: Protokollierung darf das Expiry-Cleanup nicht blockieren.
      }
      fs.rmSync(session.tempDir, { recursive: true, force: true });
      importSessions.delete(id);
    }
  }
}

function rateLimit(key: string): boolean {
  const now = Date.now();
  const current = failedAttempts.get(key);
  if (!current || current.resetAt <= now) {
    failedAttempts.set(key, { count: 1, resetAt: now + FAILED_WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_FAILED_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function requireEnabled(req: Request, res: Response, next: NextFunction): void {
  if (!isPrivateBackupImportEnabled()) {
    res.status(404).json({ error: "Nicht gefunden." });
    return;
  }
  next();
}

function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  cleanupExpiredSessions();
  const sid = readCookie(req, AUTH_COOKIE);
  if (!sid) {
    res.status(401).json({ error: "Admin-Sitzung fehlt." });
    return;
  }
  const session = adminSessions.get(sid);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) adminSessions.delete(sid);
    res.status(401).json({ error: "Admin-Sitzung abgelaufen." });
    return;
  }
  const csrf = String(req.header(CSRF_HEADER) ?? "");
  if (!csrf || csrf !== session.csrfToken) {
    res.status(403).json({ error: "CSRF-Pruefung fehlgeschlagen." });
    return;
  }
  next();
}

function requireAdminSessionReadOnly(req: Request, res: Response, next: NextFunction): void {
  cleanupExpiredSessions();
  const sid = readCookie(req, AUTH_COOKIE);
  if (!sid) {
    res.status(401).json({ error: "Admin-Sitzung fehlt." });
    return;
  }
  const session = adminSessions.get(sid);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) adminSessions.delete(sid);
    res.status(401).json({ error: "Admin-Sitzung abgelaufen." });
    return;
  }
  next();
}

function sessionKey(req: Request): string {
  return `${req.ip}:${req.path}`;
}

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.chmodSync(dir, 0o700);
  return dir;
}

export function assertValidBackupUpload(file: { filename: string | null; mimeType: string | null; buffer: Buffer }): void {
  if (file.buffer.length === 0) throw new Error("Datei ist leer.");
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw new Error("Datei ist zu groß.");
  const ext = file.filename ? path.extname(file.filename).toLowerCase() : "";
  const mime = file.mimeType?.toLowerCase() ?? "";
  if (ext !== ".json" && !mime.includes("json")) throw new Error("Nur JSON-Dateien sind erlaubt.");
}

export function parseMultipartFile(raw: Buffer, contentType: string | undefined): { filename: string | null; mimeType: string | null; buffer: Buffer } {
  if (!contentType?.includes("multipart/form-data")) throw new Error("Ungültiger Dateityp.");
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) throw new Error("Multipart-Grenze fehlt.");
  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const start = raw.indexOf(boundary);
  if (start === -1) throw new Error("Backup-Datei fehlt.");
  const headerStart = start + boundary.length + 2;
  const nextBoundary = raw.indexOf(boundary, headerStart);
  if (nextBoundary === -1) throw new Error("Backup-Datei fehlt.");
  const part = raw.subarray(headerStart, nextBoundary - 2);
  const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
  if (headerEnd === -1) throw new Error("Backup-Datei fehlt.");
  const header = part.subarray(0, headerEnd).toString("utf8");
  const body = part.subarray(headerEnd + 4);
  const filenameMatch = header.match(/filename="([^"]*)"/i);
  const typeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
  return { filename: filenameMatch ? filenameMatch[1] : null, mimeType: typeMatch ? typeMatch[1].trim() : null, buffer: body };
}

export function getConfiguredDatabasePath(): string {
  return getDatabasePath().trim();
}

function dbPath(): string {
  const configured = getDatabasePath().trim();
  if (!configured || !path.isAbsolute(configured)) throw new Error("SYMPTOCHRON_DB_PATH fehlt oder ist ungueltig.");
  const stat = fs.statSync(configured);
  if (!stat.isFile() || stat.size <= 0) throw new Error("Datenbankdatei fehlt oder ist leer.");
  return configured;
}

function integrityOk(databasePath: string): boolean {
  const db = getDatabase();
  if (dbPath() !== databasePath) {
    closeDatabase();
  }
  const check = getDatabase().prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  const fk = getDatabase().prepare("PRAGMA foreign_key_check").all() as unknown[];
  return check?.integrity_check === "ok" && fk.length === 0;
}

function canonicalSnapshotDir(): string {
  const dir = process.env.SYMPTOCHRON_BACKUP_DIR?.trim();
  if (!dir) throw new Error("SYMPTOCHRON_BACKUP_DIR fehlt.");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createSnapshot(importId: string): { path: string; sha256: string } {
  const dir = canonicalSnapshotDir();
  const snapshotPath = path.join(dir, `symptochron-before-import-${importId}-${Date.now()}.db`);
  const db = getDatabase();
  const sqlPath = `'${snapshotPath.replace(/'/g, "''")}'`;
  db.exec(`VACUUM INTO ${sqlPath}`);
  const raw = fs.readFileSync(snapshotPath);
  const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
  return { path: snapshotPath, sha256 };
}

function cloneDatabaseToTemp(sourcePath: string): { tempDir: string; tempDbPath: string } {
  const tempDir = createTempDir("symptochron-private-import-");
  const tempDbPath = path.join(tempDir, "work.db");
  fs.copyFileSync(sourcePath, tempDbPath);
  return { tempDir, tempDbPath };
}

function storeImportSession(sessionId: string, backupBuffer: Buffer, sourceFilename: string, analysis: ReturnType<typeof analyzeBackupContent>): ImportSession {
  const tempDir = createTempDir("symptochron-private-backup-");
  const safeBackupPath = path.join(tempDir, `upload-${sessionId}.json`);
  fs.writeFileSync(safeBackupPath, backupBuffer, { mode: 0o600 });
  const session: ImportSession = {
    id: analysis.importId,
    sessionId,
    sourceFilename: safeFilename(sourceFilename),
    sourceSizeBytes: backupBuffer.byteLength,
    sourceBackupVersion: analysis.sourceBackupVersion,
    sourceSchemaVersion: analysis.schemaVersion,
    sourceHash: analysis.sourceHash,
    backupPath: safeBackupPath,
    tempDir,
    status: "analyzed",
    expiresAt: Date.now() + SESSION_TTL_MS,
    analysis,
    createdAt: new Date().toISOString(),
  };
  importSessions.set(sessionId, session);
  return session;
}

function getImportSession(sessionId: string): ImportSession | null {
  cleanupExpiredSessions();
  const session = importSessions.get(sessionId) ?? null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    fs.rmSync(session.tempDir, { recursive: true, force: true });
    importSessions.delete(sessionId);
    return null;
  }
  return session;
}

function removeImportSession(sessionId: string): void {
  const session = importSessions.get(sessionId);
  if (session) {
    fs.rmSync(session.tempDir, { recursive: true, force: true });
    importSessions.delete(sessionId);
  }
}

function parseJsonBody(req: Request): any {
  return req.body ?? {};
}

export function analyzePrivateImportBuffer(buffer: Buffer): ReturnType<typeof analyzeBackupContent> {
  return analyzeBackupContent(buffer);
}

export function getPrivateImportSession(sessionId: string): ImportSession | null {
  return getImportSession(sessionId);
}

export function createPrivateAdminSession(token: string, ipKey = "global"): AdminSession {
  cleanupExpiredSessions();
  const configured = configuredToken();
  if (!configured) throw new Error("Adminschutz nicht konfiguriert.");
  const attempts = failedAttempts.get(ipKey);
  if (attempts && attempts.count >= MAX_FAILED_ATTEMPTS && attempts.resetAt > Date.now()) {
    throw new Error("Rate limit überschritten.");
  }
  if (!constantTimeEqual(token, configured)) {
    rateLimit(ipKey);
    throw new Error("Adminschutz fehlgeschlagen.");
  }
  const session: AdminSession = {
    id: crypto.randomUUID(),
    csrfToken: crypto.randomBytes(32).toString("hex"),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  adminSessions.set(session.id, session);
  return session;
}

export async function handlePrivateBackupAnalyzeRequest(req: Request): Promise<PrivateBackupImportResult> {
  const file = parseMultipartFile(req.body as Buffer, req.headers["content-type"]);
  assertValidBackupUpload(file);
  const analysis = analyzeBackupContent(file.buffer);
  const sessionId = crypto.randomUUID();
  const session = storeImportSession(sessionId, file.buffer, file.filename ?? "backup.json", analysis);
  upsertPrivateBackupImportSummary({
    importId: analysis.importId,
    sourceHash: analysis.sourceHash,
    sourceFilename: session.sourceFilename,
    sourceSizeBytes: session.sourceSizeBytes,
    sourceBackupVersion: analysis.sourceBackupVersion,
    sourceSchemaVersion: analysis.schemaVersion,
    status: "analyzed",
    lastCompletedPhase: "analyzed",
    analysisSummary: summarizeAnalysis(analysis),
    dryRunSummary: {},
    applySummary: {},
    verifySummary: {},
    snapshotReference: null,
    errorCategory: null,
    errorMessage: null,
  });
  return { ...analysis, importSessionId: sessionId };
}

export async function handlePrivateBackupDryRunRequest(req: Request): Promise<ReturnType<typeof analyzeBackupContent>> {
  const sessionId = String(parseJsonBody(req).sessionId ?? "");
  const session = getImportSession(sessionId);
  if (!session) throw new Error("Import-Sitzung fehlt oder ist abgelaufen.");
  const dbClone = cloneDatabaseToTemp(dbPath());
  try {
    const result = await runBackupImport({ mode: "dry-run", backupPath: session.backupPath, databasePath: dbClone.tempDbPath });
    session.status = result.code === 0 ? "dry-run" : "failed";
    session.dryRunResult = result;
    session.analysis = analyzeBackupContent(fs.readFileSync(session.backupPath));
    if (result.code === 0) {
      updatePrivateBackupImportSummary(session.id, {
        status: "dry_run_completed",
        lastCompletedPhase: "dry_run_completed",
        analysisSummary: summarizeAnalysis(session.analysis),
        dryRunSummary: summarizeDryRun(session.analysis, result),
        errorCategory: null,
        errorMessage: null,
      });
    } else {
      updatePrivateBackupImportSummary(session.id, {
        status: "failed",
        lastCompletedPhase: "dry_run_completed",
        dryRunSummary: summarizeDryRun(session.analysis, result),
        errorCategory: "validation_error",
        errorMessage: "Dry-Run fehlgeschlagen.",
      });
    }
    return session.analysis;
  } catch (error) {
    try {
      updatePrivateBackupImportSummary(session.id, {
        status: "failed",
        lastCompletedPhase: "failed",
        errorCategory: safeErrorCategory(error, "dry_run"),
        errorMessage: safeErrorMessage("dry_run", error),
      });
    } catch {
      // Best effort.
    }
    throw error;
  } finally {
    fs.rmSync(dbClone.tempDir, { recursive: true, force: true });
  }
}

export async function handlePrivateBackupApplyRequest(req: Request): Promise<{ status: string; snapshotId: string; snapshotSha256: string }> {
  const body = parseJsonBody(req);
  const sessionId = String(body.sessionId ?? "");
  const session = getImportSession(sessionId);
  if (!session) throw new Error("Import-Sitzung fehlt oder ist abgelaufen.");
  if (!body.confirmDryRun || !body.confirmImport || !body.confirmMedsTaken) throw new Error("Bestätigungen fehlen.");
  if (String(req.header(CSRF_HEADER) ?? "") !== String(readCookie(req, AUTH_COOKIE) ? adminSessions.get(String(readCookie(req, AUTH_COOKIE)))?.csrfToken ?? "" : "")) {
    throw new Error("CSRF-Pruefung fehlgeschlagen.");
  }
  const dbPathValue = dbPath();
  updatePrivateBackupImportSummary(session.id, {
    status: "apply_started",
    lastCompletedPhase: "apply_started",
    errorCategory: null,
    errorMessage: null,
  });
  const { path: snapshotPath, sha256 } = createSnapshot(session.id);
  getDatabase().exec("PRAGMA wal_checkpoint(FULL);");
  closeDatabase();
  const clone = cloneDatabaseToTemp(dbPathValue);
  try {
    const apply = await runBackupImport({ mode: "apply", backupPath: session.backupPath, databasePath: clone.tempDbPath, snapshotPath });
    if (apply.code !== 0) throw new Error(apply.report.errors.join(" | ") || "Apply fehlgeschlagen.");
    const verify = await runBackupImport({ mode: "verify", backupPath: session.backupPath, databasePath: clone.tempDbPath });
    if (verify.code !== 0) throw new Error(verify.report.errors.join(" | ") || "Verify fehlgeschlagen.");
    closeDatabase();
    fs.copyFileSync(clone.tempDbPath, dbPathValue);
    getDatabase();
    session.status = "verified";
    session.snapshotPath = snapshotPath;
    updatePrivateBackupImportSummary(session.id, {
      status: "verified",
      lastCompletedPhase: "verified",
      snapshotReference: path.basename(snapshotPath),
      applySummary: summarizeApply(apply, path.basename(snapshotPath)),
      verifySummary: summarizeVerify(verify),
      errorCategory: null,
      errorMessage: null,
    });
    return { status: "verified", snapshotId: path.basename(snapshotPath), snapshotSha256: sha256 };
  } catch (error) {
    try {
      updatePrivateBackupImportSummary(session.id, {
        status: "failed",
        lastCompletedPhase: "failed",
        errorCategory: safeErrorCategory(error, "apply"),
        errorMessage: safeErrorMessage("apply", error),
      });
    } catch {
      // Protokollfehler dürfen den fachlichen Fehler nicht ueberdecken.
    }
    throw error;
  } finally {
    fs.rmSync(clone.tempDir, { recursive: true, force: true });
  }
}

export async function handlePrivateBackupVerifyRequest(req: Request): Promise<{ status: string }> {
  const sessionId = String(parseJsonBody(req).sessionId ?? "");
  const session = getImportSession(sessionId);
  if (!session) throw new Error("Import-Sitzung fehlt oder ist abgelaufen.");
  if (session.status === "verified") return { status: "verified" };
  try {
    const result = await runBackupImport({ mode: "verify", backupPath: session.backupPath, databasePath: dbPath() });
    if (result.code !== 0) throw new Error(result.report.errors.join(" | ") || "Verify fehlgeschlagen.");
    session.status = "verified";
    updatePrivateBackupImportSummary(session.id, {
      status: "verified",
      lastCompletedPhase: "verified",
      verifySummary: summarizeVerify(result),
      errorCategory: null,
      errorMessage: null,
    });
    return { status: "verified" };
  } catch (error) {
    try {
      updatePrivateBackupImportSummary(session.id, {
        status: "failed",
        lastCompletedPhase: "failed",
        errorCategory: safeErrorCategory(error, "verify"),
        errorMessage: safeErrorMessage("verify", error),
      });
    } catch {
      // Protokollfehler dürfen den fachlichen Fehler nicht ueberdecken.
    }
    throw error;
  }
}

export function getPrivateBackupImportHistory(limit = 20): PrivateBackupHistoryListItem[] {
  return listPrivateBackupImportSummaries(limit).map(toHistoryListItem);
}

export function getPrivateBackupImportReport(importId: string): PrivateBackupImportSummary | null {
  return getPrivateBackupImportSummaryById(importId);
}

export function getPrivateBackupImportHistorySummary(importId: string): PrivateBackupHistoryListItem | null {
  const report = getPrivateBackupImportSummaryById(importId);
  return report ? toHistoryListItem(report) : null;
}

export function registerPrivateBackupImportRoutes(app: Express): void {
  app.post("/api/admin/private-import/session", requireEnabled, express.json(), (req, res) => {
    try {
      const ipKey = String(req.ip ?? "global");
      const token = String(req.body?.token ?? req.header(TOKEN_HEADER) ?? "");
      const session = createPrivateAdminSession(token, ipKey);
      res.cookie(AUTH_COOKIE, session.id, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_TTL_MS,
      });
      return res.json({ csrfToken: session.csrfToken, expiresAt: new Date(session.expiresAt).toISOString() });
    } catch (error) {
      return res.status(403).json({ error: error instanceof Error ? error.message : "Admin-Sitzung fehlgeschlagen." });
    }
  });

  app.post("/api/admin/private-import/logout", requireEnabled, requireAdminSession, (req, res) => {
    const sid = readCookie(req, AUTH_COOKIE);
    if (sid) adminSessions.delete(sid);
    res.clearCookie(AUTH_COOKIE, { path: "/" });
    return res.json({ status: "logged_out" });
  });

  app.post("/api/admin/backup-import/analyze", requireEnabled, requireAdminSession, express.raw({ type: "multipart/form-data", limit: `${MAX_UPLOAD_BYTES}b` }), async (req, res) => {
    try {
      const analysis = await handlePrivateBackupAnalyzeRequest(req);
      return res.json(analysis);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Analyse fehlgeschlagen." });
    }
  });

  app.post("/api/admin/backup-import/dry-run", requireEnabled, requireAdminSession, express.json(), async (req, res) => {
    try {
      const result = await handlePrivateBackupDryRunRequest(req);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Dry-Run fehlgeschlagen." });
    }
  });

  app.post("/api/admin/backup-import/apply", requireEnabled, requireAdminSession, express.json(), async (req, res) => {
    try {
      if (String(req.header(CSRF_HEADER) ?? "") !== String((req as any).csrfToken ?? "")) {
        const sid = String(readCookie(req, AUTH_COOKIE) ?? "");
        const session = sid ? adminSessions.get(sid) : null;
        if (!session || session.csrfToken !== String(req.header(CSRF_HEADER) ?? "")) throw new Error("CSRF-Pruefung fehlgeschlagen.");
      }
      const result = await withProductDbLock(`import-${String(parseJsonBody(req).sessionId ?? "unknown")}`, () => handlePrivateBackupApplyRequest(req));
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Apply fehlgeschlagen." });
    }
  });

  app.post("/api/admin/backup-import/verify", requireEnabled, requireAdminSession, express.json(), async (req, res) => {
    try {
      const result = await handlePrivateBackupVerifyRequest(req);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Verify fehlgeschlagen." });
    }
  });

  app.get("/api/admin/backup-import/history", requireEnabled, requireAdminSessionReadOnly, (_req, res) => {
    try {
      return res.json({ results: getPrivateBackupImportHistory(25) });
    } catch (error) {
      return res.status(500).json({ error: "Importhistorie konnte nicht geladen werden." });
    }
  });

  app.get("/api/admin/backup-import/history/:importId", requireEnabled, requireAdminSessionReadOnly, (req, res) => {
    try {
      const report = getPrivateBackupImportReport(req.params.importId);
      if (!report) return res.status(404).json({ error: "Import nicht gefunden." });
      return res.json(report);
    } catch {
      return res.status(500).json({ error: "Importbericht konnte nicht geladen werden." });
    }
  });
}
