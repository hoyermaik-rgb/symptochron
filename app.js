// ══════════════════════════════════════════════
//  SCHMERZ & RLS TAGEBUCH – App Logic
// ══════════════════════════════════════════════

const TIMES = [
  { key: 'morning', label: 'Morgen',  clock: '06–10 Uhr' },
  { key: 'noon',    label: 'Mittag',  clock: '10–14 Uhr' },
  { key: 'evening', label: 'Abend',   clock: '17–22 Uhr' },
  { key: 'night',   label: 'Nacht',   clock: '22–06 Uhr' },
];

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_FULL = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// IRLS - Aktualisiert basierend auf Recherche
const RLS_SURVEY_QUESTIONS = [
  'Wie stark würden Sie die RLS-Beschwerden in Ihren Beinen oder Armen einschätzen?',
  'Wie stark würden Sie Ihren Drang einschätzen, sich wegen Ihrer RLS-Beschwerden bewegen zu müssen?',
  'Wie sehr wurden die RLS-Beschwerden durch Bewegung gelindert?',
  'Wie sehr wurde Ihr Schlaf durch Ihre RLS-Beschwerden gestört?',
  'Wie müde oder schläfrig waren Sie tagsüber wegen Ihrer RLS-Beschwerden?',
  'Wie stark waren Ihre RLS-Beschwerden insgesamt?',
  'Wie oft sind Ihre RLS-Beschwerden in den letzten Wochen aufgetreten?',
  'Wie lange hielten die Beschwerden an einem durchschnittlichen Tag an?',
  'Wie sehr haben sich die Beschwerden auf Ihre Alltagstätigkeiten ausgewirkt?',
  'Wie stark haben die Beschwerden Ihre Stimmung beeinträchtigt (z.B. gereizt, traurig)?'
];

const INFLUENCE_TAGS = [
  { key: 'coffee', label: '☕ Kaffee' },
  { key: 'alcohol', label: '🍷 Alkohol' },
  { key: 'stress', label: '⚠️ Stress' },
  { key: 'sport', label: '🏋️ Sport' },
  { key: 'poorSleep', label: '🛌 Schlafmangel' },
];

const LOCAL_DRUG_INTERACTIONS = [
  { drugs: ['ibuprofen', 'diclofenac', 'naproxen', 'aspirin'], interact: ['warfarin', 'marcumar', 'rivaroxaban', 'apixaban'], msg: 'NSAR + Antikoagulanzien: Erhöhtes Blutungsrisiko!', severity: 'high' },
  { drugs: ['tramadol', 'morphin', 'tilidin', 'oxycodon'], interact: ['gabapentin', 'pregabalin'], msg: 'Opioid + Gabapentinoid: Gefahr der Atemdepression!', severity: 'high' },
  { drugs: ['pramipexol', 'ropinirol', 'rotigotin'], interact: ['haloperidol', 'metoclopramid'], msg: 'Dopaminagonist + Antagonist: Wirkung wird aufgehoben!', severity: 'moderate' }
];

// ── State ───────────────────────────────────────
let currentDate = new Date().toISOString().split('T')[0];
let chartInstance = null;
let surveyAnswers = new Array(10).fill(null);

// ── Storage ─────────────────────────────────────
const getStore = () => JSON.parse(localStorage.getItem('painDiary') || '{}');
const saveStore = (d) => localStorage.setItem('painDiary', JSON.stringify(d));
const getMeds = () => JSON.parse(localStorage.getItem('painDiaryMeds') || '[]');
const saveMeds = (m) => localStorage.setItem('painDiaryMeds', JSON.stringify(m));
const getRlsSurveys = () => JSON.parse(localStorage.getItem('painDiaryRlsSurvey') || '{}');
const saveRlsSurveys = (s) => localStorage.setItem('painDiaryRlsSurvey', JSON.stringify(s));

// ── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupNotifications();
});

function initApp() {
  updateHeaderDate();
  buildTimeBlocks();
  buildInfluenceTags();
  buildSurveyQuestions();
  loadCurrentEntry();
  renderMedList();
  refreshDiary();
}

function updateHeaderDate() {
  const d = new Date();
  document.getElementById('headerDate').textContent = d.toLocaleDateString('de-DE');
}

