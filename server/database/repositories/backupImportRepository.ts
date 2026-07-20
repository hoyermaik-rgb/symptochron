import { randomUUID } from "node:crypto";
import { getDatabase } from "../connection";

export type ImportMode = "dry-run" | "apply" | "verify";
export type ImportStatus = "pending" | "validated" | "applied" | "verified" | "failed" | "rolled_back";
export type RollbackStatus = "not_started" | "available" | "rolled_back" | "failed";

export interface UserDataImportInput {
  id?: string;
  importVersion: string;
  sourceBackupVersion: string;
  sourceHash: string;
  sourceTimestamp: string;
  targetSchemaVersion: number;
  mode: ImportMode;
  status: ImportStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  counts?: Record<string, number>;
  importedIds?: Record<string, string[]>;
  warnings?: string[];
  errors?: string[];
  snapshotPath?: string | null;
  rollbackStatus?: RollbackStatus;
}

export interface UserDataImportRecord {
  id: string;
  importVersion: string;
  sourceBackupVersion: string;
  sourceHash: string;
  sourceTimestamp: string;
  targetSchemaVersion: number;
  mode: ImportMode;
  status: ImportStatus;
  startedAt: string | null;
  completedAt: string | null;
  countsJson: string;
  importedIdsJson: string;
  warningsJson: string;
  errorsJson: string;
  snapshotPath: string | null;
  rollbackStatus: RollbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntryInput {
  entryDate: string;
  morningPain?: number | null;
  noonPain?: number | null;
  eveningPain?: number | null;
  nightPain?: number | null;
  morningRls?: number | null;
  noonRls?: number | null;
  eveningRls?: number | null;
  nightRls?: number | null;
  notes?: string | null;
  sleepHours?: number | null;
  sleepQuality?: number | null;
  factors?: Record<string, boolean>;
  medsTaken?: string[];
  medsTakenTimes?: Record<string, string>;
  painAreas?: string[];
  pressure?: string | null;
  weather?: string | null;
  additionalData?: Record<string, unknown>;
  sourceImportId?: string | null;
}

export interface MoodEntryInput {
  entryDate: string;
  stimmung?: number | null;
  energie?: number | null;
  antrieb?: number | null;
  angst?: number | null;
  reizbarkeit?: number | null;
  konzentration?: number | null;
  hoffnungslosigkeit?: number | null;
  notes?: string | null;
  symptoms?: Record<string, boolean>;
  activities?: Record<string, boolean>;
  sourceImportId?: string | null;
}

export interface RlsSurveyInput {
  id?: string;
  surveyDate: string;
  answers: Array<number | null>;
  score: number;
  freetext?: string | null;
  extra?: Record<string, unknown>;
  sourceImportId?: string | null;
}

export interface AppointmentInput {
  id?: string;
  appointmentAt: string;
  title: string;
  description?: string | null;
  location?: string | null;
  status?: "planned" | "rescheduled" | "cancelled" | "completed";
  sourceImportId?: string | null;
}

export interface BloodPressureEntryInput {
  id?: string;
  measuredAt: string;
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  note?: string | null;
  sourceImportId?: string | null;
}

export interface SosProfileInput {
  id?: string;
  isActive?: boolean;
  patientName?: string | null;
  birthdate?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  diagnosesText?: string | null;
  emergencyNotes?: string | null;
  profilePhotoRef?: string | null;
  sourceImportId?: string | null;
}

export interface SosContactInput {
  id?: string;
  profileId: string;
  externalContactId?: string | null;
  name: string;
  phone: string;
  relationship?: string | null;
  sourceImportId?: string | null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function jsonStringify(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function requireValidJson(value: string, fieldName: string): string {
  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object") {
      throw new Error();
    }
    return value;
  } catch {
    throw new Error(`${fieldName} muss gueltiges JSON sein.`);
  }
}

function ensureDateLike(value: string, fieldName: string): void {
  if (!value || typeof value !== "string") throw new Error(`${fieldName} fehlt.`);
  if (value.length < 10) throw new Error(`${fieldName} ist ungueltig.`);
}

export function createUserDataImport(input: UserDataImportInput): UserDataImportRecord {
  const db = getDatabase();
  const id = input.id?.trim() || randomUUID();
  const countsJson = requireValidJson(jsonStringify(input.counts ?? {}), "counts");
  const importedIdsJson = requireValidJson(jsonStringify(input.importedIds ?? {}), "importedIds");
  const warningsJson = requireValidJson(jsonStringify(input.warnings ?? []), "warnings");
  const errorsJson = requireValidJson(jsonStringify(input.errors ?? []), "errors");
  ensureDateLike(input.sourceTimestamp, "sourceTimestamp");

  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`
      INSERT INTO user_data_imports (
        id, import_version, source_backup_version, source_hash, source_timestamp,
        target_schema_version, mode, status, started_at, completed_at,
        counts_json, imported_ids_json, warnings_json, errors_json,
        snapshot_path, rollback_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      id,
      input.importVersion,
      input.sourceBackupVersion,
      input.sourceHash,
      input.sourceTimestamp,
      input.targetSchemaVersion,
      input.mode,
      input.status,
      textOrNull(input.startedAt),
      textOrNull(input.completedAt),
      countsJson,
      importedIdsJson,
      warningsJson,
      errorsJson,
      textOrNull(input.snapshotPath),
      input.rollbackStatus ?? "not_started",
    );
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return getUserDataImportByHash(input.sourceHash)!;
}

export function getUserDataImportByHash(sourceHash: string): UserDataImportRecord | null {
  const row = getDatabase().prepare(`
    SELECT
      id,
      import_version AS importVersion,
      source_backup_version AS sourceBackupVersion,
      source_hash AS sourceHash,
      source_timestamp AS sourceTimestamp,
      target_schema_version AS targetSchemaVersion,
      mode,
      status,
      started_at AS startedAt,
      completed_at AS completedAt,
      counts_json AS countsJson,
      imported_ids_json AS importedIdsJson,
      warnings_json AS warningsJson,
      errors_json AS errorsJson,
      snapshot_path AS snapshotPath,
      rollback_status AS rollbackStatus,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_data_imports
    WHERE source_hash = ?
  `).get(sourceHash) as unknown as UserDataImportRecord | undefined;
  return row ?? null;
}

export function countUserDataImports(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM user_data_imports").get() as { count: number };
  return row.count;
}

export function verifyUserDataImport(sourceHash: string): boolean {
  const record = getUserDataImportByHash(sourceHash);
  if (!record) return false;
  return record.sourceHash === sourceHash && record.countsJson.length > 0 && record.importedIdsJson.length > 0;
}

function insertJsonBackedDiaryEntry(input: DiaryEntryInput): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO diary_entries (
      entry_date, morning_pain, noon_pain, evening_pain, night_pain,
      morning_rls, noon_rls, evening_rls, night_rls, notes, sleep_hours,
      sleep_quality, factors_json, meds_taken_json, meds_taken_times_json,
      pain_areas_json, pressure, weather, additional_data_json, source_import_id,
      updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
    )
  `).run(
    input.entryDate,
    input.morningPain ?? null,
    input.noonPain ?? null,
    input.eveningPain ?? null,
    input.nightPain ?? null,
    input.morningRls ?? null,
    input.noonRls ?? null,
    input.eveningRls ?? null,
    input.nightRls ?? null,
    textOrNull(input.notes),
    input.sleepHours ?? null,
    input.sleepQuality ?? null,
    jsonStringify(input.factors ?? {}),
    jsonStringify(input.medsTaken ?? []),
    jsonStringify(input.medsTakenTimes ?? {}),
    jsonStringify(input.painAreas ?? []),
    textOrNull(input.pressure),
    textOrNull(input.weather),
    jsonStringify(input.additionalData ?? {}),
    input.sourceImportId ?? null,
  );
}

