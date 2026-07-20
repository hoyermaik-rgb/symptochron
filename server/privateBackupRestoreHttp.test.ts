import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "./database/connection";
import { runMigrations } from "./database/migrations";
import { createUserDataImport } from "./database/repositories/backupImportRepository";
import { upsertPrivateBackupImportSummary } from "./database/repositories/privateBackupImportRepository";
import { analyzePrivateBackupRestore, applyPrivateBackupRestore, confirmPrivateBackupRestore, getPrivateBackupRestoreReport } from "./privateBackupRestoreHttp";

let tempDir = "";
let liveDbPath = "";
let backupDir = "";
let liveSnapshotPath = "";

function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function seedSnapshotSource(snapshotDbPath: string): void {
  const previous = process.env.SYMPTOCHRON_DB_PATH;
  process.env.SYMPTOCHRON_DB_PATH = snapshotDbPath;
  closeDatabase();
  runMigrations();
  const db = openDb(snapshotDbPath);
  try {
    db.exec("BEGIN IMMEDIATE;");
    db.prepare(`
      INSERT INTO diary_entries (
        entry_date, morning_pain, noon_pain, evening_pain, night_pain,
        morning_rls, noon_rls, evening_rls, night_rls, notes, sleep_hours,
        sleep_quality, factors_json, meds_taken_json, meds_taken_times_json,
        pain_areas_json, pressure, weather, additional_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "2026-06-20",
      1, 1, 1, 1, 1, 1, 1, 1,
      "Snapshot",
      7,
      4,
      JSON.stringify({ stress: true }),
      JSON.stringify([]),
      JSON.stringify({}),
      JSON.stringify([]),
      "normal",
      "sun",
      JSON.stringify({}),
    );
    db.exec("COMMIT;");
  } finally {
    db.close();
    if (previous) process.env.SYMPTOCHRON_DB_PATH = previous;
    else delete process.env.SYMPTOCHRON_DB_PATH;
    closeDatabase();
  }
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-restore-http-"));
  liveDbPath = path.join(tempDir, "live.db");
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-restore-backup-"));
  liveSnapshotPath = path.join(backupDir, "restore-snapshot.db");
  process.env.SYMPTOCHRON_DB_PATH = liveDbPath;
  process.env.SYMPTOCHRON_BACKUP_DIR = backupDir;
  process.env.ENABLE_PRIVATE_BACKUP_IMPORT = "true";
  process.env.PRIVATE_BACKUP_IMPORT_TOKEN = "secret-token";
  closeDatabase();
  runMigrations();
  seedSnapshotSource(liveSnapshotPath);
  const liveDb = openDb(liveDbPath);
  try {
    liveDb.prepare(`
      INSERT INTO diary_entries (
        entry_date, morning_pain, noon_pain, evening_pain, night_pain,
        morning_rls, noon_rls, evening_rls, night_rls, notes, sleep_hours,
        sleep_quality, factors_json, meds_taken_json, meds_taken_times_json,
        pain_areas_json, pressure, weather, additional_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "2026-06-19",
      9, 9, 9, 9, 9, 9, 9, 9,
      "Live",
      3,
      1,
      JSON.stringify({ stress: false }),
      JSON.stringify([]),
      JSON.stringify({}),
      JSON.stringify([]),
      "high",
      "rain",
      JSON.stringify({}),
    );
  } finally {
    liveDb.close();
  }
  createUserDataImport({
    id: "import-restore-1",
    importVersion: "sc-db-08.2b",
    sourceBackupVersion: "1.0.0",
    sourceHash: "restore-hash-1",
    sourceTimestamp: "2026-07-18T10:00:00.000Z",
    targetSchemaVersion: 7,
    mode: "apply",
    status: "verified",
    counts: { diary: 1 },
    importedIds: { diary: ["2026-06-20"] },
    warnings: [],
    errors: [],
    snapshotPath: path.basename(liveSnapshotPath),
    rollbackStatus: "available",
  });
  upsertPrivateBackupImportSummary({
    importId: "import-restore-1",
    sourceHash: "restore-hash-1",
    sourceFilename: "restore-snapshot.db",
    sourceSizeBytes: fs.statSync(liveSnapshotPath).size,
    sourceBackupVersion: "1.0.0",
    sourceSchemaVersion: 7,
    status: "verified",
    lastCompletedPhase: "verified",
    snapshotReference: path.basename(liveSnapshotPath),
    analysisSummary: { snapshotReference: path.basename(liveSnapshotPath) },
    dryRunSummary: {},
    applySummary: {},
    verifySummary: {},
  });
});

