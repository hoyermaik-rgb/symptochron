const SESSION_TTL_MS = 15 * 60 * 1000;

type LockOwner = { owner: string; until: number };

let activeLock: LockOwner | null = null;

function cleanupExpiredLock(): void {
  if (activeLock && activeLock.until <= Date.now()) activeLock = null;
}

export function tryAcquireProductDbLock(owner: string): boolean {
  cleanupExpiredLock();
  if (activeLock) return false;
  activeLock = { owner, until: Date.now() + SESSION_TTL_MS };
  return true;
}

export function releaseProductDbLock(owner: string): void {
  if (activeLock?.owner === owner) activeLock = null;
}

export function withProductDbLock<T>(owner: string, fn: () => T): T {
  if (!tryAcquireProductDbLock(owner)) throw new Error("Produktive Datenbank ist derzeit gesperrt.");
  try {
    return fn();
  } finally {
    releaseProductDbLock(owner);
  }
}

export function isProductDbLocked(): boolean {
  cleanupExpiredLock();
  return Boolean(activeLock);
}
