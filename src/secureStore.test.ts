import { vi, test } from 'vitest';
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

// 3. Import secureStore
import { secureStore } from './db/secureStore';

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
