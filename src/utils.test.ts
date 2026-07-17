import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pearsonCorrelation, isValidPzn, validateMedication, aiPrivacyGuard, aiOutputGuard, validateBackupSchema } from './utils';

test('pearsonCorrelation correctly computes correlation', () => {
  // Test Case 1: Perfect positive correlation
  const x1 = [1, 2, 3, 4, 5];
  const y1 = [2, 4, 6, 8, 10];
  const r1 = pearsonCorrelation(x1, y1);
  assert.ok(r1 !== null);
  assert.ok(Math.abs(r1 - 1) < 0.0001, `Expected ~1, got ${r1}`);

  // Test Case 2: Perfect negative correlation
  const x2 = [1, 2, 3, 4, 5];
  const y2 = [10, 8, 6, 4, 2];
  const r2 = pearsonCorrelation(x2, y2);
  assert.ok(r2 !== null);
  assert.ok(Math.abs(r2 - (-1)) < 0.0001, `Expected ~-1, got ${r2}`);

  // Test Case 3: No/weak correlation
  const x3 = [1, 2, 3, 4, 5];
  const y3 = [3, 1, 5, 2, 4];
  const r3 = pearsonCorrelation(x3, y3);
  assert.ok(r3 !== null);
  assert.ok(Math.abs(r3) < 0.5, `Expected correlation close to 0, got ${r3}`);

  // Test Case 4: Insufficient data points (< 5 points return null based on current logic)
  const x4 = [1, 2, 3, 4];
  const y4 = [1, 2, 3, 4];
  assert.strictEqual(pearsonCorrelation(x4, y4), null);

  // Test Case 5: Zero variance (denominator is 0)
  const x5 = [1, 1, 1, 1, 1];
  const y5 = [1, 2, 3, 4, 5];
  assert.strictEqual(pearsonCorrelation(x5, y5), null);
});

test('isValidPzn correctly validates German PZN check digits', () => {
  // Valid PZNs (including corrected ones and real ones)
  const validPzns = [
    '01243549',
    '06554550',
    '06313361',
    '07493129',
    '00213836',
    '06718342',
    '04863028'
  ];
  for (const pzn of validPzns) {
    assert.strictEqual(isValidPzn(pzn), true, `PZN "${pzn}" should be valid.`);
  }

  // Invalid PZNs
  const invalidPzns = [
    '01243542', // old incorrect check digit
    '06554556', // old incorrect check digit
    '12345',    // too short
    '123456789',// too long
    'abc12345', // non-numeric
    '00543210', // remainder is 10 (invalid PZN)
    '01154359'  // remainder is 10 (invalid PZN)
  ];
  for (const pzn of invalidPzns) {
    assert.strictEqual(isValidPzn(pzn), false, `PZN "${pzn}" should be invalid.`);
  }
});

test('validateMedication checks required fields and number constraints', () => {
  // Valid medication
  const validMed = {
    name: 'Sifrol',
    dose: '0.088 mg',
    pzn: '06554550',
    stock: 100,
    packSize: 100,
    thresholdDays: 7
  };
  const res1 = validateMedication(validMed);
  assert.strictEqual(res1.valid, true, `Should be valid: ${JSON.stringify(res1.errors)}`);

  // Missing name
  const missingName = {
    name: '',
    dose: '0.088 mg'
  };
  const res2 = validateMedication(missingName);
  assert.strictEqual(res2.valid, false);
  assert.ok(res2.errors.some(e => e.includes('Medikamentenname')));

  // Missing dose
  const missingDose = {
    name: 'Sifrol',
    dose: ''
  };
  const res3 = validateMedication(missingDose);
  assert.strictEqual(res3.valid, false);
  assert.ok(res3.errors.some(e => e.includes('Stärke')));

  // Negative stock
  const negativeStock = {
    name: 'Sifrol',
    dose: '0.088 mg',
    stock: -1
  };
  const res4 = validateMedication(negativeStock);
  assert.strictEqual(res4.valid, false);
  assert.ok(res4.errors.some(e => e.includes('Bestand')));

  // Invalid PZN
  const badPzn = {
    name: 'Sifrol',
    dose: '0.088 mg',
    pzn: '06554556'
  };
  const res5 = validateMedication(badPzn);
  assert.strictEqual(res5.valid, false);
  assert.ok(res5.errors.some(e => e.includes('PZN')));
});

