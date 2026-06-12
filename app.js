// ══════════════════════════════════════════════
//  SCHMERZ & RLS TAGEBUCH – App Logic
// ══════════════════════════════════════════════

// ── Constants ──────────────────────────────────
const TIMES = [
  { key: 'morning', label: 'Morgen',  clock: '06–10 Uhr', dataTime: 'morning' },
  { key: 'noon',    label: 'Mittag',  clock: '10–14 Uhr', dataTime: 'noon'    },
  { key: 'evening', label: 'Abend',   clock: '17–22 Uhr', dataTime: 'evening' },
  { key: 'night',   label: 'Nacht',   clock: '22–06 Uhr', dataTime: 'night'   },
];

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_FULL = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// IRLS – International Restless Legs Syndrome Study Group Rating Scale (10 Fragen, je 0–4, max. 40)
const RLS_SURVEY_QUESTIONS = [
  'Wie würden Sie insgesamt die Beschwerden in Ihren Beinen oder Armen durch das Restless-Legs-Syndrom beschreiben?',
  'Wie würden Sie insgesamt den Drang beschreiben, sich wegen des Restless-Legs-Syndroms bewegen zu müssen?',
  'Wie stark war Ihre allgemeine Erleichterung der Beschwerden durch das Restless-Legs-Syndrom durch Bewegung?',
  'Wie stark waren Ihre Schlafstörungen durch das Restless-Legs-Syndrom?',
  'Wie stark war Ihre Müdigkeit oder Schläfrigkeit durch das Restless-Legs-Syndrom?',
  'Wie stark war das Restless-Legs-Syndrom insgesamt?',
  'Wie oft traten die Beschwerden durch das Restless-Legs-Syndrom auf?',
  'Wenn Sie die Beschwerden hatten, wie stark war der Drang, sich zu bewegen, oder wie unangenehm waren die Beschwerden im Durchschnitt?',
  'Wie stark haben sich die Beschwerden durch das Restless-Legs-Syndrom auf Ihre Fähigkeit ausgewirkt, Ihren täglichen Aktivitäten (z.B. zu Hause oder auf der Arbeit) nachzugehen?',
  'Wie stark haben sich die Beschwerden durch das Restless-Legs-Syndrom auf Ihre Stimmung ausgewirkt (z.B. auf Ihr Gefühl der Niedergeschlagenheit, Ärger, Traurigkeit, Angst oder Reizbarkeit)?',
];

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';
const MIN_PATTERN_DAYS = 5;
const MIN_TAG_DIFF = 0.3;

const INFLUENCE_TAGS = [
  { key: 'coffee', label: '☕ Kaffee' },
  { key: 'alcohol', label: '🍷 Alkohol' },
  { key: 'stress', label: '⚠️ Stress' },
  { key: 'sport', label: '🏋️ Sport' },
  { key: 'poorSleep', label: '🛌 Schlafmangel' },
];