afterEach(() => {
  closeDatabase();
  delete process.env.SYMPTOCHRON_DB_PATH;
  delete process.env.SYMPTOCHRON_BACKUP_DIR;
  delete process.env.ENABLE_PRIVATE_BACKUP_IMPORT;
  delete process.env.PRIVATE_BACKUP_IMPORT_TOKEN;
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
});

describe("private backup restore", () => {
  it("analysiert, bestaetigt und stellt einen Snapshot wieder her", () => {
    const analysis = analyzePrivateBackupRestore("import-restore-1");
    expect(analysis.restoreId).toBeTruthy();
    expect((analysis.analysis as { restoreAllowed?: boolean }).restoreAllowed).toBe(true);
    const confirmed = confirmPrivateBackupRestore(String(analysis.restoreId));
    expect((confirmed as { confirmed?: boolean }).confirmed).toBe(true);
    const result = applyPrivateBackupRestore(String(analysis.restoreId));
    expect(result.status).toBe("restore_verified");
    const report = getPrivateBackupRestoreReport(String(analysis.restoreId));
    expect(report?.verifySummary).toBeTruthy();
    const db = openDb(liveDbPath);
    try {
      const count = db.prepare("SELECT COUNT(*) AS count FROM diary_entries").get() as { count: number };
      expect(count.count).toBe(1);
    } finally {
      db.close();
    }
  });

  it("lehnt unbekannte oder manipulierbare Snapshots ab", () => {
    const db = openDb(liveDbPath);
    db.exec("BEGIN IMMEDIATE;");
    db.prepare(`INSERT INTO private_backup_import_history (
      import_id, status, last_completed_phase, source_filename, source_size_bytes,
      source_backup_version, source_schema_version, analysis_summary_json, dry_run_summary_json,
      apply_summary_json, verify_summary_json, snapshot_reference, error_category,
      error_message, source_hash
    ) VALUES (?, 'verified', 'verified', 'x', 1, '1.0.0', 7, '{}', '{}', '{}', '{}', ?, NULL, NULL, 'hash')`)
      .run("import-bad", "../escape.db");
    db.exec("COMMIT;");
    db.close();
    expect(() => analyzePrivateBackupRestore("import-bad")).toThrow();
  });

  it("blockiert eine zukuenftige Schema-Version", () => {
    const futureDbPath = path.join(tempDir, "future.db");
    fs.copyFileSync(liveSnapshotPath, futureDbPath);
    const db = openDb(futureDbPath);
    try {
      db.prepare("UPDATE schema_migrations SET version = 99 WHERE version = (SELECT MAX(version) FROM schema_migrations)").run();
    } finally {
      db.close();
    }
    const futureRef = "future.db";
    fs.copyFileSync(futureDbPath, path.join(backupDir, futureRef));
    const db2 = openDb(liveDbPath);
    try {
      db2.prepare(`
        INSERT INTO private_backup_import_history (
          import_id, status, last_completed_phase, source_filename, source_size_bytes,
          source_backup_version, source_schema_version, analysis_summary_json, dry_run_summary_json,
          apply_summary_json, verify_summary_json, snapshot_reference, error_category,
          error_message, source_hash
        ) VALUES (?, 'verified', 'verified', 'x', 1, '1.0.0', 7, '{}', '{}', '{}', '{}', ?, NULL, NULL, 'hash-future')
      `).run("import-future", futureRef);
    } finally {
      db2.close();
    }
    upsertPrivateBackupImportSummary({
      importId: "import-future",
      sourceHash: "hash-future",
      sourceFilename: "future.db",
      sourceSizeBytes: fs.statSync(path.join(backupDir, futureRef)).size,
      sourceBackupVersion: "1.0.0",
      sourceSchemaVersion: 7,
      status: "verified",
      lastCompletedPhase: "verified",
      snapshotReference: futureRef,
      analysisSummary: { snapshotReference: futureRef },
      dryRunSummary: {},
      applySummary: {},
      verifySummary: {},
    });
    expect(() => analyzePrivateBackupRestore("import-future")).toThrow();
  });
});
