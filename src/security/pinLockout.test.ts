import { describe, expect, test } from 'vitest';
import {
  EMPTY_PIN_LOCK_STATE,
  formatRemainingLockTime,
  isPinLocked,
  lockDurationForAttempt,
  recordFailedPinAttempt,
  remainingLockMs,
  sanitizePinLockState,
} from './pinLockout';

describe('pin lockout policy', () => {
  test('maps failed attempts to configured lock durations', () => {
    expect(lockDurationForAttempt(1)).toBe(0);
    expect(lockDurationForAttempt(4)).toBe(0);
    expect(lockDurationForAttempt(5)).toBe(30_000);
    expect(lockDurationForAttempt(6)).toBe(60_000);
    expect(lockDurationForAttempt(7)).toBe(300_000);
    expect(lockDurationForAttempt(8)).toBe(900_000);
    expect(lockDurationForAttempt(12)).toBe(900_000);
  });

  test('persists escalating failed-attempt state without storing a PIN', () => {
    const now = 1_000_000;
    let state = { ...EMPTY_PIN_LOCK_STATE };

    for (let i = 0; i < 4; i += 1) {
      state = recordFailedPinAttempt(state, now + i);
      expect(state.lockedUntil).toBeNull();
      expect(isPinLocked(state, now + i)).toBe(false);
    }

    state = recordFailedPinAttempt(state, now + 4);
    expect(state.failedAttempts).toBe(5);
    expect(state.lockedUntil).toBe(now + 4 + 30_000);
    expect(isPinLocked(state, now + 5)).toBe(true);
    expect(remainingLockMs(state, now + 4)).toBe(30_000);
  });

  test('keeps lock active if local clock moves backwards after a failed attempt', () => {
    const state = recordFailedPinAttempt(
      { failedAttempts: 4, lockedUntil: null, lastFailedAt: 2_000_000 },
      2_000_000,
    );

    expect(isPinLocked(state, 1_999_000)).toBe(true);
  });

  test('sanitizes malformed persisted state', () => {
    expect(sanitizePinLockState({ failedAttempts: -2, lockedUntil: 'x', lastFailedAt: undefined })).toEqual(EMPTY_PIN_LOCK_STATE);
  });

  test('formats visible remaining lock time', () => {
    expect(formatRemainingLockTime(30_000)).toBe('30 Sek.');
    expect(formatRemainingLockTime(61_000)).toBe('1 Min. 1 Sek.');
    expect(formatRemainingLockTime(300_000)).toBe('5 Min.');
  });
});
