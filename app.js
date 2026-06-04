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

const RLS_SURVEY_QUESTIONS = [
  'Wie stark waren Ihre RLS-Beschwerden (Missempfindungen/Drang) insgesamt?',
  'Wie stark war der Drang, sich wegen der Beschwerden bewegen zu müssen?',
  'Wie sehr wurde Ihr Schlaf in der letzten Woche durch RLS gestört?',
  'Wie müde oder schläfrig waren Sie tagsüber wegen des RLS?',
  'Wie stark waren die Beschwerden im Durchschnitt, wenn sie auftraten?',
  'Wie sehr haben sich die Beschwerden auf Ihre Stimmung (Ärger, Traurigkeit) ausgewirkt?',
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
let surveyAnswers = [null, null, null, null, null, null];

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
}

// ── Week Strip ──────────────────────────────────
function buildWeekStrip() {
  const strip = document.getElementById('weekStrip');
  strip.innerHTML = '';
  const today = todayStr();
  const store = getStore();

  // Show 7 days: 3 before current, current, 3 after (centered around current)
  for (let i = -3; i <= 3; i++) {
    const d = addDays(currentDate, i);
    const pd = parseDate(d);
    const hasData = !!store[d];
    const btn = document.createElement('button');
    btn.className = 'week-day-btn' +
      (d === currentDate ? ' active' : '') +
      (d === today ? ' today' : '') +
      (hasData ? ' has-data' : '');
    btn.innerHTML = `
      <span class="wd-name">${DAY_NAMES[pd.getDay()]}</span>
      <span class="wd-date">${pd.getDate()}</span>
      <span class="wd-dots">
        <span class="wd-dot pain"></span>
        <span class="wd-dot rls"></span>
      </span>`;
    btn.onclick = () => { currentDate = d; refreshDiary(); };
    strip.appendChild(btn);
  }
}

// ── Time Blocks ─────────────────────────────────
function buildTimeBlocks() {
  const grid = document.getElementById('timeBlocksGrid');
  grid.innerHTML = '';
  TIMES.forEach(t => {
    const block = document.createElement('div');
    block.className = 'time-block';
    block.setAttribute('data-time', t.key);
    block.innerHTML = `
      <div class="time-block-header">
        <div class="time-dot"></div>
        <span class="time-label">${t.label}</span>
        <span class="time-clock">${t.clock}</span>
      </div>
      <div class="score-row">
        <div class="score-label">Schmerz<span>Intensität 0–10</span></div>
        <select class="score-select pain" id="${t.key}_pain" onchange="updateScoreBadge('${t.key}','pain')">
          ${scoreOptions()}
        </select>
        <div class="score-badge pain" id="${t.key}_pain_badge">–</div>
      </div>
      <div class="score-row">
        <div class="score-label">RLS<span>Intensität 0–10</span></div>
        <select class="score-select rls" id="${t.key}_rls" onchange="updateScoreBadge('${t.key}','rls')">
          ${scoreOptions()}
        </select>
        <div class="score-badge rls" id="${t.key}_rls_badge">–</div>
      </div>`;
    grid.appendChild(block);
  });
}

function scoreOptions() {
  let opts = '<option value="">–</option>';
  for (let i = 0; i <= 10; i++) {
    opts += `<option value="${i}">${i} – ${scoreLabel(i)}</option>`;
  }
  return opts;
}

function scoreLabel(n) {
  const labels = ['Kein','Minimal','Sehr leicht','Leicht','Mäßig','Mittel','Deutlich','Stark','Sehr stark','Extrem','Unerträglich'];
  return labels[n] || '';
}

function updateScoreBadge(timeKey, type) {
  const sel = document.getElementById(`${timeKey}_${type}`);
  const badge = document.getElementById(`${timeKey}_${type}_badge`);
  const val = sel.value;
  badge.textContent = val === '' ? '–' : val;
  badge.className = `score-badge ${type}${val !== '' ? ' score-' + val : ''}`;
}

// ── Load / Save Entry ───────────────────────────
function loadCurrentEntry() {
  const store = getStore();
  const entry = store[currentDate] || {};

  TIMES.forEach(t => {
    const pSel = document.getElementById(`${t.key}_pain`);
    const rSel = document.getElementById(`${t.key}_rls`);
    pSel.value = entry[`${t.key}_pain`] !== undefined ? entry[`${t.key}_pain`] : '';
    rSel.value = entry[`${t.key}_rls`]  !== undefined ? entry[`${t.key}_rls`]  : '';
    updateScoreBadge(t.key, 'pain');
    updateScoreBadge(t.key, 'rls');
  });

  document.getElementById('dailyNotes').value = entry.notes || '';
  document.getElementById('sleepHours').value = entry.sleepHours !== undefined ? entry.sleepHours : '';
  document.getElementById('sleepQuality').value = entry.sleepQuality !== undefined ? entry.sleepQuality : '';

  const factors = entry.factors || {};
  document.querySelectorAll('.tag-btn[data-factor]').forEach(btn => {
    btn.classList.toggle('on', !!factors[btn.dataset.factor]);
  });

  renderMedIntakeForDiary(entry.medsTaken || []);
}

function saveEntry() {
  const store = getStore();
  const entry = store[currentDate] || {};

  TIMES.forEach(t => {
    const pVal = document.getElementById(`${t.key}_pain`).value;
    const rVal = document.getElementById(`${t.key}_rls`).value;
    if (pVal !== '') entry[`${t.key}_pain`] = parseInt(pVal);
    else delete entry[`${t.key}_pain`];
    if (rVal !== '') entry[`${t.key}_rls`] = parseInt(rVal);
    else delete entry[`${t.key}_rls`];
  });

  entry.notes = document.getElementById('dailyNotes').value.trim();

  const sh = document.getElementById('sleepHours').value;
  const sq = document.getElementById('sleepQuality').value;
  if (sh !== '') entry.sleepHours = parseFloat(sh);
  else delete entry.sleepHours;
  if (sq !== '') entry.sleepQuality = parseInt(sq);
  else delete entry.sleepQuality;

  const factors = {};
  document.querySelectorAll('.tag-btn[data-factor].on').forEach(btn => {
    factors[btn.dataset.factor] = true;
  });
  if (Object.keys(factors).length) entry.factors = factors;
  else delete entry.factors;

  const taken = [];
  document.querySelectorAll('[data-med-intake]:checked').forEach(cb => {
    taken.push(cb.dataset.medIntake);
  });
  if (taken.length) entry.medsTaken = taken;
  else delete entry.medsTaken;

  entry.updated = new Date().toISOString();

  if (Object.keys(entry).length > 0) {
    store[currentDate] = entry;
  } else {
    delete store[currentDate];
  }

  saveStore(store);
  buildWeekStrip();
  showToast('✅ Eintrag gespeichert');
}

function refreshDiary() {
  buildWeekStrip();
  loadCurrentEntry();
  updateNavLabel();
  document.getElementById('datePickerInput').value = currentDate;
}

// ── Influence tags & med intake ─────────────────
function buildInfluenceTags() {
  const row = document.getElementById('influenceTags');
  if (!row) return;
  row.innerHTML = INFLUENCE_TAGS.map(t =>
    `<button type="button" class="tag-btn" data-factor="${t.key}" onclick="toggleFactor('${t.key}')">${t.label}</button>`
  ).join('');
}

function toggleFactor(key) {
  const btn = document.querySelector(`.tag-btn[data-factor="${key}"]`);
  if (btn) btn.classList.toggle('on');
}

