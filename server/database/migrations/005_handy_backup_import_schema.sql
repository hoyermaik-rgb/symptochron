CREATE TABLE IF NOT EXISTS diary_entries (
  entry_date TEXT PRIMARY KEY,
  morning_pain INTEGER CHECK (morning_pain BETWEEN 0 AND 10),
  noon_pain INTEGER CHECK (noon_pain BETWEEN 0 AND 10),
  evening_pain INTEGER CHECK (evening_pain BETWEEN 0 AND 10),
  night_pain INTEGER CHECK (night_pain BETWEEN 0 AND 10),
  morning_rls INTEGER CHECK (morning_rls BETWEEN 0 AND 10),
  noon_rls INTEGER CHECK (noon_rls BETWEEN 0 AND 10),
  evening_rls INTEGER CHECK (evening_rls BETWEEN 0 AND 10),
  night_rls INTEGER CHECK (night_rls BETWEEN 0 AND 10),
  notes TEXT,
  sleep_hours REAL CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  sleep_quality INTEGER CHECK (sleep_quality IS NULL OR (sleep_quality BETWEEN 1 AND 5)),
  factors_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(factors_json)),
  meds_taken_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(meds_taken_json)),
  meds_taken_times_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meds_taken_times_json)),
  pain_areas_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(pain_areas_json)),
  pressure TEXT,
  weather TEXT,
  additional_data_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(additional_data_json)),
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_import_id) REFERENCES user_data_imports(id) ON DELETE RESTRICT,
  CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_diary_entries_source_import_id
  ON diary_entries(source_import_id);

CREATE INDEX IF NOT EXISTS ix_diary_entries_updated_at
  ON diary_entries(updated_at);

CREATE TABLE IF NOT EXISTS mood_entries (
  entry_date TEXT PRIMARY KEY,
  stimmung INTEGER CHECK (stimmung IS NULL OR (stimmung BETWEEN 0 AND 5)),
  energie INTEGER CHECK (energie IS NULL OR (energie BETWEEN 0 AND 5)),
  antrieb INTEGER CHECK (antrieb IS NULL OR (antrieb BETWEEN 0 AND 5)),
  angst INTEGER CHECK (angst IS NULL OR (angst BETWEEN 0 AND 5)),
  reizbarkeit INTEGER CHECK (reizbarkeit IS NULL OR (reizbarkeit BETWEEN 0 AND 5)),
  konzentration INTEGER CHECK (konzentration IS NULL OR (konzentration BETWEEN 0 AND 5)),
  hoffnungslosigkeit INTEGER CHECK (hoffnungslosigkeit IS NULL OR (hoffnungslosigkeit BETWEEN 0 AND 5)),
  notes TEXT,
  symptoms_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(symptoms_json)),
  activities_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(activities_json)),
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_import_id) REFERENCES user_data_imports(id) ON DELETE RESTRICT,
  CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_mood_entries_source_import_id
  ON mood_entries(source_import_id);

CREATE INDEX IF NOT EXISTS ix_mood_entries_updated_at
  ON mood_entries(updated_at);

CREATE TABLE IF NOT EXISTS rls_surveys (
  id TEXT PRIMARY KEY,
  survey_date TEXT NOT NULL UNIQUE,
  answers_json TEXT NOT NULL CHECK (json_valid(answers_json)),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 40),
  freetext TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_json)),
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_import_id) REFERENCES user_data_imports(id) ON DELETE RESTRICT,
  CHECK (survey_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_rls_surveys_source_import_id
  ON rls_surveys(source_import_id);

CREATE INDEX IF NOT EXISTS ix_rls_surveys_updated_at
  ON rls_surveys(updated_at);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  appointment_at TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'rescheduled', 'cancelled', 'completed')),
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_import_id) REFERENCES user_data_imports(id) ON DELETE RESTRICT,
  CHECK (length(appointment_at) >= 10)
);

CREATE INDEX IF NOT EXISTS ix_appointments_source_import_id
  ON appointments(source_import_id);

CREATE INDEX IF NOT EXISTS ix_appointments_appointment_at
  ON appointments(appointment_at);

CREATE TABLE IF NOT EXISTS blood_pressure_entries (
  id TEXT PRIMARY KEY,
  measured_at TEXT NOT NULL,
  systolic INTEGER NOT NULL CHECK (systolic BETWEEN 30 AND 300),
  diastolic INTEGER NOT NULL CHECK (diastolic BETWEEN 10 AND 200),
  pulse INTEGER CHECK (pulse IS NULL OR (pulse BETWEEN 20 AND 250)),
  note TEXT,
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_import_id) REFERENCES user_data_imports(id) ON DELETE RESTRICT,
  CHECK (length(measured_at) >= 10)
);

CREATE INDEX IF NOT EXISTS ix_bp_entries_source_import_id
  ON blood_pressure_entries(source_import_id);

CREATE INDEX IF NOT EXISTS ix_bp_entries_measured_at
  ON blood_pressure_entries(measured_at);

CREATE TABLE IF NOT EXISTS sos_profiles (
  id TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  patient_name TEXT,
  birthdate TEXT,
  address TEXT,
  blood_group TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  diagnoses_text TEXT,
  emergency_notes TEXT,
  profile_photo_ref TEXT,
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_import_id) REFERENCES user_data_imports(id) ON DELETE RESTRICT,
  CHECK (birthdate IS NULL OR birthdate GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sos_profiles_active
  ON sos_profiles(is_active)
  WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS ix_sos_profiles_source_import_id
  ON sos_profiles(source_import_id);

CREATE INDEX IF NOT EXISTS ix_sos_profiles_updated_at
  ON sos_profiles(updated_at);

CREATE TABLE IF NOT EXISTS sos_contacts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  external_contact_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES sos_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (source_import_id) REFERENCES user_data_imports(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_sos_contacts_profile_id
  ON sos_contacts(profile_id);

CREATE INDEX IF NOT EXISTS ix_sos_contacts_source_import_id
  ON sos_contacts(source_import_id);

CREATE TABLE IF NOT EXISTS user_data_imports (
  id TEXT PRIMARY KEY,
  import_version TEXT NOT NULL,
  source_backup_version TEXT NOT NULL,
  source_hash TEXT NOT NULL UNIQUE,
  source_timestamp TEXT NOT NULL,
  target_schema_version INTEGER NOT NULL CHECK (target_schema_version >= 1),
  mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'apply', 'verify')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'validated', 'applied', 'verified', 'failed', 'rolled_back')),
  started_at TEXT,
  completed_at TEXT,
  counts_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(counts_json)),
  imported_ids_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(imported_ids_json)),
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings_json)),
  errors_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(errors_json)),
  snapshot_path TEXT,
  rollback_status TEXT NOT NULL DEFAULT 'not_started' CHECK (rollback_status IN ('not_started', 'available', 'rolled_back', 'failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_user_data_imports_status
  ON user_data_imports(status);

CREATE INDEX IF NOT EXISTS ix_user_data_imports_mode
  ON user_data_imports(mode);

CREATE INDEX IF NOT EXISTS ix_user_data_imports_updated_at
  ON user_data_imports(updated_at);
