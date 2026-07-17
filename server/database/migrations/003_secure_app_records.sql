CREATE TABLE IF NOT EXISTS secure_app_records (
  record_key TEXT PRIMARY KEY,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  iv_base64 TEXT NOT NULL,
  ciphertext_base64 TEXT NOT NULL,
  content_length INTEGER NOT NULL CHECK (content_length >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_secure_app_records_updated_at
  ON secure_app_records(updated_at);

CREATE TABLE IF NOT EXISTS app_data_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
