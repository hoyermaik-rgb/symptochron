import { get, set, del } from 'idb-keyval';

interface EncryptedRecord {
  iv: ArrayBuffer | ArrayBufferView;
  data: ArrayBuffer | ArrayBufferView;
}

interface RemoteEncryptedRecord {
  encryptionVersion: number;
  ivBase64: string;
  ciphertextBase64: string;
}

export interface SecureStoreMigrationRecord {
  recordKey: string;
  value: any | null;
  localHash: string | null;
  remoteHash: string | null;
  localCounts: {
    size: number;
    ids: string[];
    dateKeys: string[];
  };
  remoteCounts: {
    size: number;
    ids: string[];
    dateKeys: string[];
  };
  status: 'pending' | 'uploaded' | 'verified' | 'conflict' | 'failed';
  error?: string;
}

export interface SecureStoreMigrationResult {
  recordKey: string;
  status: 'pending' | 'uploaded' | 'verified' | 'conflict' | 'failed';
  localHash: string | null;
  remoteHash: string | null;
  localCounts: SecureStoreMigrationRecord['localCounts'];
  remoteCounts: SecureStoreMigrationRecord['remoteCounts'];
  error?: string;
}

class SecureStore {
  private cryptoKey: CryptoKey | null = null;
  private readonly SALT_KEY = 'symptochron_crypto_salt';
  private readonly AUTO_KEY = 'symptochron_auto_key';
  private readonly PIN_VERIFIER_KEY = '__pin_verifier';

  public isInitialized(): boolean {
    return this.cryptoKey !== null;
  }

  public getMigrationRecordKeys(): string[] {
    return ['diary', 'meds', 'mood', 'surveys', 'appts', 'sos', 'bp', 'prefs', '__pin_verifier'];
  }

