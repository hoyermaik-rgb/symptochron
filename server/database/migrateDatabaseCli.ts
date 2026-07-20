#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDatabase } from "./connection";
import { runMigrations } from "./migrations";

export interface DatabaseMigrateCliArgs {
  databasePath: string;
}

export interface DatabaseMigrateResult {
  databasePath: string;
  schemaVersionBefore: number;
  schemaVersionAfter: number;
  appliedMigrations: number[];
  integrityCheck: "ok" | string;
  foreignKeyCheck: "ok" | Array<Record<string, unknown>>;
  status: "completed";
}

function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value) && value.trim().length > 0;
}

function readDatabaseHeader(databasePath: string): Buffer {
  const fd = fs.openSync(databasePath, "r");
  try {
    const header = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, header, 0, 16, 0);
    if (bytesRead < 16) {
      throw new Error("Die Datenbankdatei ist kuerzer als der SQLite-Header.");
    }
    return header;
  } finally {
    fs.closeSync(fd);
  }
}

function assertSQLiteFile(databasePath: string): void {
  const header = readDatabaseHeader(databasePath);
  const signature = header.toString("ascii", 0, 16);
  if (signature !== "SQLite format 3\u0000") {
    throw new Error("Die Datei ist keine gueltige SQLite-Datenbank.");
  }
}

function openDatabase(databasePath: string): DatabaseSync {
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function readSchemaVersion(db: DatabaseSync): number {
  const table = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'schema_migrations'
  `).get() as { name: string } | undefined;
  if (!table) return 0;

  const row = db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number };
  return row.version ?? 0;
}

function runIntegrityCheck(db: DatabaseSync): string {
  const row = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  return row.integrity_check;
}

function runForeignKeyCheck(db: DatabaseSync): Array<Record<string, unknown>> {
  return db.prepare("PRAGMA foreign_key_check").all() as Array<Record<string, unknown>>;
}

function assertRequiredTables(db: DatabaseSync): void {
  const requiredTables = [
    "diary_entries",
    "mood_entries",
    "rls_surveys",
    "appointments",
    "blood_pressure_entries",
    "sos_profiles",
    "sos_contacts",
    "user_data_imports",
  ];
  const present = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `).all() as Array<{ name: string }>;
  const names = new Set(present.map((row) => row.name));
  const missing = requiredTables.filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new Error(`Nach Migration fehlen Tabellen: ${missing.join(", ")}`);
  }
}

export function parseDatabaseMigrateArgs(argv: string[]): DatabaseMigrateCliArgs {
  const databaseIndex = argv.indexOf("--database");
  if (databaseIndex === -1 || databaseIndex === argv.length - 1) {
    throw new Error("Das Pflichtargument --database fehlt.");
  }

  const databasePath = argv[databaseIndex + 1];
  if (!isAbsolutePath(databasePath)) {
    throw new Error("--database muss ein vollstaendiger absoluter Pfad sein.");
  }

  if (argv.some((value, index) => value === "--database" && index !== databaseIndex)) {
    throw new Error("--database darf nur einmal angegeben werden.");
  }

  return { databasePath };
}

export function runDatabaseMigrateCli(args: DatabaseMigrateCliArgs): DatabaseMigrateResult {
  const resolvedDatabasePath = path.resolve(args.databasePath);
  const previousDbPath = process.env.SYMPTOCHRON_DB_PATH;

  if (!fs.existsSync(resolvedDatabasePath)) {
    throw new Error("Die angegebene Datenbankdatei existiert nicht.");
  }

  const fileStats = fs.statSync(resolvedDatabasePath);
  if (!fileStats.isFile()) {
    throw new Error("Der angegebene Pfad verweist nicht auf eine Datei.");
  }

  if (fileStats.size <= 0) {
    throw new Error("Die angegebene Datenbankdatei ist leer.");
  }

  assertSQLiteFile(resolvedDatabasePath);

  closeDatabase();
  process.env.SYMPTOCHRON_DB_PATH = resolvedDatabasePath;

  const beforeDb = openDatabase(resolvedDatabasePath);
  try {
    const integrityBefore = runIntegrityCheck(beforeDb);
    if (integrityBefore !== "ok") {
      throw new Error(`PRAGMA integrity_check vor der Migration meldet: ${integrityBefore}`);
    }
    const schemaVersionBefore = readSchemaVersion(beforeDb);
    beforeDb.close();

    closeDatabase();
    runMigrations();
    closeDatabase();

    const afterDb = openDatabase(resolvedDatabasePath);
    try {
      const integrityAfter = runIntegrityCheck(afterDb);
      const foreignKeyCheck = runForeignKeyCheck(afterDb);
      const schemaVersionAfter = readSchemaVersion(afterDb);
      assertRequiredTables(afterDb);

      if (integrityAfter !== "ok") {
        throw new Error(`PRAGMA integrity_check nach der Migration meldet: ${integrityAfter}`);
      }

      if (foreignKeyCheck.length > 0) {
        throw new Error(`PRAGMA foreign_key_check meldet ${foreignKeyCheck.length} Problem(e).`);
      }

      const appliedMigrations = schemaVersionAfter > schemaVersionBefore
        ? Array.from({ length: schemaVersionAfter - schemaVersionBefore }, (_, index) => schemaVersionBefore + index + 1)
        : [];

      return {
        databasePath: resolvedDatabasePath,
        schemaVersionBefore,
        schemaVersionAfter,
        appliedMigrations,
        integrityCheck: "ok",
        foreignKeyCheck: "ok",
        status: "completed",
      };
    } finally {
      afterDb.close();
    }
  } finally {
    closeDatabase();
    if (previousDbPath === undefined) {
      delete process.env.SYMPTOCHRON_DB_PATH;
    } else {
      process.env.SYMPTOCHRON_DB_PATH = previousDbPath;
    }
  }
}

async function main(): Promise<void> {
  try {
    const args = parseDatabaseMigrateArgs(process.argv.slice(2));
    const result = runDatabaseMigrateCli(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void main();