function renderMedIntakeForDiary(takenIds) {
  const meds = getMeds();
  const card = document.getElementById('medIntakeCard');
  const list = document.getElementById('medIntakeList');
  if (!card || !list) return;

  if (!meds.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  list.innerHTML = meds.map((m, i) => {
    const id = m.id || `med_${i}`;
    const checked = takenIds.includes(id) ? 'checked' : '';
    return `<label class="med-intake-row">
      <input type="checkbox" data-med-intake="${id}" ${checked} />
      <span>${escHtml(m.name)} <span style="color:var(--text-3)">${escHtml(m.dose || '')}</span></span>
    </label>`;
  }).join('');
}

// ── Voice input (Web Speech API) ────────────────
let activeRecognition = null;

function startVoiceInput(fieldId, btn) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('⚠️ Spracheingabe in diesem Browser nicht verfügbar');
    return;
  }
  if (activeRecognition) {
    activeRecognition.stop();
    activeRecognition = null;
    btn.classList.remove('listening');
    return;
  }
  const field = document.getElementById(fieldId);
  if (!field) return;

  const rec = new SpeechRecognition();
  rec.lang = 'de-DE';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  activeRecognition = rec;
  btn.classList.add('listening');

  rec.onresult = e => {
    const text = e.results[0][0].transcript;
    if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
      field.value = (field.value ? field.value + ' ' : '') + text;
    }
    btn.classList.remove('listening');
    activeRecognition = null;
    showToast('🎤 Text übernommen');
  };
  rec.onerror = () => {
    btn.classList.remove('listening');
    activeRecognition = null;
    showToast('❌ Spracheingabe fehlgeschlagen');
  };
  rec.onend = () => btn.classList.remove('listening');
  rec.start();
}

function updateNavLabel() {
  document.getElementById('navDateLabel').textContent = formatDateLabel(currentDate);
  document.getElementById('navDateSub').textContent =
    currentDate === todayStr() ? 'Heute' : '';
  document.getElementById('datePickerInput').value = currentDate;
}

function changeDay(delta) {
  currentDate = addDays(currentDate, delta);
  refreshDiary();
}

function goToDate(val) {
  if (val) { currentDate = val; refreshDiary(); }
}

// ── Medications ─────────────────────────────────
function normalizeMedName(name) {
  return (name || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

function medNameMatches(name, keywords) {
  const n = normalizeMedName(name);
  return keywords.some(k => n.includes(normalizeMedName(k)));
}

function findLocalInteractions(meds) {
  const found = [];
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const a = meds[i], b = meds[j];
      for (const rule of LOCAL_DRUG_INTERACTIONS) {
        const aInA = medNameMatches(a.name, rule.drugs);
        const bInB = medNameMatches(b.name, rule.interact);
        const aInB = medNameMatches(a.name, rule.interact);
        const bInA = medNameMatches(b.name, rule.drugs);
        if ((aInA && bInB) || (aInB && bInA)) {
          found.push({ medA: a.name, medB: b.name, msg: rule.msg, severity: rule.severity });
        }
      }
    }
  }
  return found;
}

function refreshMedInteractionAlert() {
  const el = document.getElementById('medInteractionAlert');
  if (!el) return;
  const warnings = findLocalInteractions(getMeds());
  if (!warnings.length) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = `<strong>🔴 Wechselwirkungs-Hinweis (offline):</strong><br>${warnings.map(w =>
    `${escHtml(w.medA)} + ${escHtml(w.medB)}: ${escHtml(w.msg)}`
  ).join('<br>')}`;
}

function medHasLocalWarning(name, warnings) {
  return warnings.some(w => w.medA === name || w.medB === name);
}

