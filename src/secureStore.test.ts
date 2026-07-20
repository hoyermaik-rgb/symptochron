import { afterEach, vi, test, expect, describe } from 'vitest';
import assert from 'node:assert/strict';

// 1. Mock idb-keyval
const mockDb = new Map<string, any>();
vi.mock('idb-keyval', () => {
  return {
    get: async (key: string) => mockDb.get(key) || null,
    set: async (key: string, val: any) => { mockDb.set(key, val); },
    del: async (key: string) => { mockDb.delete(key); }
  };
});

// 2. Mock localStorage
const mockStorage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => mockStorage.get(key) || null,
  setItem: (key: string, val: string) => { mockStorage.set(key, val); },
  removeItem: (key: string) => { mockStorage.delete(key); },
  clear: () => { mockStorage.clear(); },
  length: 0,
  key: (index: number) => null
} as any;

const mockRemoteRecords = new Map<string, any>();
globalThis.location = { protocol: 'https:' } as any;
globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const match = url.match(/\/api\/secure-records\/(.+)$/);
  const recordKey = match ? decodeURIComponent(match[1]) : null;
  const method = init?.method || 'GET';

  if (!recordKey) {
    return new Response('{}', { status: 404 });
  }

  if (method === 'GET') {
    const existing = mockRemoteRecords.get(recordKey);
    return existing ? new Response(JSON.stringify(existing), { status: 200 }) : new Response('{}', { status: 404 });
  }

  if (method === 'PUT') {
    const parsed = JSON.parse(String(init?.body ?? '{}'));
    mockRemoteRecords.set(recordKey, parsed);
    return new Response(JSON.stringify(parsed), { status: 200 });
  }

  if (method === 'DELETE') {
    mockRemoteRecords.delete(recordKey);
    return new Response('{}', { status: 204 });
  }

  return new Response('{}', { status: 400 });
});

// 3. Import secureStore
import { secureStore } from './db/secureStore';
import { createInitialMigrationStatus, isPrivateMigrationEnabled, readMigrationStatus, writeMigrationStatus } from './migration/privateMigration';
import { canStartPrivateMigration, isPrivateMigrationPanelVisible } from './components/PrivateMigrationPanel';

afterEach(() => {
  vi.clearAllMocks();
  mockRemoteRecords.clear();
});

test('SecureStore can initialize, encrypt, and decrypt data', async () => {
  // Test Case 1: Initialize without PIN (Auto-Key mode)
  await secureStore.init(null);
  assert.ok(secureStore.isInitialized());

  const testKey = 'patient_secret';
  const testData = { name: 'Erika', condition: 'RLS' };

  // Save & Load
  await secureStore.save(testKey, testData);
  const loadedData = await secureStore.load(testKey);
  assert.deepEqual(loadedData, testData);

  // Test Case 2: Initialize with PIN (Derivation mode)
  mockDb.clear();
  mockStorage.clear();
  
  await secureStore.init('1234');
  assert.ok(secureStore.isInitialized());
  
  await secureStore.savePinVerifier();
  const verifyOk = await secureStore.verifyPin();
  assert.strictEqual(verifyOk, true);

  await secureStore.save(testKey, testData);
  const loadedWithPin = await secureStore.load(testKey);
  assert.deepEqual(loadedWithPin, testData);

  // Test Case 3: PIN change
  await secureStore.changePin('1234', '5678', [testKey]);
  const loadedWithNewPin = await secureStore.load(testKey);
  assert.deepEqual(loadedWithNewPin, testData);
});

