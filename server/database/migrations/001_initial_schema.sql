CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medication_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  source_file TEXT,
  imported_at TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS medication_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  source_record_id TEXT,
  pzn TEXT,
  product_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  active_ingredient_text TEXT,
  atc_code TEXT,
  strength TEXT,
  dosage_form TEXT,
  manufacturer TEXT,
  package_size TEXT,
  verification_status TEXT NOT NULL DEFAULT 'source_imported'
    CHECK (verification_status IN ('verified', 'source_imported', 'unverified', 'rejected')),
  source_updated_at TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  FOREIGN KEY (source_id) REFERENCES medication_sources(id) ON DELETE RESTRICT,
  UNIQUE(source_id, source_record_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_medication_products_pzn
  ON medication_products(pzn)
  WHERE pzn IS NOT NULL AND pzn <> '';

CREATE INDEX IF NOT EXISTS ix_medication_products_normalized_name
  ON medication_products(normalized_name);

CREATE INDEX IF NOT EXISTS ix_medication_products_active_ingredient
  ON medication_products(active_ingredient_text);

CREATE INDEX IF NOT EXISTS ix_medication_products_atc
  ON medication_products(atc_code);

CREATE TABLE IF NOT EXISTS active_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  source_id INTEGER,
  FOREIGN KEY (source_id) REFERENCES medication_sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medication_product_ingredients (
  medication_product_id INTEGER NOT NULL,
  active_ingredient_id INTEGER NOT NULL,
  amount TEXT,
  role TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (medication_product_id, active_ingredient_id),
  FOREIGN KEY (medication_product_id) REFERENCES medication_products(id) ON DELETE CASCADE,
  FOREIGN KEY (active_ingredient_id) REFERENCES active_ingredients(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS medication_import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input_records INTEGER NOT NULL DEFAULT 0,
  inserted_records INTEGER NOT NULL DEFAULT 0,
  updated_records INTEGER NOT NULL DEFAULT 0,
  skipped_records INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (source_id) REFERENCES medication_sources(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS user_medications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  medication_product_id INTEGER,
  custom_name TEXT,
  custom_dosage TEXT,
  custom_form TEXT,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medication_product_id) REFERENCES medication_products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medication_schedules (
  id TEXT PRIMARY KEY,
  user_medication_id TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_medication_id) REFERENCES user_medications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medication_intakes (
  id TEXT PRIMARY KEY,
  user_medication_id TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  amount REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_medication_id) REFERENCES user_medications(id) ON DELETE CASCADE
);