function renderMedList() {
  const meds = getMeds();
  const list = document.getElementById('medList');
  const empty = document.getElementById('medEmpty');
  const warnings = findLocalInteractions(meds);

  if (meds.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    refreshMedInteractionAlert();
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = meds.map((m, i) => {
    const warn = medHasLocalWarning(m.name, warnings);
    return `
    <div class="med-item">
      ${warn ? `<span class="med-warn-icon" title="Mögliche Wechselwirkung">🔴</span>` : ''}
      <div class="med-icon">💊</div>
      <div class="med-info">
        <div class="med-name">${escHtml(m.name)}${m.pzn ? ` <span class="badge-pill">PZN ${escHtml(m.pzn)}</span>` : ''}</div>
        <div class="med-detail">${escHtml(m.dose)}</div>
        ${m.note ? `<div class="med-detail" style="font-style:italic">${escHtml(m.note)}</div>` : ''}
        <div class="med-time">🕐 ${escHtml(m.time)}</div>
      </div>
      <button class="btn-danger" onclick="deleteMed(${i})">✕</button>
    </div>`;
  }).join('');
  refreshMedInteractionAlert();
}

function openMedModal() {
  document.getElementById('medModal').classList.add('open');
  document.getElementById('medName').focus();
}

function closeMedModal() {
  document.getElementById('medModal').classList.remove('open');
  ['medName','medPzn','medDose','medTime','medNote'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function saveMedication() {
  const name = document.getElementById('medName').value.trim();
  const pzn = document.getElementById('medPzn').value.trim().replace(/\D/g, '');
  const dose = document.getElementById('medDose').value.trim();
  const time = document.getElementById('medTime').value.trim();
  const note = document.getElementById('medNote').value.trim();

  if (!name) { showToast('⚠️ Bitte Medikamentenname eingeben'); return; }

  const meds = getMeds();
  meds.push({ id: Date.now().toString(36), name, pzn: pzn || undefined, dose, time, note });
  saveMeds(meds);
  renderMedList();
  closeMedModal();
  const w = findLocalInteractions(meds);
  if (w.length) showToast('⚠️ Medikament gespeichert – Wechselwirkung prüfen');
  else showToast('✅ Medikament gespeichert');
}

function deleteMed(i) {
  if (!confirm('Medikament entfernen?')) return;
  const meds = getMeds();
  meds.splice(i, 1);
  saveMeds(meds);
  renderMedList();
  showToast('🗑 Medikament entfernt');
}

// ── RLS: Appointments & daily doc ───────────────
function populateRlsSymptomSelect() {
  const sel = document.getElementById('rlsSymptom');
  if (!sel) return;
  let opts = '<option value="">–</option>';
  for (let i = 0; i <= 10; i++) opts += `<option value="${i}">${i}</option>`;
  sel.innerHTML = opts;
}

function getAppointments() {
  const s = getSettings();
  return Array.isArray(s.appointments) ? s.appointments : [];
}

function saveAppointment() {
  const date = document.getElementById('apptDate').value;
  const type = document.getElementById('apptType').value;
  const preDays = parseInt(document.getElementById('apptPreDays').value, 10) || 7;
  if (!date) { showToast('⚠️ Bitte Termindatum wählen'); return; }

  const settings = getSettings();
  const appts = getAppointments();
  appts.push({ id: Date.now().toString(36), date, type, preVisitDays: preDays });
  appts.sort((a, b) => a.date.localeCompare(b.date));
  settings.appointments = appts;
  saveSettings(settings);
  document.getElementById('apptDate').value = '';
  renderAppointmentList();
  applyRlsVisibility();
  updateRlsBanners();
  showToast('✅ Termin gespeichert');
}

function deleteAppointment(id) {
  if (!confirm('Termin entfernen?')) return;
  const settings = getSettings();
  settings.appointments = getAppointments().filter(a => a.id !== id);
  saveSettings(settings);
  renderAppointmentList();
  updateRlsBanners();
}

function renderAppointmentList() {
  const el = document.getElementById('apptList');
  if (!el) return;
  const appts = getAppointments().filter(a => a.date >= todayStr());
  if (appts.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-3)">Kein kommender Termin hinterlegt.</p>';
    return;
  }
  el.innerHTML = appts.map(a => {
    const typeLabel = a.type === 'pain' ? 'Schmerztherapeut' : 'RLS-Facharzt';
    const inWindow = isInPreVisitWindow(a.date, a.preVisitDays);
    return `<div class="med-item" style="margin-top:8px">
      <div class="med-info">
        <div class="med-name">${formatDateShort(a.date)} – ${typeLabel}
          ${inWindow ? '<span class="badge-pill active">Doku aktiv</span>' : ''}</div>
        <div class="med-detail">Tägliche RLS-Doku: ${a.preVisitDays} Tage vorher</div>
      </div>
      <button class="btn-danger" onclick="deleteAppointment('${a.id}')">✕</button>
    </div>`;
  }).join('');
}

function formatDateShort(str) {
  const d = parseDate(str);
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
}

function isInPreVisitWindow(apptDate, preDays) {
  const start = addDays(apptDate, -preDays);
  const today = todayStr();
  return today >= start && today <= apptDate;
}

function getActivePreVisitPeriod() {
  const today = todayStr();
  for (const a of getAppointments()) {
    const start = addDays(a.date, -(a.preVisitDays || 7));
    if (today >= start && today <= a.date) return { ...a, startDate: start };
  }
  return null;
}

function getRlsMode() {
  return getSettings().rlsMode || 'auto';
}

function loadRlsModeSettings() {
  const s = getSettings();
  const modeEl = document.getElementById('rlsMode');
  const wdEl = document.getElementById('surveyWeekday');
  if (modeEl) modeEl.value = s.rlsMode || 'auto';
  if (wdEl) wdEl.value = String(s.surveyWeekday ?? 0);
  applyRlsVisibility();
}

function saveRlsModeSettings() {
  const settings = getSettings();
  settings.rlsMode = document.getElementById('rlsMode')?.value || 'auto';
  settings.surveyWeekday = parseInt(document.getElementById('surveyWeekday')?.value || '0', 10);
  saveSettings(settings);
  applyRlsVisibility();
  updateRlsBanners();
}

function shouldShowDetailedRls() {
  const mode = getRlsMode();
  if (mode === 'weekly_only') return false;
  if (mode === 'detailed_only') return true;
  return !!getActivePreVisitPeriod();
}

function shouldShowWeeklySurvey() {
  const mode = getRlsMode();
  if (mode === 'detailed_only') return false;
  if (mode === 'auto' && getActivePreVisitPeriod()) return false;
  return true;
}

function isSameCalendarWeek(d1, d2) {
  const a = parseDate(d1);
  const b = parseDate(d2);
  const day = x => (x.getDay() + 6) % 7;
  const thursday = x => {
    const d = new Date(x);
    d.setDate(d.getDate() - day(d) + 3);
    return d.getFullYear() + '-' + d.getMonth();
  };
  return thursday(a) === thursday(b) && a.getFullYear() === b.getFullYear();
}

function isSurveyDue() {
  if (!shouldShowWeeklySurvey()) return false;
  const settings = getSettings();
  const wd = settings.surveyWeekday ?? 0;
  if (parseDate(todayStr()).getDay() !== wd) return false;
  const last = settings.lastSurveyDate;
  if (!last) return true;
  if (last === todayStr()) return false;
  return !isSameCalendarWeek(last, todayStr());
}

function applyRlsVisibility() {
  const daily = document.getElementById('rlsDailyCard');
  const survey = document.getElementById('rlsSurveyCard');
  const wdGroup = document.getElementById('surveyWeekdayGroup');
  const mode = getRlsMode();

  if (daily) daily.style.display = mode === 'weekly_only' ? 'none' : 'block';
  if (survey) {
    survey.style.display = (mode === 'detailed_only' || (mode === 'auto' && getActivePreVisitPeriod()))
      ? 'none' : 'block';
  }
  if (wdGroup) wdGroup.style.display = mode === 'detailed_only' ? 'none' : 'block';
}

function surveySeverityLabel(sum) {
  if (sum <= 5) return 'Keine bis minimale Beschwerden';
  if (sum <= 10) return 'Leichte Beschwerden';
  if (sum <= 15) return 'Mittelgradige Beschwerden';
  if (sum <= 20) return 'Schwere Beschwerden';
  return 'Sehr schwere Beschwerden';
}

function buildSurveyQuestions() {
  const wrap = document.getElementById('surveyQuestions');
  if (!wrap) return;
  wrap.innerHTML = RLS_SURVEY_QUESTIONS.map((q, i) => `
    <div class="survey-q" data-q="${i}">
      <p><strong>${i + 1}.</strong> ${escHtml(q)}</p>
      <div class="survey-scale">
        ${[0,1,2,3,4].map(v => `<button type="button" class="scale-btn" data-q="${i}" data-v="${v}" onclick="selectSurveyAnswer(${i},${v})">${v}</button>`).join('')}
      </div>
    </div>`).join('');
}

function selectSurveyAnswer(qIdx, val) {
  surveyAnswers[qIdx] = val;
  document.querySelectorAll(`.scale-btn[data-q="${qIdx}"]`).forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.v, 10) === val);
  });
  updateSurveySumDisplay();
}

function updateSurveySumDisplay() {
  const answered = surveyAnswers.filter(v => v !== null);
  const sum = answered.reduce((a, b) => a + b, 0);
  const el = document.getElementById('surveySum');
  const sev = document.getElementById('surveySeverity');
  if (answered.length === 6) {
    el.textContent = `${sum} / 24`;
    sev.textContent = surveySeverityLabel(sum);
  } else {
    el.textContent = answered.length ? `${sum} / 24 (${answered.length}/6)` : '– / 24';
    sev.textContent = 'Bitte alle 6 Fragen beantworten';
  }
}

function saveRlsSurvey() {
  if (surveyAnswers.some(v => v === null)) {
    showToast('⚠️ Bitte alle 6 Fragen bewerten (0–4)');
    return;
  }
  const sum = surveyAnswers.reduce((a, b) => a + b, 0);
  const surveys = getRlsSurveys();
  const entry = {
    answers: [...surveyAnswers],
    sum,
    severity: surveySeverityLabel(sum),
    updated: new Date().toISOString(),
  };
  surveys[todayStr()] = entry;
  saveRlsSurveys(surveys);

  const settings = getSettings();
  settings.lastSurveyDate = todayStr();
  saveSettings(settings);

  surveyAnswers = [null, null, null, null, null, null];
  buildSurveyQuestions();
  updateSurveySumDisplay();
  renderSurveyHistory();
  updateRlsBanners();
  showToast(`✅ Fragebogen gespeichert (${sum}/24)`);
}

function renderSurveyHistory() {
  const el = document.getElementById('surveyHistory');
  if (!el) return;
  const surveys = getRlsSurveys();
  const dates = Object.keys(surveys).sort().reverse().slice(0, 8);
  if (!dates.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-2)">Letzte Fragebögen</div>' +
    dates.map(d => {
      const s = surveys[d];
      return `<div class="corr-item"><span class="corr-pair">${formatDateShort(d)}</span><span class="corr-val">${s.sum}/24 – ${escHtml(s.severity)}</span></div>`;
    }).join('');
}

function initRlsTab() {
  currentRlsDate = todayStr();
  loadRlsDailyForm();
  renderAppointmentList();
  renderRlsDailyTable();
  renderSurveyHistory();
  loadRlsModeSettings();
  updateRlsBanners();
  const period = getActivePreVisitPeriod();
  if (period) {
    document.getElementById('apptPreDays').value = String(period.preVisitDays || 7);
  }
}

