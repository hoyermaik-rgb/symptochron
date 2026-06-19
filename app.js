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
  currentDate = todayStr();
  updateHeaderDate();
  if (typeof ensureDiaryReady === 'function') ensureDiaryReady({ forceToday: true });
  if (typeof populateRlsSymptomSelect === 'function') populateRlsSymptomSelect();
  if (typeof buildSurveyQuestions === 'function') buildSurveyQuestions();
  if (typeof renderMedList === 'function') renderMedList();
  if (typeof initRlsTab === 'function') initRlsTab();
  if (typeof loadRlsModeSettings === 'function') loadRlsModeSettings();
  if (typeof refreshMedInteractionAlert === 'function') refreshMedInteractionAlert();
  if (typeof loadAlarmSettings === 'function') loadAlarmSettings();
  if (typeof startAlarmEngine === 'function') startAlarmEngine();
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
  try {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch {
    window.scrollTo(0, 0);
  }
  if (name === 'welcome' && typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  if (name === 'diary' && typeof ensureDiaryReady === 'function') ensureDiaryReady();
  if (name === 'charts') renderCharts();
  if (name === 'rls') refreshRlsTab();
  if (name === 'meds') renderMedList();
  if (name === 'analysis') renderAnalysisTab();
  if (name === 'export' && typeof initExportTab === 'function') initExportTab();
}

function applyInitialRoute() {
  const route = (location.hash || '').replace('#', '').trim();
  const validTabs = ['welcome', 'diary', 'rls', 'meds', 'mood', 'sos', 'analysis', 'charts', 'export'];
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
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (typeof showToast === 'function') {
              showToast('🔄 Update installiert. App wird neu geladen...');
            }
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        });
      });
    }).catch(() => {});
  }, { once: true });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

window.addEventListener('hashchange', applyInitialRoute);
window.addEventListener('focus', () => {
  updateHeaderDate();
  if (typeof updateNavLabel === 'function') updateNavLabel();
  if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateHeaderDate();
    if (typeof updateNavLabel === 'function') updateNavLabel();
    if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  }
});
registerServiceWorker();

// ── Einnahme-Wecker Alarm Engine ────────────────
let alarmIntervalId = null;

function startAlarmEngine() {
  if (alarmIntervalId) clearInterval(alarmIntervalId);
  alarmIntervalId = setInterval(checkMedicationAlarms, 30000);
  setTimeout(checkMedicationAlarms, 3000);
}

function checkPrescriptionReminders() {
  if (typeof getMeds !== 'function') return;
  const meds = getMeds();

  meds.forEach(med => {
    if (!med.active) return;
    if (med.stock === undefined || med.stock === null || isNaN(med.stock)) return;

    const dailyDose = (med.schedule?.morning || 0) + (med.schedule?.noon || 0) + (med.schedule?.evening || 0) + (med.schedule?.night || 0);
    const threshold = med.thresholdDays !== undefined && !isNaN(med.thresholdDays) ? med.thresholdDays : 7;

    let isLow = false;
    if (dailyDose === 0) {
      isLow = med.stock < 10;
    } else {
      const days = Math.floor(med.stock / dailyDose);
      isLow = days < threshold;
    }

    if (isLow) {
      const title = `💊 Rezept-Erinnerung`;
      const body = `Dein Bestand für ${med.name} ist knapp. Bitte denke daran, ein neues Rezept zu bestellen!`;
      triggerPushNotification(title, body);
    }
  });
}

function checkMedicationAlarms() {
  if (typeof getSettings !== 'function' || typeof getMeds !== 'function') return;
  const settings = getSettings();
  if (settings.notificationsEnabled !== true) return;

  const alarmTimes = settings.alarmTimes || {
    morning: '08:00',
    noon: '12:00',
    evening: '18:00',
    night: '22:00',
  };

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const lastTriggered = localStorage.getItem('lastTriggeredAlarmMinute');
  const todayKey = todayStr();
  const triggerKey = `${todayKey}_${currentHHMM}`;

  // Täglich um 09:00 Uhr Rezept-Bestände prüfen und ggf. benachrichtigen
  if (currentHHMM === '09:00') {
    const lastPrescriptionDate = localStorage.getItem('lastTriggeredPrescriptionDate');
    if (lastPrescriptionDate !== todayKey) {
      localStorage.setItem('lastTriggeredPrescriptionDate', todayKey);
      checkPrescriptionReminders();
    }
  }

  if (lastTriggered === triggerKey) return;

  const slots = [
    { key: 'morning', label: 'morgens', time: alarmTimes.morning },
    { key: 'noon', label: 'mittags', time: alarmTimes.noon },
    { key: 'evening', label: 'abends', time: alarmTimes.evening },
    { key: 'night', label: 'nachts', time: alarmTimes.night },
  ];

  const matchedSlot = slots.find(s => s.time === currentHHMM);
  if (!matchedSlot) return;

  const meds = getMeds();
  const store = getStore();
  const entry = store[todayKey] || {};
  const taken = Array.isArray(entry.medsTaken) ? entry.medsTaken : [];

  const pendingMeds = meds.filter(m => {
    if (!m.active) return false;
    const schedQty = m.schedule?.[matchedSlot.key] || 0;
    if (schedQty <= 0) return false;

    const slotId = `${m.id}_${matchedSlot.key}`;
    const alreadyTaken = taken.includes(slotId) || taken.includes(m.id);
    return !alreadyTaken;
  });

  if (pendingMeds.length === 0) return;

  const medNames = pendingMeds.map(m => m.name).join(', ');
  const title = `💊 Einnahme-Erinnerung (${matchedSlot.key === 'morning' ? 'Morgens' : matchedSlot.key === 'noon' ? 'Mittags' : matchedSlot.key === 'evening' ? 'Abends' : 'Nachts'})`;
  const body = `Bitte nimm deine anstehenden Medikamente ein: ${medNames}.`;

  localStorage.setItem('lastTriggeredAlarmMinute', triggerKey);
  triggerPushNotification(title, body);
}

function triggerPushNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: title,
      body: body,
      tag: 'medication-reminder'
    });
  } else {
    try {
      new Notification(title, {
        body: body,
        icon: './icons/icon-192.png',
        tag: 'medication-reminder'
      });
    } catch (e) {}
  }
}
