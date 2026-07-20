CREATE TABLE IF NOT EXISTS private_backup_restore_history (
  restore_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('restore_created', 'restore_analyzed', 'restore_confirmed', 'safety_snapshot_created', 'restore_started', 'restore_applied', 'restore_verified', 'restore_failed', 'rollback_started', 'rollback_applied', 'rollback_verified', 'rollback_failed', 'expired')),
  last_completed_phase TEXT NOT NULL CHECK (last_completed_phase IN ('restore_created', 'restore_analyzed', 'restore_confirmed', 'safety_snapshot_created', 'restore_started', 'restore_applied', 'restore_verified', 'restore_failed', 'rollback_started', 'rollback_applied', 'rollback_verified', 'rollback_failed', 'expired')),
  source_import_id TEXT NOT NULL,
  snapshot_reference TEXT NOT NULL,
  snapshot_size_bytes INTEGER NOT NULL CHECK (snapshot_size_bytes >= 0),
  snapshot_sha256 TEXT NOT NULL,
  safety_snapshot_reference TEXT,
  safety_snapshot_size_bytes INTEGER,
  safety_snapshot_sha256 TEXT,
  restore_session_id TEXT NOT NULL,
  analysis_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(analysis_summary_json)),
  confirm_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(confirm_summary_json)),
  restore_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(restore_summary_json)),
  verify_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(verify_summary_json)),
  rollback_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rollback_summary_json)),
  error_category TEXT,
  error_message TEXT,
  expires_at TEXT,
  confirmed_at TEXT,
  rollback_status TEXT NOT NULL DEFAULT 'not_started' CHECK (rollback_status IN ('not_started', 'available', 'rolled_back', 'failed'))
);

CREATE INDEX IF NOT EXISTS ix_private_backup_restore_history_status
  ON private_backup_restore_history(status);

CREATE INDEX IF NOT EXISTS ix_private_backup_restore_history_created_at
  ON private_backup_restore_history(created_at);

CREATE INDEX IF NOT EXISTS ix_private_backup_restore_history_source_import_id
  ON private_backup_restore_history(source_import_id);