function refreshRlsTab() {
  loadRlsDailyForm();
  renderRlsDailyTable();
  renderAppointmentList();
  applyRlsVisibility();
  updateRlsBanners();
}

function changeRlsDay(delta) {
  currentRlsDate = addDays(currentRlsDate, delta);
  loadRlsDailyForm();
}

function loadRlsDailyForm() {
  const store = getRlsDaily();
  const e = store[currentRlsDate] || {};
  document.getElementById('rlsDateLabel').textContent = formatDateLabel(currentRlsDate);
  document.getElementById('rlsSymptom').value = e.symptom !== undefined ? e.symptom : '';
  document.getElementById('rlsSleepQuality').value = e.sleepQuality !== undefined ? e.sleepQuality : '';
  document.getElementById('rlsBeginDuration').value = e.beginDuration || '';
  document.getElementById('rlsTriggers').value = e.triggers || '';
  document.getElementById('rlsMedication').value = e.medication || '';
  document.getElementById('rlsRelief').value = e.relief || '';
  const onset = document.getElementById('rlsSleepOnset');
  const wake = document.getElementById('rlsSleepWakeups');
  const rlsW = document.getElementById('rlsSleepRlsWake');
  const aug = document.getElementById('rlsAugmentation');
  if (onset) onset.value = e.sleepOnset || '';
  if (wake) wake.value = e.sleepWakeups || '';
  if (rlsW) rlsW.value = e.sleepRlsWake || '';
  if (aug) aug.checked = !!e.augmentation;

  const period = getActivePreVisitPeriod();
  const sub = document.getElementById('rlsDailySubtitle');
  if (getRlsMode() === 'detailed_only') {
    sub.textContent = 'Ausführliche Doku – empfohlen für beste Auswertung';
  } else if (period) {
    sub.textContent = `Vor-Termin-Phase (1–2 Wochen) bis ${formatDateShort(period.date)} – täglich ausfüllen`;
  } else {
    sub.textContent = 'Optional außerhalb der Vor-Termin-Phase';
  }
}

function saveRlsDaily() {
  const store = getRlsDaily();
  const entry = {};
  const sym = document.getElementById('rlsSymptom').value;
  if (sym !== '') entry.symptom = parseInt(sym, 10);
  const sq = document.getElementById('rlsSleepQuality').value;
  if (sq !== '') entry.sleepQuality = parseInt(sq, 10);
  const fields = ['beginDuration', 'triggers', 'medication', 'relief', 'sleepOnset', 'sleepWakeups', 'sleepRlsWake'];
  const ids = ['rlsBeginDuration', 'rlsTriggers', 'rlsMedication', 'rlsRelief', 'rlsSleepOnset', 'rlsSleepWakeups', 'rlsSleepRlsWake'];
  fields.forEach((key, i) => {
    const v = document.getElementById(ids[i])?.value?.trim();
    if (v) entry[key] = v;
  });
  if (document.getElementById('rlsAugmentation')?.checked) entry.augmentation = true;
  else delete entry.augmentation;
  entry.updated = new Date().toISOString();

  const hasContent = entry.symptom !== undefined || entry.sleepQuality !== undefined ||
    fields.some(k => entry[k]);
  if (!hasContent) {
    showToast('⚠️ Bitte mindestens ein Feld ausfüllen');
    return;
  }

  store[currentRlsDate] = { ...(store[currentRlsDate] || {}), ...entry };
  saveRlsDailyStore(store);
  renderRlsDailyTable();
  showToast('✅ RLS-Dokumentation gespeichert');
}

function renderRlsDailyTable() {
  const tbody = document.getElementById('rlsDailyTableBody');
  if (!tbody) return;
  const store = getRlsDaily();
  let dates = Object.keys(store).sort().reverse();

  const period = getActivePreVisitPeriod();
  if (period) {
    dates = dates.filter(d => d >= period.startDate && d <= period.date);
    dates.sort();
  } else {
    dates = dates.slice(0, 14).reverse();
  }

  if (!dates.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-3);text-align:center">Noch keine Einträge</td></tr>';
    return;
  }

  tbody.innerHTML = dates.map(d => {
    const e = store[d];
    return `<tr>
      <td>${formatDateShort(d)}</td>
      <td>${e.symptom ?? '–'}</td>
      <td>${escHtml((e.beginDuration || '–').slice(0, 40))}</td>
      <td>${e.sleepQuality ?? '–'}</td>
      <td>${escHtml((e.triggers || '–').slice(0, 30))}</td>
      <td>${escHtml((e.medication || '–').slice(0, 30))}</td>
      <td>${escHtml((e.relief || '–').slice(0, 30))}</td>
    </tr>`;
  }).join('');
}

function updateRlsBanners() {
  const preBanner = document.getElementById('rlsPreVisitBanner');
  const surveyBanner = document.getElementById('rlsSurveyBanner');
  const period = getActivePreVisitPeriod();

  if (period && preBanner) {
    const typeLabel = period.type === 'pain' ? 'Schmerztherapeut' : 'RLS-Facharzt';
    preBanner.style.display = 'block';
    preBanner.innerHTML = `<strong>Tägliche RLS-Dokumentation aktiv</strong> – ${period.preVisitDays} Tage vor Ihrem Termin am ${formatDateShort(period.date)} (${typeLabel}). Bitte täglich ausfüllen.`;
  } else if (preBanner) {
    preBanner.style.display = 'none';
  }

  if (surveyBanner) {
    const wd = getSettings().surveyWeekday ?? 0;
    const wdName = DAY_NAMES_FULL[wd];
    if (getRlsMode() === 'detailed_only') {
      surveyBanner.style.display = 'block';
      surveyBanner.innerHTML = 'Sie nutzen nur die <strong>ausführliche Tagesdoku</strong> – der wöchentliche RLS-6 Fragebogen ist deaktiviert.';
    } else if (getActivePreVisitPeriod() && getRlsMode() === 'auto') {
      surveyBanner.style.display = 'block';
      surveyBanner.innerHTML = '<strong>Vor-Termin-Phase:</strong> Bitte die ausführliche tägliche Doku nutzen. Der wöchentliche Kurzfragebogen ist bis nach dem Termin pausiert.';
    } else if (isSurveyDue()) {
      surveyBanner.style.display = 'block';
      surveyBanner.innerHTML = `<strong>RLS-6 fällig heute (${wdName})</strong> – Bitte den Kurzfragebogen unten ausfüllen.`;
    } else {
      surveyBanner.style.display = 'block';
      surveyBanner.innerHTML = `Nächster RLS-6 Fragebogen am <strong>${wdName}</strong> (wöchentlich).`;
    }
  }
  applyRlsVisibility();
}

