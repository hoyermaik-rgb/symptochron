import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { closeDatabase, getDatabase, getDatabasePath } from "./database/connection";
import { getPrivateBackupImportSummaryById } from "./database/repositories/privateBackupImportRepository";
import {
  getPrivateAdminSessionCsrfToken,
  hasPrivateAdminSession,
  isPrivateBackupImportEnabled,
} from "./privateBackupImportHttp";
import {
  getPrivateBackupRestoreById,
  listPrivateBackupRestoreSummaries,
  markPrivateBackupRestoreExpired,
  updatePrivateBackupRestoreSummary,
  upsertPrivateBackupRestoreSummary,
  type PrivateBackupRestoreSummary,
} from "./database/repositories/privateBackupRestoreRepository";
import { withProductDbLock } from "./database/productDbLock";

const AUTH_COOKIE = "symptochron_private_import_auth";
const CSRF_HEADER = "x-symptochron-private-import-csrf";
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SNAPSHOT_BYTES = 200 * 1024 * 1024;
const MAX_KNOWN_SCHEMA_VERSION = 7;

type RestorePhase =
  | "restore_created"
  | "restore_analyzed"
  | "restore_confirmed"
  | "safety_snapshot_created"
  | "restore_started"
  | "restore_applied"
  | "restore_verified"
  | "restore_failed"
  | "rollback_started"
  | "rollback_applied"
  | "rollback_verified"
  | "rollback_failed"
  | "expired";

interface RestoreSession {
  restoreId: string;
  sourceImportId: string;
  snapshotReference: string;
  snapshotPath: string;
  snapshotSizeBytes: number;
  snapshotSha256: string;
  status: RestorePhase;
  confirmed: boolean;
  confirmedAt: string | null;
  expiresAt: number;
  analysis: Record<string, unknown>;
  safetySnapshotReference?: string | null;
  safetySnapshotPath?: string | null;
  safetySnapshotSha256?: string | null;
  safetySnapshotSizeBytes?: number | null;
  rollbackStatus: "not_started" | "available" | "rolled_back" | "failed";
}

const restoreSessions = new Map<string, RestoreSession>();

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of restoreSessions) {
    if (session.expiresAt <= now) {
      restoreSessions.delete(id);
      try {
        markPrivateBackupRestoreExpired(id);
      } catch {
        // Best effort only.
      }
    }
  }
}

export function withRestoreLock<T>(owner: string, fn: () => T): T {
  cleanupExpiredSessions();
  return withProductDbLock(owner, fn);
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
  if (!sid || !hasPrivateAdminSession(sid)) {
    res.status(401).json({ error: "Admin-Sitzung fehlt oder ist abgelaufen." });
    return;
  }
  const csrf = String(req.header(CSRF_HEADER) ?? "");
  if (csrf !== getPrivateAdminSessionCsrfToken(sid)) {
    res.status(403).json({ error: "CSRF-Pruefung fehlgeschlagen." });
    return;
  }
  next();
}

function requireAdminSessionReadOnly(req: Request, res: Response, next: NextFunction): void {
  cleanupExpiredSessions();
  const sid = readCookie(req, AUTH_COOKIE);
  if (!sid || !hasPrivateAdminSession(sid)) {
    res.status(401).json({ error: "Admin-Sitzung fehlt oder ist abgelaufen." });
    return;
  }
  next();
}

function backupDir(): string {
  const dir = process.env.SYMPTOCHRON_BACKUP_DIR?.trim();
  if (!dir) throw new Error("SYMPTOCHRON_BACKUP_DIR fehlt.");
  fs.mkdirSync(dir, { recursive: true });
  return path.resolve(dir);
}

function ensureInsideBackupDir(filePath: string): string {
  const root = backupDir();
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Snapshot-Pfad ausserhalb des Backup-Verzeichnisses.");
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(resolved);
  const realRelative = path.relative(realRoot, realFile);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) throw new Error("Snapshot verweist ausserhalb des Backup-Verzeichnisses.");
  return realFile;
}

