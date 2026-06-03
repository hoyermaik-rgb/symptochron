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

// ── State ───────────────────────────────────────
let currentDate = todayStr();
let chartInstance = null;
let todChartInstance = null;
let currentChartView = 'week';

// ── Storage helpers ─────────────────────────────
function getStore() {
  try { return JSON.parse(localStorage.getItem('painDiary') || '{}'); } catch { return {}; }
}
function saveStore(d) { localStorage.setItem('painDiary', JSON.stringify(d)); }

function getMeds() {
  try { return JSON.parse(localStorage.getItem('painDiaryMeds') || '[]'); } catch { return []; }
}
function saveMeds(m) { localStorage.setItem('painDiaryMeds', JSON.stringify(m)); }

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
  loadCurrentEntry();
  updateNavLabel();
  renderMedList();
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
function renderMedList() {
  const meds = getMeds();
  const list = document.getElementById('medList');
  const empty = document.getElementById('medEmpty');

  if (meds.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = meds.map((m, i) => `
    <div class="med-item">
      <div class="med-icon">💊</div>
      <div class="med-info">
        <div class="med-name">${escHtml(m.name)}</div>
        <div class="med-detail">${escHtml(m.dose)}</div>
        ${m.note ? `<div class="med-detail" style="font-style:italic">${escHtml(m.note)}</div>` : ''}
        <div class="med-time">🕐 ${escHtml(m.time)}</div>
      </div>
      <button class="btn-danger" onclick="deleteMed(${i})">✕</button>
    </div>`).join('');
}

function openMedModal() {
  document.getElementById('medModal').classList.add('open');
  document.getElementById('medName').focus();
}

function closeMedModal() {
  document.getElementById('medModal').classList.remove('open');
  ['medName','medDose','medTime','medNote'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function saveMedication() {
  const name = document.getElementById('medName').value.trim();
  const dose = document.getElementById('medDose').value.trim();
  const time = document.getElementById('medTime').value.trim();
  const note = document.getElementById('medNote').value.trim();

  if (!name) { showToast('⚠️ Bitte Medikamentenname eingeben'); return; }

  const meds = getMeds();
  meds.push({ name, dose, time, note });
  saveMeds(meds);
  renderMedList();
  closeMedModal();
  showToast('✅ Medikament gespeichert');
}

function deleteMed(i) {
  if (!confirm('Medikament entfernen?')) return;
  const meds = getMeds();
  meds.splice(i, 1);
  saveMeds(meds);
  renderMedList();
  showToast('🗑 Medikament entfernt');
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
}

// ── Export CSV ───────────────────────────────────
function exportCSV() {
  const store = getStore();
  const dates = Object.keys(store).sort();

  if (dates.length === 0) { showToast('⚠️ Keine Daten zum Exportieren'); return; }

  const header = 'datum,morgen_schmerz,morgen_rls,mittag_schmerz,mittag_rls,abend_schmerz,abend_rls,nacht_schmerz,nacht_rls,notizen';
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
    exportedAt: new Date().toISOString(),
    version: 1,
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

    if (e.notes) {
      doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(80,80,80);
      const lines = doc.splitTextToSize(`Notiz: ${e.notes}`, rm - lm - 5);
      doc.text(lines, lm + 3, y);
      y += lines.length * 4.5 + 2;
    }
    y += 4;
  });

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
        buildWeekStrip();
        renderMedList();
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
  buildWeekStrip();
  loadCurrentEntry();
  renderMedList();
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