// ── RxNav drug interactions ─────────────────────
async function resolveRxcui(name, pzn) {
  const term = (name || '').trim();
  if (!term && !pzn) return null;

  if (pzn && /^\d{7,8}$/.test(pzn)) {
    try {
      const r = await fetch(`${RXNAV_BASE}/approximateTerm.json?term=${encodeURIComponent(pzn)}&maxEntries=3`);
      const j = await r.json();
      const cand = j?.approximateGroup?.candidate;
      if (cand) {
        const list = Array.isArray(cand) ? cand : [cand];
        const rx = list.find(c => c.rxcui) || list[0];
        if (rx?.rxcui) return rx.rxcui;
      }
    } catch { /* fallback to name */ }
  }

  try {
    const r = await fetch(`${RXNAV_BASE}/drugs.json?name=${encodeURIComponent(term)}`);
    const j = await r.json();
    const groups = j?.drugGroup?.conceptGroup;
    if (!groups) return null;
    const arr = Array.isArray(groups) ? groups : [groups];
    for (const g of arr) {
      const props = g?.conceptProperties;
      if (!props) continue;
      const list = Array.isArray(props) ? props : [props];
      const inPin = list.find(p => p.tty === 'IN' || p.tty === 'PIN');
      if (inPin?.rxcui) return inPin.rxcui;
      if (list[0]?.rxcui) return list[0].rxcui;
    }
  } catch { /* offline */ }

  try {
    const r = await fetch(`${RXNAV_BASE}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=1`);
    const j = await r.json();
    const c = j?.approximateGroup?.candidate;
    const one = Array.isArray(c) ? c[0] : c;
    return one?.rxcui || null;
  } catch {
    return null;
  }
}