const LOCAL_DRUG_INTERACTIONS = [
  { drugs: ['ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'celecoxib', 'meloxicam', 'indometacin'], interact: ['warfarin', 'marcumar', 'phenprocoumon', 'rivaroxaban', 'apixaban'], msg: 'NSAR + Antikoagulanzien: erhöhtes Blutungsrisiko', severity: 'high' },
  { drugs: ['ibuprofen', 'diclofenac', 'naproxen'], interact: ['lithium'], msg: 'NSAR + Lithium: Lithiumspiegel kann steigen', severity: 'high' },
  { drugs: ['tramadol', 'morphin', 'tilidin', 'oxycodon', 'fentanyl', 'buprenorphin'], interact: ['gabapentin', 'pregabalin'], msg: 'Opioid + Gabapentinoid: verstärkte Sedierung / Atemdepression möglich', severity: 'high' },
  { drugs: ['tramadol', 'morphin', 'tilidin'], interact: ['citalopram', 'sertralin', 'escitalopram', 'fluoxetin', 'venlafaxin', 'duloxetin', 'amitriptylin'], msg: 'Opioid + Antidepressivum: Serotoninsyndrom-Risiko', severity: 'high' },
  { drugs: ['pramipexol', 'ropinirol', 'rotigotin', 'levodopa', 'carbidopa'], interact: ['metoclopramid', 'prochlorperazin', 'haloperidol', 'risperidon', 'quetiapin'], msg: 'Dopaminagonist + Antiemetikum/Antipsychotikum: Wirkungsabschwächung', severity: 'moderate' },
  { drugs: ['pramipexol', 'ropinirol'], interact: ['ciprofloxacin', 'erythromycin'], msg: 'Dopaminagonist + bestimmte Antibiotika: Spiegelanstieg möglich', severity: 'moderate' },
  { drugs: ['gabapentin', 'pregabalin'], interact: ['morphin', 'oxycodon', 'tramadol'], msg: 'Gabapentinoid + Opioid: verstärkte ZNS-Depression', severity: 'high' },
  { drugs: ['gabapentin'], interact: ['pregabalin'], msg: 'Gabapentin + Pregabalin: gleiche Wirkmechanismen, Doppelung vermeiden', severity: 'moderate' },
];

// ── State ───────────────────────────────────────
let currentDate = todayStr();
let currentRlsDate = todayStr();
let chartInstance = null;
let todChartInstance = null;
let currentChartView = 'week';
let surveyAnswers = [null, null, null, null, null, null, null, null, null, null];

// ── Storage helpers ─────────────────────────────
function getStore() {
  try { return JSON.parse(localStorage.getItem('painDiary') || '{}'); } catch { return {}; }
}
function saveStore(d) { localStorage.setItem('painDiary', JSON.stringify(d)); }

function getSettings() {
  try { return JSON.parse(localStorage.getItem('painDiarySettings') || '{}'); } catch { return {}; }
}
function saveSettings(s) { localStorage.setItem('painDiarySettings', JSON.stringify(s)); }

function getRlsDaily() {
  try { return JSON.parse(localStorage.getItem('painDiaryRlsDaily') || '{}'); } catch { return {}; }
}
function saveRlsDailyStore(d) { localStorage.setItem('painDiaryRlsDaily', JSON.stringify(d)); }

function getRlsSurveys() {
  try { return JSON.parse(localStorage.getItem('painDiaryRlsSurvey') || '{}'); } catch { return {}; }
}
function saveRlsSurveys(s) { localStorage.setItem('painDiaryRlsSurvey', JSON.stringify(s)); }

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return formatLocalDate(new Date());
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLabel(str) {
  const d = parseDate(str);
  return `${DAY_NAMES_FULL[d.getDay()]}, ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return formatLocalDate(d);
}

// ── Init ────────────────────────────────────────
function initImportZone() {
  const importZone = document.querySelector('.import-zone');
  if (!importZone || importZone.dataset.initialized === 'true') return;
  importZone.dataset.initialized = 'true';
  importZone.addEventListener('dragover', e => { e.preventDefault(); importZone.style.borderColor = '#3b9eff'; });
  importZone.addEventListener('dragleave', () => { importZone.style.borderColor = ''; });
  importZone.addEventListener('drop', e => {
    e.preventDefault();
    importZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      const fi = document.getElementById('fileInput');
      fi.files = dt.files;
      importData(fi);
    }
  });
}

function initApp() {
  updateHeaderDate();
  buildTimeBlocks();
  buildInfluenceTags();
  buildWeekStrip();
  populateRlsSymptomSelect();
  buildSurveyQuestions();
  renderMedList();
  loadCurrentEntry();
  updateNavLabel();
  initRlsTab();
  loadRlsModeSettings();
  refreshMedInteractionAlert();
  initImportZone();
  if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  applyInitialRoute();
}

document.addEventListener('DOMContentLoaded', initApp);

function updateHeaderDate() {
  const d = new Date();
  document.getElementById('headerDate').textContent =
    `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
}

// ── Tab switching ───────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.menu-action').forEach(b => b.classList.remove('active'));
  const section = document.getElementById('tab-' + name);
  if (!section) return;
  section.classList.add('active');
  document.querySelectorAll(`[data-tab="${name}"]`).forEach(b => b.classList.add('active'));
  if (location.hash !== `#${name}`) {
    history.replaceState(null, '', `#${name}`);
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (name === 'welcome' && typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  if (name === 'charts') renderCharts();
  if (name === 'rls') refreshRlsTab();
  if (name === 'meds') renderMedList();
  if (name === 'analysis') renderAnalysisTab();
}

function applyInitialRoute() {
  const route = (location.hash || '').replace('#', '').trim();
  const validTabs = ['welcome', 'diary', 'rls', 'meds', 'analysis', 'charts', 'export'];
  if (validTabs.includes(route)) {
    switchTab(route);
  } else {
    switchTab('welcome');
  }
}

// ── Utilities ────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }, { once: true });
}

window.addEventListener('hashchange', applyInitialRoute);
registerServiceWorker();
