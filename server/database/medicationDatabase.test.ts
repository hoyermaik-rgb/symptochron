import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./connection";
import { runMigrations } from "./migrations";
import { createUserMedication, deleteUserMedication, listUserMedications, recordMedicationIntake } from "./repositories/userMedicationRepository";

let tempDir = "";
beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-db-"));
  process.env.SYMPTOCHRON_DB_PATH = path.join(tempDir, "test.db");
  closeDatabase();
  runMigrations();
});
afterEach(() => {
  closeDatabase();
  delete process.env.SYMPTOCHRON_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("SQLite-Medikamentenfundament", () => {
  it("führt alle Migrationen aus und aktiviert Fremdschlüssel", () => {
    const db = getDatabase();
    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{version:number}>;
    expect(versions.map(v => v.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect((db.prepare("PRAGMA foreign_keys").get() as {foreign_keys:number}).foreign_keys).toBe(1);
  });

  it("legt Nutzermedikation und Einnahme transaktional an", () => {
    const id = createUserMedication({ customName: "Testpräparat", customDosage: "10 mg", schedule: { evening: 1 } });
    expect(listUserMedications()).toHaveLength(1);
    const intakeId = recordMedicationIntake(id, new Date().toISOString(), 1, "Test");
    expect(intakeId).toBeTruthy();
    expect((getDatabase().prepare("SELECT COUNT(*) AS count FROM medication_intakes").get() as {count:number}).count).toBe(1);
  });

  it("löscht abhängige Pläne und Einnahmen per Cascade", () => {
    const id = createUserMedication({ customName: "Testpräparat", schedule: { morning: 1 } });
    recordMedicationIntake(id, new Date().toISOString(), 1);
    expect(deleteUserMedication(id)).toBe(true);
    expect((getDatabase().prepare("SELECT COUNT(*) AS count FROM medication_schedules").get() as {count:number}).count).toBe(0);
    expect((getDatabase().prepare("SELECT COUNT(*) AS count FROM medication_intakes").get() as {count:number}).count).toBe(0);
  });

  it("weist ungültige Nutzermedikation zurück", () => {
    expect(() => createUserMedication({})).toThrow(/erforderlich/);
    expect(() => createUserMedication({ customName: "X", schedule: { night: -1 } })).toThrow(/Ungültiger/);
  });
});