async function checkDrugInteractions() {
  const meds = getMeds();
  const box = document.getElementById('interactionResults');
  const btn = document.getElementById('btnCheckInteractions');

  if (meds.length < 2) {
    showToast('⚠️ Mindestens 2 Medikamente für Wechselwirkungsprüfung');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Prüfe…';
  box.style.display = 'block';
  const local = findLocalInteractions(meds);
  let localHtml = '';
  if (local.length) {
    localHtml += '<p style="font-size:12px;font-weight:600;color:var(--accent-pain);margin-bottom:8px">Offline-Prüfung (gängige Kombinationen):</p>';
    local.forEach(w => {
      localHtml += `<div class="interaction-item severity-high"><strong>🔴 ${escHtml(w.medA)} + ${escHtml(w.medB)}</strong><br>${escHtml(w.msg)}</div>`;
    });
    localHtml += '<hr style="border:none;border-top:1px solid var(--border);margin:12px 0">';
  }
  box.innerHTML = localHtml + '<p style="font-size:12px;color:var(--text-2)">RxNorm Online-Prüfung…</p>';

  const resolved = [];
  for (const m of meds) {
    const rxcui = await resolveRxcui(m.name, m.pzn);
    resolved.push({ ...m, rxcui });
  }

  const withRxcui = resolved.filter(m => m.rxcui);
  if (withRxcui.length < 2) {
    box.innerHTML = localHtml + `<p style="color:var(--accent-pain);font-size:12px">Nur ${withRxcui.length} von ${meds.length} Medikamenten in RxNorm gefunden. Bitte Wirkstoffnamen (z.&nbsp;B. „Pramipexol") verwenden.</p>
      <ul style="margin-top:8px;font-size:11px;color:var(--text-3)">${resolved.map(m => `<li>${escHtml(m.name)}: ${m.rxcui ? 'RxCUI ' + m.rxcui : 'nicht gefunden'}</li>`).join('')}</ul>`;
    btn.disabled = false;
    btn.textContent = '🔍 Wechselwirkungen prüfen';
    return;
  }

  const rxcuis = withRxcui.map(m => m.rxcui).join('+');
  try {
    const r = await fetch(`${RXNAV_BASE}/interaction/list.json?rxcuis=${rxcuis}`);
    const j = await r.json();
    const groups = j?.fullInteractionTypeGroup;
    let rxHtml = `<p style="font-size:11px;color:var(--text-3);margin-bottom:10px">RxNorm geprüft: ${withRxcui.map(m => escHtml(m.name)).join(', ')}</p>`;

    if (!groups || (Array.isArray(groups) && groups.length === 0)) {
      rxHtml += '<p style="font-size:13px;color:var(--accent-2)">Keine weiteren Wechselwirkungen in RxNorm gefunden.</p>';
    } else {
      const gList = Array.isArray(groups) ? groups : [groups];
      gList.forEach(g => {
        const types = g?.fullInteractionType;
        const tList = Array.isArray(types) ? types : (types ? [types] : []);
        tList.forEach(t => {
          const pairs = t?.interactionPair;
          const pList = Array.isArray(pairs) ? pairs : (pairs ? [pairs] : []);
          pList.forEach(p => {
            const desc = p?.description || 'Wechselwirkung';
            const sev = (p?.severity || '').toLowerCase();
            const cls = sev.includes('high') ? 'severity-high' : sev.includes('moderate') ? 'severity-moderate' : 'severity-low';
            rxHtml += `<div class="interaction-item ${cls}"><strong>${escHtml(t?.interactionType || 'Interaktion')}</strong><br>${escHtml(desc)}${p?.severity ? `<br><span style="color:var(--text-3)">Schwere: ${escHtml(p.severity)}</span>` : ''}</div>`;
          });
        });
      });
    }
    box.innerHTML = localHtml + rxHtml;
    showToast('✅ Wechselwirkungsprüfung abgeschlossen');
  } catch (err) {
    box.innerHTML = localHtml + `<p style="color:var(--accent-pain);font-size:12px">RxNav nicht erreichbar.${local.length ? ' Offline-Hinweise oben beachten.' : ''}</p>`;
    showToast('❌ RxNav nicht erreichbar');
  }

  btn.disabled = false;
  btn.textContent = '🔍 Wechselwirkungen prüfen';
}

// ── Pearson correlation ─────────────────────────
function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
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

function getDailySeries(store, extractor) {
  const dates = Object.keys(store).sort();
  const xs = [];
  const ys = [];
  dates.forEach(d => {
    const pair = extractor(store[d], d);
    if (pair && pair[0] !== null && pair[1] !== null && !isNaN(pair[0]) && !isNaN(pair[1])) {
      xs.push(pair[0]);
      ys.push(pair[1]);
    }
  });
  return { xs, ys, n: xs.length };
}

function dailyAvgPain(entry) {
  const vals = TIMES.map(t => entry[`${t.key}_pain`]).filter(v => v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function dailyAvgRls(entry) {
  const vals = TIMES.map(t => entry[`${t.key}_rls`]).filter(v => v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function renderCorrelations() {
  const grid = document.getElementById('correlationGrid');
  if (!grid) return;
  const store = getStore();
  const rlsDaily = getRlsDaily();

  const pairs = [
    {
      label: 'Ø Schmerz ↔ Schlafqualität',
      get: () => getDailySeries(store, e => {
        const p = dailyAvgPain(e);
        const s = e.sleepQuality;
        return p !== null && s !== undefined ? [p, s] : null;
      }),
    },
    {
      label: 'Ø RLS ↔ Schlafqualität',
      get: () => getDailySeries(store, e => {
        const r = dailyAvgRls(e);
        const s = e.sleepQuality;
        return r !== null && s !== undefined ? [r, s] : null;
      }),
    },
    {
      label: 'Ø Schmerz ↔ Schlafdauer (h)',
      get: () => getDailySeries(store, e => {
        const p = dailyAvgPain(e);
        const h = e.sleepHours;
        return p !== null && h !== undefined ? [p, h] : null;
      }),
    },
    {
      label: 'Ø RLS ↔ Schlafdauer (h)',
      get: () => getDailySeries(store, e => {
        const r = dailyAvgRls(e);
        const h = e.sleepHours;
        return r !== null && h !== undefined ? [r, h] : null;
      }),
    },
    {
      label: 'Ø Schmerz ↔ Ø RLS',
      get: () => getDailySeries(store, e => {
        const p = dailyAvgPain(e);
        const r = dailyAvgRls(e);
        return p !== null && r !== null ? [p, r] : null;
      }),
    },
    {
      label: 'RLS-Symptom (Doku) ↔ Schlaf (Doku)',
      get: () => {
        const dates = Object.keys(rlsDaily).sort();
        const xs = [], ys = [];
        dates.forEach(d => {
          const e = rlsDaily[d];
          if (e.symptom !== undefined && e.sleepQuality !== undefined) {
            xs.push(e.symptom);
            ys.push(e.sleepQuality);
          }
        });
        return { xs, ys, n: xs.length };
      },
    },
  ];

  const results = pairs.map(p => {
    const { xs, ys, n } = p.get();
    const r = pearsonCorrelation(xs, ys);
    return { label: p.label, r, n };
  }).filter(x => x.n >= 5);

  if (!results.length) {
    grid.innerHTML = '<div class="empty-state" style="padding:20px"><p>Noch zu wenig gemeinsame Tage (min. 5) für Korrelationen.<br>Erfassen Sie Schlaf, Schmerz und RLS regelmäßig.</p></div>';
    return;
  }

  grid.innerHTML = results.map(({ label, r, n }) => {
    const abs = Math.abs(r);
    const cls = abs >= 0.5 ? 'strong' : abs >= 0.3 ? 'moderate' : 'weak';
    const sign = r > 0 ? '+' : '';
    return `<div class="corr-item">
      <span class="corr-pair">${escHtml(label)} <span style="color:var(--text-3)">(n=${n})</span></span>
      <span class="corr-val ${cls}">r = ${sign}${r.toFixed(2)}</span>
    </div>`;
  }).join('');
}

function avgOf(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function renderTagPatternInsights() {
  const el = document.getElementById('tagPatternInsights');
  if (!el) return;
  const store = getStore();
  const insights = [];

  INFLUENCE_TAGS.forEach(tag => {
    const withVals = { pain: [], rls: [] };
    const withoutVals = { pain: [], rls: [] };

    Object.keys(store).forEach(d => {
      const e = store[d];
      const p = dailyAvgPain(e);
      const r = dailyAvgRls(e);
      if (p === null && r === null) return;
      const has = !!(e.factors && e.factors[tag.key]);
      if (has) {
        if (p !== null) withVals.pain.push(p);
        if (r !== null) withVals.rls.push(r);
      } else {
        if (p !== null) withoutVals.pain.push(p);
        if (r !== null) withoutVals.rls.push(r);
      }
    });

    const tagLabel = tag.label;
    ['rls', 'pain'].forEach(metric => {
      const w = withVals[metric];
      const o = withoutVals[metric];
      if (w.length < MIN_PATTERN_DAYS || o.length < MIN_PATTERN_DAYS) return;
      const avgW = avgOf(w);
      const avgO = avgOf(o);
      const diff = avgW - avgO;
      if (Math.abs(diff) < MIN_TAG_DIFF) return;
      const metricLabel = metric === 'rls' ? 'RLS' : 'Schmerz';
      if (diff > 0) {
        insights.push(`An Tagen mit ${tagLabel} lag dein ${metricLabel} im Schnitt bei <strong>${avgW.toFixed(1)}</strong>, ohne bei <strong>${avgO.toFixed(1)}</strong> – ${tagLabel.replace(/^[^\s]+\s/, '')} könnte ein Auslöser sein.`);
      } else {
        const pct = avgO ? Math.round(Math.abs(diff) / avgO * 100) : 0;
        insights.push(`${tagLabel} senkt deinen ${metricLabel} im Schnitt von <strong>${avgO.toFixed(1)}</strong> auf <strong>${avgW.toFixed(1)}</strong>${pct ? ` (−${pct}%)` : ''}.`);
      }
    });
  });

  if (!insights.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px"><p>Nutze die Einflussfaktoren im Tagebuch – nach min. 5 Tagen mit/ohne Tag erscheinen Muster.</p></div>';
    return;
  }
  el.innerHTML = insights.map(t => `<div class="smart-insight">💡 ${t}</div>`).join('');
}

function renderMedEffectInsights() {
  const el = document.getElementById('medEffectInsights');
  if (!el) return;
  const store = getStore();
  const meds = getMeds();
  const insights = [];

  meds.forEach(m => {
    const id = m.id;
    const withVals = { pain: [], rls: [] };
    const withoutVals = { pain: [], rls: [] };

    Object.keys(store).forEach(d => {
      const e = store[d];
      const p = dailyAvgPain(e);
      const r = dailyAvgRls(e);
      if (p === null && r === null) return;
      const taken = (e.medsTaken || []).includes(id);
      if (taken) {
        if (p !== null) withVals.pain.push(p);
        if (r !== null) withVals.rls.push(r);
      } else {
        if (p !== null) withoutVals.pain.push(p);
        if (r !== null) withoutVals.rls.push(r);
      }
    });

    ['rls', 'pain'].forEach(metric => {
      const w = withVals[metric];
      const o = withoutVals[metric];
      if (w.length < 3 || o.length < 3) return;
      const avgW = avgOf(w);
      const avgO = avgOf(o);
      if (avgW === null || avgO === null || avgO === 0) return;
      const pct = Math.round((avgO - avgW) / avgO * 100);
      if (Math.abs(pct) < 8) return;
      const metricLabel = metric === 'rls' ? 'RLS' : 'Schmerz';
      if (pct > 0) {
        insights.push(`Unter Einnahme von <strong>${escHtml(m.name)}</strong> sank dein ${metricLabel} im Schnitt um <strong>${pct}%</strong> (${avgO.toFixed(1)} → ${avgW.toFixed(1)}).`);
      } else {
        insights.push(`An Tagen mit <strong>${escHtml(m.name)}</strong> war dein ${metricLabel} im Schnitt <strong>${Math.abs(pct)}%</strong> höher (${avgO.toFixed(1)} → ${avgW.toFixed(1)}).`);
      }
    });
  });

  if (!insights.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px"><p>Im Tagebuch „Medikamente heute eingenommen“ ankreuzen – dann Vergleich Einnahme- vs. freie Tage.</p></div>';
    return;
  }
  el.innerHTML = insights.map(t => `<div class="smart-insight">${t}</div>`).join('');
}

// ── Charts ───────────────────────────────────────
function setChartView(view, btn) {
  currentChartView = view;
  document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCharts();
}

function renderCharts() {
  const store = getStore();
  const dates = Object.keys(store).sort();

  // Compute stats
  let totalPain = 0, totalRls = 0, countPain = 0, countRls = 0;
  dates.forEach(d => {
    const e = store[d];
    TIMES.forEach(t => {
      if (e[`${t.key}_pain`] !== undefined) { totalPain += e[`${t.key}_pain`]; countPain++; }
      if (e[`${t.key}_rls`]  !== undefined) { totalRls  += e[`${t.key}_rls`];  countRls++;  }
    });
  });
  document.getElementById('statAvgPain').textContent = countPain ? (totalPain/countPain).toFixed(1) : '–';
  document.getElementById('statAvgRls').textContent  = countRls  ? (totalRls/countRls).toFixed(1)   : '–';
  document.getElementById('statDays').textContent    = dates.length;

  // Determine date range
  const today = new Date();
  let days;
  if (currentChartView === 'week')   days = 7;
  else if (currentChartView === 'month')  days = 30;
  else if (currentChartView === '3month') days = 90;
  else days = 365;

  const labels = [];
  const painData = [];
  const rlsData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = d.toISOString().split('T')[0];
    const entry = store[str];

    let lbl;
    if (days <= 7) lbl = `${DAY_NAMES[d.getDay()]} ${d.getDate()}.`;
    else if (days <= 30) lbl = `${d.getDate()}.${d.getMonth()+1}.`;
    else lbl = `${d.getDate()}.${d.getMonth()+1}.`;

    labels.push(lbl);

    if (entry) {
      let p = [], r = [];
      TIMES.forEach(t => {
        if (entry[`${t.key}_pain`] !== undefined) p.push(entry[`${t.key}_pain`]);
        if (entry[`${t.key}_rls`]  !== undefined) r.push(entry[`${t.key}_rls`]);
      });
      painData.push(p.length ? +(p.reduce((a,b)=>a+b,0)/p.length).toFixed(1) : null);
      rlsData.push(r.length  ? +(r.reduce((a,b)=>a+b,0)/r.length).toFixed(1) : null);
    } else {
      painData.push(null);
      rlsData.push(null);
    }
  }

  // Main chart
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Schmerz',
          data: painData,
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255,107,107,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#ff6b6b',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true,
          spanGaps: true,
        },
        {
          label: 'RLS',
          data: rlsData,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167,139,250,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#a78bfa',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true,
          spanGaps: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1e35',
          titleColor: '#8aa8cc',
          bodyColor: '#e8f1ff',
          borderColor: '#1e3a5f',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y + ' / 10' : '–'}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,58,95,0.5)', drawBorder: false },
          ticks: { color: '#4a6890', font: { size: 10, family: "'DM Mono', monospace" }, maxRotation: 45 }
        },
        y: {
          min: 0, max: 10,
          grid: { color: 'rgba(30,58,95,0.5)', drawBorder: false },
          ticks: { color: '#4a6890', font: { size: 10 }, stepSize: 2 }
        }
      }
    }
  });

  // Time-of-day chart (last 7 days avg per time slot)
  const todLabels = ['Morgen', 'Mittag', 'Abend', 'Nacht'];
  const todPain = [0,0,0,0];
  const todRls  = [0,0,0,0];
  const todCount = [0,0,0,0];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = d.toISOString().split('T')[0];
    const entry = store[str];
    if (!entry) continue;
    TIMES.forEach((t, idx) => {
      if (entry[`${t.key}_pain`] !== undefined) { todPain[idx] += entry[`${t.key}_pain`]; todCount[idx]++; }
      if (entry[`${t.key}_rls`]  !== undefined) { todRls[idx]  += entry[`${t.key}_rls`]; }
    });
  }

  const todPainAvg = todPain.map((v, i) => todCount[i] ? +(v/todCount[i]).toFixed(1) : 0);
  const todRlsAvg  = todRls.map((v, i)  => todCount[i] ? +(v/todCount[i]).toFixed(1) : 0);

  const ctx2 = document.getElementById('todChart').getContext('2d');
  if (todChartInstance) todChartInstance.destroy();
  todChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: todLabels,
      datasets: [
        {
          label: 'Schmerz',
          data: todPainAvg,
          backgroundColor: 'rgba(255,107,107,0.7)',
          borderColor: '#ff6b6b',
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: 'RLS',
          data: todRlsAvg,
          backgroundColor: 'rgba(167,139,250,0.7)',
          borderColor: '#a78bfa',
          borderWidth: 1,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1e35',
          titleColor: '#8aa8cc',
          bodyColor: '#e8f1ff',
          borderColor: '#1e3a5f',
          borderWidth: 1,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8aa8cc', font: { size: 12, family: "'DM Sans', sans-serif", weight: '500' } }
        },
        y: {
          min: 0, max: 10,
          grid: { color: 'rgba(30,58,95,0.5)' },
          ticks: { color: '#4a6890', font: { size: 10 }, stepSize: 2 }
        }
      }
    }
  });

  renderCorrelations();
  renderTagPatternInsights();
  renderMedEffectInsights();
}

