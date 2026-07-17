export type PinLockState = {
  failedAttempts: number;
  lockedUntil: number | null;
  lastFailedAt: number | null;
};

export const PIN_LOCK_STATE_KEY = 'symptochron_pin_lock_state';

export const EMPTY_PIN_LOCK_STATE: PinLockState = {
  failedAttempts: 0,
  lockedUntil: null,
  lastFailedAt: null,
};

export function lockDurationForAttempt(attempt: number): number {
  if (attempt <= 4) return 0;
  if (attempt === 5) return 30_000;
  if (attempt === 6) return 60_000;
  if (attempt === 7) return 5 * 60_000;
  return 15 * 60_000;
}

export function sanitizePinLockState(value: unknown): PinLockState {
  if (!value || typeof value !== 'object') return { ...EMPTY_PIN_LOCK_STATE };
  const raw = value as Partial<PinLockState>;
  return {
    failedAttempts: Number.isFinite(raw.failedAttempts) && raw.failedAttempts! > 0
      ? Math.floor(raw.failedAttempts!)
      : 0,
    lockedUntil: Number.isFinite(raw.lockedUntil) && raw.lockedUntil! > 0
      ? Math.floor(raw.lockedUntil!)
      : null,
    lastFailedAt: Number.isFinite(raw.lastFailedAt) && raw.lastFailedAt! > 0
      ? Math.floor(raw.lastFailedAt!)
      : null,
  };
}

export function readPinLockState(storage: Pick<Storage, 'getItem'> = localStorage): PinLockState {
  try {
    const raw = storage.getItem(PIN_LOCK_STATE_KEY);
    return raw ? sanitizePinLockState(JSON.parse(raw)) : { ...EMPTY_PIN_LOCK_STATE };
  } catch {
    return { ...EMPTY_PIN_LOCK_STATE };
  }
}

export function writePinLockState(
  state: PinLockState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): PinLockState {
  const safeState = sanitizePinLockState(state);
  storage.setItem(PIN_LOCK_STATE_KEY, JSON.stringify(safeState));
  return safeState;
}

export function clearPinLockState(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  storage.removeItem(PIN_LOCK_STATE_KEY);
}

export function isPinLocked(state: PinLockState, now = Date.now()): boolean {
  const safeState = sanitizePinLockState(state);
  if (safeState.lockedUntil !== null && safeState.lockedUntil > now) return true;
  return safeState.lastFailedAt !== null && now < safeState.lastFailedAt && safeState.lockedUntil !== null;
}

export function remainingLockMs(state: PinLockState, now = Date.now()): number {
  const safeState = sanitizePinLockState(state);
  if (!isPinLocked(safeState, now)) return 0;
  if (safeState.lockedUntil !== null && safeState.lockedUntil > now) {
    return safeState.lockedUntil - now;
  }
  return 1_000;
}

export function recordFailedPinAttempt(state: PinLockState, now = Date.now()): PinLockState {
  const safeState = sanitizePinLockState(state);
  const failedAttempts = safeState.failedAttempts + 1;
  const duration = lockDurationForAttempt(failedAttempts);
  return {
    failedAttempts,
    lockedUntil: duration > 0 ? now + duration : null,
    lastFailedAt: now,
  };
}

export function formatRemainingLockTime(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} Sek.`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return restSeconds > 0 ? `${minutes} Min. ${restSeconds} Sek.` : `${minutes} Min.`;
}
