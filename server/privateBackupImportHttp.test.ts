import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "./database/connection";
import { runMigrations } from "./database/migrations";
import { analyzeBackupContent } from "./database/backupImporter";
import {
  createPrivateAdminSession,
  handlePrivateBackupAnalyzeRequest,
  handlePrivateBackupDryRunRequest,
  handlePrivateBackupApplyRequest,
  handlePrivateBackupVerifyRequest,
  assertValidBackupUpload,
  getConfiguredDatabasePath,
  isPrivateBackupImportEnabled,
  parseMultipartFile,
  getPrivateImportSession,
  getPrivateBackupImportHistory,
  getPrivateBackupImportReport,
} from "./privateBackupImportHttp";

const realBackupPath = "/home/maikhoyer/Development/SymptoChron-Import/handy-backup.json";

function multipartBody(fileName: string, content: Buffer | string, boundary = "----symptochron-boundary") {
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="backup"; filename="${fileName}"\r\n`),
    Buffer.from("Content-Type: application/json\r\n\r\n"),
    Buffer.isBuffer(content) ? content : Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

let tempDir = "";
let tempDbPath = "";
let tempBackupDir = "";

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-private-import-http-"));
  tempDbPath = path.join(tempDir, "test.db");
  tempBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-private-import-backup-"));
  process.env.ENABLE_PRIVATE_BACKUP_IMPORT = "true";
  process.env.PRIVATE_BACKUP_IMPORT_TOKEN = "secret-token";
  process.env.PRIVATE_BACKUP_IMPORT_DATABASE_PATH = tempDbPath;
  process.env.SYMPTOCHRON_DB_PATH = tempDbPath;
  process.env.SYMPTOCHRON_BACKUP_DIR = tempBackupDir;
  closeDatabase();
  runMigrations();
});

afterEach(() => {
  closeDatabase();
  delete process.env.ENABLE_PRIVATE_BACKUP_IMPORT;
  delete process.env.PRIVATE_BACKUP_IMPORT_TOKEN;
  delete process.env.PRIVATE_BACKUP_IMPORT_DATABASE_PATH;
  delete process.env.SYMPTOCHRON_DB_PATH;
  delete process.env.SYMPTOCHRON_BACKUP_DIR;
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(tempBackupDir, { recursive: true, force: true });
});

describe("private backup import helpers", () => {
  it("analysiert das echte Backup ohne Gesundheitsinhalte zu leaken", () => {
    const analysis = analyzeBackupContent(fs.readFileSync(realBackupPath));
    expect(analysis.sourceCounts.diary).toBe(52);
    expect(analysis.sourceCounts.medsTaken).toBeGreaterThan(0);
    expect(analysis.expectedTargetCounts.userDataImports).toBe(1);
    expect(analysis.blockers.length).toBe(0);
    expect(analysis.warnings.join(" ")).toContain("medsTaken");
  });

  it("parst multipart JSON-Dateien korrekt", () => {
    const { body, contentType } = multipartBody("handy-backup.json", Buffer.from("{}"));
    const file = parseMultipartFile(body, contentType);
    expect(file.filename).toBe("handy-backup.json");
    expect(file.buffer.toString("utf8")).toBe("{}");
    expect(() => assertValidBackupUpload(file)).not.toThrow();
  });

  it("blockiert nicht-JSON und zu grosse Uploads", () => {
    expect(() => assertValidBackupUpload({ filename: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("x") })).toThrow("Nur JSON-Dateien sind erlaubt.");
    expect(() => assertValidBackupUpload({ filename: "empty.json", mimeType: "application/json", buffer: Buffer.alloc(0) })).toThrow("Datei ist leer.");
    expect(() => assertValidBackupUpload({ filename: "large.json", mimeType: "application/json", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })).toThrow("Datei ist zu groß.");
  });

  it("liefert den konfigurierten Datenbankpfad und verweigert fehlende Konfiguration", () => {
    expect(getConfiguredDatabasePath()).toBe(tempDbPath);
    delete process.env.PRIVATE_BACKUP_IMPORT_DATABASE_PATH;
    delete process.env.SYMPTOCHRON_DB_PATH;
    expect(getConfiguredDatabasePath()).toContain("symptochron.db");
  });

  it("gibt die Feature-Freigabe und eine Admin-Sitzung kontrolliert aus", () => {
    expect(isPrivateBackupImportEnabled()).toBe(true);
    const session = createPrivateAdminSession("secret-token");
    expect(session.csrfToken).toBeTruthy();
  });

  it("analysiert eine Request-Payload und legt eine Import-Sitzung an", async () => {
    createPrivateAdminSession("secret-token");
    const { body, contentType } = multipartBody("handy-backup.json", fs.readFileSync(realBackupPath));
    const result = await handlePrivateBackupAnalyzeRequest({ body, headers: { "content-type": contentType } } as never);
    expect(result.importAllowed).toBe(true);
    expect(result.schemaVersion).toBe(5);
    expect(result.sourceCounts.diary).toBe(52);
    expect(result.importSessionId).toBeTruthy();
    expect(getPrivateImportSession(String(result.importSessionId))).toBeTruthy();
  });

  it("führt einen Dry-Run auf der expliziten Testdatenbank aus, ohne sie zu verändern", async () => {
    const before = fs.readFileSync(tempDbPath);
    const { body, contentType } = multipartBody("handy-backup.json", fs.readFileSync(realBackupPath));
    const analysis = await handlePrivateBackupAnalyzeRequest({ body, headers: { "content-type": contentType } } as never);
    const result = await handlePrivateBackupDryRunRequest({ body: { sessionId: analysis.importSessionId }, headers: { "content-type": "application/json" } } as never);
    const after = fs.readFileSync(tempDbPath);
    expect(Buffer.compare(before, after)).toBe(0);
    expect(result.importAllowed).toBe(true);
    expect(result.status).toBe("analyzed");
  });

  it("führt Apply und Verify über die serverseitige Import-Sitzung aus", async () => {
    const adminSession = createPrivateAdminSession("secret-token");
    const { body, contentType } = multipartBody("handy-backup.json", fs.readFileSync(realBackupPath));
    const analysis = await handlePrivateBackupAnalyzeRequest({ body, headers: { "content-type": contentType } } as never);
    await handlePrivateBackupDryRunRequest({ body: { sessionId: analysis.importSessionId }, headers: { "content-type": "application/json" } } as never);
    const apply = await handlePrivateBackupApplyRequest({
      body: { sessionId: analysis.importSessionId, confirmDryRun: true, confirmImport: true, confirmMedsTaken: true },
      header: (name: string) => (name === "x-symptochron-private-import-csrf" ? adminSession.csrfToken : ""),
      headers: {
        "content-type": "application/json",
        cookie: `symptochron_private_import_auth=${adminSession.id}`,
        "x-symptochron-private-import-csrf": adminSession.csrfToken,
      },
    } as never);
    expect(apply.status).toBe("verified");
    const verify = await handlePrivateBackupVerifyRequest({
      body: { sessionId: analysis.importSessionId },
      header: (name: string) => (name === "x-symptochron-private-import-csrf" ? adminSession.csrfToken : ""),
      headers: {
        "content-type": "application/json",
        cookie: `symptochron_private_import_auth=${adminSession.id}`,
        "x-symptochron-private-import-csrf": adminSession.csrfToken,
      },
    } as never);
    expect(verify.status).toBe("verified");
    const history = getPrivateBackupImportHistory(25);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("verified");
    expect(history[0].snapshotReference).toMatch(/symptochron-before-import-/);
    const report = getPrivateBackupImportReport(String(analysis.importId));
    expect(report?.verifySummary).toBeTruthy();
    const repeatVerify = await handlePrivateBackupVerifyRequest({
      body: { sessionId: analysis.importSessionId },
      header: (name: string) => (name === "x-symptochron-private-import-csrf" ? adminSession.csrfToken : ""),
      headers: {
        "content-type": "application/json",
        cookie: `symptochron_private_import_auth=${adminSession.id}`,
        "x-symptochron-private-import-csrf": adminSession.csrfToken,
      },
    } as never);
    expect(repeatVerify.status).toBe("verified");
    expect(getPrivateBackupImportHistory(25)).toHaveLength(1);
  });
});
