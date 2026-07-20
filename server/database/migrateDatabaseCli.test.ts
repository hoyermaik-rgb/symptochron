import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "./connection";
import { runDatabaseMigrateCli, parseDatabaseMigrateArgs } from "./migrateDatabaseCli";

let tempDir = "";
let tempDbPath = "";
let defaultDbPath = "";

function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function runSqlFile(dbPath: string, filename: string): void {
  const db = openDb(dbPath);
  try {
    const sqlPath = path.join(process.cwd(), "server", "database", "migrations", filename);
    const sql = fs.readFileSync(sqlPath, "utf8");
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec(sql);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    db.close();
  }
}

function createSchema4Database(dbPath: string): void {
  runSqlFile(dbPath, "001_initial_schema.sql");
  runSqlFile(dbPath, "002_medication_hardening.sql");
  runSqlFile(dbPath, "003_secure_app_records.sql");

  const db = openDb(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare("INSERT INTO schema_migrations (version, name) VALUES (1, 'initial medication schema')").run();
    db.prepare("INSERT INTO schema_migrations (version, name) VALUES (2, 'medication hardening')").run();
    db.prepare("INSERT INTO schema_migrations (version, name) VALUES (3, 'encrypted application records')").run();
    db.prepare("INSERT INTO schema_migrations (version, name) VALUES (4, 'central crypto metadata')").run();
  } finally {
    db.close();
  }
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-migrate-cli-"));
  tempDbPath = path.join(tempDir, "target.db");
  defaultDbPath = path.join(process.cwd(), "data", "symptochron.db");
  closeDatabase();
  createSchema4Database(tempDbPath);
});

afterEach(() => {
  closeDatabase();
  delete process.env.SYMPTOCHRON_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("database migration CLI", () => {
  it("fordert --database zwingend an", () => {
    expect(() => parseDatabaseMigrateArgs([])).toThrow(/--database/);
  });

  it("lehnt einen fehlenden Zielpfad ab", () => {
    expect(() => runDatabaseMigrateCli({ databasePath: path.join(tempDir, "missing.db") })).toThrow(/existiert nicht/);
  });

  it("lehnt eine 0-Byte-Datei ab", () => {
    const emptyDbPath = path.join(tempDir, "empty.db");
    fs.writeFileSync(emptyDbPath, "");
    expect(() => runDatabaseMigrateCli({ databasePath: emptyDbPath })).toThrow(/leer/);
  });

  it("migriert Schema 4 auf Schema 7", () => {
    const result = runDatabaseMigrateCli({ databasePath: tempDbPath });
    expect(result.databasePath).toBe(tempDbPath);
    expect(result.schemaVersionBefore).toBe(4);
    expect(result.schemaVersionAfter).toBe(7);
    expect(result.appliedMigrations).toEqual([5, 6, 7]);
    expect(result.integrityCheck).toBe("ok");
    expect(result.foreignKeyCheck).toBe("ok");
    expect(result.status).toBe("completed");

    const db = openDb(tempDbPath);
    try {
      const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
      expect(versions.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      const version4 = db.prepare("SELECT name FROM schema_migrations WHERE version = 4").get() as { name: string };
      expect(version4.name).toBe("central crypto metadata");
    } finally {
      db.close();
    }
  });

  it("wendet Migration 005, 006 und 007 nur einmal an und bleibt idempotent", () => {
    const first = runDatabaseMigrateCli({ databasePath: tempDbPath });
    const second = runDatabaseMigrateCli({ databasePath: tempDbPath });
    expect(first.appliedMigrations).toEqual([5, 6, 7]);
    expect(second.appliedMigrations).toEqual([]);

    const db = openDb(tempDbPath);
    try {
      const count = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
      expect(count.count).toBe(7);
    } finally {
      db.close();
    }
  });

  it("erhaelt bestehende Medikamentendaten und secure_app_records", () => {
    const db = openDb(tempDbPath);
    try {
      db.prepare(`
        INSERT INTO medication_sources (source_key, source_name, record_count)
        VALUES ('seed-source', 'Seed', 1)
      `).run();
      db.prepare(`
        INSERT INTO medication_products (
          source_id, source_record_id, product_name, normalized_name
        ) VALUES (1, 'seed-1', 'Testmedikament', 'testmedikament')
      `).run();
      db.prepare(`
        INSERT INTO user_medications (id, medication_product_id, custom_name, custom_dosage, created_at, updated_at)
        VALUES ('med-test-1', 1, 'Testmedikament', '10 mg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      db.prepare(`
        INSERT INTO secure_app_records (
          record_key, iv_base64, ciphertext_base64, content_length, created_at, updated_at
        ) VALUES ('record-1', 'aXY=', 'Y2lwaGVydGV4dA==', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
    } finally {
      db.close();
    }

    const result = runDatabaseMigrateCli({ databasePath: tempDbPath });
    expect(result.schemaVersionAfter).toBe(7);

    const verifyDb = openDb(tempDbPath);
    try {
      const medicationCount = verifyDb.prepare("SELECT COUNT(*) AS count FROM user_medications").get() as { count: number };
      const secureCount = verifyDb.prepare("SELECT COUNT(*) AS count FROM secure_app_records").get() as { count: number };
      expect(medicationCount.count).toBe(1);
      expect(secureCount.count).toBe(1);
    } finally {
      verifyDb.close();
    }
  });

  it("laesst die Standarddatenbank unberuehrt", () => {
    const before = fs.existsSync(defaultDbPath) ? fs.statSync(defaultDbPath).mtimeMs : null;
    runDatabaseMigrateCli({ databasePath: tempDbPath });
    const after = fs.existsSync(defaultDbPath) ? fs.statSync(defaultDbPath).mtimeMs : null;
    expect(after).toBe(before);
  });
});
