import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { isValidPzn } from "../../src/utils";

export type ImportMode = "dry-run" | "apply" | "verify" | "rollback";

export interface BackupImportCliArgs {
  mode: ImportMode;
  backupPath: string;
  databasePath: string;
  snapshotPath?: string;
  importId?: string;
  allowEmpty?: boolean;
  reportPath?: string;
}

export interface ImportReport {
  importId: string;
  sourceHash: string;
  sourceBackupVersion: string;
  sourceTimestamp: string;
  mode: ImportMode;
  status: "pending" | "validated" | "applied" | "verified" | "failed" | "rolled_back";
  counts: Record<string, number>;
  importedIds: Record<string, string[]>;
  matchedIds: Record<string, string[]>;
  warnings: string[];
  errors: string[];
  startedAt: string;
  completedAt: string | null;
  databasePath: string;
  snapshotPath: string | null;
  plannedTables?: string[];
  conflicts?: string[];
  blockers?: string[];
  expectedImportId?: string;
  verificationChecks?: Record<string, { status: "passed" | "failed"; expected?: unknown; actual?: unknown; message?: string }>;
}

type JsonValue = Record<string, any>;

interface ParsedBackup {
  version: string;
  timestamp: string;
  diary: Record<string, any>;
  meds: any[];
  mood: Record<string, any>;
  rlsSurveys?: Record<string, any>;
  sosData?: Record<string, any>;
  [key: string]: any;
}

function sha256FileSync(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function canonicalize(value: any): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function openDatabase(databasePath: string): DatabaseSync {
  if (!databasePath || !path.isAbsolute(databasePath)) {
    throw new Error("Ein expliziter absoluter --database-Pfad ist erforderlich.");
  }
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  return db;
}

function assertReadableFile(filePath: string, label: string): void {
  if (!filePath || !path.isAbsolute(filePath)) throw new Error(`${label} muss als absoluter Pfad angegeben werden.`);
  if (!fs.existsSync(filePath)) throw new Error(`${label} existiert nicht.`);
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`${label} ist keine Datei.`);
}

function parseDateLike(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} fehlt oder ist ungueltig.`);
  return value;
}

function validateDateKey(key: string, field: string, errors: string[]): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) errors.push(`${field} hat ein ungueltiges Datumsformat: ${key}`);
}

function validateMoodValue(value: unknown, fieldPath: string, errors: string[]): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${fieldPath} muss eine ganze Zahl sein.`);
    return;
  }
  if (value < 0 || value > 5) {
    errors.push(`${fieldPath} liegt ausserhalb der historischen Skala 0-5.`);
  }
}

function countMedicationSchedules(parsed: ParsedBackup): number {
  let total = 0;
  for (const med of parsed.meds ?? []) {
    const schedule = med?.schedule;
    if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) continue;
    for (const slot of ["morning", "noon", "evening", "night"]) {
      const value = Number(schedule?.[slot] ?? 0);
      if (Number.isFinite(value) && value > 0) total += 1;
    }
  }
  return total;
}

function countMedicationIntakeAmbiguities(parsed: ParsedBackup): number {
  return countDiaryMedsTaken(parsed);
}

function collectUnknownKeys(source: JsonValue, allowed: Set<string>, prefix = ""): string[] {
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (!allowed.has(key)) unknown.push(prefix ? `${prefix}.${key}` : key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // recurse only for known structured nodes handled separately by caller
    }
  }
  return unknown;
}

function toMedSchedule(schedule: any): Record<string, number> {
  const result: Record<string, number> = {};
  for (const slot of ["morning", "noon", "evening", "night"]) {
    const value = Number(schedule?.[slot] ?? 0);
    if (Number.isFinite(value) && value > 0) result[slot] = value;
  }
  return result;
}

function deterministicId(prefix: string, ...parts: Array<string | number | null | undefined>): string {
  const payload = parts.map((p) => String(p ?? "")).join("|");
  return `${prefix}_${createHash("sha256").update(payload).digest("hex").slice(0, 16)}`;
}

function loadBackup(backupPath: string): { parsed: ParsedBackup; raw: Buffer; sourceHash: string } {
  assertReadableFile(backupPath, "Backup-Datei");
  const raw = fs.readFileSync(backupPath);
  const parsed = parseBackupBuffer(raw);
  return {
    parsed,
    raw,
    sourceHash: createHash("sha256").update(raw).digest("hex"),
  };
}

function parseBackupBuffer(raw: Buffer): ParsedBackup {
  try {
    return JSON.parse(raw.toString("utf8")) as ParsedBackup;
  } catch {
    throw new Error("Backup ist kein gueltiges JSON.");
  }
}