function assertSnapshotFormat(snapshotPath: string): { size: number; sha256: string } {
  const stat = fs.statSync(snapshotPath);
  if (!stat.isFile()) throw new Error("Snapshot ist keine reguläre Datei.");
  if (stat.size <= 0) throw new Error("Snapshot ist leer.");
  if (stat.size > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot ist zu gross.");
  const header = fs.readFileSync(snapshotPath).subarray(0, 16).toString("utf8");
  if (!header.startsWith("SQLite format 3")) throw new Error("Snapshot ist keine SQLite-Datei.");
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(snapshotPath)).digest("hex");
  return { size: stat.size, sha256 };
}

function openSnapshotDb(snapshotPath: string): DatabaseSync {
  const db = new DatabaseSync(snapshotPath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function readSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number } | undefined;
  return row?.version ?? 0;
}

function expectedTables(): string[] {
  return [
    "diary_entries",
    "mood_entries",
    "user_medications",
    "medication_schedules",
    "medication_intakes",
    "rls_surveys",
    "appointments",
    "blood_pressure_entries",
    "sos_profiles",
    "sos_contacts",
    "private_backup_import_history",
    "private_backup_restore_history",
    "schema_migrations",
  ];
}

function validateSnapshot(snapshotPath: string): { size: number; sha256: string; schemaVersion: number; tables: string[] } {
  const { size, sha256 } = assertSnapshotFormat(snapshotPath);
  const db = openSnapshotDb(snapshotPath);
  try {
    const integrity = db.prepare("PRAGMA integrity_check").all() as Array<Record<string, string>>;
    if (integrity.length === 0 || Object.values(integrity[0])[0] !== "ok") throw new Error("Snapshot integrity_check fehlgeschlagen.");
    const foreignKeys = db.prepare("PRAGMA foreign_key_check").all() as unknown[];
    if (foreignKeys.length > 0) throw new Error("Snapshot foreign_key_check fehlgeschlagen.");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const tableNames = tables.map((row) => row.name);
    for (const table of expectedTables()) {
      if (!tableNames.includes(table)) throw new Error(`Snapshot-Tabelle fehlt: ${table}`);
    }
    const schemaVersion = readSchemaVersion(db);
    if (schemaVersion > MAX_KNOWN_SCHEMA_VERSION) throw new Error("Snapshot enthaelt eine unbekannte zukuenftige Schema-Version.");
    return { size, sha256, schemaVersion, tables: tableNames };
  } finally {
    db.close();
  }
}

function deterministicId(prefix: string, ...parts: Array<string | number | undefined | null>): string {
  const payload = parts.map((part) => String(part ?? "")).join("|");
  return `${prefix}_${crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16)}`;
}

function createSafetySnapshot(referenceId: string): { path: string; reference: string; size: number; sha256: string } {
  const db = getDatabase();
  const dir = backupDir();
  const reference = `safety-${referenceId}-${Date.now()}.db`;
  const target = path.join(dir, reference);
  db.exec("PRAGMA wal_checkpoint(FULL);");
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const validated = validateSnapshot(target);
  return { path: target, reference, size: validated.size, sha256: validated.sha256 };
}

function atomicReplace(sourcePath: string, targetPath: string): void {
  const tempTarget = `${targetPath}.restore-${Date.now()}-${crypto.randomUUID()}`;
  fs.copyFileSync(sourcePath, tempTarget);
  fs.renameSync(tempTarget, targetPath);
  const wal = `${targetPath}-wal`;
  const shm = `${targetPath}-shm`;
  if (fs.existsSync(wal)) fs.rmSync(wal, { force: true });
  if (fs.existsSync(shm)) fs.rmSync(shm, { force: true });
}

function getLiveDbPath(): string {
  const dbPath = getDatabasePath();
  if (!path.isAbsolute(dbPath)) throw new Error("SYMPTOCHRON_DB_PATH fehlt oder ist ungueltig.");
  return dbPath;
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  return Boolean(row);
}

function summarizeDb(db: DatabaseSync): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const table of expectedTables()) {
    summary[table] = tableExists(db, table)
      ? Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count)
      : 0;
  }
  return summary;
}