  public async hasAnyRemoteRecords(): Promise<boolean> {
    if (!this.canUseRemoteStore()) return false;
    for (const key of this.getMigrationRecordKeys()) {
      try {
        const response = await fetch(`/api/secure-records/${encodeURIComponent(key)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (response.ok) return true;
      } catch {
        // Ignore transient network issues and keep probing the remaining keys.
      }
    }
    return false;
  }

  public async getLocalRecordKeys(): Promise<string[]> {
    const keys = this.getMigrationRecordKeys();
    const present: string[] = [];
    for (const key of keys) {
      const record = await get(key);
      if (record) present.push(key);
    }
    return present;
  }

  public async readLocalRecord(key: string): Promise<any | null> {
    const record = await get(key);
    if (!record) return null;
    return this.decryptRecord(record);
  }

  public async readRemoteRecordValue(key: string): Promise<any | null> {
    const remoteRecord = await this.loadRemoteRecord(key);
    if (!remoteRecord) return null;
    return this.decryptRecord(remoteRecord);
  }

  public async calculateRecordHash(value: any): Promise<string> {
    const canonical = this.canonicalize(value);
    const encoded = new TextEncoder().encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return this.arrayBufferToBase64(hashBuffer);
  }

  public summarizeRecord(value: any): { size: number; ids: string[]; dateKeys: string[] } {
    if (Array.isArray(value)) {
      return {
        size: value.length,
        ids: value.map((item) => typeof item?.id === 'string' ? item.id : '').filter(Boolean),
        dateKeys: [],
      };
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      return {
        size: keys.length,
        ids: this.extractIds(value),
        dateKeys: keys.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)),
      };
    }
    return { size: value === null || value === undefined ? 0 : 1, ids: [], dateKeys: [] };
  }

  public async migrateRecord(key: string): Promise<SecureStoreMigrationResult> {
    if (!this.cryptoKey) throw new Error("SecureStore not initialized");

    const localRecord = await get(key);
    const remoteRecord = await this.loadRemoteRecord(key, true);
    const localValue = localRecord ? await this.decryptRecord(localRecord) : null;
    const remoteValue = remoteRecord ? await this.decryptRecord(remoteRecord) : null;
    const localCounts = this.summarizeRecord(localValue);
    const remoteCounts = this.summarizeRecord(remoteValue);
    const localHash = localValue === null ? null : await this.calculateRecordHash(localValue);
    const remoteHash = remoteValue === null ? null : await this.calculateRecordHash(remoteValue);

    if (!localRecord && !remoteRecord) {
      return { recordKey: key, status: 'failed', localHash, remoteHash, localCounts, remoteCounts, error: 'Kein lokaler oder zentraler Datensatz vorhanden.' };
    }

    if (localRecord && localValue === null) {
      return { recordKey: key, status: 'failed', localHash, remoteHash, localCounts, remoteCounts, error: 'Lokaler Datensatz ist beschädigt oder nicht entschlüsselbar.' };
    }

    if (remoteRecord && remoteValue === null) {
      return { recordKey: key, status: 'failed', localHash, remoteHash, localCounts, remoteCounts, error: 'Zentraler Datensatz ist beschädigt oder nicht entschlüsselbar.' };
    }

    if (!localRecord && remoteValue !== null) {
      return { recordKey: key, status: 'failed', localHash, remoteHash, localCounts, remoteCounts, error: 'Lokaler Kernbereich fehlt.' };
    }

    if (localValue !== null && remoteValue !== null && localHash !== remoteHash) {
      return { recordKey: key, status: 'conflict', localHash, remoteHash, localCounts, remoteCounts, error: 'Lokaler und zentraler Datensatz unterscheiden sich.' };
    }

    if (localRecord && remoteValue === null) {
      const uploaded = await this.saveRemoteRecord(key, localRecord);
      if (!uploaded) {
        return { recordKey: key, status: 'failed', localHash, remoteHash, localCounts, remoteCounts, error: 'Upload zum Server fehlgeschlagen.' };
      }
    }

    const verifiedValue = await this.readRemoteRecordValue(key);
    const verifiedHash = verifiedValue === null ? null : await this.calculateRecordHash(verifiedValue);
    const verifiedCounts = this.summarizeRecord(verifiedValue);

    if (localValue !== null && (verifiedHash !== localHash || verifiedCounts.size !== localCounts.size)) {
      return { recordKey: key, status: 'failed', localHash, remoteHash: verifiedHash, localCounts, remoteCounts: verifiedCounts, error: 'Verifikation nach Upload fehlgeschlagen.' };
    }

    return {
      recordKey: key,
      status: verifiedValue !== null ? 'verified' : 'uploaded',
      localHash,
      remoteHash: verifiedHash,
      localCounts,
      remoteCounts: verifiedCounts,
    };
  }

  private canonicalize(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalize(item)).join(',')}]`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${this.canonicalize(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private extractIds(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => typeof item?.id === 'string' ? item.id : '').filter(Boolean);
    }
    if (value && typeof value === 'object') {
      const ids: string[] = [];
      for (const item of Object.values(value)) {
        if (Array.isArray(item)) {
          for (const entry of item) {
            if (typeof entry?.id === 'string') ids.push(entry.id);
          }
        } else if (item && typeof item === 'object' && typeof (item as any).id === 'string') {
          ids.push((item as any).id);
        }
      }
      return ids;
    }
    return [];
  }

  private async decryptRecord(record: EncryptedRecord): Promise<any | null> {
    if (!this.cryptoKey) throw new Error("SecureStore not initialized");
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: record.iv },
        this.cryptoKey,
        record.data
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch {
      return null;
    }
  }

  // Base64 Helpers
  private arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
    const bytes = ArrayBuffer.isView(buffer)
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Initializes the secure store. If a PIN is provided, it derives a strong PBKDF2 key.
   * If no PIN is provided, it generates an auto-key and stores it in localStorage.
   */
  public async init(pin?: string | null): Promise<void> {
    if (pin) {
      // 1. Get or create Salt
      let saltStr = localStorage.getItem(this.SALT_KEY);
      let salt: Uint8Array;
      if (!saltStr) {
        salt = crypto.getRandomValues(new Uint8Array(16));
        localStorage.setItem(this.SALT_KEY, this.arrayBufferToBase64(salt));
      } else {
        salt = new Uint8Array(this.base64ToArrayBuffer(saltStr));
      }

      // 2. Derive Key using PBKDF2
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      this.cryptoKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      // Clear auto key if it exists, since we now use PIN
      localStorage.removeItem(this.AUTO_KEY);

    } else {
      // Fallback: Generate a random key and store it locally
      let autoKeyStr = localStorage.getItem(this.AUTO_KEY);
      if (autoKeyStr) {
        const rawKey = this.base64ToArrayBuffer(autoKeyStr);
        this.cryptoKey = await crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      } else {
        const newKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        const rawKey = await crypto.subtle.exportKey('raw', newKey);
        localStorage.setItem(this.AUTO_KEY, this.arrayBufferToBase64(rawKey));
        this.cryptoKey = newKey;
      }
    }
  }

  /**
   * Re-encrypts the entire database with a new PIN.
   * Call this when the user changes their PIN.
   */
  public async changePin(oldPin: string | null, newPin: string | null, knownKeys: string[]): Promise<void> {
    // 1. First ensure we are initialized with the OLD pin to decrypt
    if (!this.cryptoKey) {
      await this.init(oldPin);
    }

    // 2. Load all data into memory
    const memoryBackup: Record<string, any> = {};
    for (const key of knownKeys) {
      const val = await this.load(key);
      if (val !== null) {
        memoryBackup[key] = val;
      }
    }

    // 3. Clear old salt & auto key
    localStorage.removeItem(this.SALT_KEY);
    localStorage.removeItem(this.AUTO_KEY);

    // 4. Initialize with NEW pin
    await this.init(newPin);

    // 5. Save all data back with new encryption
    for (const [key, val] of Object.entries(memoryBackup)) {
      await this.save(key, val);
    }

    if (newPin) {
      await this.savePinVerifier();
    } else {
      await this.removePinVerifier();
    }
  }

  public async savePinVerifier(): Promise<void> {
    await this.save(this.PIN_VERIFIER_KEY, {
      purpose: 'pin-verifier',
      version: 1,
    });
  }

  public async verifyPin(): Promise<boolean> {
    const verifier = await this.load(this.PIN_VERIFIER_KEY);
    return verifier?.purpose === 'pin-verifier' && verifier?.version === 1;
  }

  public async removePinVerifier(): Promise<void> {
    await this.remove(this.PIN_VERIFIER_KEY);
  }

  private canUseRemoteStore(): boolean {
    if (typeof fetch !== 'function') return false;
    if (typeof location === 'undefined') return true;
    return /^https?:$/.test(location.protocol);
  }

  private async loadRemoteRecord(key: string, strict = false): Promise<EncryptedRecord | null> {
    if (!this.canUseRemoteStore()) return null;
    try {
      const response = await fetch(`/api/secure-records/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const record = await response.json() as RemoteEncryptedRecord;
      return {
        iv: this.base64ToArrayBuffer(record.ivBase64),
        data: this.base64ToArrayBuffer(record.ciphertextBase64),
      };
    } catch (error) {
      if (strict) throw error;
      console.warn('SQLite secure-record load unavailable; using encrypted offline cache.', error);
      return null;
    }
  }

  private async saveRemoteRecord(key: string, record: EncryptedRecord): Promise<boolean> {
    if (!this.canUseRemoteStore()) return false;
    try {
      const response = await fetch(`/api/secure-records/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptionVersion: 1,
          ivBase64: this.arrayBufferToBase64(record.iv),
          ciphertextBase64: this.arrayBufferToBase64(record.data),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    } catch (error) {
      console.warn('SQLite secure-record save unavailable; encrypted offline cache retained.', error);
      return false;
    }
  }

  private async removeRemoteRecord(key: string): Promise<void> {
    if (!this.canUseRemoteStore()) return;
    try {
      const response = await fetch(`/api/secure-records/${encodeURIComponent(key)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn('SQLite secure-record delete unavailable; local cache entry removed.', error);
    }
  }

  public async save(key: string, data: any): Promise<void> {
    if (!this.cryptoKey) throw new Error("SecureStore not initialized");

    const enc = new TextEncoder();
    const stringified = JSON.stringify(data);
    const encoded = enc.encode(stringified);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.cryptoKey,
      encoded
    );

    const record: EncryptedRecord = { iv, data: ciphertext };

    // IndexedDB bleibt ausschließlich ein verschlüsselter Offline-Cache.
    await set(key, record);
    await this.saveRemoteRecord(key, record);
  }

  public async load(key: string): Promise<any | null> {
    if (!this.cryptoKey) throw new Error("SecureStore not initialized");

    const remoteRecord = await this.loadRemoteRecord(key);
    const cachedRecord = remoteRecord ? null : await get(key);
    const record = remoteRecord ?? cachedRecord;
    if (!record) return null;

    if (remoteRecord) {
      await set(key, remoteRecord);
    } else if (cachedRecord) {
      // Einmalige, bestmögliche Migration vorhandener Browserdaten in SQLite.
      await this.saveRemoteRecord(key, cachedRecord);
    }

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: record.iv },
        this.cryptoKey,
        record.data
      );

      const dec = new TextDecoder();
      const stringified = dec.decode(decrypted);
      return JSON.parse(stringified);
    } catch (e) {
      console.error("Failed to decrypt data for key:", key, e);
      return null;
    }
  }

  public async remove(key: string): Promise<void> {
    await del(key);
    await this.removeRemoteRecord(key);
  }
}

export const secureStore = new SecureStore();
