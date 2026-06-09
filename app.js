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

function getMeds() {
  try {
    let meds = JSON.parse(localStorage.getItem('painDiaryMeds') || '[]');
    let changed = false;
    meds = meds.map((m, i) => {
      if (!m.id) { changed = true; return { ...m, id: 'med_' + i }; }
      return m;
    });
    if (changed) saveMeds(meds);
    return meds;
  } catch { return []; }
}
function saveMeds(m) { localStorage.setItem('painDiaryMeds', JSON.stringify(m)); }

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

function todayStr() {
  return new Date().toISOString().split('T')[0];
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
  return d.toISOString().split('T')[0];
}

// ── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  buildTimeBlocks();
  buildWeekStrip();
  populateRlsSymptomSelect();
  buildSurveyQuestions();
  loadCurrentEntry();
  updateNavLabel();
  renderMedList();
  buildInfluenceTags();
  initRlsTab();
  loadRlsModeSettings();
  refreshMedInteractionAlert();
});

function updateHeaderDate() {
  const d = new Date();
  document.getElementById('headerDate').textContent =
    `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
}

// ── Tab switching ───────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (name === 'charts') renderCharts();
  if (name === 'rls') refreshRlsTab();
  if (name === 'meds') renderMedList();
  if (name === 'analysis') renderAnalysisTab();
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

// Drag & drop for import zone
const importZone = document.querySelector('.import-zone');
if (importZone) {
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
function filterDiaryEntries(query) {
    const searchInput = query.toLowerCase().trim();
    const resultsContainer = document.getElementById('appSearchResults');
    const resultsBody = document.getElementById('appSearchResultsBody');

    if (!searchInput) {
        resultsContainer.style.display = 'none';
        return;
    }

    resultsBody.innerHTML = '';
    let matchCount = 0;

    // Korrekte Storage-Keys
    const diaryStore = JSON.parse(localStorage.getItem('painDiary') || '{}');
    const rlsDailyStore = JSON.parse(localStorage.getItem('painDiaryRlsDaily') || '{}');
    const rlsSurveys = JSON.parse(localStorage.getItem('painDiaryRlsSurvey') || '{}');

    // Tagebuch durchsuchen
    Object.entries(diaryStore).forEach(([date, entry]) => {
        const notes = (entry.notes || '').toLowerCase();
        const factors = entry.factors ? Object.keys(entry.factors).join(', ').toLowerCase() : '';

        if (notes.includes(searchInput) || factors.includes(searchInput)) {
            matchCount++;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${date}</td>
                <td><span style="background:rgba(0,212,170,0.1); padding:3px 8px; border-radius:4px; font-size:11px;">📋 Tagebuch</span></td>
                <td style="font-size:13px; color:var(--text-2);">${notes || 'Faktoren: ' + factors}</td>
            `;
            resultsBody.appendChild(tr);
        }
    });

    // RLS-Tagesdoku durchsuchen
    Object.entries(rlsDailyStore).forEach(([date, entry]) => {
        const triggers = (entry.triggers || '').toLowerCase();
        const med = (entry.medication || '').toLowerCase();
        const relief = (entry.relief || '').toLowerCase();

        if (triggers.includes(searchInput) || med.includes(searchInput) || relief.includes(searchInput)) {
            matchCount++;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${date}</td>
                <td><span style="background:rgba(167,139,250,0.15); padding:3px 8px; border-radius:4px; font-size:11px;">🦵 RLS-Doku</span></td>
                <td style="font-size:13px; color:var(--text-2);">${med || triggers || relief}</td>
            `;
            resultsBody.appendChild(tr);
        }
    });

    // IRLS-Fragebögen durchsuchen
    Object.entries(rlsSurveys).forEach(([date, survey]) => {
        if (JSON.stringify(survey).toLowerCase().includes(searchInput)) {
            matchCount++;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${date}</td>
                <td><span style="background:rgba(167,139,250,0.15); padding:3px 8px; border-radius:4px; font-size:11px;">📊 IRLS</span></td>
                <td style="font-size:13px; color:var(--text-2);">Score: ${survey.sum}/40 - ${survey.severity}</td>
            `;
            resultsBody.appendChild(tr);
        }
    });

    if (matchCount > 0) {
        resultsContainer.style.display = 'block';
    } else {
        resultsContainer.style.display = 'block';
        resultsBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-3); padding:20px;">Keine Einträge für "${query}" gefunden.</td></tr>`;
    }
}