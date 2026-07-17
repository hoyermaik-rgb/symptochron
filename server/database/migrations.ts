import fs from "fs";
import path from "path";
import { getDatabase } from "./connection";

interface MigrationDefinition {
  version: number;
  name: string;
  filename: string;
}

const migrations: MigrationDefinition[] = [
  { version: 1, name: "initial medication schema", filename: "001_initial_schema.sql" },
  { version: 2, name: "medication hardening", filename: "002_medication_hardening.sql" },
  { version: 3, name: "encrypted application records", filename: "003_secure_app_records.sql" },
];

export function runMigrations(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const hasMigration = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (hasMigration.get(migration.version)) continue;

    const sqlPath = path.join(process.cwd(), "server", "database", "migrations", migration.filename);
    const sql = fs.readFileSync(sqlPath, "utf8");

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec(sql);
      recordMigration.run(migration.version, migration.name);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  }
}