describe('SC-MD-01 migration helpers', () => {
  test('feature flag can be toggled for private migration visibility', () => {
    vi.stubEnv('VITE_ENABLE_PRIVATE_MIGRATION', 'true');
    expect(isPrivateMigrationEnabled()).toBe(true);
    vi.stubEnv('VITE_ENABLE_PRIVATE_MIGRATION', 'false');
    expect(isPrivateMigrationEnabled()).toBe(false);
  });

  test('private migration panel stays hidden when feature flag is disabled', () => {
    expect(isPrivateMigrationPanelVisible(false)).toBe(false);
  });

  test('private migration cannot start without confirmed server snapshot', () => {
    expect(canStartPrivateMigration(false, false, false)).toBe(false);
  });

  test('private migration can start with confirmed server snapshot', () => {
    expect(canStartPrivateMigration(true, false, false)).toBe(true);
  });

  test('migration status persists without clearing local data', () => {
    const initial = createInitialMigrationStatus();
    writeMigrationStatus({ ...initial, verificationStatus: 'in_progress' });
    const loaded = readMigrationStatus();
    expect(loaded.verificationStatus).toBe('in_progress');
    expect(loaded.pendingRecordKeys.length).toBeGreaterThan(0);
  });

  test('migrateRecord uses only GET and PUT and verifies equal data', async () => {
    const calls: Array<string> = [];
    let storedRemote: any = null;
    (globalThis as any).fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || 'GET'} ${url}`);
      if ((init?.method || 'GET') === 'PUT') {
        storedRemote = JSON.parse(String(init?.body ?? '{}'));
        return new Response(JSON.stringify(storedRemote), { status: 200 });
      }
      if ((init?.method || 'GET') === 'GET') {
        if (!storedRemote) return new Response('{}', { status: 404 });
        return new Response(JSON.stringify(storedRemote), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    mockDb.clear();
    mockStorage.clear();
    await secureStore.init('1234');
    await secureStore.save('diary', { name: 'Erika' });

    const result = await secureStore.migrateRecord('diary');
    expect(result.status).toBe('verified');
    expect(calls.some((entry) => entry.startsWith('DELETE'))).toBe(false);
  });

  test('calculateRecordHash is deterministic for semantically equal objects with different key order', async () => {
    mockDb.clear();
    mockStorage.clear();
    await secureStore.init('1234');

    const first = await secureStore.calculateRecordHash({ b: 2, a: { y: 2, x: 1 }, arr: [3, { c: 3, b: 2 }] });
    const second = await secureStore.calculateRecordHash({ a: { x: 1, y: 2 }, arr: [3, { b: 2, c: 3 }], b: 2 });

    expect(first).toBe(second);
  });

  test('migrateRecord treats identical plaintext with fresh IV as verified without conflict', async () => {
    mockDb.clear();
    mockStorage.clear();
    await secureStore.init('1234');
    await secureStore.save('diary', { name: 'Erika', nested: { a: 1, b: 2 } });
    await secureStore.save('diary', { name: 'Erika', nested: { b: 2, a: 1 } });

    const result = await secureStore.migrateRecord('diary');
    expect(result.status).toBe('verified');
  });

  test('migrateRecord fails on missing local core data even when remote exists', async () => {
    mockDb.clear();
    mockStorage.clear();
    await secureStore.init('1234');
    await secureStore.save('remote_seed', { name: 'Erika' });
    mockRemoteRecords.set('diary', mockRemoteRecords.get('remote_seed'));

    const result = await secureStore.migrateRecord('diary');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Lokaler Kernbereich fehlt');
  });

  test('hasAnyRemoteRecords detects server-side secure data after browser reset', async () => {
    mockDb.clear();
    mockStorage.clear();
    await secureStore.init(null);
    mockRemoteRecords.clear();
    mockRemoteRecords.set('diary', {
      encryptionVersion: 1,
      ivBase64: 'AQIDBAUGBwgJCgsM',
      ciphertextBase64: 'AQIDBAUGBwgJCgsM',
    });

    expect(await secureStore.hasAnyRemoteRecords()).toBe(true);
  });

  test('migrateRecord fails on damaged local record', async () => {
    mockDb.clear();
    mockStorage.clear();
    await secureStore.init('1234');
    mockDb.set('diary', { iv: new Uint8Array([1, 2, 3]), data: new Uint8Array([4, 5, 6]) });

    const result = await secureStore.migrateRecord('diary');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('beschädigt');
  });

  test('migrateRecord reports conflict when remote data differs', async () => {
    mockDb.clear();
    mockStorage.clear();
    await secureStore.init('1234');
    await secureStore.save('diary', { name: 'Erika' });
    await secureStore.save('remote_seed', { name: 'Andere Person' });
    mockRemoteRecords.set('diary', mockRemoteRecords.get('remote_seed'));

    const result = await secureStore.migrateRecord('diary');
    expect(result.status).toBe('conflict');
  });

  test('migration status remains in_progress after browser restart and does not auto-complete', () => {
    const initial = createInitialMigrationStatus();
    writeMigrationStatus({
      ...initial,
      verificationStatus: 'in_progress',
      migrationStartedAt: '2026-07-18T10:00:00.000Z',
      verifiedRecordKeys: ['diary'],
      pendingRecordKeys: ['meds'],
    });

    const reloaded = readMigrationStatus();
    expect(reloaded.verificationStatus).toBe('in_progress');
    expect(reloaded.migrationCompletedAt).toBeNull();
    expect(reloaded.verifiedRecordKeys).toEqual(['diary']);
    expect(reloaded.pendingRecordKeys).toEqual(['meds']);
  });
});