function createRestoreSession(importId: string): RestoreSession {
  const importSummary = getPrivateBackupImportSummaryById(importId);
  if (!importSummary?.snapshotReference) throw new Error("Import oder Snapshot nicht gefunden.");
  const snapshotPath = ensureInsideBackupDir(path.join(backupDir(), importSummary.snapshotReference));
  const validated = validateSnapshot(snapshotPath);
  const restoreId = deterministicId("restore", importId, importSummary.snapshotReference, validated.sha256);
  const session: RestoreSession = {
    restoreId,
    sourceImportId: importId,
    snapshotReference: importSummary.snapshotReference,
    snapshotPath,
    snapshotSizeBytes: validated.size,
    snapshotSha256: validated.sha256,
    status: "restore_analyzed",
    confirmed: false,
    confirmedAt: null,
    expiresAt: Date.now() + SESSION_TTL_MS,
    analysis: {
      importId,
      snapshotReference: importSummary.snapshotReference,
      sourceSchemaVersion: importSummary.sourceSchemaVersion,
      snapshotSizeBytes: validated.size,
      schemaVersion: validated.schemaVersion,
      tables: validated.tables,
      restoreAllowed: true,
    },
    rollbackStatus: "not_started",
  };
  restoreSessions.set(restoreId, session);
  upsertPrivateBackupRestoreSummary({
    restoreId,
    sourceImportId: importId,
    snapshotReference: importSummary.snapshotReference,
    snapshotSizeBytes: validated.size,
    snapshotSha256: validated.sha256,
    restoreSessionId: restoreId,
    status: "restore_analyzed",
    lastCompletedPhase: "restore_analyzed",
    analysisSummary: session.analysis,
    confirmSummary: {},
    restoreSummary: {},
    verifySummary: {},
    rollbackSummary: {},
    rollbackStatus: "not_started",
  });
  return session;
}

function getSession(restoreId: string): RestoreSession | null {
  cleanupExpiredSessions();
  return restoreSessions.get(restoreId) ?? null;
}

export function getPrivateRestoreSession(restoreId: string): RestoreSession | null {
  return getSession(restoreId);
}

function safeSummary(session: RestoreSession): Record<string, unknown> {
  return {
    restoreId: session.restoreId,
    sourceImportId: session.sourceImportId,
    snapshotReference: session.snapshotReference,
    snapshotSizeBytes: session.snapshotSizeBytes,
    status: session.status,
    confirmed: session.confirmed,
    confirmedAt: session.confirmedAt,
    expiresAt: new Date(session.expiresAt).toISOString(),
    analysis: session.analysis,
    rollbackStatus: session.rollbackStatus,
  };
}

function ensureRestoreRecord(session: RestoreSession): void {
  if (getPrivateBackupRestoreById(session.restoreId)) return;
  upsertPrivateBackupRestoreSummary({
    restoreId: session.restoreId,
    sourceImportId: session.sourceImportId,
    snapshotReference: session.snapshotReference,
    snapshotSizeBytes: session.snapshotSizeBytes,
    snapshotSha256: session.snapshotSha256,
    restoreSessionId: session.restoreId,
    status: session.status,
    lastCompletedPhase: session.status,
    analysisSummary: session.analysis,
    confirmSummary: {},
    restoreSummary: {},
    verifySummary: {},
    rollbackSummary: {},
    safetySnapshotReference: session.safetySnapshotReference ?? null,
    safetySnapshotSizeBytes: session.safetySnapshotSizeBytes ?? null,
    safetySnapshotSha256: session.safetySnapshotSha256 ?? null,
    rollbackStatus: session.rollbackStatus,
    confirmedAt: session.confirmedAt,
  });
}