function buildTimeBlocks() {
  const grid = document.getElementById('timeBlocksGrid');
  grid.innerHTML = TIMES.map(t => `
    <div class="time-block">
      <div class="time-block-header">
        <div class="time-dot" style="background:var(--${t.key})"></div>
        <span class="time-label" style="color:var(--${t.key})">${t.label}</span>
        <span class="time-clock">${t.clock}</span>
      </div>
      <div class="score-row">
        <div class="score-label">Schmerz <span>0-10</span></div>
        <select class="score-select" id="${t.key}_pain" onchange="updateScoreBadge('${t.key}', 'pain')">
          ${[...Array(11).keys()].map(i => `<option value="${i}">${i}</option>`).join('')}
          <option value="" selected>--</option>
        </select>
        <div class="score-badge" id="${t.key}_pain_badge">--</div>
      </div>
      <div class="score-row">
        <div class="score-label">RLS <span>0-10</span></div>
        <select class="score-select" id="${t.key}_rls" onchange="updateScoreBadge('${t.key}', 'rls')">
          ${[...Array(11).keys()].map(i => `<option value="${i}">${i}</option>`).join('')}
          <option value="" selected>--</option>
        </select>
        <div class="score-badge" id="${t.key}_rls_badge">--</div>
      </div>
    </div>
  `).join('');
}

function updateScoreBadge(time, type) {
  const val = document.getElementById(`${time}_${type}`).value;
  const badge = document.getElementById(`${time}_${type}_badge`);
  badge.textContent = val || '--';
  badge.className = `score-badge score-${val}`;
}

function buildInfluenceTags() {
  const container = document.getElementById('influenceTags');
  container.innerHTML = INFLUENCE_TAGS.map(t => `
    <button class="tag-btn" id="tag_${t.key}" onclick="toggleTag('${t.key}')">${t.label}</button>
  `).join('');
}

function toggleTag(key) {
  document.getElementById(`tag_${key}`).classList.toggle('on');
}

// ── Diary Logic ─────────────────────────────────
function loadCurrentEntry() {
  const store = getStore();
  const entry = store[currentDate] || {};
  
  TIMES.forEach(t => {
    document.getElementById(`${t.key}_pain`).value = entry[`${t.key}_pain`] ?? '';
    document.getElementById(`${t.key}_rls`).value = entry[`${t.key}_rls`] ?? '';
    updateScoreBadge(t.key, 'pain');
    updateScoreBadge(t.key, 'rls');
  });

  document.getElementById('sleepHours').value = entry.sleepHours || '';
  document.getElementById('sleepQuality').value = entry.sleepQuality || '';
  document.getElementById('dailyNotes').value = entry.notes || '';
  
  INFLUENCE_TAGS.forEach(t => {
    document.getElementById(`tag_${t.key}`).classList.toggle('on', !!entry.factors?.[t.key]);
  });

  renderMedIntake(entry.medsTaken || []);
}

function saveEntry() {
  const store = getStore();
  const entry = { factors: {}, medsTaken: [] };
  
  TIMES.forEach(t => {
    const p = document.getElementById(`${t.key}_pain`).value;
    const r = document.getElementById(`${t.key}_rls`).value;
    if(p) entry[`${t.key}_pain`] = parseInt(p);
    if(r) entry[`${t.key}_rls`] = parseInt(r);
  });

  entry.sleepHours = parseFloat(document.getElementById('sleepHours').value);
  entry.sleepQuality = parseInt(document.getElementById('sleepQuality').value);
  entry.notes = document.getElementById('dailyNotes').value;

  INFLUENCE_TAGS.forEach(t => {
    if(document.getElementById(`tag_${t.key}`).classList.contains('on')) entry.factors[t.key] = true;
  });

  document.querySelectorAll('.med-intake-checkbox:checked').forEach(cb => {
    entry.medsTaken.push(cb.dataset.id);
  });

  store[currentDate] = entry;
  saveStore(store);
  showToast('Eintrag gespeichert!');
  if(currentDate === new Date().toISOString().split('T')[0]) {
    // Clear notification if saved
  }
}

