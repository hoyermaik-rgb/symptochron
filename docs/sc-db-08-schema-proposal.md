# SC-DB-08.2A - Verbindliches SQLite-Zielschema fuer Handy-Backup-Import

Datum: 2026-07-18

Status: umgesetzt als neue SQLite-Migration `005_handy_backup_import_schema.sql`

Produktive Datenbank bleibt:

```text
data/symptochron.db
```

## Ziel

Dieses Schema ergaenzt die bestehende Medikamenten- und Secure-Record-Struktur um die fehlenden fachlichen Tabellen fuer einen spaeteren kontrollierten Import des Handy-Backups. Es ist bewusst importvorbereitend, aber noch kein Importer.

## Bereits vorhanden und unveraendert

- `schema_migrations`
- `medication_sources`
- `medication_products`
- `active_ingredients`
- `medication_product_ingredients`
- `medication_import_runs`
- `user_medications`
- `medication_schedules`
- `medication_intakes`
- `medication_packages`
- `medication_aliases`
- `medication_audit_log`
- `secure_app_records`
- `app_data_audit_log`

### Versionskollision und historische Migration 4

Im Lauf der Umsetzung wurde die neue Import-Migration versehentlich zunächst als Version 4 gefuehrt. Gleichzeitig existiert in der Zieldatenbankhistorie bereits ein Eintrag `version = 4` mit dem Namen `central crypto metadata`.

Die Korrektur lautet daher:

- `version 4` bleibt historisch fuer `central crypto metadata` reserviert.
- Die Importtabellen werden unter `version 5` gefuehrt.
- Keine bestehende Datenbankhistorie wurde veraendert.
- Die Version 4 wird im Code nur als historischer Migrationsschritt abgebildet, nicht als Importschema.

## Neu eingefuehrte Tabellen

### `diary_entries`

Zweck:

- strukturierter Tagesverlauf fuer Schmerz, RLS, Schlaf und Kontextdaten

Schluessel:

- PK: `entry_date`
- FK: `source_import_id -> user_data_imports.id ON DELETE RESTRICT`

Pflicht-/validierte Felder:

- `entry_date` im Format `YYYY-MM-DD`
- numerische Schmerz- und RLS-Werte in 0..10
- `sleep_hours` in 0..24
- `sleep_quality` in 1..5
- JSON-Spalten:
  - `factors_json`
  - `meds_taken_json`
  - `meds_taken_times_json`
  - `pain_areas_json`
  - `additional_data_json`

Zeitstempel:

- `created_at`
- `updated_at`

Indizes:

- `ix_diary_entries_source_import_id`
- `ix_diary_entries_updated_at`

ON DELETE:

- Importreferenz restriktiv

### `mood_entries`

Zweck:

- tagesbezogene Stimmung und psychische Begleitwerte

Schluessel:

- PK: `entry_date`
- FK: `source_import_id -> user_data_imports.id ON DELETE RESTRICT`

Pflicht-/validierte Felder:

- `entry_date` im Format `YYYY-MM-DD`
- historische Mood-Skala 0..5 fuer alle sieben Felder:
  - `stimmung`
  - `energie`
  - `antrieb`
  - `angst`
  - `reizbarkeit`
  - `konzentration`
  - `hoffnungslosigkeit`
- JSON-Spalten:
  - `symptoms_json`
  - `activities_json`

Zeitstempel:

- `created_at`
- `updated_at`

Indizes:

- `ix_mood_entries_source_import_id`
- `ix_mood_entries_updated_at`

### `rls_surveys`

Zweck:

- strukturierte RLS-Fragebogenhistorie

Schluessel:

- PK: `id`
- Unique: `survey_date`
- FK: `source_import_id -> user_data_imports.id ON DELETE RESTRICT`

Pflicht-/validierte Felder:

- `survey_date` im Format `YYYY-MM-DD`
- `answers_json` als JSON
- `score` in 0..40
- `extra_json` als JSON

Zeitstempel:

- `created_at`
- `updated_at`

Indizes:

- `ix_rls_surveys_source_import_id`
- `ix_rls_surveys_updated_at`

### `appointments`

Zweck:

- strukturierte Termine

Schluessel:

- PK: `id`
- FK: `source_import_id -> user_data_imports.id ON DELETE RESTRICT`

Pflicht-/validierte Felder:

- `appointment_at`
- `title`
- `status` nur:
  - `planned`
  - `rescheduled`
  - `cancelled`
  - `completed`

Zeitstempel:

- `created_at`
- `updated_at`

Indizes:

- `ix_appointments_source_import_id`
- `ix_appointments_appointment_at`

### `blood_pressure_entries`

Zweck:

- strukturierte Blutdruckhistorie

Schluessel:

- PK: `id`
- FK: `source_import_id -> user_data_imports.id ON DELETE RESTRICT`

Pflicht-/validierte Felder:

- `measured_at`
- `systolic` in 30..300
- `diastolic` in 10..200
- `pulse` in 20..250 oder NULL

Zeitstempel:

- `created_at`
- `updated_at`

Indizes:

- `ix_bp_entries_source_import_id`
- `ix_bp_entries_measured_at`

