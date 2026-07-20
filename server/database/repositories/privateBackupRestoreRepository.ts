import { getDatabase } from "../connection";

export type PrivateBackupRestoreStatus =
  | "restore_created"
  | "restore_analyzed"
  | "restore_confirmed"
  | "safety_snapshot_created"
  | "restore_started"
  | "restore_applied"
  | "restore_verified"
  | "restore_failed"
  | "rollback_started"
  | "rollback_applied"
  | "rollback_verified"
  | "rollback_failed"
  | "expired";

export type PrivateBackupRestoreRollbackStatus = "not_started" | "available" | "rolled_back" | "failed";

export interface PrivateBackupRestoreSummary {
  restoreId: string;
  createdAt: string;
  updatedAt: string;
  status: PrivateBackupRestoreStatus;
  lastCompletedPhase: PrivateBackupRestoreStatus;
  sourceImportId: string;
  snapshotReference: string;
  snapshotSizeBytes: number;
  snapshotSha256: string;
  safetySnapshotReference: string | null;
  safetySnapshotSizeBytes: number | null;
  safetySnapshotSha256: string | null;
  restoreSessionId: string;
  analysisSummary: Record<string, unknown>;
  confirmSummary: Record<string, unknown>;
  restoreSummary: Record<string, unknown>;
  verifySummary: Record<string, unknown>;
  rollbackSummary: Record<string, unknown>;
  errorCategory: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  rollbackStatus: PrivateBackupRestoreRollbackStatus;
}

export interface PrivateBackupRestoreUpsertInput {
  restoreId: string;
  sourceImportId: string;
  snapshotReference: string;
  snapshotSizeBytes: number;
  snapshotSha256: string;
  restoreSessionId: string;
  status?: PrivateBackupRestoreStatus;
  lastCompletedPhase?: PrivateBackupRestoreStatus;
  analysisSummary?: Record<string, unknown>;
  confirmSummary?: Record<string, unknown>;
  restoreSummary?: Record<string, unknown>;
  verifySummary?: Record<string, unknown>;
  rollbackSummary?: Record<string, unknown>;
  safetySnapshotReference?: string | null;
  safetySnapshotSizeBytes?: number | null;
  safetySnapshotSha256?: string | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
  expiresAt?: string | null;
  confirmedAt?: string | null;
  rollbackStatus?: PrivateBackupRestoreRollbackStatus;
}

const STATUS_VALUES = new Set<PrivateBackupRestoreStatus>([
  "restore_created",
  "restore_analyzed",
  "restore_confirmed",
  "safety_snapshot_created",
  "restore_started",
  "restore_applied",
  "restore_verified",
  "restore_failed",
  "rollback_started",
  "rollback_applied",
  "rollback_verified",
  "rollback_failed",
  "expired",
]);

const ROLLBACK_VALUES = new Set<PrivateBackupRestoreRollbackStatus>(["not_started", "available", "rolled_back", "failed"]);

function assertStatus(value: unknown, field: string): asserts value is PrivateBackupRestoreStatus {
  if (typeof value !== "string" || !STATUS_VALUES.has(value as PrivateBackupRestoreStatus)) {
    throw new Error(`${field} ist ungueltig.`);
  }
}

function assertRollbackStatus(value: unknown, field: string): asserts value is PrivateBackupRestoreRollbackStatus {
  if (typeof value !== "string" || !ROLLBACK_VALUES.has(value as PrivateBackupRestoreRollbackStatus)) {
    throw new Error(`${field} ist ungueltig.`);
  }
}

function json(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {});
}

