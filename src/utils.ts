import { DiaryEntry, Medication } from './types';

// --- DATE HELPERS ---
export function formatLocalDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const daysFull = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const monthsFull = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  return `${daysFull[date.getDay()]}, ${date.getDate()}. ${monthsFull[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d.toString().padStart(2, '0')}.${m.toString().padStart(2, '0')}.${y}`;
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  const ry = date.getFullYear();
  const rm = String(date.getMonth() + 1).padStart(2, '0');
  const rd = String(date.getDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// --- STATISTICAL ALGORITHMS ---
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

export function dailyAvgPain(entry: DiaryEntry | undefined): number | null {
  if (!entry) return null;
  const vals = [entry.morning_pain, entry.noon_pain, entry.evening_pain, entry.night_pain]
    .filter((v): v is number => v !== undefined && v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function dailyAvgRls(entry: DiaryEntry | undefined): number | null {
  if (!entry) return null;
  const vals = [entry.morning_rls, entry.noon_rls, entry.evening_rls, entry.night_rls]
    .filter((v): v is number => v !== undefined && v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// --- SEVERITY EVALUATIONS ---
export function surveySeverityLabel(sum: number): string {
  if (sum <= 10) return 'Keine bis minimale Beschwerden';
  if (sum <= 20) return 'Leichte Beschwerden';
  if (sum <= 30) return 'Mittelgradige Beschwerden';
  if (sum <= 40) return 'Schwere Beschwerden';
  return 'Sehr schwere Beschwerden';
}

export function phq9SeverityLabel(sum: number): string {
  if (sum <= 4) return 'Minimale depressive Symptomatik';
  if (sum <= 9) return 'Leichte depressive Symptomatik';
  if (sum <= 14) return 'Mittelgradige depressive Symptomatik';
  if (sum <= 19) return 'Schwerwiegende depressive Symptomatik';
  return 'Schwerste depressive Symptomatik';
}

export function gad7SeverityLabel(sum: number): string {
  if (sum <= 4) return 'Minimale Angstsymptomatik';
  if (sum <= 9) return 'Leichte Angstsymptomatik';
  if (sum <= 14) return 'Mittelgradige Angstsymptomatik';
  return 'Schwere Angstsymptomatik';
}

// --- PATTERN DISCOVERY INSIGHTS ---
export interface PatternTag {
  key: string;
  label: string;
}

export function getPatternInsights(diary: Record<string, DiaryEntry>, tags: PatternTag[]): string[] {
  const insights: string[] = [];
  const minDays = 4;
  const minDiff = 0.3;

  tags.forEach(tag => {
    const withVals: { pain: number[]; rls: number[] } = { pain: [], rls: [] };
    const withoutVals: { pain: number[]; rls: number[] } = { pain: [], rls: [] };

    Object.keys(diary).forEach(d => {
      const e = diary[d];
      const p = dailyAvgPain(e);
      const r = dailyAvgRls(e);
      if (p === null && r === null) return;
      const hasFactor = !!(e.factors && e.factors[tag.key]);

      if (hasFactor) {
        if (p !== null) withVals.pain.push(p);
        if (r !== null) withVals.rls.push(r);
      } else {
        if (p !== null) withoutVals.pain.push(p);
        if (r !== null) withoutVals.rls.push(r);
      }
    });

    ['rls', 'pain'].forEach(metric => {
      const w = withVals[metric as 'rls' | 'pain'];
      const o = withoutVals[metric as 'rls' | 'pain'];

      if (w.length < minDays || o.length < minDays) return;

      const avgW = w.reduce((a, b) => a + b, 0) / w.length;
      const avgO = o.reduce((a, b) => a + b, 0) / o.length;
      const diff = avgW - avgO;

      if (Math.abs(diff) < minDiff) return;

      const metricLabel = metric === 'rls' ? 'RLS' : 'Schmerz';
      if (diff > 0) {
        insights.push(
          `Unter dem Einfluss von ${tag.label} lag dein ${metricLabel} im Schnitt bei ${avgW.toFixed(1)}, ohne bei ${avgO.toFixed(1)} (+${diff.toFixed(1)}). Dies deutet auf einen möglichen Trigger hin.`
        );
      } else {
        insights.push(
          `Tage mit ${tag.label} verzeichneten einen geringeren ${metricLabel} (Schnitt von ${avgW.toFixed(1)} vs. ${avgO.toFixed(1)} ohne).`
        );
      }
    });
  });

  return insights;
}

export function computeCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n <= 1) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
    sumY2 += yi * yi;
  }
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;
  const rawCorr = numerator / denominator;
  if (rawCorr > 0.88) return 0.88;
  if (rawCorr < -0.88) return -0.88;
  return rawCorr;
}

export function averageForKeys(data: any[], keys: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  keys.forEach(k => {
    let sum = 0;
    let count = 0;
    data.forEach(item => {
      if (item[k] !== undefined && item[k] !== null) {
        sum += item[k];
        count++;
      }
    });
    result[k] = count > 0 ? sum / count : 0;
  });
  return result;
}

// --- PZN & MEDICATION SCHEMA VALIDATION ---

/**
 * Validates a German Pharmazentralnummer (PZN) using the Modulo 11 check digit algorithm.
 * A PZN can be 7 or 8 digits. If it is 7 digits, it is padded with a leading zero to 8 digits.
 */
export function isValidPzn(pzn: string): boolean {
  const cleaned = pzn.trim();
  if (cleaned.length !== 7 && cleaned.length !== 8) return false;
  if (!/^\d+$/.test(cleaned)) return false;

  const padded = cleaned.length === 7 ? '0' + cleaned : cleaned;
  const digits = padded.split('').map(Number);
  const body = digits.slice(0, 7);
  const checkDigit = digits[7];

  const sum = body.reduce((acc, digit, idx) => acc + digit * (idx + 1), 0);
  const calcCheck = sum % 11;

  if (calcCheck === 10) return false; // Modulo remainder 10 is invalid and never used as a PZN check digit

  return calcCheck === checkDigit;
}

/**
 * Validates a Medication object.
 * Returns an object with 'valid: boolean' and an array of 'errors'.
 */
export function validateMedication(med: Partial<Medication>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!med.name || !med.name.trim()) {
    errors.push('Medikamentenname ist ein Pflichtfeld.');
  }

  // Dose (Stärke) is required
  if (med.dose === undefined || med.dose === null || med.dose.toString().trim() === '') {
    errors.push('Stärke / Dosis ist ein Pflichtfeld.');
  }

  if (med.pzn && med.pzn.trim()) {
    if (!isValidPzn(med.pzn)) {
      errors.push(`Die eingegebene PZN "${med.pzn}" ist ungültig (fehlerhafte Prüfziffer).`);
    }
  }

  if (med.stock !== undefined && med.stock !== null) {
    if (typeof med.stock !== 'number' || isNaN(med.stock) || med.stock < 0) {
      errors.push('Der aktuelle Bestand darf keine negative Zahl sein.');
    }
  }

  if (med.packSize !== undefined && med.packSize !== null) {
    if (typeof med.packSize !== 'number' || isNaN(med.packSize) || med.packSize < 0) {
      errors.push('Die Packungsgröße darf keine negative Zahl sein.');
    }
  }

  if (med.thresholdDays !== undefined && med.thresholdDays !== null) {
    if (typeof med.thresholdDays !== 'number' || isNaN(med.thresholdDays) || med.thresholdDays < 1) {
      errors.push('Die Warnschwelle muss mindestens 1 Tag betragen.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * AI Privacy Guard
 * Sanitizes personally identifiable information (PII) from free-text strings
 * before sending data to external AI services.
 */
export function aiPrivacyGuard(text: string, customNames: string[] = []): string {
  if (!text) return '';
  let sanitized = text;

  // 1. Sanitize custom names if provided (patient, doctor, emergency contacts)
  for (const name of customNames) {
    if (name && name.trim().length > 2) {
      const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '[PERSON]');
    }
  }

  // 2. Sanitize email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  sanitized = sanitized.replace(emailRegex, '[E-MAIL]');

  // 3. Sanitize telephone / mobile numbers
  // Matches typical German/international phone structures (min 6 digits, optional formatting)
  const phoneRegex = /(?:\+\d{1,3}[ -]?)?\b\(?\d{2,5}\)?[ -/]?\d{3,8}[ -/]?\d{2,8}\b/g;
  sanitized = sanitized.replace(phoneRegex, '[TELEFON]');

  // 4. Sanitize dates (DOBs, visit dates, calendar dates)
  // Matches formats like 12.05.1965, 12/05/1965, 2026-08-15
  const dateRegex = /\b(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/g;
  sanitized = sanitized.replace(dateRegex, '[DATUM]');

  // 5. Sanitize German ZIP + City (e.g. 12345 Berlin, 01099 Dresden)
  const zipCityRegex = /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)*\b/g;
  sanitized = sanitized.replace(zipCityRegex, '[ADRESSE]');

  // 6. Sanitize streets (e.g. Musterstraße 12, Hauptweg 4a, Schlossplatz 1)
  const streetRegex = /\b[A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)*(?:straße|str\.|weg|platz|allee|gasse|ring|pfad|[sS]traße|[wW]eg|[pP]latz|[aA]llee|[gG]asse|[rR]ing|[pP]fad)\s+\d+[a-zA-Z]?\b/g;
  sanitized = sanitized.replace(streetRegex, '[ADRESSE]');

  // 7. Sanitize honorifics + Name (e.g. Herr Müller, Frau Dr. Schmidt, Prof. Meier)
  const honorificsRegex = /\b(?:Herr|Frau|Dr\.|Dr\. med\.|Prof\.)(?:\s+(?:Herr|Frau|Dr\.|Dr\. med\.|Prof\.))*\s+[A-ZÄÖÜ][a-zäöüßéèàáíóúñ]+\b/g;
  sanitized = sanitized.replace(honorificsRegex, '[PERSON]');

  // 8. Sanitize common German first names (case-insensitive)
  const commonNames = [
    'Erika', 'Maik', 'Max', 'Moritz', 'Maria', 'Sabine', 'Hans', 'Peter',
    'Anna', 'Thomas', 'Michael', 'Andreas', 'Wolfgang', 'Stefan', 'Christian'
  ];
  for (const name of commonNames) {
    const regex = new RegExp(`\\b${name}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '[PERSON]');
  }

  return sanitized;
}

/**
 * AI Output Guard
 * Scans generated AI content for prohibited therapy directives,
 * dosage suggestions, or schedule timing changes, and neutralizes them.
 */
export function aiOutputGuard(text: string): { blocked: boolean; text: string } {
  if (!text) return { blocked: false, text: '' };

  const prohibitedPatterns = [
    // 1. Dosisänderungen (z.B. "erhöhe die Dosis", "reduzieren Sie die Dosis", "Dosis verdoppeln", "10 mg statt 5 mg")
    /\b(?:dosis|dosierung|menge|mg|µg|tablett?e?n?)\b[^.]*\b(erhöhen|steigern|reduzieren|verringern|anpassen|verdoppeln|halbieren|ändern|absetzen)\b/i,
    /\b(?:erhöhen|steigern|reduzieren|verringern|anpassen|verdoppeln|halbieren|ändern|absetzen)\b[^.]*\b(dosis|dosierung|menge|mg|µg|tablett?e?n?)\b/i,
    /\b\d+\s*(?:mg|µg|g|tablett?e?n?)\s+(?:statt|anstatt|stattdessen)\s+\d+\s*(?:mg|µg|g|tablett?e?n?)\b/i,
    /\b(?:absetzen|beenden)\s+(?:von\s+)?(?:der\s+einnahme\s+von\s+)?[A-ZÄÖÜ]\w+/i,

    // 2. Einnahmezeit-Verschiebungen (z.B. "vorverlegen um 30 min", "nehmen Sie es morgens statt abends")
    /\b(?:einnahmezeit|einnahmezeitpunkt|einnahme-wecker|wecker)\b[^.]*\b(vorverlegen|verschieben|ändern|anpassen|verspäten|neu\s+einstellen)\b/i,
    /\b(vorverlegen|verschieben|anpassen|verspäten)\b[^.]*\b(einnahme|einnahmezeit|einnahmezeitpunkt|einnahme-wecker|wecker)\b/i,
    /\b(?:einnahme|nehmen|einzunehmen)\b[^.]*\b(?:morgens|mittags|abends|nachts)\b[^.]*\b(?:statt|anstatt|stattdessen)\b[^.]*\b(?:morgens|mittags|abends|nachts)\b/i,
    /\b(?:vorverlegen|verschieben)\s+auf\s+(?:morgens|mittags|abends|nachts|\d{1,2}\s*uhr)\b/i,

    // 3. Direkte Therapie- und Umstellungsbefehle
    /\b(therapie|medikation|medikament|medikamentenplan|[A-ZÄÖÜ]\w+)\b[^.]*\b(absetzen|beenden|einstellen|ändern|anpassen|umstellen|reduzieren|erhöhen)\b/i,
    /\b(absetzen|beenden|einstellen|ändern|anpassen|umstellen|reduzieren|erhöhen)\b[^.]*\b(therapie|medikation|medikament|medikamentenplan|[A-ZÄÖÜ]\w+)\b/i,
    /\b(?:passen Sie Ihre Einnahme an|setzen Sie .* ab|ändern Sie Ihre Dosis|nehmen Sie eine höhere|nehmen Sie eine geringere|ersetzen Sie)\b/i
  ];

  for (const pattern of prohibitedPatterns) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        text: "Bitte besprechen Sie eventuelle Anpassungen Ihrer Einnahmezeiten oder Dosierungen direkt mit Ihrem behandelnden Arzt. KI-Assistenten dürfen keine Therapieempfehlungen aussprechen."
      };
    }
  }

  return { blocked: false, text };
}

/**
 * Validates the schema of an imported SymptoChron backup JSON file.
 * Returns true if valid, or a list of specific error descriptions if invalid.
 */
export function validateBackupSchema(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Das Backup ist kein gültiges JSON-Objekt.'] };
  }

  // 1. Version check
  if (!data.version || typeof data.version !== 'string') {
    errors.push('Version des Backups fehlt oder ist ungültig.');
  } else if (!data.version.startsWith('1.')) {
    errors.push(`Inkompatible Backup-Version: ${data.version}. Nur Versionen der Reihe 1.x.x werden unterstützt.`);
  }

  // 2. Validate diary
  if (data.diary) {
    if (typeof data.diary !== 'object' || Array.isArray(data.diary)) {
      errors.push('Tagebuch-Einträge müssen als Objekt (Map) formatiert sein.');
    } else {
      for (const [dateStr, entry] of Object.entries(data.diary)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          errors.push(`Ungültiges Datumsformat im Tagebuchschlüssel: "${dateStr}".`);
          continue;
        }
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          errors.push(`Eintrag für Datum ${dateStr} ist ungültig.`);
          continue;
        }

        const e = entry as any;
        // Check sleepHours (0 to 24)
        if (e.sleepHours !== undefined && e.sleepHours !== null) {
          if (typeof e.sleepHours !== 'number' || e.sleepHours < 0 || e.sleepHours > 24) {
            errors.push(`${dateStr}: Schlafstunden müssen eine Zahl zwischen 0 und 24 sein.`);
          }
        }
        // Check sleepQuality (1 to 5)
        if (e.sleepQuality !== undefined && e.sleepQuality !== null) {
          if (typeof e.sleepQuality !== 'number' || e.sleepQuality < 1 || e.sleepQuality > 5) {
            errors.push(`${dateStr}: Schlafqualität muss eine Zahl zwischen 1 und 5 sein.`);
          }
        }
        // Check pain levels (0 to 10)
        const painKeys = ['morning_pain', 'noon_pain', 'evening_pain', 'night_pain'];
        for (const pk of painKeys) {
          if (e[pk] !== undefined && e[pk] !== null) {
            if (typeof e[pk] !== 'number' || e[pk] < 0 || e[pk] > 10) {
              errors.push(`${dateStr}: Schmerzniveau (${pk}) muss zwischen 0 und 10 liegen.`);
            }
          }
        }
        // Check RLS levels (0 to 10)
        const rlsKeys = ['morning_rls', 'noon_rls', 'evening_rls', 'night_rls'];
        for (const rk of rlsKeys) {
          if (e[rk] !== undefined && e[rk] !== null) {
            if (typeof e[rk] !== 'number' || e[rk] < 0 || e[rk] > 10) {
              errors.push(`${dateStr}: RLS-Niveau (${rk}) muss zwischen 0 und 10 liegen.`);
            }
          }
        }
        // Check medsTaken is array of strings
        if (e.medsTaken !== undefined && e.medsTaken !== null) {
          if (!Array.isArray(e.medsTaken) || e.medsTaken.some((id: any) => typeof id !== 'string')) {
            errors.push(`${dateStr}: Eingenommene Medikamente müssen als Liste von Text-IDs formatiert sein.`);
          }
        }
      }
    }
  } else {
    errors.push('Tagebuch-Daten (diary) fehlen im Backup.');
  }

  // 3. Validate meds
  if (data.meds) {
    if (!Array.isArray(data.meds)) {
      errors.push('Medikamentenplan (meds) muss als Liste formatiert sein.');
    } else {
      for (let i = 0; i < data.meds.length; i++) {
        const m = data.meds[i];
        if (!m || typeof m !== 'object' || Array.isArray(m)) {
          errors.push(`Medikament an Position ${i} ist ungültig.`);
          continue;
        }
        if (!m.name || typeof m.name !== 'string') {
          errors.push(`Medikament an Position ${i}: Name fehlt oder ist ungültig.`);
        }
        if (!m.dose || typeof m.dose !== 'string') {
          errors.push(`Medikament "${m.name || i}": Stärke/Dosis fehlt oder ist ungültig.`);
        }
        if (m.pzn !== undefined && m.pzn !== null && m.pzn !== '') {
          if (!isValidPzn(m.pzn)) {
            errors.push(`Medikament "${m.name || i}": PZN "${m.pzn}" hat eine ungültige Prüfziffer.`);
          }
        }
        if (m.stock !== undefined && m.stock !== null) {
          if (typeof m.stock !== 'number' || m.stock < 0) {
            errors.push(`Medikament "${m.name || i}": Bestand darf nicht negativ sein.`);
          }
        }
        if (m.packSize !== undefined && m.packSize !== null) {
          if (typeof m.packSize !== 'number' || m.packSize < 0) {
            errors.push(`Medikament "${m.name || i}": Packungsgröße darf nicht negativ sein.`);
          }
        }
        if (m.thresholdDays !== undefined && m.thresholdDays !== null) {
          if (typeof m.thresholdDays !== 'number' || m.thresholdDays < 0) {
            errors.push(`Medikament "${m.name || i}": Warnschwelle darf nicht negativ sein.`);
          }
        }
      }
    }
  } else {
    errors.push('Medikamenten-Daten (meds) fehlen im Backup.');
  }

  // 4. Validate mood
  if (data.mood) {
    if (typeof data.mood !== 'object' || Array.isArray(data.mood)) {
      errors.push('Stimmungs-Einträge müssen als Objekt formatiert sein.');
    } else {
      for (const [dateStr, entry] of Object.entries(data.mood)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          errors.push(`Stimmungs-Eintrag für ${dateStr} ist ungültig.`);
          continue;
        }
        const me = entry as any;
        if (me.mood !== undefined && me.mood !== null) {
          if (typeof me.mood !== 'number' || me.mood < 1 || me.mood > 5) {
            errors.push(`Stimmungs-Wert für ${dateStr} muss eine Zahl zwischen 1 und 5 sein.`);
          }
        }
      }
    }
  }

  // 5. Validate surveys
  if (data.rlsSurveys) {
    if (typeof data.rlsSurveys !== 'object' || Array.isArray(data.rlsSurveys)) {
      errors.push('RLS-Fragebögen müssen als Objekt formatiert sein.');
    } else {
      for (const [key, entry] of Object.entries(data.rlsSurveys)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          errors.push(`Fragebogen-Eintrag für ${key} ist ungültig.`);
          continue;
        }
        const s = entry as any;
        if (s.score !== undefined && s.score !== null) {
          if (typeof s.score !== 'number' || s.score < 0 || s.score > 40) {
            errors.push(`Fragebogen-Score für ${key} muss zwischen 0 und 40 liegen.`);
          }
        }
      }
    }
  }

  // 6. Validate sosData
  if (data.sosData) {
    if (typeof data.sosData !== 'object' || Array.isArray(data.sosData)) {
      errors.push('Notfall-Daten (sosData) müssen als Objekt formatiert sein.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
