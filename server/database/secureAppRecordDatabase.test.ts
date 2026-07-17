import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./connection";
import { runMigrations } from "./migrations";
import {
  countSecureAppRecords,
  deleteSecureAppRecord,
  getSecureAppRecord,
  upsertSecureAppRecord,
} from "./repositories/secureAppRecordRepository";

let tempDir = "";
const ivBase64 = Buffer.alloc(12, 7).toString("base64");
const ciphertextBase64 = Buffer.from("verschluesselte-testdaten").toString("base64");

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-secure-db-"));
  process.env.SYMPTOCHRON_DB_PATH = path.join(tempDir, "test.db");
  closeDatabase();
  runMigrations();
});

afterEach(() => {
  closeDatabase();
  delete process.env.SYMPTOCHRON_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("zentraler verschlüsselter App-Datenspeicher", () => {
  it("speichert ausschließlich Ciphertext und Metadaten", () => {
    const record = upsertSecureAppRecord({ recordKey: "diary", ivBase64, ciphertextBase64 });
    expect(record.recordKey).toBe("diary");
    expect(record.contentLength).toBeGreaterThan(0);
    expect(countSecureAppRecords()).toBe(1);

    const columns = getDatabase().prepare("PRAGMA table_info(secure_app_records)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).not.toContain("plaintext");
    expect(JSON.stringify(getSecureAppRecord("diary"))).not.toContain("Patient");
  });

  it("aktualisiert atomar und protokolliert Änderungen", () => {
    upsertSecureAppRecord({ recordKey: "mood", ivBase64, ciphertextBase64 });
    const changedCiphertext = Buffer.from("anderer-ciphertext").toString("base64");
    upsertSecureAppRecord({ recordKey: "mood", ivBase64, ciphertextBase64: changedCiphertext });

    expect(getSecureAppRecord("mood")?.ciphertextBase64).toBe(changedCiphertext);
    const actions = getDatabase().prepare(
      "SELECT action FROM app_data_audit_log WHERE record_key = ? ORDER BY id",
    ).all("mood") as Array<{ action: string }>;
    expect(actions.map((row) => row.action)).toEqual(["created", "updated"]);
  });

  it("löscht Datensätze und schreibt einen Audit-Eintrag", () => {
    upsertSecureAppRecord({ recordKey: "prefs", ivBase64, ciphertextBase64 });
    expect(deleteSecureAppRecord("prefs")).toBe(true);
    expect(getSecureAppRecord("prefs")).toBeNull();
    const action = getDatabase().prepare(
      "SELECT action FROM app_data_audit_log WHERE record_key = 'prefs' ORDER BY id DESC LIMIT 1",
    ).get() as { action: string };
    expect(action.action).toBe("deleted");
  });

  it("weist ungültige Schlüssel, IVs und übergroße Datensätze zurück", () => {
    expect(() => upsertSecureAppRecord({ recordKey: "../diary", ivBase64, ciphertextBase64 })).toThrow(/Datensatzschlüssel/);
    expect(() => upsertSecureAppRecord({ recordKey: "diary", ivBase64: "AA==", ciphertextBase64 })).toThrow(/12 Byte/);
    const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
    expect(() => upsertSecureAppRecord({ recordKey: "diary", ivBase64, ciphertextBase64: tooLarge })).toThrow(/zu groß/);
  });
});