function runRestore(session: RestoreSession): { status: string; restoreId: string } {
  if (!session.confirmed) throw new Error("Restore-Bestaetigung fehlt.");
  const dbPath = getLiveDbPath();
  try {
    ensureRestoreRecord(session);
    updatePrivateBackupRestoreSummary(session.restoreId, {
      status: "safety_snapshot_created",
      lastCompletedPhase: "safety_snapshot_created",
      confirmSummary: { confirmedAt: session.confirmedAt, snapshotReference: session.snapshotReference },
    });
    const safety = createSafetySnapshot(session.restoreId);
    session.safetySnapshotReference = safety.reference;
    session.safetySnapshotPath = safety.path;
    session.safetySnapshotSha256 = safety.sha256;
    session.safetySnapshotSizeBytes = safety.size;
    updatePrivateBackupRestoreSummary(session.restoreId, {
      status: "restore_started",
      lastCompletedPhase: "restore_started",
      safetySnapshotReference: safety.reference,
      safetySnapshotSizeBytes: safety.size,
      safetySnapshotSha256: safety.sha256,
      rollbackStatus: "available",
    });

    closeDatabase();
    atomicReplace(session.snapshotPath, dbPath);
    const reopened = getDatabase();
    ensureRestoreRecord(session);
    const integrity = reopened.prepare("PRAGMA integrity_check").all() as Array<Record<string, string>>;
    const fk = reopened.prepare("PRAGMA foreign_key_check").all() as unknown[];
    const tables = summarizeDb(reopened);
    if (integrity.length === 0 || Object.values(integrity[0])[0] !== "ok" || fk.length > 0) {
      throw new Error("Restore-Verifikation fehlgeschlagen.");
    }
    updatePrivateBackupRestoreSummary(session.restoreId, {
      status: "restore_verified",
      lastCompletedPhase: "restore_verified",
      restoreSummary: {
        integrityCheck: "ok",
        foreignKeyCheck: "ok",
        tables,
      },
      verifySummary: {
        integrityCheck: "ok",
        foreignKeyCheck: "ok",
        tables,
      },
      rollbackStatus: "available",
    });
    session.status = "restore_verified";
    return { status: "restore_verified", restoreId: session.restoreId };
  } catch (error) {
    try {
      const rollbackSource = session.safetySnapshotPath;
      if (rollbackSource && fs.existsSync(rollbackSource)) {
        updatePrivateBackupRestoreSummary(session.restoreId, {
          status: "rollback_started",
          lastCompletedPhase: "rollback_started",
          rollbackStatus: "available",
        });
        closeDatabase();
        atomicReplace(rollbackSource, dbPath);
        const reopened = getDatabase();
        ensureRestoreRecord(session);
        const integrity = reopened.prepare("PRAGMA integrity_check").all() as Array<Record<string, string>>;
        const fk = reopened.prepare("PRAGMA foreign_key_check").all() as unknown[];
        if (integrity.length === 0 || Object.values(integrity[0])[0] !== "ok" || fk.length > 0) {
          throw new Error("Rollback-Verifikation fehlgeschlagen.");
        }
        updatePrivateBackupRestoreSummary(session.restoreId, {
          status: "rollback_verified",
          lastCompletedPhase: "rollback_verified",
          rollbackSummary: {
            integrityCheck: "ok",
            foreignKeyCheck: "ok",
          },
          rollbackStatus: "rolled_back",
          errorCategory: "rollback_applied",
        });
        session.rollbackStatus = "rolled_back";
        return { status: "rollback_verified", restoreId: session.restoreId };
      }
    } catch (rollbackError) {
      updatePrivateBackupRestoreSummary(session.restoreId, {
        status: "rollback_failed",
        lastCompletedPhase: "rollback_failed",
        rollbackStatus: "failed",
        errorCategory: "rollback_error",
        errorMessage: rollbackError instanceof Error ? rollbackError.message : "Rollback fehlgeschlagen.",
      });
      throw rollbackError;
    }
    updatePrivateBackupRestoreSummary(session.restoreId, {
      status: "restore_failed",
      lastCompletedPhase: "restore_failed",
      rollbackStatus: session.rollbackStatus,
      errorCategory: error instanceof Error ? "restore_error" : "restore_error",
      errorMessage: error instanceof Error ? error.message : "Restore fehlgeschlagen.",
    });
    throw error;
  } finally {
  }
}

export function analyzePrivateBackupRestore(importId: string): Record<string, unknown> {
  return safeSummary(createRestoreSession(importId));
}