function validateBackup(parsed: ParsedBackup, allowEmpty = false): { errors: string[]; warnings: string[]; blockers: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { errors: ["Backup ist kein Objekt."], warnings, blockers: ["invalid_json"] };
  }
  if (typeof parsed.version !== "string" || !parsed.version.startsWith("1.")) {
    errors.push(`Inkompatible oder fehlende Backup-Version: ${String(parsed.version ?? "")}`);
  }
  parseDateLike(parsed.timestamp, "timestamp");

  const topAllowed = new Set(["version", "timestamp", "diary", "meds", "mood", "rlsSurveys", "sosData"]);
  for (const key of Object.keys(parsed)) {
    if (!topAllowed.has(key)) warnings.push(`Unbekanntes Top-Level-Feld: ${key}`);
  }

  if (!parsed.diary || typeof parsed.diary !== "object" || Array.isArray(parsed.diary)) {
    errors.push("diary fehlt oder ist ungueltig.");
  }
  if (!Array.isArray(parsed.meds)) {
    errors.push("meds fehlt oder ist ungueltig.");
  }
  if (!parsed.mood || typeof parsed.mood !== "object" || Array.isArray(parsed.mood)) {
    errors.push("mood fehlt oder ist ungueltig.");
  }
  if (parsed.rlsSurveys && (typeof parsed.rlsSurveys !== "object" || Array.isArray(parsed.rlsSurveys))) {
    errors.push("rlsSurveys ist ungueltig.");
  }
  if (!parsed.sosData || typeof parsed.sosData !== "object" || Array.isArray(parsed.sosData)) {
    errors.push("sosData fehlt oder ist ungueltig.");
  }

  for (const [dateKey, entry] of Object.entries(parsed.diary ?? {})) {
    validateDateKey(dateKey, "diary", errors);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`diary.${dateKey} ist ungueltig.`);
      continue;
    }
    const allowed = new Set([
      "morning_pain","noon_pain","evening_pain","night_pain","morning_rls","noon_rls","evening_rls","night_rls",
      "notes","sleepHours","sleepQuality","factors","painAreas","weather","pressure","medsTaken","medsTakenTimes","updated"
    ]);
    for (const key of Object.keys(entry)) {
      if (!allowed.has(key)) warnings.push(`Unbekanntes diary-Feld ${dateKey}.${key}`);
    }
    if (entry.medsTaken !== undefined && !Array.isArray(entry.medsTaken)) errors.push(`diary.${dateKey}.medsTaken muss Array sein.`);
  }

  for (const [dateKey, entry] of Object.entries(parsed.mood ?? {})) {
    validateDateKey(dateKey, "mood", errors);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`mood.${dateKey} ist ungueltig.`);
      continue;
    }
    const allowed = new Set(["stimmung","energie","antrieb","angst","reizbarkeit","konzentration","hoffnungslosigkeit","notes","symptoms","activities","updated"]);
    for (const key of Object.keys(entry)) {
      if (!allowed.has(key)) warnings.push(`Unbekanntes mood-Feld ${dateKey}.${key}`);
    }
    for (const field of ["stimmung", "energie", "antrieb", "angst", "reizbarkeit", "konzentration", "hoffnungslosigkeit"]) {
      validateMoodValue((entry as Record<string, unknown>)[field], `mood.${dateKey}.${field}`, errors);
    }
  }

  if ((parsed.rlsSurveys ?? null) && typeof parsed.rlsSurveys === "object") {
    for (const [dateKey, entry] of Object.entries(parsed.rlsSurveys ?? {})) {
      validateDateKey(dateKey, "rlsSurveys", errors);
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) errors.push(`rlsSurveys.${dateKey} ist ungueltig.`);
    }
  }

  const sos = parsed.sosData ?? {};
  const sosAllowed = new Set(["patientName","dob","bloodType","allergies","diagnoses","emergencyNotes","iceContacts","personal","medical","documents","emergencyContacts","metadata"]);
  for (const key of Object.keys(sos)) {
    if (!sosAllowed.has(key)) warnings.push(`Unbekanntes sosData-Feld: ${key}`);
  }
  if (sos.personal && typeof sos.personal === "object") {
    for (const key of Object.keys(sos.personal)) {
      if (!new Set(["name","birthdate","address","profilePhoto"]).has(key)) warnings.push(`Unbekanntes sosData.personal-Feld: ${key}`);
    }
  }
  if (sos.medical && typeof sos.medical === "object") {
    for (const key of Object.keys(sos.medical)) {
      if (!new Set(["bloodGroup","allergies","chronicConditions"]).has(key)) warnings.push(`Unbekanntes sosData.medical-Feld: ${key}`);
    }
  }
  if (Array.isArray(sos.iceContacts)) {
    for (let i = 0; i < sos.iceContacts.length; i += 1) {
      const c = sos.iceContacts[i];
      if (!c || typeof c !== "object" || Array.isArray(c)) errors.push(`sosData.iceContacts[${i}] ist ungueltig.`);
      else {
        for (const key of Object.keys(c)) {
          if (!new Set(["id","name","phone","relationship"]).has(key)) warnings.push(`Unbekanntes sosData.iceContacts[${i}]-Feld: ${key}`);
        }
      }
    }
  }

  if (!allowEmpty && Array.isArray(parsed.meds) && parsed.meds.length === 0) errors.push("meds darf nicht leer sein.");

  const ambiguousIntakes = countMedicationIntakeAmbiguities(parsed);
  if (ambiguousIntakes > 0) {
    warnings.push(`${ambiguousIntakes} diary.medsTaken-Einträge können nicht eindeutig als medication_intakes importiert werden, weil keine eindeutigen Einnahmezeiten vorliegen.`);
  }

  for (let i = 0; i < (parsed.meds ?? []).length; i += 1) {
    const med = parsed.meds[i];
    if (!med || typeof med !== "object" || Array.isArray(med)) {
      errors.push(`meds[${i}] ist ungueltig.`);
      continue;
    }
    if (!med.id) warnings.push(`meds[${i}] hat keine ID und wird deterministisch erzeugt.`);
    if (!med.name || typeof med.name !== "string") errors.push(`meds[${i}].name fehlt.`);
    if (!med.dose || typeof med.dose !== "string") errors.push(`meds[${i}].dose fehlt.`);
    if (med.pzn && !isValidPzn(String(med.pzn))) errors.push(`meds[${i}].pzn hat ungueltige Prüfziffer.`);
    if (med.schedule && (typeof med.schedule !== "object" || Array.isArray(med.schedule))) errors.push(`meds[${i}].schedule ist ungueltig.`);
  }

  const medIds = new Set((parsed.meds ?? []).map((med: any, index: number) => typeof med?.id === "string" && med.id.trim() ? med.id.trim() : deterministicId("med", parsed.version, index, med?.name, med?.dose)));
  for (const [dateKey, entry] of Object.entries(parsed.diary ?? {})) {
    const taken = Array.isArray(entry?.medsTaken) ? entry.medsTaken : [];
    for (const slotId of taken) {
      if (typeof slotId !== "string") {
        errors.push(`diary.${dateKey}.medsTaken enthaelt ungueltige IDs.`);
        continue;
      }
      const parsedSlot = splitMedsTakenSlot(slotId);
      if (!parsedSlot) {
        errors.push(`diary.${dateKey}.medsTaken enthaelt ungueltige Slot-Referenz: ${slotId}`);
        continue;
      }
      if (!medIds.has(parsedSlot.medId)) {
        errors.push(`diary.${dateKey}.medsTaken referenziert unbekanntes Medikament: ${parsedSlot.medId}`);
      }
    }
  }

  if (errors.length > 0) blockers.push(...errors.map((_, idx) => `blocker_${idx + 1}`));
  return { errors, warnings, blockers };
}

function dbSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number };
  return row.version;
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  return Boolean(row);
}

function rowsBySourceImportId(db: DatabaseSync, table: string, importId: string): unknown[] {
  if (!tableExists(db, table)) return [];
  return db.prepare(`SELECT * FROM ${table} WHERE source_import_id = ?`).all(importId) as unknown[];
}

