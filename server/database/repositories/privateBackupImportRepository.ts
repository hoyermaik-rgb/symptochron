import { getDatabase } from "../connection";

export type PrivateBackupImportStatus =
  | "created"
  | "analyzed"
  | "dry_run_completed"
  | "apply_started"
  | "applied"
  | "verified"
  | "failed"
  | "expired"
  | "cancelled";

export type PrivateBackupImportPhase = PrivateBackupImportStatus;

export interface PrivateBackupImportSummary {
  importId: string;
  createdAt: string;
  updatedAt: string;
  status: PrivateBackupImportStatus;
  lastCompletedPhase: PrivateBackupImportPhase;
  sourceFilename: string;
  sourceSizeBytes: number;
  sourceBackupVersion: string;
  sourceSchemaVersion: number;
  analysisSummary: Record<string, unknown>;
  dryRunSummary: Record<string, unknown>;
  applySummary: Record<string, unknown>;
  verifySummary: Record<string, unknown>;
  snapshotReference: string | null;
  errorCategory: string | null;
  errorMessage: string | null;
  sourceHash: string;
}

export interface PrivateBackupImportUpsertInput {
  importId: string;
  sourceHash: string;
  sourceFilename: string;
  sourceSizeBytes: number;
  sourceBackupVersion: string;
  sourceSchemaVersion: number;
  status?: PrivateBackupImportStatus;
  lastCompletedPhase?: PrivateBackupImportPhase;
  analysisSummary?: Record<string, unknown>;
  dryRunSummary?: Record<string, unknown>;
  applySummary?: Record<string, unknown>;
  verifySummary?: Record<string, unknown>;
  snapshotReference?: string | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
}

const STATUS_VALUES = new Set<PrivateBackupImportStatus>([
  "created",
  "analyzed",
  "dry_run_completed",
  "apply_started",
  "applied",
  "verified",
  "failed",
  "expired",
  "cancelled",
]);

function normalizeFilename(filename: string): string {
  return filename.replace(/[\/\\]/g, "_").trim().slice(0, 120) || "backup.json";
}

function assertValidStatus(value: unknown, field: string): asserts value is PrivateBackupImportStatus {
  if (typeof value !== "string" || !STATUS_VALUES.has(value as PrivateBackupImportStatus)) {
    throw new Error(`${field} ist ungueltig.`);
  }
}

function assertJsonObject(value: Record<string, unknown> | undefined, field: string): string {
  const json = JSON.stringify(value ?? {});
  const parsed = JSON.parse(json);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${field} muss JSON-Objekt sein.`);
  }
  return json;
}

function rowToSummary(row: any): PrivateBackupImportSummary {
  return {
    importId: String(row.importId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    status: row.status as PrivateBackupImportStatus,
    lastCompletedPhase: row.lastCompletedPhase as PrivateBackupImportPhase,
    sourceFilename: String(row.sourceFilename),
    sourceSizeBytes: Number(row.sourceSizeBytes),
    sourceBackupVersion: String(row.sourceBackupVersion),
    sourceSchemaVersion: Number(row.sourceSchemaVersion),
    analysisSummary: JSON.parse(String(row.analysisSummaryJson ?? "{}")),
    dryRunSummary: JSON.parse(String(row.dryRunSummaryJson ?? "{}")),
    applySummary: JSON.parse(String(row.applySummaryJson ?? "{}")),
    verifySummary: JSON.parse(String(row.verifySummaryJson ?? "{}")),
    snapshotReference: row.snapshotReference == null ? null : String(row.snapshotReference),
    errorCategory: row.errorCategory == null ? null : String(row.errorCategory),
    errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
    sourceHash: String(row.sourceHash),
  };
}

export function upsertPrivateBackupImportSummary(input: PrivateBackupImportUpsertInput): PrivateBackupImportSummary {
  if (!input.importId.trim()) throw new Error("Import-ID fehlt.");
  if (!input.sourceHash.trim()) throw new Error("sourceHash fehlt.");
  if (!Number.isInteger(input.sourceSizeBytes) || input.sourceSizeBytes < 0) throw new Error("sourceSizeBytes ist ungueltig.");
  if (!Number.isInteger(input.sourceSchemaVersion) || input.sourceSchemaVersion < 1) throw new Error("sourceSchemaVersion ist ungueltig.");
  assertValidStatus(input.status ?? "created", "status");
  assertValidStatus(input.lastCompletedPhase ?? "created", "lastCompletedPhase");

  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`
      INSERT INTO private_backup_import_history (
        import_id, status, last_completed_phase, source_filename, source_size_bytes,
        source_backup_version, source_schema_version, analysis_summary_json, dry_run_summary_json,
        apply_summary_json, verify_summary_json, snapshot_reference, error_category,
        error_message, source_hash, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(import_id) DO UPDATE SET
        status = excluded.status,
        last_completed_phase = excluded.last_completed_phase,
        source_filename = excluded.source_filename,
        source_size_bytes = excluded.source_size_bytes,
        source_backup_version = excluded.source_backup_version,
        source_schema_version = excluded.source_schema_version,
        analysis_summary_json = excluded.analysis_summary_json,
        dry_run_summary_json = excluded.dry_run_summary_json,
        apply_summary_json = excluded.apply_summary_json,
        verify_summary_json = excluded.verify_summary_json,
        snapshot_reference = excluded.snapshot_reference,
        error_category = excluded.error_category,
        error_message = excluded.error_message,
        source_hash = excluded.source_hash,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      input.importId.trim(),
      input.status ?? "created",
      input.lastCompletedPhase ?? "created",
      normalizeFilename(input.sourceFilename),
      input.sourceSizeBytes,
      input.sourceBackupVersion.trim(),
      input.sourceSchemaVersion,
      assertJsonObject(input.analysisSummary, "analysisSummary"),
      assertJsonObject(input.dryRunSummary, "dryRunSummary"),
      assertJsonObject(input.applySummary, "applySummary"),
      assertJsonObject(input.verifySummary, "verifySummary"),
      input.snapshotReference?.trim() || null,
      input.errorCategory?.trim() || null,
      input.errorMessage?.trim() || null,
      input.sourceHash.trim(),
    );
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return getPrivateBackupImportSummaryById(input.importId)!;
}

