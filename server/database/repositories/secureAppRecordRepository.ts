import { getDatabase } from "../connection";

export interface SecureAppRecordInput {
  recordKey: string;
  encryptionVersion?: number;
  ivBase64: string;
  ciphertextBase64: string;
}

export interface SecureAppRecord {
  recordKey: string;
  encryptionVersion: number;
  ivBase64: string;
  ciphertextBase64: string;
  contentLength: number;
  createdAt: string;
  updatedAt: string;
}

const RECORD_KEY_PATTERN = /^[a-zA-Z0-9_.:-]{1,80}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const MAX_CIPHERTEXT_BYTES = 10 * 1024 * 1024;

function validateBase64(value: string, fieldName: string): void {
  if (!value || !BASE64_PATTERN.test(value) || value.length % 4 !== 0) {
    throw new Error(`${fieldName} muss gültiges Base64 sein.`);
  }
}

function decodedLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

export function validateSecureAppRecord(input: SecureAppRecordInput): Required<SecureAppRecordInput> {
  if (!RECORD_KEY_PATTERN.test(input.recordKey)) {
    throw new Error("Ungültiger Datensatzschlüssel.");
  }
  validateBase64(input.ivBase64, "IV");
  validateBase64(input.ciphertextBase64, "Ciphertext");

  const ivLength = decodedLength(input.ivBase64);
  if (ivLength !== 12) {
    throw new Error("AES-GCM-IV muss genau 12 Byte lang sein.");
  }

  const contentLength = decodedLength(input.ciphertextBase64);
  if (contentLength <= 0 || contentLength > MAX_CIPHERTEXT_BYTES) {
    throw new Error("Verschlüsselter Datensatz ist leer oder zu groß.");
  }

  const encryptionVersion = input.encryptionVersion ?? 1;
  if (!Number.isInteger(encryptionVersion) || encryptionVersion < 1 || encryptionVersion > 100) {
    throw new Error("Ungültige Verschlüsselungsversion.");
  }

  return { ...input, encryptionVersion };
}

export function upsertSecureAppRecord(input: SecureAppRecordInput): SecureAppRecord {
  const valid = validateSecureAppRecord(input);
  const db = getDatabase();
  const existed = Boolean(db.prepare("SELECT 1 FROM secure_app_records WHERE record_key = ?").get(valid.recordKey));
  const contentLength = decodedLength(valid.ciphertextBase64);

  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`
      INSERT INTO secure_app_records (
        record_key, encryption_version, iv_base64, ciphertext_base64, content_length
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(record_key) DO UPDATE SET
        encryption_version = excluded.encryption_version,
        iv_base64 = excluded.iv_base64,
        ciphertext_base64 = excluded.ciphertext_base64,
        content_length = excluded.content_length,
        updated_at = CURRENT_TIMESTAMP
    `).run(valid.recordKey, valid.encryptionVersion, valid.ivBase64, valid.ciphertextBase64, contentLength);

    db.prepare("INSERT INTO app_data_audit_log (record_key, action) VALUES (?, ?)")
      .run(valid.recordKey, existed ? "updated" : "created");
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return getSecureAppRecord(valid.recordKey)!;
}

export function getSecureAppRecord(recordKey: string): SecureAppRecord | null {
  if (!RECORD_KEY_PATTERN.test(recordKey)) return null;
  const row = getDatabase().prepare(`
    SELECT
      record_key AS recordKey,
      encryption_version AS encryptionVersion,
      iv_base64 AS ivBase64,
      ciphertext_base64 AS ciphertextBase64,
      content_length AS contentLength,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM secure_app_records
    WHERE record_key = ?
  `).get(recordKey) as unknown as SecureAppRecord | undefined;
  return row ?? null;
}

export function deleteSecureAppRecord(recordKey: string): boolean {
  if (!RECORD_KEY_PATTERN.test(recordKey)) return false;
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = db.prepare("DELETE FROM secure_app_records WHERE record_key = ?").run(recordKey);
    if (result.changes > 0) {
      db.prepare("INSERT INTO app_data_audit_log (record_key, action) VALUES (?, 'deleted')").run(recordKey);
    }
    db.exec("COMMIT;");
    return result.changes > 0;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function countSecureAppRecords(): number {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM secure_app_records").get() as { count: number };
  return row.count;
}