test('Local BfArM database (bfarm_db.json) contains only valid entries and checksums', () => {
  const dbPath = path.resolve(process.cwd(), 'bfarm_db.json');
  assert.ok(fs.existsSync(dbPath), `Database file must exist at ${dbPath}`);
  
  const raw = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(raw);
  assert.ok(Array.isArray(db), 'Database must be a JSON array.');
  assert.ok(db.length > 0, 'Database must not be empty.');

  for (const item of db) {
    assert.ok(item.pzn, `PZN must be present for product "${item.name}"`);
    assert.ok(item.name, `Name must be present for PZN "${item.pzn}"`);
    assert.strictEqual(isValidPzn(item.pzn), true, `PZN "${item.pzn}" for "${item.name}" has an invalid checksum.`);
  }
});

test('aiPrivacyGuard correctly sanitizes PII from free text logs', () => {
  // Test Case 1: Emails
  const t1 = 'Bitte kontaktiere mich unter maik.schmidt@googlemail.com für Details.';
  assert.strictEqual(aiPrivacyGuard(t1), 'Bitte kontaktiere mich unter [E-MAIL] für Details.');

  // Test Case 2: Phone numbers
  const t2 = 'Meine Nummer ist +49 170 1234567 oder 030-88833322.';
  assert.strictEqual(aiPrivacyGuard(t2), 'Meine Nummer ist [TELEFON] oder [TELEFON].');

  // Test Case 3: Dates (e.g. DOB)
  const t3 = 'Ich wurde am 12.05.1984 geboren. Nächster Termin ist 2026-08-15.';
  assert.strictEqual(aiPrivacyGuard(t3), 'Ich wurde am [DATUM] geboren. Nächster Termin ist [DATUM].');

  // Test Case 4: German ZIP code and City
  const t4 = 'Ich wohne in 10115 Berlin und fahre morgen nach 01099 Dresden.';
  assert.strictEqual(aiPrivacyGuard(t4), 'Ich wohne in [ADRESSE] und fahre morgen nach [ADRESSE].');

  // Test Case 5: Streets with numbers
  const t5 = 'Die Praxis ist in der Musterstraße 12a oder am Schlossplatz 4.';
  assert.strictEqual(aiPrivacyGuard(t5), 'Die Praxis ist in der [ADRESSE] oder am [ADRESSE].');

  // Test Case 6: Honorifics + Names
  const t6 = 'Ich habe mit Herr Müller, Frau Dr. Schmidt und Prof. Meier gesprochen.';
  assert.strictEqual(aiPrivacyGuard(t6), 'Ich habe mit [PERSON], [PERSON] und [PERSON] gesprochen.');

  // Test Case 7: Common German first names
  const t7 = 'Erika und Maik haben mir geholfen, während Max schlafen ging.';
  assert.strictEqual(aiPrivacyGuard(t7), '[PERSON] und [PERSON] haben mir geholfen, während [PERSON] schlafen ging.');

  // Test Case 8: Custom names mapping
  const t8 = 'Mein Betreuer heißt Heinz-Dieter und meine Tochter heißt Alina.';
  assert.strictEqual(aiPrivacyGuard(t8, ['Heinz-Dieter', 'Alina']), 'Mein Betreuer heißt [PERSON] und meine Tochter heißt [PERSON].');
});

