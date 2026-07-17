import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | null = null;

export function getDatabasePath(): string {
  return process.env.SYMPTOCHRON_DB_PATH?.trim() || path.join(process.cwd(), "data", "symptochron.db");
}

export function getDatabase(): DatabaseSync {
  if (database) return database;

  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  database = new DatabaseSync(dbPath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA busy_timeout = 5000;");

  return database;
}

export function closeDatabase(): void {
  if (!database) return;
  database.close();
  database = null;
}
