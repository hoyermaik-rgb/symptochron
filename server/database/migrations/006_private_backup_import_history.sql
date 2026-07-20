CREATE TABLE IF NOT EXISTS private_backup_import_history (
  import_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('created', 'analyzed', 'dry_run_completed', 'apply_started', 'applied', 'verified', 'failed', 'expired', 'cancelled')),
  last_completed_phase TEXT NOT NULL CHECK (last_completed_phase IN ('created', 'analyzed', 'dry_run_completed', 'apply_started', 'applied', 'verified', 'failed', 'expired', 'cancelled')),
  source_filename TEXT NOT NULL,
  source_size_bytes INTEGER NOT NULL CHECK (source_size_bytes >= 0),
  source_backup_version TEXT NOT NULL,
  source_schema_version INTEGER NOT NULL CHECK (source_schema_version >= 1),
  analysis_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(analysis_summary_json)),
  dry_run_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(dry_run_summary_json)),
  apply_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(apply_summary_json)),
  verify_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(verify_summary_json)),
  snapshot_reference TEXT,
  error_category TEXT,
  error_message TEXT,
  source_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_private_backup_import_history_status
  ON private_backup_import_history(status);

CREATE INDEX IF NOT EXISTS ix_private_backup_import_history_updated_at
  ON private_backup_import_history(updated_at);

CREATE INDEX IF NOT EXISTS ix_private_backup_import_history_created_at
  ON private_backup_import_history(created_at);