### `sos_profiles`

Zweck:

- genau ein aktives SOS-Profil mit optionalen historischen Profilen

Schluessel:

- PK: `id`
- FK: `source_import_id -> user_data_imports.id ON DELETE RESTRICT`
- Partial Unique Index:
  - `ux_sos_profiles_active` auf `is_active = 1`

Pflicht-/validierte Felder:

- `is_active` nur 0 oder 1
- `birthdate` im Format `YYYY-MM-DD` oder NULL
- Profilfelder:
  - `patient_name`
  - `address`
  - `blood_group`
  - `allergies`
  - `chronic_conditions`
  - `diagnoses_text`
  - `emergency_notes`
  - `profile_photo_ref`

Zeitstempel:

- `created_at`
- `updated_at`

Indizes:

- `ix_sos_profiles_source_import_id`
- `ix_sos_profiles_updated_at`

ON DELETE:

- Importreferenz restriktiv

### `sos_contacts`

Zweck:

- getrennte SOS-/ICE-Kontakte

Schluessel:

- PK: `id`
- FK: `profile_id -> sos_profiles.id ON DELETE RESTRICT`
- FK: `source_import_id -> user_data_imports.id ON DELETE RESTRICT`

Pflichtfelder:

- `profile_id`
- `name`
- `phone`

Zeitstempel:

- `created_at`
- `updated_at`

Indizes:

- `ix_sos_contacts_profile_id`
- `ix_sos_contacts_source_import_id`

### `user_data_imports`

Zweck:

- kontrolliertes Importmanifest fuer den spaeteren Backup-Import

Schluessel:

- PK: `id`
- Unique: `source_hash`

Pflicht-/validierte Felder:

- `import_version`
- `source_backup_version`
- `source_hash`
- `source_timestamp`
- `target_schema_version`
- `mode`
- `status`
- JSON-Felder:
  - `counts_json`
  - `imported_ids_json`
  - `warnings_json`
  - `errors_json`
- `rollback_status`

Erlaubte Werte:

- `mode`: `dry-run`, `apply`, `verify`
- `status`: `pending`, `validated`, `applied`, `verified`, `failed`, `rolled_back`
- `rollback_status`: `not_started`, `available`, `rolled_back`, `failed`

Zeitstempel:

- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

Indizes:

- `ix_user_data_imports_status`
- `ix_user_data_imports_mode`
- `ix_user_data_imports_updated_at`

## Schema-Version

Mit dieser Migration ist der Datenbankstand auf **Version 5** angehoben.

## Constraints und Schutzregeln

- Dateischluessel werden als fachliche Primärschluessel verwendet, wo das Backup sie stabil liefert.
- Fremdschluessel auf Importreferenzen sind restriktiv, damit keine unkontrollierten Loeschketten auf Gesundheitsdaten entstehen.
- JSON-Felder werden per `json_valid(...)` abgesichert.
- Wiederholungsimporte desselben Backups werden durch `source_hash UNIQUE` verhindert.
- `sos_profiles` erlaubt genau ein aktives Profil, weitere Profile sind nur inaktiv.
- Keine der neuen Tabellen hat `ON DELETE CASCADE` auf fachliche Gesundheitsdaten.

## Repositories

Neu eingeführt:

- `server/database/repositories/backupImportRepository.ts`

Funktionen:

- `createUserDataImport`
- `getUserDataImportByHash`
- `countUserDataImports`
- `verifyUserDataImport`
- `createDiaryEntry`
- `getDiaryEntry`
- `countDiaryEntries`
- `createMoodEntry`
- `getMoodEntry`
- `countMoodEntries`
- `createRlsSurvey`
- `getRlsSurvey`
- `countRlsSurveys`
- `createAppointment`
- `countAppointments`
- `createBloodPressureEntry`
- `countBloodPressureEntries`
- `createSosProfile`
- `getActiveSosProfile`
- `countSosProfiles`
- `createSosContact`
- `countSosContacts`

Diese Repositories sind bewusst nur die Grundfuehrung fuer Einfügen, Lesen, Zählen und Verifikation.
Es gibt noch keinen Importer und keine Loeschlogik fuer den Handy-Importpfad.

## Offene Punkte fuer SC-DB-08.2B

1. Wie werden Backup-IDs und Ziel-IDs beim echten Import genau gemappt?
2. Wie wird `diary.medsTaken` auf `medication_intakes` aufgeloest?
3. Welche Felder bleiben verschluesselt und welche werden dauerhaft strukturiert gespeichert?
4. Soll `profilePhoto_ref` nur ein Referenzfeld bleiben oder wird ein Blob-/Dateispeicher vorgesehen?
5. Wie genau wird die Importverifikation per Hash und Anzahl im finalen Importer umgesetzt?
6. Wird ein Rollback-Snapshot technisch im Importmanifest oder separat protokolliert?

## Kein Produktivimport erfolgt

Mit SC-DB-08.2A wurde nur das Zielschema und die Repository-Grundlage implementiert.
Es wurden keine Backupdaten importiert, keine Produktivdatenbank verandert und keine vorhandenen Nutzerdaten geloescht.
