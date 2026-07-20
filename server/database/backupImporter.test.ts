import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "./connection";
import { runMigrations } from "./migrations";
import { runBackupImport, parseBackupImportArgs } from "./backupImporter";
import { DatabaseSync } from "node:sqlite";

let tempDir = "";
let backupPath = "";
let targetDbPath = "";
let snapshotPath = "";
const realBackupPath = path.join(process.cwd(), "..", "SymptoChron-Import", "handy-backup.json");

function makeBackup(overrides: Record<string, any> = {}): any {
  return {
    version: "1.0.0",
    timestamp: "2026-06-21T08:50:00.000Z",
    diary: {
      "2026-06-20": {
        morning_pain: 5,
        noon_pain: 6,
        evening_pain: 7,
        night_pain: 8,
        morning_rls: 1,
        noon_rls: 2,
        evening_rls: 3,
        night_rls: 4,
        notes: "Tag",
        sleepHours: 7.5,
        sleepQuality: 4,
        factors: { stress: true },
        painAreas: ["back-lower"],
        pressure: "normal",
        weather: "sun",
        medsTaken: ["med_1_morning"],
        medsTakenTimes: { med_1_morning: "08:00" },
        updated: "2026-06-20T18:00:00.000Z",
      },
    },
    meds: [
      {
        id: "med_1",
        name: "Medikament A",
        dose: "10mg",
        form: "Tablette",
        schedule: { morning: 1, evening: 1 },
        time: "1x morgens, 1x abends",
        thresholdDays: 7,
        source: "manual",
        active: true,
        createdAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-20T08:00:00.000Z",
      },
    ],
    mood: {
      "2026-06-20": {
        stimmung: 3,
        energie: 4,
        antrieb: 4,
        angst: 2,
        reizbarkeit: 2,
        konzentration: 3,
        hoffnungslosigkeit: 1,
        symptoms: { gruebeln: true },
        activities: { hobby: true },
        updated: "2026-06-20T18:00:00.000Z",
      },
    },
    rlsSurveys: {},
    sosData: {
      patientName: "Maik Hoyer",
      dob: "1982-07-28",
      bloodType: "A+",
      allergies: "Keine bekannt",
      diagnoses: "RLS",
      emergencyNotes: "Hinweis",
      iceContacts: [
        { id: "ice_maik_1", name: "Jeanina", phone: "+49 170 0000000", relationship: "Angehörige" },
      ],
      personal: {
        name: "Maik Hoyer",
        birthdate: "1982-07-28",
        address: "Nicht hinterlegt",
        profilePhoto: null,
      },
      medical: {
        bloodGroup: "A+",
        allergies: "Keine bekannt",
        chronicConditions: "RLS",
      },
    },
    ...overrides,
  };
}

function writeBackup(obj: any, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function prepareDb(dbPath: string): void {
  process.env.SYMPTOCHRON_DB_PATH = dbPath;
  closeDatabase();
  runMigrations();
  closeDatabase();
}

function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symptochron-backup-import-"));
  backupPath = path.join(tempDir, "backup.json");
  targetDbPath = path.join(tempDir, "target.db");
  snapshotPath = path.join(tempDir, "snapshot.db");
  writeBackup(makeBackup(), backupPath);
  prepareDb(targetDbPath);
  fs.copyFileSync(targetDbPath, snapshotPath);
});