function renderMedIntake(taken) {
  const meds = getMeds();
  const container = document.getElementById('medIntakeList');
  const card = document.getElementById('medIntakeCard');
  
  if(!meds.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  container.innerHTML = meds.map(m => {
    const isTaken = taken.includes(m.id);
    return `
      <div class="med-intake-block">
        <label class="med-intake-time-btn ${isTaken ? 'taken' : ''}">
          <input type="checkbox" class="med-intake-checkbox" data-id="${m.id}" ${isTaken ? 'checked' : ''} onchange="this.parentElement.classList.toggle('taken', this.checked)">
          <span>💊 ${m.name}</span>
          <span style="font-size:10px">${m.dose || ''}</span>
        </label>
      </div>
    `;
  }).join('');
}

// ── RLS Survey ──────────────────────────────────
function buildSurveyQuestions() {
  const container = document.getElementById('surveyQuestions');
  container.innerHTML = RLS_SURVEY_QUESTIONS.map((q, i) => `
    <div style="margin-bottom:15px;">
      <p style="font-size:12px; margin-bottom:5px;">${i+1}. ${q}</p>
      <div style="display:flex; gap:5px;">
        ${[0,1,2,3,4].map(v => `
          <button class="tag-btn ${surveyAnswers[i] === v ? 'on' : ''}" onclick="setSurveyAnswer(${i}, ${v}, this)">${v}</button>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function setSurveyAnswer(qIdx, val, btn) {
  surveyAnswers[qIdx] = val;
  const row = btn.parentElement;
  row.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  calculateRlsScore();
}

function calculateRlsScore() {
  const total = surveyAnswers.reduce((a, b) => a + (b || 0), 0);
  document.getElementById('rlsScoreDisplay').textContent = total;
  let label = "Nicht vorhanden";
  if(total >= 31) label = "Sehr schwer";
  else if(total >= 21) label = "Schwer";
  else if(total >= 11) label = "Mäßig";
  else if(total >= 1) label = "Leicht";
  document.getElementById('rlsSeverityLabel').textContent = label;
}

function saveRlsSurvey() {
  const surveys = getRlsSurveys();
  surveys[currentDate] = [...surveyAnswers];
  saveRlsSurveys(surveys);
  showToast('RLS-Fragebogen gespeichert!');
}

// ── Meds Logic ──────────────────────────────────
function renderMedList() {
  const meds = getMeds();
  const list = document.getElementById('medList');
  const empty = document.getElementById('medEmpty');
  
  if(!meds.length) { empty.style.display = 'block'; list.innerHTML = ''; return; }
  empty.style.display = 'none';

  list.innerHTML = meds.map((m, i) => `
    <div class="med-item">
      <div class="med-info">
        <div class="med-name">${m.name} ${m.pzn ? `<span class="badge-pill">PZN ${m.pzn}</span>` : ''}</div>
        <div style="font-size:11px; color:var(--text-2)">${m.dose || ''} • ${m.form || ''}</div>
      </div>
      <button class="btn-danger" onclick="deleteMed(${i})" style="padding:4px 8px;">✕</button>
    </div>
  `).join('');
  checkInteractions(meds);
}

function openMedModal() { document.getElementById('medModal').classList.add('open'); }
function closeMedModal() { document.getElementById('medModal').classList.remove('open'); }

function saveMedication() {
  const name = document.getElementById('medName').value;
  if(!name) return showToast('Name fehlt!');
  
  const meds = getMeds();
  meds.push({
    id: Date.now().toString(),
    name,
    pzn: document.getElementById('medPzn').value,
    dose: document.getElementById('medDose').value,
    form: document.getElementById('medForm').value,
    note: document.getElementById('medNote').value,
    schedule: {
      morning: document.getElementById('medMorning').value || 0,
      noon: document.getElementById('medNoon').value || 0,
      evening: document.getElementById('medEvening').value || 0,
      night: document.getElementById('medNight').value || 0
    }
  });
  saveMeds(meds);
  renderMedList();
  closeMedModal();
  showToast('Medikament hinzugefügt');
}

function deleteMed(i) {
  const meds = getMeds();
  meds.splice(i, 1);
  saveMeds(meds);
  renderMedList();
}

function checkInteractions(meds) {
  const alert = document.getElementById('medInteractionAlert');
  const names = meds.map(m => m.name.toLowerCase());
  const warnings = [];

  LOCAL_DRUG_INTERACTIONS.forEach(rule => {
    const hasA = rule.drugs.some(d => names.some(n => n.includes(d)));
    const hasB = rule.interact.some(d => names.some(n => n.includes(d)));
    if(hasA && hasB) warnings.push(rule.msg);
  });

  if(warnings.length) {
    alert.style.display = 'block';
    alert.innerHTML = `<strong>Achtung:</strong><br>${warnings.join('<br>')}`;
  } else {
    alert.style.display = 'none';
  }
}

// ── Analysis Logic (Pearson Correlation) ────────
function renderAnalysisTab() {
  const store = getStore();
  const dates = Object.keys(store).sort();
  if(dates.length < 3) return;

  const factors = INFLUENCE_TAGS.map(t => t.key);
  const results = [];

  factors.forEach(f => {
    const x = [], yRLS = [], ySleep = [];
    dates.forEach((d, i) => {
      const nextDate = new Date(new Date(d).getTime() + 86400000).toISOString().split('T')[0];
      if(store[nextDate]) {
        x.push(store[d].factors?.[f] ? 1 : 0);
        yRLS.push(store[nextDate].night_rls || 0);
        ySleep.push(store[nextDate].sleepQuality || 0);
      }
    });
    if(x.length > 2) {
      const corrRLS = pearson(x, yRLS);
      if(Math.abs(corrRLS) > 0.2) results.push({ pair: `${f} ➔ RLS Nacht`, val: corrRLS });
    }
  });

  const container = document.getElementById('correlationResults');
  container.innerHTML = results.map(r => `
    <div class="corr-item">
      <span>${r.pair}</span>
      <span class="corr-val">${r.val.toFixed(2)}</span>
    </div>
  `).join('') || 'Keine signifikanten Muster gefunden.';

  renderChart(dates, store);
}

function pearson(x, y) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for(let i=0; i<n; i++) {
    sumX += x[i]; sumY += y[i];
    sumXY += x[i]*y[i]; sumX2 += x[i]*x[i]; sumY2 += y[i]*y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

function renderChart(dates, store) {
  const ctx = document.getElementById('mainChart').getContext('2d');
  if(chartInstance) chartInstance.destroy();
  
  const last7 = dates.slice(-7);
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last7.map(d => d.split('-').slice(1).reverse().join('.')),
      datasets: [{
        label: 'Schmerz (Abend)',
        data: last7.map(d => store[d].evening_pain || 0),
        borderColor: '#ff6b6b',
        tension: 0.3
      }, {
        label: 'RLS (Nacht)',
        data: last7.map(d => store[d].night_rls || 0),
        borderColor: '#a78bfa',
        tension: 0.3
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

// ── Notifications ───────────────────────────────
function setupNotifications() {
  if(!("Notification" in window)) return;
  if(Notification.permission !== "granted") Notification.requestPermission();
  
  setInterval(() => {
    const now = new Date();
    const timeStr = now.getHours() + ":" + now.getMinutes().toString().padStart(2, '0');
    
    // Check missing entries
    if(['10:01', '14:01', '22:01'].includes(timeStr)) {
      const store = getStore();
      if(!store[new Date().toISOString().split('T')[0]]) {
        new Notification("Schmerztagebuch", { body: "Maik, hast du heute schon deine Werte eingetragen?" });
      }
    }
  }, 60000);
}

// ── Helpers ─────────────────────────────────────
function changeDay(delta) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + delta);
  currentDate = d.toISOString().split('T')[0];
  refreshDiary();
}

function goToDate(val) {
  currentDate = val;
  refreshDiary();
}

function refreshDiary() {
  document.getElementById('navDateLabel').textContent = new Date(currentDate).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long' });
  document.getElementById('datePickerInput').value = currentDate;
  loadCurrentEntry();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Scanner Bridge ──────────────────────────────
function openScannerModal() {
  document.getElementById('scannerModal').classList.add('open');
  if(typeof startQRScanner === 'function') startQRScanner();
}
function closeScannerModal() {
  document.getElementById('scannerModal').classList.remove('open');
  if(typeof stopQRScanner === 'function') stopQRScanner();
}
