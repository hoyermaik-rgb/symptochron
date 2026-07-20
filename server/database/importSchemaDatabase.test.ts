import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./connection";
import { runMigrations } from "./migrations";
import {
  countAppointments,
  countBloodPressureEntries,
  countDiaryEntries,
  countMoodEntries,
  countRlsSurveys,
  countSosContacts,
  countSosProfiles,
  countUserDataImports,
  createAppointment,
  createBloodPressureEntry,
  createDiaryEntry,
  createMoodEntry,
  createRlsSurvey,
  createSosContact,
  createSosProfile,
  createUserDataImport,
  getActiveSosProfile,
  getDiaryEntry,
  getMoodEntry,
  getRlsSurvey,
  getUserDataImportByHash,
  verifyUserDataImport,
} from "./repositories/backupImportRepository";

let tempDir = "";

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-import-schema-"));
  process.env.SYMPTOCHRON_DB_PATH = path.join(tempDir, "test.db");
  closeDatabase();
  runMigrations();
});

afterEach(() => {
  closeDatabase();
  delete process.env.SYMPTOCHRON_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("SC-DB-08.2A Import-Schema", () => {
  it("legt die neue Migration auf leerer Datenbank an", () => {
    const db = getDatabase();
    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `).all() as Array<{ name: string }>;
    const names = tables.map((row) => row.name);
    expect(names).toEqual(expect.arrayContaining([
      "diary_entries",
      "mood_entries",
      "rls_surveys",
      "appointments",
      "blood_pressure_entries",
      "sos_profiles",
      "sos_contacts",
      "user_data_imports",
    ]));
  });

  it("ist bei wiederholtem Anwenden der Migration idempotent", () => {
    runMigrations();
    runMigrations();
    const versions = getDatabase().prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
    expect(versions.count).toBe(7);
  });

  it("verhindert doppelte Importmanifeste und akzeptiert validen JSON-Inhalt", () => {
    const first = createUserDataImport({
      importVersion: "sc-db-08.2a",
      sourceBackupVersion: "1.0.0",
      sourceHash: "hash-1",
      sourceTimestamp: "2026-06-21T08:50:00.000Z",
      targetSchemaVersion: 5,
      mode: "dry-run",
      status: "validated",
      counts: { diary: 52, meds: 15 },
      importedIds: { diary: ["2026-06-20"] },
      warnings: [],
      errors: [],
      snapshotPath: "/snapshots/symptochron.db",
      rollbackStatus: "available",
    });

    expect(first.sourceHash).toBe("hash-1");
    expect(countUserDataImports()).toBe(1);
    expect(getUserDataImportByHash("hash-1")).not.toBeNull();
    expect(verifyUserDataImport("hash-1")).toBe(true);

    expect(() => createUserDataImport({
      importVersion: "sc-db-08.2a",
      sourceBackupVersion: "1.0.0",
      sourceHash: "hash-1",
      sourceTimestamp: "2026-06-21T08:50:00.000Z",
      targetSchemaVersion: 5,
      mode: "dry-run",
      status: "validated",
      counts: { diary: 52 },
      importedIds: { diary: ["2026-06-20"] },
      warnings: [],
      errors: [],
    })).toThrow(/UNIQUE|unique|constraint/i);
  });

  it("validiert JSON-Spalten und lehnt ungueltige JSON-Werte ab", () => {
    const db = getDatabase();
    expect(() => db.prepare(`
      INSERT INTO user_data_imports (
        id, import_version, source_backup_version, source_hash, source_timestamp,
        target_schema_version, mode, status, counts_json, imported_ids_json,
        warnings_json, errors_json, rollback_status
      ) VALUES ('bad', 'sc-db-08.2a', '1.0.0', 'hash-json', '2026-06-21T08:50:00.000Z',
        4, 'dry-run', 'validated', 'not-json', '{}', '[]', '[]', 'not_started')
    `).run()).toThrow();

    expect(() => db.prepare(`
      INSERT INTO diary_entries (
        entry_date, factors_json, meds_taken_json, meds_taken_times_json,
        pain_areas_json, additional_data_json
      ) VALUES ('2026-06-20', 'not-json', '[]', '{}', '[]', '{}')
    `).run()).toThrow();
  });

  it("wahrt Fremdschluessel und verhindert unkontrollierte Datenverluste", () => {
    expect(() => createDiaryEntry({
      entryDate: "2026-06-20",
      morningPain: 5,
      sleepHours: 7,
      factors: { stress: true },
      medsTaken: ["med_1"],
      painAreas: ["back-lower"],
      additionalData: { weather: "sun" },
      sourceImportId: "missing-import",
    })).toThrow();

    expect(() => createSosContact({
      profileId: "missing-profile",
      name: "Kontakt",
      phone: "+49 170 0000000",
    })).toThrow();
  });

  it("akzeptiert gueltige Diary-, Mood-, Survey-, Termin-, Blutdruck- und SOS-Datensaetze", () => {
    const importId = createUserDataImport({
      importVersion: "sc-db-08.2a",
      sourceBackupVersion: "1.0.0",
      sourceHash: "hash-2",
      sourceTimestamp: "2026-06-21T08:50:00.000Z",
      targetSchemaVersion: 5,
      mode: "apply",
      status: "validated",
      counts: { diary: 1 },
      importedIds: { diary: ["2026-06-20"] },
      warnings: [],
      errors: [],
      rollbackStatus: "available",
    }).id;

    createDiaryEntry({
      entryDate: "2026-06-20",
      morningPain: 5,
      noonPain: 6,
      eveningPain: 7,
      nightPain: 8,
      morningRls: 1,
      noonRls: 2,
      eveningRls: 3,
      nightRls: 4,
      notes: "Test",
      sleepHours: 7.5,
      sleepQuality: 4,
      factors: { stress: true },
      medsTaken: ["med_1_morning"],
      medsTakenTimes: { med_1_morning: "08:00" },
      painAreas: ["back-lower"],
      pressure: "normal",
      weather: "sun",
      additionalData: { origin: "backup" },
      sourceImportId: importId,
    });
    createMoodEntry({
      entryDate: "2026-06-20",
      stimmung: 0,
      energie: 5,
      antrieb: 0,
      angst: 5,
      reizbarkeit: 0,
      konzentration: 5,
      hoffnungslosigkeit: 0,
      notes: "Mood",
      symptoms: { gruebeln: true },
      activities: { hobby: true },
      sourceImportId: importId,
    });
    const surveyId = createRlsSurvey({
      surveyDate: "2026-06-20",
      answers: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
      score: 30,
      freetext: "Text",
      extra: { source: "backup" },
      sourceImportId: importId,
    });
    const apptId = createAppointment({
      appointmentAt: "2026-06-20T10:30:00.000Z",
      title: "Arzttermin",
      description: "Kontrolle",
      location: "Praxis",
      status: "planned",
      sourceImportId: importId,
    });
    const bpId = createBloodPressureEntry({
      measuredAt: "2026-06-20T08:15:00.000Z",
      systolic: 124,
      diastolic: 80,
      pulse: 70,
      note: "morgens",
      sourceImportId: importId,
    });
    const profileId = createSosProfile({
      id: "sos-profile-1",
      isActive: true,
      patientName: "Maik",
      birthdate: "1982-07-28",
      address: "Nicht hinterlegt",
      bloodGroup: "A+",
      allergies: "Keine bekannt",
      chronicConditions: "RLS",
      diagnosesText: "RLS",
      emergencyNotes: "Hinweis",
      profilePhotoRef: null,
      sourceImportId: importId,
    });
    const contactId = createSosContact({
      profileId,
      externalContactId: "ice-1",
      name: "Jeanina",
      phone: "+49 170 0000000",
      relationship: "Angehörige",
      sourceImportId: importId,
    });

    expect(getDiaryEntry("2026-06-20")).not.toBeNull();
    expect(getMoodEntry("2026-06-20")).not.toBeNull();
    expect(getRlsSurvey(surveyId)).not.toBeNull();
    expect(countAppointments()).toBe(1);
    expect(countBloodPressureEntries()).toBe(1);
    expect(countSosProfiles()).toBe(1);
    expect(countSosContacts()).toBe(1);
    expect(getActiveSosProfile()).not.toBeNull();
    expect(apptId).toBeTruthy();
    expect(bpId).toBeTruthy();
    expect(contactId).toBeTruthy();
  });

  it("veraendert bestehende Medikamenten- und Secure-App-Tabellen nicht", () => {
    const db = getDatabase();
    const medBefore = db.prepare("SELECT COUNT(*) AS count FROM medication_products").get() as { count: number };
    const secureBefore = db.prepare("SELECT COUNT(*) AS count FROM secure_app_records").get() as { count: number };
    expect(medBefore.count).toBe(0);
    expect(secureBefore.count).toBe(0);

    const colsMed = db.prepare("PRAGMA table_info(medication_products)").all() as Array<{ name: string }>;
    const colsSecure = db.prepare("PRAGMA table_info(secure_app_records)").all() as Array<{ name: string }>;
    expect(colsMed.map((c) => c.name)).toEqual(expect.arrayContaining(["product_name", "pzn", "verification_status"]));
    expect(colsSecure.map((c) => c.name)).toEqual(expect.arrayContaining(["record_key", "iv_base64", "ciphertext_base64"]));
    expect(colsSecure.map((c) => c.name)).not.toContain("plaintext");
  });
});