function getRowByPrimaryKey(db: DatabaseSync, table: string, keyColumn: string, keyValue: string): any | null {
  if (!tableExists(db, table)) return null;
  return db.prepare(`SELECT * FROM ${table} WHERE ${keyColumn} = ?`).get(keyValue) ?? null;
}

function jsonParseSafe(value: string | null): any {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function compareRows(expected: any, actual: any, keys: string[]): boolean {
  for (const key of keys) {
    if (canonicalize(expected[key]) !== canonicalize(actual[key])) return false;
  }
  return true;
}

function buildDiaryRecord(entryDate: string, entry: any, importId: string, sourceHash: string) {
  return {
    entry_date: entryDate,
    morning_pain: entry.morning_pain ?? null,
    noon_pain: entry.noon_pain ?? null,
    evening_pain: entry.evening_pain ?? null,
    night_pain: entry.night_pain ?? null,
    morning_rls: entry.morning_rls ?? null,
    noon_rls: entry.noon_rls ?? null,
    evening_rls: entry.evening_rls ?? null,
    night_rls: entry.night_rls ?? null,
    notes: entry.notes ?? null,
    sleep_hours: entry.sleepHours ?? null,
    sleep_quality: entry.sleepQuality ?? null,
    factors_json: JSON.stringify(entry.factors ?? {}),
    meds_taken_json: JSON.stringify(entry.medsTaken ?? []),
    meds_taken_times_json: JSON.stringify(entry.medsTakenTimes ?? {}),
    pain_areas_json: JSON.stringify(entry.painAreas ?? []),
    pressure: entry.pressure ?? null,
    weather: entry.weather ?? null,
    additional_data_json: JSON.stringify({
      backup_updated: entry.updated ?? null,
    }),
    source_import_id: importId,
  };
}

function buildMoodRecord(entryDate: string, entry: any, importId: string, sourceHash: string) {
  return {
    entry_date: entryDate,
    stimmung: entry.stimmung ?? null,
    energie: entry.energie ?? null,
    antrieb: entry.antrieb ?? null,
    angst: entry.angst ?? null,
    reizbarkeit: entry.reizbarkeit ?? null,
    konzentration: entry.konzentration ?? null,
    hoffnungslosigkeit: entry.hoffnungslosigkeit ?? null,
    notes: entry.notes ?? null,
    symptoms_json: JSON.stringify(entry.symptoms ?? {}),
    activities_json: JSON.stringify(entry.activities ?? {}),
    source_import_id: importId,
  };
}

function splitMedsTakenSlot(slotId: string): { medId: string; slot: string } | null {
  const slots = ["morning", "noon", "evening", "night"];
  for (const slot of slots) {
    if (slotId.endsWith(`_${slot}`)) {
      return { medId: slotId.slice(0, -(slot.length + 1)), slot };
    }
  }
  return null;
}

function existingImportByHash(db: DatabaseSync, sourceHash: string): any | null {
  if (!tableExists(db, "user_data_imports")) return null;
  return db.prepare("SELECT * FROM user_data_imports WHERE source_hash = ?").get(sourceHash) ?? null;
}

function ensureNoConflict(expected: any, actual: any, keys: string[], context: string): { matched: boolean; conflict: boolean } {
  if (!actual) return { matched: false, conflict: false };
  const same = compareRows(expected, actual, keys);
  return { matched: same, conflict: !same };
}

function withTransaction(db: DatabaseSync, fn: () => void): void {
  db.exec("BEGIN IMMEDIATE;");
  try {
    fn();
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function insertImportManifest(db: DatabaseSync, record: any): void {
  db.prepare(`
    INSERT INTO user_data_imports (
      id, import_version, source_backup_version, source_hash, source_timestamp,
      target_schema_version, mode, status, started_at, completed_at,
      counts_json, imported_ids_json, warnings_json, errors_json,
      snapshot_path, rollback_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    record.id,
    record.import_version,
    record.source_backup_version,
    record.source_hash,
    record.source_timestamp,
    record.target_schema_version,
    record.mode,
    record.status,
    record.started_at,
    record.completed_at,
    record.counts_json,
    record.imported_ids_json,
    record.warnings_json,
    record.errors_json,
    record.snapshot_path,
    record.rollback_status,
  );
}

function updateImportManifest(db: DatabaseSync, sourceHash: string, patch: Record<string, any>): void {
  const keys = Object.keys(patch);
  const assignments = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE user_data_imports SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE source_hash = ?`)
    .run(...keys.map((k) => patch[k]), sourceHash);
}

function countDiaryMedsTaken(parsed: ParsedBackup): number {
  let total = 0;
  for (const entry of Object.values(parsed.diary ?? {})) {
    total += Array.isArray(entry?.medsTaken) ? entry.medsTaken.length : 0;
  }
  return total;
}

function buildCounts(parsed: ParsedBackup) {
  const sourceCounts = {
    diary: Object.keys(parsed.diary ?? {}).length,
    mood: Object.keys(parsed.mood ?? {}).length,
    meds: Array.isArray(parsed.meds) ? parsed.meds.length : 0,
    rlsSurveys: Object.keys(parsed.rlsSurveys ?? {}).length,
    appointments: 0,
    bloodPressure: 0,
    sosContacts: Array.isArray(parsed.sosData?.iceContacts) ? parsed.sosData.iceContacts.length : 0,
    medsTaken: countDiaryMedsTaken(parsed),
  };
  const targetCounts = {
    diaryEntries: sourceCounts.diary,
    moodEntries: sourceCounts.mood,
    userMedications: sourceCounts.meds,
    medicationSchedules: countMedicationSchedules(parsed),
    medicationIntakes: 0,
    rlsSurveys: sourceCounts.rlsSurveys,
    appointments: 0,
    bloodPressureEntries: 0,
    sosProfiles: parsed.sosData ? 1 : 0,
    sosContacts: sourceCounts.sosContacts,
    userDataImports: 1,
  };
  return { sourceCounts, targetCounts };
}

export interface BackupImportAnalysis {
  importId: string;
  sourceHash: string;
  sourceBackupVersion: string;
  sourceTimestamp: string;
  status: "analyzed" | "blocked";
  sourceCounts: Record<string, number>;
  expectedTargetCounts: Record<string, number>;
  warnings: string[];
  blockers: string[];
  plannedTables: string[];
  schemaVersion: number;
  importAllowed: boolean;
}

export function analyzeBackupContent(raw: Buffer): BackupImportAnalysis {
  const sourceHash = createHash("sha256").update(raw).digest("hex");
  const parsed = parseBackupBuffer(raw);
  const { errors, warnings, blockers } = validateBackup(parsed, false);
  const { sourceCounts, targetCounts } = buildCounts(parsed);
  return {
    importId: deterministicId("import", sourceHash),
    sourceHash,
    sourceBackupVersion: String(parsed.version ?? ""),
    sourceTimestamp: String(parsed.timestamp ?? ""),
    status: blockers.length > 0 || errors.length > 0 ? "blocked" : "analyzed",
    sourceCounts,
    expectedTargetCounts: targetCounts,
    warnings,
    blockers: [...blockers, ...errors],
    plannedTables: ["diary_entries", "mood_entries", "user_medications", "medication_schedules", "medication_intakes", "rls_surveys", "appointments", "blood_pressure_entries", "sos_profiles", "sos_contacts", "user_data_imports"],
    schemaVersion: 5,
    importAllowed: blockers.length === 0 && errors.length === 0,
  };
}

function snapshotIsValid(snapshotPath: string): boolean {
  try {
    const snapDb = openDatabase(snapshotPath);
    try {
      const integrity = snapDb.prepare("PRAGMA integrity_check").all() as Array<Record<string, string>>;
      return integrity.length > 0 && Object.values(integrity[0])[0] === "ok";
    } finally {
      snapDb.close();
    }
  } catch {
    return false;
  }
}

function tableCount(db: DatabaseSync, table: string, importId: string): number {
  if (!tableExists(db, table)) return 0;
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE source_import_id = ?`).get(importId) as { count: number };
  return row.count;
}

export async function runBackupImport(args: BackupImportCliArgs): Promise<{ code: number; report: ImportReport }> {
  const startedAt = new Date().toISOString();
  let parsed: ParsedBackup;
  let sourceHash: string;
  try {
    ({ parsed, sourceHash } = loadBackup(args.backupPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      code: 1,
      report: {
        importId: args.importId?.trim() || deterministicId("import", args.backupPath),
        sourceHash: "",
        sourceBackupVersion: "",
        sourceTimestamp: "",
        mode: args.mode,
        status: "failed",
        counts: {},
        importedIds: {},
        matchedIds: {},
        warnings: [],
        errors: [message],
        startedAt,
        completedAt: new Date().toISOString(),
        databasePath: args.databasePath,
        snapshotPath: args.snapshotPath ?? null,
        blockers: [message],
      },
    };
  }
  const sourceHashCheck = sha256FileSync(args.backupPath);
  if (sourceHashCheck !== sourceHash) {
    throw new Error("Quellhash konnte nicht konsistent gebildet werden.");
  }
  const db = openDatabase(args.databasePath);
  const warnings: string[] = [];
  const errors: string[] = [];
  const blockers: string[] = [];
  const { errors: validationErrors, warnings: validationWarnings, blockers: validationBlockers } = validateBackup(parsed, Boolean(args.allowEmpty));
  warnings.push(...validationWarnings);
  errors.push(...validationErrors);
  blockers.push(...validationBlockers);

  const importId = args.importId?.trim() || deterministicId("import", sourceHash);
  const sourceBackupVersion = parsed.version;
  const sourceTimestamp = parsed.timestamp;
  const { sourceCounts, targetCounts } = buildCounts(parsed);
  const plannedTables = ["diary_entries", "mood_entries", "user_medications", "medication_schedules", "medication_intakes", "rls_surveys", "sos_profiles", "sos_contacts", "user_data_imports"];
  const importedIds: Record<string, string[]> = {};
  const matchedIds: Record<string, string[]> = {};
  const reportBase: ImportReport = {
    importId,
    sourceHash,
    sourceBackupVersion,
    sourceTimestamp,
    mode: args.mode,
    status: "pending",
    counts: sourceCounts,
    importedIds,
    matchedIds,
    warnings,
    errors,
    startedAt,
    completedAt: null,
    databasePath: args.databasePath,
    snapshotPath: args.snapshotPath ?? null,
    plannedTables,
    blockers,
    expectedImportId: importId,
  };

  const topExisting = existingImportByHash(db, sourceHash);
  if (args.mode === "apply" && topExisting && ["applied", "verified"].includes(String(topExisting.status))) {
    reportBase.status = "failed";
    reportBase.errors.push("source_hash ist bereits angewendet oder verifiziert.");
    reportBase.blockers?.push("duplicate_source_hash");
    return { code: 1, report: { ...reportBase, completedAt: new Date().toISOString() } };
  }

  if (args.mode === "dry-run") {
    reportBase.status = errors.length === 0 ? "validated" : "failed";
    reportBase.completedAt = new Date().toISOString();
    return { code: errors.length === 0 ? 0 : 1, report: reportBase };
  }

  if (args.mode === "apply") {
    if (!args.snapshotPath) {
      return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Snapshot-Pfad fehlt."], completedAt: new Date().toISOString() } };
    }
    assertReadableFile(args.snapshotPath, "Snapshot");
    const snapStat = fs.statSync(args.snapshotPath);
    if (snapStat.size <= 0) {
      return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Snapshot ist leer."], completedAt: new Date().toISOString() } };
    }
    if (!snapshotIsValid(args.snapshotPath)) {
      return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Snapshot integrity_check fehlgeschlagen."], completedAt: new Date().toISOString() } };
    }
    if (dbSchemaVersion(db) < 5) {
      return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Zielschema-Version ist kleiner als 5."], completedAt: new Date().toISOString() } };
    }
    if (blockers.length > 0) {
      return { code: 1, report: { ...reportBase, status: "failed", completedAt: new Date().toISOString() } };
    }

    try {
      withTransaction(db, () => {
      insertImportManifest(db, {
        id: importId,
        import_version: "sc-db-08.2b",
        source_backup_version: sourceBackupVersion,
        source_hash: sourceHash,
        source_timestamp: sourceTimestamp,
        target_schema_version: 5,
        mode: "apply",
        status: "pending",
        started_at: startedAt,
        completed_at: null,
        counts_json: JSON.stringify({ source: sourceCounts, target: targetCounts }),
        imported_ids_json: JSON.stringify({}),
        warnings_json: JSON.stringify(warnings),
        errors_json: JSON.stringify(errors),
        snapshot_path: args.snapshotPath,
        rollback_status: "not_started",
      });

      const importedDiary: string[] = [];
      const matchedDiary: string[] = [];
      for (const [dateKey, entry] of Object.entries(parsed.diary ?? {})) {
        const expected = buildDiaryRecord(dateKey, entry, importId, sourceHash);
        const existing = getRowByPrimaryKey(db, "diary_entries", "entry_date", dateKey);
        if (existing) {
          const { matched, conflict } = ensureNoConflict(expected, existing, [
            "entry_date","morning_pain","noon_pain","evening_pain","night_pain","morning_rls","noon_rls","evening_rls","night_rls","notes","sleep_hours","sleep_quality","factors_json","meds_taken_json","meds_taken_times_json","pain_areas_json","pressure","weather","additional_data_json"
          ], `diary.${dateKey}`);
          if (conflict) throw new Error(`Konflikt in diary ${dateKey}.`);
          if (matched) { matchedDiary.push(dateKey); continue; }
        }
        db.prepare(`
          INSERT INTO diary_entries (
            entry_date, morning_pain, noon_pain, evening_pain, night_pain,
            morning_rls, noon_rls, evening_rls, night_rls, notes, sleep_hours,
            sleep_quality, factors_json, meds_taken_json, meds_taken_times_json,
            pain_areas_json, pressure, weather, additional_data_json, source_import_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          expected.entry_date, expected.morning_pain, expected.noon_pain, expected.evening_pain, expected.night_pain,
          expected.morning_rls, expected.noon_rls, expected.evening_rls, expected.night_rls, expected.notes,
          expected.sleep_hours, expected.sleep_quality, expected.factors_json, expected.meds_taken_json,
          expected.meds_taken_times_json, expected.pain_areas_json, expected.pressure, expected.weather,
          expected.additional_data_json, expected.source_import_id,
        );
        importedDiary.push(dateKey);
      }

      const importedMood: string[] = [];
      const matchedMood: string[] = [];
      for (const [dateKey, entry] of Object.entries(parsed.mood ?? {})) {
        const expected = buildMoodRecord(dateKey, entry, importId, sourceHash);
        const existing = getRowByPrimaryKey(db, "mood_entries", "entry_date", dateKey);
        if (existing) {
          const { matched, conflict } = ensureNoConflict(expected, existing, [
            "entry_date","stimmung","energie","antrieb","angst","reizbarkeit","konzentration","hoffnungslosigkeit","notes","symptoms_json","activities_json"
          ], `mood.${dateKey}`);
          if (conflict) throw new Error(`Konflikt in mood ${dateKey}.`);
          if (matched) { matchedMood.push(dateKey); continue; }
        }
        db.prepare(`
          INSERT INTO mood_entries (
            entry_date, stimmung, energie, antrieb, angst, reizbarkeit, konzentration,
            hoffnungslosigkeit, notes, symptoms_json, activities_json, source_import_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          expected.entry_date, expected.stimmung, expected.energie, expected.antrieb, expected.angst,
          expected.reizbarkeit, expected.konzentration, expected.hoffnungslosigkeit, expected.notes,
          expected.symptoms_json, expected.activities_json, expected.source_import_id,
        );
        importedMood.push(dateKey);
      }

      const medById = new Map<string, any>();
      const importedMedIds: string[] = [];
      const matchedMedIds: string[] = [];
      const importedScheduleIds: string[] = [];
      const knownPzn = new Map<string, any>();
      const knownName = new Map<string, any>();
      for (const row of db.prepare("SELECT id, product_name, pzn, active_ingredient_text, strength, dosage_form, manufacturer, package_size, verification_status FROM medication_products").all() as any[]) {
        if (row.pzn) knownPzn.set(String(row.pzn), row);
        knownName.set(String(row.product_name).toLowerCase(), row);
      }

      const importMedRows: any[] = [];
      parsed.meds.forEach((med, index) => {
        const id = typeof med.id === "string" && med.id.trim() ? med.id.trim() : deterministicId("med", sourceHash, index, med.name, med.dose);
        const schedule = toMedSchedule(med.schedule);
        const product = med.pzn ? knownPzn.get(String(med.pzn)) : knownName.get(String(med.name).toLowerCase());
        const row = {
          id,
          user_id: null,
          medication_product_id: product?.id ?? null,
          custom_name: product ? null : String(med.name),
          custom_dosage: String(med.dose),
          custom_form: med.form ? String(med.form) : null,
          start_date: null,
          end_date: null,
          notes: med.note ?? null,
          created_at: med.createdAt ?? startedAt,
          updated_at: med.updatedAt ?? startedAt,
        };
        importMedRows.push({ med, row, schedule, product });
      });

      for (const { med, row, schedule, product } of importMedRows) {
        const existing = db.prepare("SELECT * FROM user_medications WHERE id = ?").get(row.id) as any;
        const expectedBase = {
          id: row.id,
          user_id: null,
          medication_product_id: row.medication_product_id,
          custom_name: row.custom_name,
          custom_dosage: row.custom_dosage,
          custom_form: row.custom_form,
          start_date: null,
          end_date: null,
          notes: row.notes,
        };
        if (existing) {
          const { matched, conflict } = ensureNoConflict(expectedBase, existing, Object.keys(expectedBase), `meds.${row.id}`);
          if (conflict) throw new Error(`Konflikt in meds ${row.id}.`);
          if (matched) { matchedMedIds.push(row.id); continue; }
        }
        db.prepare(`
          INSERT INTO user_medications (
            id, user_id, medication_product_id, custom_name, custom_dosage, custom_form,
            start_date, end_date, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          row.id, row.user_id, row.medication_product_id, row.custom_name, row.custom_dosage, row.custom_form,
          row.start_date, row.end_date, row.notes, row.created_at, row.updated_at,
        );
        importedMedIds.push(row.id);
        for (const [slot, amount] of Object.entries(schedule)) {
          const scheduleId = deterministicId("schedule", row.id, slot);
          const existingSchedule = db.prepare("SELECT * FROM medication_schedules WHERE id = ?").get(scheduleId) as any;
          if (existingSchedule) {
            if (!compareRows({ id: scheduleId, user_medication_id: row.id, time_of_day: slot, amount }, existingSchedule, ["id","user_medication_id","time_of_day","amount"])) {
              throw new Error(`Konflikt in medication_schedules ${scheduleId}.`);
            }
            continue;
          }
          db.prepare("INSERT INTO medication_schedules (id, user_medication_id, time_of_day, amount) VALUES (?, ?, ?, ?)").run(scheduleId, row.id, slot, amount as number);
          importedScheduleIds.push(scheduleId);
        }
      }

      const importedSurveyIds: string[] = [];
      const matchedSurveyIds: string[] = [];
      for (const [dateKey, survey] of Object.entries(parsed.rlsSurveys ?? {})) {
        const id = typeof survey.id === "string" && survey.id.trim() ? survey.id.trim() : deterministicId("survey", sourceHash, dateKey);
        const expected = {
          id,
          survey_date: dateKey,
          answers_json: JSON.stringify(survey.answers ?? []),
          score: survey.sum ?? survey.score ?? 0,
          freetext: survey.freetext ?? survey.notes ?? null,
          extra_json: JSON.stringify(survey.extra ?? {}),
          source_import_id: importId,
        };
        const existing = getRowByPrimaryKey(db, "rls_surveys", "id", id);
        if (existing) {
          const { matched, conflict } = ensureNoConflict(expected, existing, ["id","survey_date","answers_json","score","freetext","extra_json"], `rlsSurveys.${dateKey}`);
          if (conflict) throw new Error(`Konflikt in rlsSurveys ${dateKey}.`);
          if (matched) { matchedSurveyIds.push(id); continue; }
        }
        db.prepare(`
          INSERT INTO rls_surveys (
            id, survey_date, answers_json, score, freetext, extra_json, source_import_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(id, expected.survey_date, expected.answers_json, expected.score, expected.freetext, expected.extra_json, expected.source_import_id);
        importedSurveyIds.push(id);
      }

      const activeProfileId = deterministicId(
        "sos",
        parsed.sosData?.personal?.name ?? parsed.sosData?.patientName ?? "profile",
        parsed.sosData?.personal?.birthdate ?? parsed.sosData?.dob ?? "",
      );
      const profileExisting = getRowByPrimaryKey(db, "sos_profiles", "id", activeProfileId);
      const profileExpected = {
        id: activeProfileId,
        is_active: 1,
        patient_name: parsed.sosData?.personal?.name ?? parsed.sosData?.patientName ?? null,
        birthdate: parsed.sosData?.personal?.birthdate ?? parsed.sosData?.dob ?? null,
        address: parsed.sosData?.personal?.address ?? null,
        blood_group: parsed.sosData?.medical?.bloodGroup ?? parsed.sosData?.bloodType ?? null,
        allergies: parsed.sosData?.medical?.allergies ?? parsed.sosData?.allergies ?? null,
        chronic_conditions: parsed.sosData?.medical?.chronicConditions ?? parsed.sosData?.diagnoses ?? null,
        diagnoses_text: parsed.sosData?.diagnoses ?? null,
        emergency_notes: parsed.sosData?.emergencyNotes ?? null,
        profile_photo_ref: parsed.sosData?.personal?.profilePhoto ?? null,
        source_import_id: importId,
      };
      if (profileExisting) {
        const { matched, conflict } = ensureNoConflict(profileExpected, profileExisting, ["id","is_active","patient_name","birthdate","address","blood_group","allergies","chronic_conditions","diagnoses_text","emergency_notes","profile_photo_ref"], "sosData");
        if (conflict) throw new Error("Konflikt im SOS-Profil.");
        if (!matched) {
          throw new Error("Aktives SOS-Profil existiert bereits in abweichender Form.");
        }
      } else {
        db.prepare(`
          INSERT INTO sos_profiles (
            id, is_active, patient_name, birthdate, address, blood_group, allergies,
            chronic_conditions, diagnoses_text, emergency_notes, profile_photo_ref,
            source_import_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          profileExpected.id, profileExpected.is_active, profileExpected.patient_name, profileExpected.birthdate, profileExpected.address,
          profileExpected.blood_group, profileExpected.allergies, profileExpected.chronic_conditions, profileExpected.diagnoses_text,
          profileExpected.emergency_notes, profileExpected.profile_photo_ref, profileExpected.source_import_id,
        );
      }

      const importedProfileIds = [activeProfileId];

      const importedContactIds: string[] = [];
      const matchedContactIds: string[] = [];
      for (const [index, contact] of (parsed.sosData?.iceContacts ?? []).entries()) {
        const id = typeof contact.id === "string" && contact.id.trim() ? contact.id.trim() : deterministicId("ice", sourceHash, index, contact.name, contact.phone);
        const expected = {
          id,
          profile_id: activeProfileId,
          external_contact_id: contact.id ?? null,
          name: String(contact.name),
          phone: String(contact.phone),
          relationship: contact.relationship ?? null,
          source_import_id: importId,
        };
        const current = getRowByPrimaryKey(db, "sos_contacts", "id", id);
        if (current) {
          const { matched, conflict } = ensureNoConflict(expected, current, ["id","profile_id","external_contact_id","name","phone","relationship"], `sosData.iceContacts[${index}]`);
          if (conflict) throw new Error(`Konflikt im SOS-Kontakt ${id}.`);
          if (matched) { matchedContactIds.push(id); continue; }
        }
        db.prepare(`
          INSERT INTO sos_contacts (
            id, profile_id, external_contact_id, name, phone, relationship,
            source_import_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(id, expected.profile_id, expected.external_contact_id, expected.name, expected.phone, expected.relationship, expected.source_import_id);
        importedContactIds.push(id);
      }

      const intakeWarnings = countDiaryMedsTaken(parsed);
      if (intakeWarnings > 0) {
        warnings.push(`${intakeWarnings} diary.medsTaken-Eintraege konnten nicht eindeutig als medication_intakes importiert werden, weil keine separaten Tageszeiten vorliegen.`);
      }

      updateImportManifest(db, sourceHash, {
        status: "applied",
        completed_at: new Date().toISOString(),
        counts_json: JSON.stringify({
          source: sourceCounts,
          target: {
            diaryEntries: importedDiary.length,
            moodEntries: importedMood.length,
            userMedications: importedMedIds.length,
            medicationSchedules: importedScheduleIds.length,
            medicationIntakes: 0,
            rlsSurveys: importedSurveyIds.length,
            appointments: 0,
            bloodPressureEntries: 0,
            sosProfiles: importedProfileIds.length,
            sosContacts: importedContactIds.length,
            userDataImports: 1,
          },
        }),
        imported_ids_json: JSON.stringify({
          diary: importedDiary,
          mood: importedMood,
          meds: importedMedIds,
          medicationSchedules: importedScheduleIds,
          medicationIntakes: [],
          rlsSurveys: importedSurveyIds,
          sosProfiles: importedProfileIds,
          sosContacts: importedContactIds,
          userDataImports: [importId],
        }),
        warnings_json: JSON.stringify(warnings),
        errors_json: JSON.stringify(errors),
        rollback_status: "available",
      });

      importedIds.diary = importedDiary;
      importedIds.mood = importedMood;
      importedIds.meds = importedMedIds;
      importedIds.medicationSchedules = importedScheduleIds;
      importedIds.medicationIntakes = [];
      importedIds.rlsSurveys = importedSurveyIds;
      importedIds.sosProfiles = importedProfileIds;
      importedIds.sosContacts = importedContactIds;
      importedIds.userDataImports = [importId];
      matchedIds.diary = matchedDiary;
      matchedIds.mood = matchedMood;
      matchedIds.meds = matchedMedIds;
      matchedIds.rlsSurveys = matchedSurveyIds;
      matchedIds.sosContacts = matchedContactIds;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        code: 1,
        report: {
          ...reportBase,
          status: "failed",
          errors: [...errors, message],
          completedAt: new Date().toISOString(),
        },
      };
    }

    const report: ImportReport = {
      ...reportBase,
      status: "applied",
      completedAt: new Date().toISOString(),
      counts: sourceCounts,
      importedIds,
      matchedIds,
      errors,
    };
    return { code: 0, report };
  }

  if (args.mode === "verify") {
    const manifest = existingImportByHash(db, sourceHash);
    if (!manifest) {
      return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Importmanifest nicht gefunden."], completedAt: new Date().toISOString() } };
    }
    const manifestImportedIds = jsonParseSafe(String(manifest.imported_ids_json)) ?? {};
    const manifestCounts = jsonParseSafe(String(manifest.counts_json)) ?? {};
    const manifestSourceCounts = (manifestCounts as any)?.source ?? {};
    const manifestTargetCounts = (manifestCounts as any)?.target ?? {};
    const verificationChecks: Record<string, { status: "passed" | "failed"; expected?: unknown; actual?: unknown; message?: string }> = {};
    const manifestStatus = String(manifest.status);
    verificationChecks.manifestExists = { status: "passed", actual: true };
    verificationChecks.sourceHash = {
      status: String(manifest.source_hash) === sourceHash ? "passed" : "failed",
      expected: sourceHash,
      actual: String(manifest.source_hash),
      message: String(manifest.source_hash) === sourceHash ? undefined : "source_hash stimmt nicht ueberein.",
    };
    verificationChecks.importId = {
      status: String(manifest.id) ? "passed" : "failed",
      expected: String(manifest.id),
      actual: String(manifest.id),
    };
    verificationChecks.status = {
      status: ["applied", "verified"].includes(manifestStatus) ? "passed" : "failed",
      expected: "applied|verified",
      actual: manifestStatus,
    };
    verificationChecks.schemaVersion = {
      status: Number(manifest.target_schema_version) === 5 ? "passed" : "failed",
      expected: 5,
      actual: Number(manifest.target_schema_version),
    };
    const expectedCounts = {
      diaryEntries: Number(manifestTargetCounts.diaryEntries ?? 0),
      moodEntries: Number(manifestTargetCounts.moodEntries ?? 0),
      userMedications: Number(manifestTargetCounts.userMedications ?? 0),
      medicationSchedules: Number(manifestTargetCounts.medicationSchedules ?? 0),
      medicationIntakes: Number(manifestTargetCounts.medicationIntakes ?? 0),
      rlsSurveys: Number(manifestTargetCounts.rlsSurveys ?? 0),
      appointments: Number(manifestTargetCounts.appointments ?? 0),
      bloodPressureEntries: Number(manifestTargetCounts.bloodPressureEntries ?? 0),
      sosProfiles: Number(manifestTargetCounts.sosProfiles ?? 0),
      sosContacts: Number(manifestTargetCounts.sosContacts ?? 0),
      userDataImports: Number(manifestTargetCounts.userDataImports ?? 0),
    };
    verificationChecks.manifestSourceCounts = {
      status: manifestSourceCounts.diary !== undefined ? "passed" : "failed",
      expected: "source counts present",
      actual: manifestSourceCounts,
    };
    const actualCounts = {
      diaryEntries: db.prepare("SELECT COUNT(*) AS count FROM diary_entries").get() as { count: number },
      moodEntries: db.prepare("SELECT COUNT(*) AS count FROM mood_entries").get() as { count: number },
      userMedications: db.prepare("SELECT COUNT(*) AS count FROM user_medications").get() as { count: number },
      medicationSchedules: db.prepare("SELECT COUNT(*) AS count FROM medication_schedules").get() as { count: number },
      medicationIntakes: db.prepare("SELECT COUNT(*) AS count FROM medication_intakes").get() as { count: number },
      rlsSurveys: db.prepare("SELECT COUNT(*) AS count FROM rls_surveys").get() as { count: number },
      appointments: db.prepare("SELECT COUNT(*) AS count FROM appointments").get() as { count: number },
      bloodPressureEntries: db.prepare("SELECT COUNT(*) AS count FROM blood_pressure_entries").get() as { count: number },
      sosProfiles: db.prepare("SELECT COUNT(*) AS count FROM sos_profiles").get() as { count: number },
      sosContacts: db.prepare("SELECT COUNT(*) AS count FROM sos_contacts").get() as { count: number },
      userDataImports: db.prepare("SELECT COUNT(*) AS count FROM user_data_imports").get() as { count: number },
    };
    for (const [key, expectedValue] of Object.entries(expectedCounts)) {
      const actualValue = (actualCounts as any)[key].count;
      verificationChecks[key] = {
        status: actualValue === expectedValue ? "passed" : "failed",
        expected: expectedValue,
        actual: actualValue,
      };
    }
    const expectedIdChecks = [
      ["diaryIds", Array.isArray(manifestImportedIds.diary) ? manifestImportedIds.diary : []],
      ["moodIds", Array.isArray(manifestImportedIds.mood) ? manifestImportedIds.mood : []],
      ["medicationIds", Array.isArray(manifestImportedIds.meds) ? manifestImportedIds.meds : []],
      ["medicationScheduleIds", Array.isArray(manifestImportedIds.medicationSchedules) ? manifestImportedIds.medicationSchedules : []],
      ["medicationIntakeIds", Array.isArray(manifestImportedIds.medicationIntakes) ? manifestImportedIds.medicationIntakes : []],
      ["rlsSurveyIds", Array.isArray(manifestImportedIds.rlsSurveys) ? manifestImportedIds.rlsSurveys : []],
      ["sosProfileIds", Array.isArray(manifestImportedIds.sosProfiles) ? manifestImportedIds.sosProfiles : []],
      ["sosContactIds", Array.isArray(manifestImportedIds.sosContacts) ? manifestImportedIds.sosContacts : []],
      ["userDataImportIds", Array.isArray(manifestImportedIds.userDataImports) ? manifestImportedIds.userDataImports : []],
    ] as Array<[string, string[]]>;
    const idProblems: string[] = [];
    for (const [label, ids] of expectedIdChecks) {
      const missing = ids.filter((id) => {
        switch (label) {
          case "diaryIds": return !getRowByPrimaryKey(db, "diary_entries", "entry_date", id);
          case "moodIds": return !getRowByPrimaryKey(db, "mood_entries", "entry_date", id);
          case "medicationIds": return !getRowByPrimaryKey(db, "user_medications", "id", id);
          case "medicationScheduleIds": return !getRowByPrimaryKey(db, "medication_schedules", "id", id);
          case "medicationIntakeIds": return !getRowByPrimaryKey(db, "medication_intakes", "id", id);
          case "rlsSurveyIds": return !getRowByPrimaryKey(db, "rls_surveys", "id", id);
          case "sosProfileIds": return !getRowByPrimaryKey(db, "sos_profiles", "id", id);
          case "sosContactIds": return !getRowByPrimaryKey(db, "sos_contacts", "id", id);
          case "userDataImportIds": return !getRowByPrimaryKey(db, "user_data_imports", "id", id);
          default: return true;
        }
      });
      if (missing.length > 0) {
        idProblems.push(`${label}:${missing.join(",")}`);
      }
    }
    verificationChecks.ids = {
      status: idProblems.length === 0 ? "passed" : "failed",
      expected: "all documented ids present",
      actual: idProblems.length === 0 ? "all present" : idProblems,
      message: idProblems.length === 0 ? undefined : `Fehlende IDs: ${idProblems.join(" | ")}`,
    };
    const foreignKeyCheck = db.prepare("PRAGMA foreign_key_check").all() as any[];
    const integrityCheck = db.prepare("PRAGMA integrity_check").all() as Array<Record<string, string>>;
    verificationChecks.integrityCheck = {
      status: integrityCheck.length > 0 && Object.values(integrityCheck[0])[0] === "ok" ? "passed" : "failed",
      expected: "ok",
      actual: integrityCheck.length > 0 ? Object.values(integrityCheck[0])[0] : "missing",
    };
    verificationChecks.foreignKeyCheck = {
      status: foreignKeyCheck.length === 0 ? "passed" : "failed",
      expected: 0,
      actual: foreignKeyCheck.length,
    };
    const countMismatch = Object.entries(expectedCounts).some(([key, value]) => (actualCounts as any)[key].count !== value);
    const failedChecks = Object.entries(verificationChecks).filter(([, value]) => value.status === "failed");
    if (countMismatch || failedChecks.length > 0) {
      return {
        code: 1,
        report: {
          ...reportBase,
          status: "failed",
          verificationChecks,
          errors: [...errors, "Verify-Checks fehlgeschlagen.", ...failedChecks.map(([key, value]) => `${key}: ${value.message ?? `${value.actual} != ${value.expected}`}`)],
          completedAt: new Date().toISOString(),
        },
      };
    }
    updateImportManifest(db, sourceHash, {
      status: "verified",
      completed_at: new Date().toISOString(),
      rollback_status: "available",
    });
    return {
      code: 0,
      report: {
        ...reportBase,
        status: "verified",
        completedAt: new Date().toISOString(),
        counts: sourceCounts,
        verificationChecks,
      },
    };
  }

  if (args.mode === "rollback") {
    if (!args.snapshotPath) {
      return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Snapshot-Pfad fehlt."], completedAt: new Date().toISOString() } };
    }
    assertReadableFile(args.snapshotPath, "Snapshot");
    const currentBackup = `${args.databasePath}.pre-rollback-${Date.now()}`;
    fs.copyFileSync(args.databasePath, currentBackup);
    fs.copyFileSync(args.snapshotPath, args.databasePath);
    if (!snapshotIsValid(args.snapshotPath)) {
      return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Snapshot ist ungueltig."], completedAt: new Date().toISOString() } };
    }
    const restored = openDatabase(args.databasePath);
    try {
      const integrity = restored.prepare("PRAGMA integrity_check").all() as Array<Record<string, string>>;
      if (integrity.length === 0 || Object.values(integrity[0])[0] !== "ok") {
        return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Wiederhergestellte Datei ist ungueltig."], completedAt: new Date().toISOString() } };
      }
      return {
        code: 0,
        report: {
          ...reportBase,
          status: "rolled_back",
          completedAt: new Date().toISOString(),
          snapshotPath: args.snapshotPath,
        },
      };
    } finally {
      restored.close();
    }
  }

  return { code: 1, report: { ...reportBase, status: "failed", errors: [...errors, "Unbekannter Modus."], completedAt: new Date().toISOString() } };
}

export function writeImportReport(report: ImportReport, reportPath?: string): void {
  if (!reportPath) return;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

export function parseBackupImportArgs(argv: string[]): BackupImportCliArgs {
  const args: Record<string, string | boolean | undefined> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    const next = argv[i + 1];
    if (!cur.startsWith("--")) continue;
    const key = cur.slice(2);
    if (["allow-empty"].includes(key)) {
      args[key] = true;
    } else {
      args[key] = next && !next.startsWith("--") ? next : "";
      if (next && !next.startsWith("--")) i += 1;
    }
  }

  const mode = String(args.mode ?? "");
  const backupPath = String(args.backup ?? "");
  const databasePath = String(args.database ?? "");
  if (!mode || !["dry-run", "apply", "verify", "rollback"].includes(mode)) throw new Error("Ungültiger oder fehlender --mode.");
  if (!backupPath) throw new Error("Fehlendes --backup.");
  if (!databasePath) throw new Error("Fehlendes --database.");
  return {
    mode: mode as ImportMode,
    backupPath,
    databasePath,
    snapshotPath: args.snapshot ? String(args.snapshot) : undefined,
    importId: args["import-id"] ? String(args["import-id"]) : undefined,
    allowEmpty: Boolean(args["allow-empty"]),
    reportPath: args.report ? String(args.report) : undefined,
  };
}