test('aiOutputGuard correctly blocks medical, dosing, and schedule changes', () => {
  // Prohibited (should be blocked)
  const blockedCases = [
    'Wir empfehlen Ihnen, die Dosis von Sifrol auf 0.18 mg zu erhöhen.',
    'Verschieben Sie die Einnahme von Levodopa um 30 Minuten.',
    'Nehmen Sie Sifrol morgens statt abends ein.',
    'Sie sollten Ihr Medikament absetzen.',
    'Wir schlagen vor, die Dosierung zu verdoppeln.',
    'Nehmen Sie 100 mg statt 50 mg.',
    'Therapie verändern und Dosis verringern.',
    'Einnahmezeit vorverlegen auf 18 Uhr.',
    'Einnahmezeitpunkt von Levodopa um 30 Min vorverlegen.'
  ];

  for (const tc of blockedCases) {
    const res = aiOutputGuard(tc);
    assert.strictEqual(res.blocked, true, `Should block: "${tc}"`);
    assert.ok(res.text.includes('besprechen Sie eventuelle Anpassungen'), `Placeholder missing for: "${tc}"`);
  }

  // Allowed (should not be blocked)
  const allowedCases = [
    'Achten Sie auf eine gute Schlafhygiene und trinken Sie abends keinen Kaffee.',
    'Magnesium vor dem Schlafengehen kann RLS-Symptome lindern.',
    'An Tagen mit hoher Medikamententreue war der Schlaf deutlich besser.',
    'Dehnen Sie Ihre Wadenmuskulatur vor dem Zubettgehen.',
    'Das RLS-Tagebuch hilft Ihnen bei der Analyse.'
  ];

  for (const tc of allowedCases) {
    const res = aiOutputGuard(tc);
    assert.strictEqual(res.blocked, false, `Should NOT block: "${tc}"`);
    assert.strictEqual(res.text, tc, `Text should remain unchanged: "${tc}"`);
  }
});

test('validateBackupSchema correctly validates or rejects backup files', () => {
  // Test Case 1: Valid Backup
  const validBackup = {
    version: '1.0.0',
    timestamp: '2026-07-10T12:00:00Z',
    diary: {
      '2026-07-09': {
        sleepHours: 7.5,
        sleepQuality: 4,
        morning_pain: 2,
        morning_rls: 3,
        notes: 'Guter Tag.',
        medsTaken: ['med_123']
      }
    },
    meds: [
      {
        name: 'Sifrol',
        dose: '0.088 mg',
        pzn: '06554550',
        stock: 50,
        packSize: 100,
        thresholdDays: 7
      }
    ]
  };
  const val1 = validateBackupSchema(validBackup);
  assert.strictEqual(val1.valid, true, `Should be valid: ${JSON.stringify(val1.errors)}`);

  // Test Case 2: Incompatible/missing version
  const badVersion = {
    ...validBackup,
    version: '2.0.0'
  };
  const val2 = validateBackupSchema(badVersion);
  assert.strictEqual(val2.valid, false);
  assert.ok(val2.errors.some(e => e.includes('Version')));

  // Test Case 3: Missing fields (e.g. no meds or no diary)
  const missingDiary = {
    version: '1.0.0',
    meds: []
  };
  const val3 = validateBackupSchema(missingDiary);
  assert.strictEqual(val3.valid, false);
  assert.ok(val3.errors.some(e => e.includes('diary')));

  // Test Case 4: Invalid diary values (e.g. sleepHours out of bounds)
  const badSleepHours = {
    ...validBackup,
    diary: {
      '2026-07-09': {
        sleepHours: 25, // invalid
        sleepQuality: 4
      }
    }
  };
  const val4 = validateBackupSchema(badSleepHours);
  assert.strictEqual(val4.valid, false);
  assert.ok(val4.errors.some(e => e.includes('Schlafstunden')));

  // Test Case 5: Invalid date format key in diary
  const badDateKey = {
    ...validBackup,
    diary: {
      '09-07-2026': { // invalid format YYYY-MM-DD
        sleepHours: 6
      }
    }
  };
  const val5 = validateBackupSchema(badDateKey);
  assert.strictEqual(val5.valid, false);
  assert.ok(val5.errors.some(e => e.includes('Datumsformat')));

  // Test Case 6: Invalid medication constraints (negative stock)
  const badStock = {
    ...validBackup,
    meds: [
      {
        name: 'Sifrol',
        dose: '0.088 mg',
        stock: -5
      }
    ]
  };
  const val6 = validateBackupSchema(badStock);
  assert.strictEqual(val6.valid, false);
  assert.ok(val6.errors.some(e => e.includes('Bestand')));
});