export function confirmPrivateBackupRestore(restoreId: string): Record<string, unknown> {
  const session = getSession(restoreId);
  if (!session) throw new Error("Restore-Sitzung nicht gefunden.");
  ensureRestoreRecord(session);
  session.confirmed = true;
  session.confirmedAt = new Date().toISOString();
  updatePrivateBackupRestoreSummary(session.restoreId, {
    status: "restore_confirmed",
    lastCompletedPhase: "restore_confirmed",
    confirmedAt: session.confirmedAt,
    confirmSummary: { confirmedAt: session.confirmedAt, snapshotReference: session.snapshotReference },
  });
  return safeSummary(session);
}

export function applyPrivateBackupRestore(restoreId: string): { status: string; restoreId: string } {
  const session = getSession(restoreId);
  if (!session) throw new Error("Restore-Sitzung nicht gefunden.");
  return withRestoreLock(session.restoreId, () => runRestore(session));
}

export function getPrivateBackupRestoreHistory(limit = 20): PrivateBackupRestoreSummary[] {
  return listPrivateBackupRestoreSummaries(limit);
}

export function getPrivateBackupRestoreReport(restoreId: string): PrivateBackupRestoreSummary | null {
  return getPrivateBackupRestoreById(restoreId);
}

export function registerPrivateBackupRestoreRoutes(app: Express): void {
  app.post("/api/admin/backup-import/restore/analyze", requireEnabled, requireAdminSession, express.json(), (req, res) => {
    try {
      const importId = String(req.body?.importId ?? "");
      if (!importId.trim()) return res.status(400).json({ error: "importId fehlt." });
      const session = createRestoreSession(importId.trim());
      return res.json(safeSummary(session));
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Restore-Analyse fehlgeschlagen." });
    }
  });

  app.post("/api/admin/backup-import/restore/confirm", requireEnabled, requireAdminSession, express.json(), (req, res) => {
    try {
      const restoreId = String(req.body?.restoreId ?? "");
      const session = getSession(restoreId);
      if (!session) return res.status(404).json({ error: "Restore-Sitzung nicht gefunden." });
      session.confirmed = true;
      session.confirmedAt = new Date().toISOString();
      updatePrivateBackupRestoreSummary(session.restoreId, {
        status: "restore_confirmed",
        lastCompletedPhase: "restore_confirmed",
        confirmedAt: session.confirmedAt,
        confirmSummary: { confirmedAt: session.confirmedAt, snapshotReference: session.snapshotReference },
      });
      return res.json(safeSummary(session));
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Bestätigung fehlgeschlagen." });
    }
  });

  app.post("/api/admin/backup-import/restore/apply", requireEnabled, requireAdminSession, express.json(), (req, res) => {
    try {
      const restoreId = String(req.body?.restoreId ?? "");
      const session = getSession(restoreId);
      if (!session) return res.status(404).json({ error: "Restore-Sitzung nicht gefunden." });
      if (!session.confirmed) return res.status(400).json({ error: "Restore-Bestaetigung fehlt." });
      if (String(req.header(CSRF_HEADER) ?? "") !== String(getPrivateAdminSessionCsrfToken(String(readCookie(req, AUTH_COOKIE) ?? "")) ?? "")) {
        return res.status(403).json({ error: "CSRF-Pruefung fehlgeschlagen." });
      }
      const result = withRestoreLock(session.restoreId, () => runRestore(session));
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Restore fehlgeschlagen." });
    }
  });

  app.get("/api/admin/backup-import/restore/history", requireEnabled, requireAdminSessionReadOnly, (_req, res) => {
    try {
      return res.json({ results: getPrivateBackupRestoreHistory(25) });
    } catch {
      return res.status(500).json({ error: "Restore-Historie konnte nicht geladen werden." });
    }
  });

  app.get("/api/admin/backup-import/restore/:restoreId", requireEnabled, requireAdminSessionReadOnly, (req, res) => {
    try {
      const report = getPrivateBackupRestoreReport(req.params.restoreId);
      if (!report) return res.status(404).json({ error: "Restore nicht gefunden." });
      return res.json(report);
    } catch {
      return res.status(500).json({ error: "Restore-Bericht konnte nicht geladen werden." });
    }
  });
}