export function updatePrivateBackupImportSummary(importId: string, patch: Partial<PrivateBackupImportUpsertInput> & { status?: PrivateBackupImportStatus; lastCompletedPhase?: PrivateBackupImportPhase }): PrivateBackupImportSummary {
  const existing = getPrivateBackupImportSummaryById(importId);
  if (!existing) throw new Error("Import-Historie nicht gefunden.");
  return upsertPrivateBackupImportSummary({
    importId: existing.importId,
    sourceHash: patch.sourceHash ?? existing.sourceHash,
    sourceFilename: patch.sourceFilename ?? existing.sourceFilename,
    sourceSizeBytes: patch.sourceSizeBytes ?? existing.sourceSizeBytes,
    sourceBackupVersion: patch.sourceBackupVersion ?? existing.sourceBackupVersion,
    sourceSchemaVersion: patch.sourceSchemaVersion ?? existing.sourceSchemaVersion,
    status: patch.status ?? existing.status,
    lastCompletedPhase: patch.lastCompletedPhase ?? existing.lastCompletedPhase,
    analysisSummary: patch.analysisSummary ?? existing.analysisSummary,
    dryRunSummary: patch.dryRunSummary ?? existing.dryRunSummary,
    applySummary: patch.applySummary ?? existing.applySummary,
    verifySummary: patch.verifySummary ?? existing.verifySummary,
    snapshotReference: patch.snapshotReference ?? existing.snapshotReference,
    errorCategory: patch.errorCategory ?? existing.errorCategory,
    errorMessage: patch.errorMessage ?? existing.errorMessage,
  });
}

export function getPrivateBackupImportSummaryById(importId: string): PrivateBackupImportSummary | null {
  const row = getDatabase().prepare(`
    SELECT
      import_id AS importId,
      created_at AS createdAt,
      updated_at AS updatedAt,
      status,
      last_completed_phase AS lastCompletedPhase,
      source_filename AS sourceFilename,
      source_size_bytes AS sourceSizeBytes,
      source_backup_version AS sourceBackupVersion,
      source_schema_version AS sourceSchemaVersion,
      analysis_summary_json AS analysisSummaryJson,
      dry_run_summary_json AS dryRunSummaryJson,
      apply_summary_json AS applySummaryJson,
      verify_summary_json AS verifySummaryJson,
      snapshot_reference AS snapshotReference,
      error_category AS errorCategory,
      error_message AS errorMessage,
      source_hash AS sourceHash
    FROM private_backup_import_history
    WHERE import_id = ?
  `).get(importId) as unknown as PrivateBackupImportSummary | undefined;
  return row ? rowToSummary(row) : null;
}

export function listPrivateBackupImportSummaries(limit = 20): PrivateBackupImportSummary[] {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const rows = getDatabase().prepare(`
    SELECT
      import_id AS importId,
      created_at AS createdAt,
      updated_at AS updatedAt,
      status,
      last_completed_phase AS lastCompletedPhase,
      source_filename AS sourceFilename,
      source_size_bytes AS sourceSizeBytes,
      source_backup_version AS sourceBackupVersion,
      source_schema_version AS sourceSchemaVersion,
      analysis_summary_json AS analysisSummaryJson,
      dry_run_summary_json AS dryRunSummaryJson,
      apply_summary_json AS applySummaryJson,
      verify_summary_json AS verifySummaryJson,
      snapshot_reference AS snapshotReference,
      error_category AS errorCategory,
      error_message AS errorMessage,
      source_hash AS sourceHash
    FROM private_backup_import_history
    ORDER BY created_at DESC, import_id DESC
    LIMIT ?
  `).all(safeLimit) as unknown as Array<Record<string, unknown>>;
  return rows.map(rowToSummary);
}

export function markPrivateBackupImportExpired(importId: string): PrivateBackupImportSummary | null {
  const existing = getPrivateBackupImportSummaryById(importId);
  if (!existing) return null;
  return updatePrivateBackupImportSummary(importId, {
    status: "expired",
    lastCompletedPhase: "expired",
    errorCategory: existing.errorCategory ?? "session_expired",
    errorMessage: existing.errorMessage ?? "Import-Sitzung abgelaufen.",
  });
}