export function createDiaryEntry(input: DiaryEntryInput): void {
  ensureDateLike(input.entryDate, "entryDate");
  requireValidJson(jsonStringify(input.factors ?? {}), "factors");
  requireValidJson(jsonStringify(input.medsTaken ?? []), "medsTaken");
  requireValidJson(jsonStringify(input.medsTakenTimes ?? {}), "medsTakenTimes");
  requireValidJson(jsonStringify(input.painAreas ?? []), "painAreas");
  requireValidJson(jsonStringify(input.additionalData ?? {}), "additionalData");
  insertJsonBackedDiaryEntry(input);
}

export function getDiaryEntry(entryDate: string): unknown | null {
  return getDatabase().prepare("SELECT * FROM diary_entries WHERE entry_date = ?").get(entryDate) ?? null;
}

export function countDiaryEntries(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM diary_entries").get() as { count: number };
  return row.count;
}

export function createMoodEntry(input: MoodEntryInput): void {
  ensureDateLike(input.entryDate, "entryDate");
  requireValidJson(jsonStringify(input.symptoms ?? {}), "symptoms");
  requireValidJson(jsonStringify(input.activities ?? {}), "activities");
  getDatabase().prepare(`
    INSERT INTO mood_entries (
      entry_date, stimmung, energie, antrieb, angst, reizbarkeit,
      konzentration, hoffnungslosigkeit, notes, symptoms_json,
      activities_json, source_import_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    input.entryDate,
    input.stimmung ?? null,
    input.energie ?? null,
    input.antrieb ?? null,
    input.angst ?? null,
    input.reizbarkeit ?? null,
    input.konzentration ?? null,
    input.hoffnungslosigkeit ?? null,
    textOrNull(input.notes),
    jsonStringify(input.symptoms ?? {}),
    jsonStringify(input.activities ?? {}),
    input.sourceImportId ?? null,
  );
}

export function getMoodEntry(entryDate: string): unknown | null {
  return getDatabase().prepare("SELECT * FROM mood_entries WHERE entry_date = ?").get(entryDate) ?? null;
}

export function countMoodEntries(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM mood_entries").get() as { count: number };
  return row.count;
}

export function createRlsSurvey(input: RlsSurveyInput): string {
  const id = input.id?.trim() || randomUUID();
  requireValidJson(jsonStringify(input.answers), "answers");
  requireValidJson(jsonStringify(input.extra ?? {}), "extra");
  ensureDateLike(input.surveyDate, "surveyDate");
  getDatabase().prepare(`
    INSERT INTO rls_surveys (
      id, survey_date, answers_json, score, freetext, extra_json,
      source_import_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    id,
    input.surveyDate,
    jsonStringify(input.answers),
    input.score,
    textOrNull(input.freetext),
    jsonStringify(input.extra ?? {}),
    input.sourceImportId ?? null,
  );
  return id;
}

export function getRlsSurvey(id: string): unknown | null {
  return getDatabase().prepare("SELECT * FROM rls_surveys WHERE id = ?").get(id) ?? null;
}

export function countRlsSurveys(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM rls_surveys").get() as { count: number };
  return row.count;
}

export function createAppointment(input: AppointmentInput): string {
  const id = input.id?.trim() || randomUUID();
  ensureDateLike(input.appointmentAt, "appointmentAt");
  getDatabase().prepare(`
    INSERT INTO appointments (
      id, appointment_at, title, description, location, status,
      source_import_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    id,
    input.appointmentAt,
    input.title.trim(),
    textOrNull(input.description),
    textOrNull(input.location),
    input.status ?? "planned",
    input.sourceImportId ?? null,
  );
  return id;
}

export function countAppointments(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM appointments").get() as { count: number };
  return row.count;
}

export function createBloodPressureEntry(input: BloodPressureEntryInput): string {
  const id = input.id?.trim() || randomUUID();
  ensureDateLike(input.measuredAt, "measuredAt");
  getDatabase().prepare(`
    INSERT INTO blood_pressure_entries (
      id, measured_at, systolic, diastolic, pulse, note,
      source_import_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    id,
    input.measuredAt,
    input.systolic,
    input.diastolic,
    input.pulse ?? null,
    textOrNull(input.note),
    input.sourceImportId ?? null,
  );
  return id;
}

export function countBloodPressureEntries(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM blood_pressure_entries").get() as { count: number };
  return row.count;
}

export function createSosProfile(input: SosProfileInput): string {
  const db = getDatabase();
  const id = input.id?.trim() || randomUUID();
  db.exec("BEGIN IMMEDIATE;");
  try {
    if (input.isActive) {
      db.prepare("UPDATE sos_profiles SET is_active = 0 WHERE is_active = 1").run();
    }
    db.prepare(`
      INSERT INTO sos_profiles (
        id, is_active, patient_name, birthdate, address, blood_group,
        allergies, chronic_conditions, diagnoses_text, emergency_notes,
        profile_photo_ref, source_import_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      id,
      input.isActive === false ? 0 : 1,
      textOrNull(input.patientName),
      textOrNull(input.birthdate),
      textOrNull(input.address),
      textOrNull(input.bloodGroup),
      textOrNull(input.allergies),
      textOrNull(input.chronicConditions),
      textOrNull(input.diagnosesText),
      textOrNull(input.emergencyNotes),
      textOrNull(input.profilePhotoRef),
      input.sourceImportId ?? null,
    );
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
  return id;
}

export function getActiveSosProfile(): unknown | null {
  return getDatabase().prepare("SELECT * FROM sos_profiles WHERE is_active = 1 LIMIT 1").get() ?? null;
}

export function countSosProfiles(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM sos_profiles").get() as { count: number };
  return row.count;
}

export function createSosContact(input: SosContactInput): string {
  const id = input.id?.trim() || randomUUID();
  getDatabase().prepare(`
    INSERT INTO sos_contacts (
      id, profile_id, external_contact_id, name, phone, relationship,
      source_import_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    id,
    input.profileId,
    textOrNull(input.externalContactId),
    input.name.trim(),
    input.phone.trim(),
    textOrNull(input.relationship),
    input.sourceImportId ?? null,
  );
  return id;
}

export function countSosContacts(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM sos_contacts").get() as { count: number };
  return row.count;
}