afterEach(() => {
  closeDatabase();
  delete process.env.SYMPTOCHRON_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("SC-DB-08.2B Backup Importer", () => {
  it("akzeptiert einen gueltigen Dry-Run", async () => {
    const result = await runBackupImport({ mode: "dry-run", backupPath, databasePath: targetDbPath });
    expect(result.code).toBe(0);
    expect(result.report.status).toBe("validated");
    expect(result.report.counts.diary).toBe(1);
    expect(result.report.plannedTables).toContain("user_data_imports");
  });

  it("lehnt ungueltiges JSON ab", async () => {
    fs.writeFileSync(backupPath, "{ not json");
    const result = await runBackupImport({ mode: "dry-run", backupPath, databasePath: targetDbPath });
    expect(result.code).toBe(1);
    expect(result.report.errors.join(" ")).toContain("JSON");
  });

  it("meldet unbekannte Felder als Warnung", async () => {
    writeBackup(makeBackup({ extra_top: true, diary: { "2026-06-20": { foo: "bar" } } }), backupPath);
    const result = await runBackupImport({ mode: "dry-run", backupPath, databasePath: targetDbPath });
    expect(result.report.warnings.join(" ")).toContain("Unbekanntes Top-Level-Feld");
    expect(result.report.warnings.join(" ")).toContain("Unbekanntes diary-Feld");
  });

  it("blockiert apply bei identischem source_hash", async () => {
    const first = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath });
    expect(first.code).toBe(0);
    const second = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath });
    expect(second.code).toBe(1);
    expect(second.report.errors.join(" ")).toContain("source_hash");
  });

  it("matched einen identischen Zieldatensatz", async () => {
    const variantBackupPath = path.join(tempDir, "variant.json");
    writeBackup(makeBackup({ extraField: "kept-for-hash-change" }), variantBackupPath);

    const first = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath });
    expect(first.code).toBe(0);

    const second = await runBackupImport({ mode: "apply", backupPath: variantBackupPath, databasePath: targetDbPath, snapshotPath });
    expect(second.code).toBe(0);
    expect(second.report.matchedIds.diary).toContain("2026-06-20");
    expect(second.report.matchedIds.meds).toContain("med_1");
  });

  it("meldet Konflikte bei abweichendem Zieldatensatz", async () => {
    const db = openDb(targetDbPath);
    db.prepare(`
      INSERT INTO diary_entries (
        entry_date, morning_pain, noon_pain, evening_pain, night_pain,
        morning_rls, noon_rls, evening_rls, night_rls, notes, sleep_hours,
        sleep_quality, factors_json, meds_taken_json, meds_taken_times_json,
        pain_areas_json, pressure, weather, additional_data_json, source_import_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "2026-06-20", 9, 9, 9, 9, 9, 9, 9, 9, "Andere", 1, 1,
      JSON.stringify({ stress: false }),
      JSON.stringify([]),
      JSON.stringify({}),
      JSON.stringify([]),
      "high",
      "rain",
      JSON.stringify({}),
      null,
    );
    db.close();

    const result = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath });
    expect(result.code).toBe(1);
    expect(result.report.errors.join(" ")).toContain("Konflikt");
  });

  it("blockiert fehlende Medikamentenreferenzen in medsTaken", async () => {
    writeBackup(makeBackup({
      diary: {
        "2026-06-20": { ...makeBackup().diary["2026-06-20"], medsTaken: ["unknown_med_morning"] },
      },
    }), backupPath);
    const result = await runBackupImport({ mode: "dry-run", backupPath, databasePath: targetDbPath });
    expect(result.code).toBe(1);
    expect(result.report.errors.join(" ")).toContain("unbekanntes Medikament");
  });

  it("akzeptiert die reale historische Mood-Skala 0 bis 5 aus dem Backup", async () => {
    const result = await runBackupImport({ mode: "dry-run", backupPath: realBackupPath, databasePath: targetDbPath });
    expect(result.code).toBe(0);
    expect(result.report.errors.join(" ")).not.toContain("Mood");
    expect(result.report.errors.join(" ")).not.toContain("Skala");
  });

  it("blockiert Mood-Werte ausserhalb der historischen Skala vor der Transaktion", async () => {
    writeBackup(makeBackup({
      mood: {
        "2026-06-20": {
          stimmung: 3,
          energie: 4,
          antrieb: 6,
          angst: 2,
          reizbarkeit: 2,
          konzentration: 3,
          hoffnungslosigkeit: 1,
        },
      },
    }), backupPath);

    const result = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath });
    expect(result.code).toBe(1);
    expect(result.report.errors.join(" ")).toContain("liegt ausserhalb der historischen Skala 0-5");
    const db = openDb(targetDbPath);
    try {
      const counts = {
        diary: db.prepare("SELECT COUNT(*) AS count FROM diary_entries").get() as { count: number },
        mood: db.prepare("SELECT COUNT(*) AS count FROM mood_entries").get() as { count: number },
        imports: db.prepare("SELECT COUNT(*) AS count FROM user_data_imports").get() as { count: number },
      };
      expect(counts.diary.count).toBe(0);
      expect(counts.mood.count).toBe(0);
      expect(counts.imports.count).toBe(0);
    } finally {
      db.close();
    }
  });

  it("behandelt leere rlsSurveys als 0 Datensaetze", async () => {
    const result = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath });
    expect(result.code).toBe(0);
    expect(result.report.counts.rlsSurveys).toBe(0);
  });

  it("blockiert apply ohne Snapshot", async () => {
    const result = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath });
    expect(result.code).toBe(1);
    expect(result.report.errors.join(" ")).toContain("Snapshot-Pfad");
  });

  it("blockiert einen leeren Snapshot", async () => {
    const emptySnapshot = path.join(tempDir, "empty.db");
    fs.writeFileSync(emptySnapshot, "");
    const result = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath: emptySnapshot });
    expect(result.code).toBe(1);
    expect(result.report.errors.join(" ")).toContain("Snapshot ist leer");
  });

  it("blockiert einen ungueltigen Snapshot", async () => {
    const invalidSnapshot = path.join(tempDir, "invalid.db");
    fs.writeFileSync(invalidSnapshot, "not a sqlite db");
    const result = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath: invalidSnapshot });
    expect(result.code).toBe(1);
  });

  it("erkennt fehlende IDs und Count-Abweichungen im Verify", async () => {
    const applyResult = await runBackupImport({ mode: "apply", backupPath, databasePath: targetDbPath, snapshotPath });
    expect(applyResult.code).toBe(0);
    const db = openDb(targetDbPath);
    db.prepare("DELETE FROM mood_entries WHERE entry_date = ?").run("2026-06-20");
    db.close();

    const verifyResult = await runBackupImport({ mode: "verify", backupPath, databasePath: targetDbPath });
    expect(verifyResult.code).toBe(1);
    expect(verifyResult.report.errors.join(" ")).toContain("Verify-Checks");
  });

  it("enthaelt keine DELETE-Statements im Importpfad", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "server", "database", "backupImporter.ts"), "utf8");
    expect(source).not.toMatch(/DELETE FROM/i);
  });

  it("parst die CLI-Argumente", () => {
    const args = parseBackupImportArgs([
      "--mode", "dry-run",
      "--backup", backupPath,
      "--database", targetDbPath,
      "--allow-empty",
    ]);
    expect(args.mode).toBe("dry-run");
    expect(args.allowEmpty).toBe(true);
  });
});
