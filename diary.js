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

  const timeSlots = [
    { key: 'morning', icon: '☀️', label: 'Morgens' },
    { key: 'noon',    icon: '🌤️', label: 'Mittags' },
    { key: 'evening', icon: '🌆', label: 'Abends'  },
    { key: 'night',   icon: '🌙', label: 'Nachts'  },
  ];

  list.innerHTML = meds.map((m, i) => {
    const id = m.id || `med_${i}`;
    const sched = m.schedule || {};

    // Which time slots does this med have?
    const activeTimes = timeSlots.filter(t => sched[t.key] > 0);

    // If no schedule defined (old format), show single checkbox
    if (!activeTimes.length) {
      const checked = takenIds.includes(id) ? 'checked' : '';
      return `<label class="med-intake-row">
        <input type="checkbox" data-med-intake="${id}" ${checked} />
        <span>${escHtml(m.name)} <span style="color:var(--text-3)">${escHtml(m.dose || '')}</span></span>
      </label>`;
    }

    // Show one checkbox per time slot
    return `<div class="med-intake-block">
      <div class="med-intake-name">💊 ${escHtml(m.name)} <span style="color:var(--text-3)">${escHtml(m.dose || '')}</span></div>
      <div class="med-intake-times">
        ${activeTimes.map(t => {
          const slotId = `${id}_${t.key}`;
          const checked = takenIds.includes(slotId) ? 'checked' : '';
          return `<label class="med-intake-time-btn ${checked ? 'taken' : ''}">
            <input type="checkbox" data-med-intake="${slotId}" ${checked}
              onchange="this.closest('label').classList.toggle('taken', this.checked)" />
            <span>${t.icon}</span>
            <span>${t.label}</span>
            <span style="color:var(--accent-1);font-weight:600">${sched[t.key]}×</span>
          </label>`;
        }).join('')}
      </div>
    </div>`;
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

  const scheduleIcons = [
    { key: 'morning', icon: '☀️', label: 'Mo' },
    { key: 'noon',    icon: '🌤️', label: 'Mi' },
    { key: 'evening', icon: '🌆', label: 'Ab' },
    { key: 'night',   icon: '🌙', label: 'Na' },
  ];

  list.innerHTML = meds.map((m, i) => {
    const warn = medHasLocalWarning(m.name, warnings);
    const sched = m.schedule || {};
    const schedHtml = scheduleIcons
      .filter(s => sched[s.key] > 0)
      .map(s => `<span class="med-schedule-pill">
        <span class="pill-icon">${s.icon}</span>
        <span>${s.label}</span>
        <span class="pill-val">${sched[s.key]}×</span>
      </span>`).join('');

    return `
    <div class="med-item">
      ${warn ? `<span class="med-warn-icon" title="Mögliche Wechselwirkung">🔴</span>` : ''}
      <div class="med-icon">💊</div>
      <div class="med-info">
        <div class="med-name">${escHtml(m.name)}${m.pzn ? ` <span class="badge-pill">PZN ${escHtml(m.pzn)}</span>` : ''}${m.form ? ` <span class="badge-pill" style="background:rgba(59,158,255,0.15);color:var(--accent-1)">${escHtml(m.form)}</span>` : ''}</div>
        ${m.dose ? `<div class="med-detail">💉 ${escHtml(m.dose)}</div>` : ''}
        ${m.note ? `<div class="med-detail" style="font-style:italic">📌 ${escHtml(m.note)}</div>` : ''}
        ${schedHtml ? `<div class="med-schedule">${schedHtml}</div>` : m.time ? `<div class="med-time">🕐 ${escHtml(m.time)}</div>` : ''}
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
  ['medName','medPzn','medDose','medMorning','medNoon','medEvening','medNight','medForm','medNote'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function saveMedication() {
  const name = document.getElementById('medName').value.trim();
  const pzn  = document.getElementById('medPzn').value.trim().replace(/\D/g, '');
  const dose = document.getElementById('medDose').value.trim();
  const form = document.getElementById('medForm').value.trim();
  const note = document.getElementById('medNote').value.trim();

  const parseQty = id => {
    const v = parseFloat(document.getElementById(id).value);
    return (!isNaN(v) && v > 0) ? v : 0;
  };
  const schedule = {
    morning: parseQty('medMorning'),
    noon:    parseQty('medNoon'),
    evening: parseQty('medEvening'),
    night:   parseQty('medNight'),
  };

  if (!name) { showToast('⚠️ Bitte Medikamentenname eingeben'); return; }
  if (!Object.values(schedule).some(v => v > 0)) {
    showToast('⚠️ Bitte mindestens eine Einnahmezeit angeben');
    return;
  }

  // Build legacy time string for backwards compat display
  const timeLabels = [];
  if (schedule.morning) timeLabels.push(`${schedule.morning}× Morgens`);
  if (schedule.noon)    timeLabels.push(`${schedule.noon}× Mittags`);
  if (schedule.evening) timeLabels.push(`${schedule.evening}× Abends`);
  if (schedule.night)   timeLabels.push(`${schedule.night}× Nachts`);
  const timeStr = timeLabels.join(' · ');

  const meds = getMeds();
  meds.push({
    id: Date.now().toString(36),
    name,
    pzn: pzn || undefined,
    dose,
    form: form || undefined,
    schedule,
    time: timeStr,
    note,
  });
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