// ── Export CSV ───────────────────────────────────
function exportCSV() {
  const store = getStore();
  const dates = Object.keys(store).sort();

  if (dates.length === 0) { showToast('⚠️ Keine Daten zum Exportieren'); return; }

  const header = 'datum,morgen_schmerz,morgen_rls,mittag_schmerz,mittag_rls,abend_schmerz,abend_rls,nacht_schmerz,nacht_rls,schlafdauer_stunden,schlafqualitaet_1_5,notizen';
  const rows = dates.map(d => {
    const e = store[d];
    const cols = [
      d,
      e.morning_pain ?? '',
      e.morning_rls  ?? '',
      e.noon_pain    ?? '',
      e.noon_rls     ?? '',
      e.evening_pain ?? '',
      e.evening_rls  ?? '',
      e.night_pain   ?? '',
      e.night_rls    ?? '',
      e.sleepHours ?? '',
      e.sleepQuality ?? '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ];
    return cols.join(',');
  });

  const csv = [header, ...rows].join('\n');
  downloadFile(csv, `schmerztagebuch_${todayStr()}.csv`, 'text/csv;charset=utf-8;');
  showToast('✅ CSV exportiert');
}

// ── Export JSON ──────────────────────────────────
function exportJSON() {
  const data = {
    diary: getStore(),
    medications: getMeds(),
    settings: getSettings(),
    rlsDaily: getRlsDaily(),
    rlsSurveys: getRlsSurveys(),
    exportedAt: new Date().toISOString(),
    version: 2,
  };
  downloadFile(JSON.stringify(data, null, 2), `schmerztagebuch_backup_${todayStr()}.json`, 'application/json');
  showToast('✅ JSON-Backup erstellt');
}

// ── Export PDF ───────────────────────────────────
function exportPDF() {
  if (!window.jspdf) { showToast('⏳ PDF-Bibliothek lädt...'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const store = getStore();
  const dates = Object.keys(store).sort();
  const meds  = getMeds();

  let y = 20;
  const lm = 20, rm = 190;

  // Header
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(232, 241, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Schmerz & RLS Tagebuch', lm, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(138, 168, 204);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' })}`, lm, 25);
  doc.text(`Zeitraum: ${dates.length > 0 ? dates[0] + ' – ' + dates[dates.length-1] : 'Keine Daten'}`, lm, 31);

  y = 45;
  doc.setTextColor(30, 30, 30);

  // Stats
  if (dates.length > 0) {
    let tp = 0, tr = 0, cp = 0, cr = 0;
    dates.forEach(d => {
      const e = store[d];
      TIMES.forEach(t => {
        if (e[`${t.key}_pain`] !== undefined) { tp += e[`${t.key}_pain`]; cp++; }
        if (e[`${t.key}_rls`]  !== undefined) { tr += e[`${t.key}_rls`];  cr++; }
      });
    });

    doc.setFillColor(240, 245, 255);
    doc.roundedRect(lm, y, 50, 24, 3, 3, 'F');
    doc.roundedRect(76, y, 50, 24, 3, 3, 'F');
    doc.roundedRect(132, y, 50, 24, 3, 3, 'F');

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 50, 50);
    doc.text(cp ? (tp/cp).toFixed(1) : '–', 45, y+12, {align:'center'});
    doc.setTextColor(120, 80, 200);
    doc.text(cr ? (tr/cr).toFixed(1) : '–', 101, y+12, {align:'center'});
    doc.setTextColor(40, 120, 200);
    doc.text(String(dates.length), 157, y+12, {align:'center'});

    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,100,100);
    doc.text('Ø Schmerz', 45, y+20, {align:'center'});
    doc.text('Ø RLS', 101, y+20, {align:'center'});
    doc.text('Tage erfasst', 157, y+20, {align:'center'});

    y += 32;
  }

  // Medications
  if (meds.length > 0) {
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(10,22,40);
    doc.text('Medikamentenplan', lm, y); y += 8;
    doc.setLineWidth(0.5); doc.setDrawColor(59,158,255);
    doc.line(lm, y, rm, y); y += 6;

    meds.forEach(m => {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30,30,30);
      doc.text(`${m.name}  –  ${m.dose}`, lm, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(100,100,100);
      doc.text(`Zeit: ${m.time}${m.note ? '  |  ' + m.note : ''}`, lm + 5, y + 5);
      y += 12;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4;
  }

  // Diary Entries
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(10,22,40);
  doc.text('Tagebucheinträge', lm, y); y += 8;
  doc.setLineWidth(0.5); doc.setDrawColor(59,158,255);
  doc.line(lm, y, rm, y); y += 6;

  dates.slice(-90).forEach(d => {
    const e = store[d];
    const pd = parseDate(d);
    const dLabel = `${DAY_NAMES_FULL[pd.getDay()]}, ${pd.getDate()}. ${MONTH_NAMES[pd.getMonth()]} ${pd.getFullYear()}`;

    if (y > 250) { doc.addPage(); y = 20; }

    doc.setFillColor(240, 245, 255);
    doc.roundedRect(lm, y, rm - lm, 7, 1, 1, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30,30,80);
    doc.text(dLabel, lm + 3, y + 5); y += 10;

    const timeLabels = ['Morgen','Mittag','Abend','Nacht'];
    const timeKeys   = ['morning','noon','evening','night'];
    let rowX = lm;

    timeKeys.forEach((tk, i) => {
      const p = e[`${tk}_pain`];
      const r = e[`${tk}_rls`];
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(80,80,80);
      doc.text(timeLabels[i], rowX + 10, y, {align:'center'});
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(180,60,60);
      doc.text(`S: ${p !== undefined ? p : '–'}`, rowX + 4, y + 5);
      doc.setTextColor(120,80,200);
      doc.text(`R: ${r !== undefined ? r : '–'}`, rowX + 14, y + 5);
      rowX += 43;
    });
    y += 12;

    if (e.sleepHours !== undefined || e.sleepQuality !== undefined) {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60,100,160);
      doc.text(`Schlaf: ${e.sleepHours !== undefined ? e.sleepHours + ' h' : '–'}, Qualität: ${e.sleepQuality !== undefined ? e.sleepQuality + '/5' : '–'}`, lm + 3, y);
      y += 6;
    }

    if (e.notes) {
      doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(80,80,80);
      const lines = doc.splitTextToSize(`Notiz: ${e.notes}`, rm - lm - 5);
      doc.text(lines, lm + 3, y);
      y += lines.length * 4.5 + 2;
    }
    y += 4;
  });

  const rlsDaily = getRlsDaily();
  const rlsDates = Object.keys(rlsDaily).sort();
  if (rlsDates.length > 0 && y > 240) { doc.addPage(); y = 20; }
  if (rlsDates.length > 0) {
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(10,22,40);
    doc.text('RLS-Tagesdokumentation', lm, y); y += 8;
    rlsDates.slice(-30).forEach(d => {
      if (y > 270) { doc.addPage(); y = 20; }
      const e = rlsDaily[d];
      doc.setFontSize(9); doc.setTextColor(40,40,40);
      doc.text(`${formatDateShort(d)}: Symptom ${e.symptom ?? '–'}/10, Schlaf ${e.sleepQuality ?? '–'}/5`, lm, y);
      y += 5;
      if (e.beginDuration) { doc.text(`  Beginn/Dauer: ${e.beginDuration}`, lm, y); y += 5; }
      y += 3;
    });
  }

  const surveys = getRlsSurveys();
  const surveyDates = Object.keys(surveys).sort();
  if (surveyDates.length > 0) {
    y += 6;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('RLS-Fragebögen (6 Fragen)', lm, y); y += 8;
    surveyDates.slice(-10).forEach(d => {
      const s = surveys[d];
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`${formatDateShort(d)}: ${s.sum}/24 – ${s.severity}`, lm, y);
      y += 6;
    });
  }

  doc.save(`schmerztagebuch_${todayStr()}.pdf`);
  showToast('✅ PDF erstellt');
}

// ── Import ───────────────────────────────────────
function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();

  reader.onload = e => {
    const content = e.target.result;

    if (file.name.endsWith('.json')) {
      try {
        const data = JSON.parse(content);
        if (data.diary) {
          const store = getStore();
          Object.assign(store, data.diary);
          saveStore(store);
        }
        if (data.medications) {
          const meds = getMeds();
          meds.push(...data.medications);
          saveMeds(meds);
        }
        if (data.settings) saveSettings({ ...getSettings(), ...data.settings });
        if (data.rlsDaily) {
          const rd = getRlsDaily();
          Object.assign(rd, data.rlsDaily);
          saveRlsDailyStore(rd);
        }
        if (data.rlsSurveys) {
          const rs = getRlsSurveys();
          Object.assign(rs, data.rlsSurveys);
          saveRlsSurveys(rs);
        }
        buildWeekStrip();
        renderMedList();
        initRlsTab();
        showToast(`✅ JSON importiert`);
      } catch {
        showToast('❌ Ungültige JSON-Datei');
      }
      return;
    }

    // CSV import
    try {
      const lines = content.trim().split('\n');
      const header = lines[0].toLowerCase().replace(/\r/g,'').split(',');
      const store = getStore();
      let imported = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].replace(/\r/g,'');
        if (!line.trim()) continue;
        const cols = parseCSVLine(line);

        const datum = cols[0]?.trim();
        if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;

        const entry = {};
        const mapping = {
          morgen_schmerz: 'morning_pain', morgen_rls:  'morning_rls',
          mittag_schmerz: 'noon_pain',    mittag_rls:  'noon_rls',
          abend_schmerz:  'evening_pain', abend_rls:   'evening_rls',
          nacht_schmerz:  'night_pain',   nacht_rls:   'night_rls',
        };

        header.forEach((h, idx) => {
          const key = mapping[h.trim()];
          if (key && cols[idx] !== undefined && cols[idx].trim() !== '') {
            const v = parseInt(cols[idx]);
            if (!isNaN(v) && v >= 0 && v <= 10) entry[key] = v;
          }
          if (h.trim() === 'notizen' && cols[idx]) {
            entry.notes = cols[idx].replace(/^"|"$/g,'').replace(/""/g,'"').trim();
          }
          if (h.trim() === 'schlafdauer_stunden' && cols[idx]?.trim()) {
            const v = parseFloat(cols[idx]);
            if (!isNaN(v)) entry.sleepHours = v;
          }
          if (h.trim() === 'schlafqualitaet_1_5' && cols[idx]?.trim()) {
            const v = parseInt(cols[idx], 10);
            if (!isNaN(v) && v >= 1 && v <= 5) entry.sleepQuality = v;
          }
        });

        if (Object.keys(entry).length > 0) {
          store[datum] = { ...(store[datum] || {}), ...entry };
          imported++;
        }
      }

      saveStore(store);
      buildWeekStrip();
      showToast(`✅ ${imported} Einträge importiert`);
    } catch (err) {
      showToast('❌ Importfehler: ' + err.message);
    }

    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Clear Data ───────────────────────────────────
function clearAllData() {
  if (!confirm('Wirklich ALLE Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) return;
  localStorage.removeItem('painDiary');
  localStorage.removeItem('painDiaryMeds');
  localStorage.removeItem('painDiarySettings');
  localStorage.removeItem('painDiaryRlsDaily');
  localStorage.removeItem('painDiaryRlsSurvey');
  buildWeekStrip();
  loadCurrentEntry();
  renderMedList();
  initRlsTab();
  showToast('🗑 Alle Daten gelöscht');
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