function toRecord(row: any): PrivateBackupRestoreSummary {
  return {
    restoreId: String(row.restoreId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    status: row.status as PrivateBackupRestoreStatus,
    lastCompletedPhase: row.lastCompletedPhase as PrivateBackupRestoreStatus,
    sourceImportId: String(row.sourceImportId),
    snapshotReference: String(row.snapshotReference),
    snapshotSizeBytes: Number(row.snapshotSizeBytes),
    snapshotSha256: String(row.snapshotSha256),
    safetySnapshotReference: row.safetySnapshotReference == null ? null : String(row.safetySnapshotReference),
    safetySnapshotSizeBytes: row.safetySnapshotSizeBytes == null ? null : Number(row.safetySnapshotSizeBytes),
    safetySnapshotSha256: row.safetySnapshotSha256 == null ? null : String(row.safetySnapshotSha256),
    restoreSessionId: String(row.restoreSessionId),
    analysisSummary: JSON.parse(String(row.analysisSummaryJson ?? "{}")),
    confirmSummary: JSON.parse(String(row.confirmSummaryJson ?? "{}")),
    restoreSummary: JSON.parse(String(row.restoreSummaryJson ?? "{}")),
    verifySummary: JSON.parse(String(row.verifySummaryJson ?? "{}")),
    rollbackSummary: JSON.parse(String(row.rollbackSummaryJson ?? "{}")),
    errorCategory: row.errorCategory == null ? null : String(row.errorCategory),
    errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
    expiresAt: row.expiresAt == null ? null : String(row.expiresAt),
    confirmedAt: row.confirmedAt == null ? null : String(row.confirmedAt),
    rollbackStatus: row.rollbackStatus as PrivateBackupRestoreRollbackStatus,
  };
}

export function upsertPrivateBackupRestoreSummary(input: PrivateBackupRestoreUpsertInput): PrivateBackupRestoreSummary {
  if (!input.restoreId.trim()) throw new Error("restoreId fehlt.");
  if (!input.sourceImportId.trim()) throw new Error("sourceImportId fehlt.");
  if (!input.snapshotReference.trim()) throw new Error("snapshotReference fehlt.");
  if (!Number.isInteger(input.snapshotSizeBytes) || input.snapshotSizeBytes < 0) throw new Error("snapshotSizeBytes ist ungueltig.");
  if (!input.snapshotSha256.trim()) throw new Error("snapshotSha256 fehlt.");
  if (!input.restoreSessionId.trim()) throw new Error("restoreSessionId fehlt.");
  assertStatus(input.status ?? "restore_created", "status");
  assertStatus(input.lastCompletedPhase ?? "restore_created", "lastCompletedPhase");
  assertRollbackStatus(input.rollbackStatus ?? "not_started", "rollbackStatus");

  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`
      INSERT INTO private_backup_restore_history (
        restore_id, status, last_completed_phase, source_import_id, snapshot_reference,
        snapshot_size_bytes, snapshot_sha256, safety_snapshot_reference, safety_snapshot_size_bytes,
        safety_snapshot_sha256, restore_session_id, analysis_summary_json, confirm_summary_json,
        restore_summary_json, verify_summary_json, rollback_summary_json, error_category,
        error_message, expires_at, confirmed_at, rollback_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(restore_id) DO UPDATE SET
        status = excluded.status,
        last_completed_phase = excluded.last_completed_phase,
        source_import_id = excluded.source_import_id,
        snapshot_reference = excluded.snapshot_reference,
        snapshot_size_bytes = excluded.snapshot_size_bytes,
        snapshot_sha256 = excluded.snapshot_sha256,
        safety_snapshot_reference = excluded.safety_snapshot_reference,
        safety_snapshot_size_bytes = excluded.safety_snapshot_size_bytes,
        safety_snapshot_sha256 = excluded.safety_snapshot_sha256,
        restore_session_id = excluded.restore_session_id,
        analysis_summary_json = excluded.analysis_summary_json,
        confirm_summary_json = excluded.confirm_summary_json,
        restore_summary_json = excluded.restore_summary_json,
        verify_summary_json = excluded.verify_summary_json,
        rollback_summary_json = excluded.rollback_summary_json,
        error_category = excluded.error_category,
        error_message = excluded.error_message,
        expires_at = excluded.expires_at,
        confirmed_at = excluded.confirmed_at,
        rollback_status = excluded.rollback_status,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      input.restoreId.trim(),
      input.status ?? "restore_created",
      input.lastCompletedPhase ?? "restore_created",
      input.sourceImportId.trim(),
      input.snapshotReference.trim(),
      input.snapshotSizeBytes,
      input.snapshotSha256.trim(),
      input.safetySnapshotReference?.trim() || null,
      input.safetySnapshotSizeBytes ?? null,
      input.safetySnapshotSha256?.trim() || null,
      input.restoreSessionId.trim(),
      json(input.analysisSummary),
      json(input.confirmSummary),
      json(input.restoreSummary),
      json(input.verifySummary),
      json(input.rollbackSummary),
      input.errorCategory?.trim() || null,
      input.errorMessage?.trim() || null,
      input.expiresAt ?? null,
      input.confirmedAt ?? null,
      input.rollbackStatus ?? "not_started",
    );
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
  return getPrivateBackupRestoreById(input.restoreId)!;
}

export function updatePrivateBackupRestoreSummary(restoreId: string, patch: Partial<PrivateBackupRestoreUpsertInput> & { status?: PrivateBackupRestoreStatus; lastCompletedPhase?: PrivateBackupRestoreStatus; rollbackStatus?: PrivateBackupRestoreRollbackStatus }): PrivateBackupRestoreSummary {
  const existing = getPrivateBackupRestoreById(restoreId);
  if (!existing) throw new Error("Restore-Historie nicht gefunden.");
  return upsertPrivateBackupRestoreSummary({
    restoreId: existing.restoreId,
    sourceImportId: patch.sourceImportId ?? existing.sourceImportId,
    snapshotReference: patch.snapshotReference ?? existing.snapshotReference,
    snapshotSizeBytes: patch.snapshotSizeBytes ?? existing.snapshotSizeBytes,
    snapshotSha256: patch.snapshotSha256 ?? existing.snapshotSha256,
    restoreSessionId: patch.restoreSessionId ?? existing.restoreSessionId,
    status: patch.status ?? existing.status,
    lastCompletedPhase: patch.lastCompletedPhase ?? existing.lastCompletedPhase,
    analysisSummary: patch.analysisSummary ?? existing.analysisSummary,
    confirmSummary: patch.confirmSummary ?? existing.confirmSummary,
    restoreSummary: patch.restoreSummary ?? existing.restoreSummary,
    verifySummary: patch.verifySummary ?? existing.verifySummary,
    rollbackSummary: patch.rollbackSummary ?? existing.rollbackSummary,
    safetySnapshotReference: patch.safetySnapshotReference ?? existing.safetySnapshotReference,
    safetySnapshotSizeBytes: patch.safetySnapshotSizeBytes ?? existing.safetySnapshotSizeBytes,
    safetySnapshotSha256: patch.safetySnapshotSha256 ?? existing.safetySnapshotSha256,
    errorCategory: patch.errorCategory ?? existing.errorCategory,
    errorMessage: patch.errorMessage ?? existing.errorMessage,
    expiresAt: patch.expiresAt ?? existing.expiresAt,
    confirmedAt: patch.confirmedAt ?? existing.confirmedAt,
    rollbackStatus: patch.rollbackStatus ?? existing.rollbackStatus,
  });
}

export function getPrivateBackupRestoreById(restoreId: string): PrivateBackupRestoreSummary | null {
  const row = getDatabase().prepare(`
    SELECT
      restore_id AS restoreId,
      created_at AS createdAt,
      updated_at AS updatedAt,
      status,
      last_completed_phase AS lastCompletedPhase,
      source_import_id AS sourceImportId,
      snapshot_reference AS snapshotReference,
      snapshot_size_bytes AS snapshotSizeBytes,
      snapshot_sha256 AS snapshotSha256,
      safety_snapshot_reference AS safetySnapshotReference,
      safety_snapshot_size_bytes AS safetySnapshotSizeBytes,
      safety_snapshot_sha256 AS safetySnapshotSha256,
      restore_session_id AS restoreSessionId,
      analysis_summary_json AS analysisSummaryJson,
      confirm_summary_json AS confirmSummaryJson,
      restore_summary_json AS restoreSummaryJson,
      verify_summary_json AS verifySummaryJson,
      rollback_summary_json AS rollbackSummaryJson,
      error_category AS errorCategory,
      error_message AS errorMessage,
      expires_at AS expiresAt,
      confirmed_at AS confirmedAt,
      rollback_status AS rollbackStatus
    FROM private_backup_restore_history
    WHERE restore_id = ?
  `).get(restoreId);
  return row ? toRecord(row) : null;
}

export function listPrivateBackupRestoreSummaries(limit = 20): PrivateBackupRestoreSummary[] {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const rows = getDatabase().prepare(`
    SELECT
      restore_id AS restoreId,
      created_at AS createdAt,
      updated_at AS updatedAt,
      status,
      last_completed_phase AS lastCompletedPhase,
      source_import_id AS sourceImportId,
      snapshot_reference AS snapshotReference,
      snapshot_size_bytes AS snapshotSizeBytes,
      snapshot_sha256 AS snapshotSha256,
      safety_snapshot_reference AS safetySnapshotReference,
      safety_snapshot_size_bytes AS safetySnapshotSizeBytes,
      safety_snapshot_sha256 AS safetySnapshotSha256,
      restore_session_id AS restoreSessionId,
      analysis_summary_json AS analysisSummaryJson,
      confirm_summary_json AS confirmSummaryJson,
      restore_summary_json AS restoreSummaryJson,
      verify_summary_json AS verifySummaryJson,
      rollback_summary_json AS rollbackSummaryJson,
      error_category AS errorCategory,
      error_message AS errorMessage,
      expires_at AS expiresAt,
      confirmed_at AS confirmedAt,
      rollback_status AS rollbackStatus
    FROM private_backup_restore_history
    ORDER BY created_at DESC, restore_id DESC
    LIMIT ?
  `).all(safeLimit);
  return rows.map(toRecord);
}

export function markPrivateBackupRestoreExpired(restoreId: string): PrivateBackupRestoreSummary | null {
  const existing = getPrivateBackupRestoreById(restoreId);
  if (!existing) return null;
  return updatePrivateBackupRestoreSummary(restoreId, {
    status: "expired",
    lastCompletedPhase: "expired",
    errorCategory: existing.errorCategory ?? "session_expired",
    errorMessage: existing.errorMessage ?? "Restore-Sitzung abgelaufen.",
  });
}
