import { DiaryEntry } from './types';

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
  return numerator / denominator;
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
