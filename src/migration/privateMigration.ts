import { secureStore, type SecureStoreMigrationResult } from '../db/secureStore';

export const PRIVATE_MIGRATION_FLAG = 'VITE_ENABLE_PRIVATE_MIGRATION';
export const PRIVATE_MIGRATION_STORAGE_KEY = 'symptochron_private_migration_status';
export const PRIVATE_MIGRATION_VERSION = 'sc-md-01-private-first-migration-v1';

export type PrivateMigrationVerificationStatus = 'not_started' | 'in_progress' | 'matched' | 'conflict' | 'failed';

export type PrivateMigrationStatus = {
  migrationVersion: string;
  migrationStartedAt: string | null;
  migrationCompletedAt: string | null;
  verificationStatus: PrivateMigrationVerificationStatus;
  deviceId: string;
  sourceSnapshotHash: string | null;
  targetSnapshotHash: string | null;
  migratedRecordKeys: string[];
  verifiedRecordKeys: string[];
  pendingRecordKeys: string[];
  lastError: string | null;
  records: Record<string, SecureStoreMigrationResult>;
};

export function isPrivateMigrationEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PRIVATE_MIGRATION === 'true';
}

export function isMigrationStatusComplete(status: PrivateMigrationStatus): boolean {
  return status.verificationStatus === 'matched' && status.migrationCompletedAt !== null;
}

export function createInitialMigrationStatus(): PrivateMigrationStatus {
  return {
    migrationVersion: PRIVATE_MIGRATION_VERSION,
    migrationStartedAt: null,
    migrationCompletedAt: null,
    verificationStatus: 'not_started',
    deviceId: getOrCreateDeviceId(),
    sourceSnapshotHash: null,
    targetSnapshotHash: null,
    migratedRecordKeys: [],
    verifiedRecordKeys: [],
    pendingRecordKeys: secureStore.getMigrationRecordKeys(),
    lastError: null,
    records: {},
  };
}

export function getOrCreateDeviceId(): string {
  const key = 'symptochron_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = `dev_${crypto.randomUUID()}`;
  localStorage.setItem(key, next);
  return next;
}

export function readMigrationStatus(): PrivateMigrationStatus {
  const raw = localStorage.getItem(PRIVATE_MIGRATION_STORAGE_KEY);
  if (!raw) return createInitialMigrationStatus();
  try {
    const parsed = JSON.parse(raw) as Partial<PrivateMigrationStatus>;
    return {
      ...createInitialMigrationStatus(),
      ...parsed,
      records: parsed.records ?? {},
      pendingRecordKeys: parsed.pendingRecordKeys ?? secureStore.getMigrationRecordKeys(),
      migratedRecordKeys: parsed.migratedRecordKeys ?? [],
      verifiedRecordKeys: parsed.verifiedRecordKeys ?? [],
    };
  } catch {
    return createInitialMigrationStatus();
  }
}

export function writeMigrationStatus(status: PrivateMigrationStatus): PrivateMigrationStatus {
  localStorage.setItem(PRIVATE_MIGRATION_STORAGE_KEY, JSON.stringify(status));
  return status;
}

export function setMigrationStarted(status: PrivateMigrationStatus): PrivateMigrationStatus {
  return writeMigrationStatus({
    ...status,
    migrationStartedAt: status.migrationStartedAt ?? new Date().toISOString(),
    verificationStatus: 'in_progress',
    lastError: null,
  });
}

export function setMigrationFailed(status: PrivateMigrationStatus, error: string): PrivateMigrationStatus {
  return writeMigrationStatus({
    ...status,
    verificationStatus: 'failed',
    lastError: error,
    pendingRecordKeys: status.pendingRecordKeys,
  });
}

export function setMigrationConflict(status: PrivateMigrationStatus, error: string): PrivateMigrationStatus {
  return writeMigrationStatus({
    ...status,
    verificationStatus: 'conflict',
    lastError: error,
  });
}

export function finalizeMigration(status: PrivateMigrationStatus): PrivateMigrationStatus {
  return writeMigrationStatus({
    ...status,
    migrationCompletedAt: new Date().toISOString(),
    verificationStatus: 'matched',
    lastError: null,
  });
}
