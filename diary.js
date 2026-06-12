// ── Week Strip ──────────────────────────────────
function buildWeekStrip() {
  const strip = document.getElementById('weekStrip');
  if (!strip) return;
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
  if (!grid) return;
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
  if (!sel || !badge) return;
  const val = sel.value;
  badge.textContent = val === '' ? '–' : val;
  badge.className = `score-badge ${type}${val !== '' ? ' score-' + val : ''}`;
}

// ── Load / Save Entry ───────────────────────────
function copyFromYesterday() {
  const store = getStore();
  const yesterday = addDays(currentDate, -1);
  const prevEntry = store[yesterday];
  
  if (!prevEntry) {
    showToast('Kein Eintrag vom Vortag vorhanden.');
    return;
  }

  const elHours = document.getElementById('sleepHours');
  const elQual = document.getElementById('sleepQuality');
  
  const hasCurrentSleep = elHours.value !== '' || elQual.value !== '';
  const hasCurrentTags = Array.from(document.querySelectorAll('.tag-btn[data-factor]')).some(btn => btn.classList.contains('on'));
  
  if (hasCurrentSleep || hasCurrentTags) {
    if (!confirm('Aktuelle Eingaben für Schlaf und Einflussfaktoren mit den Werten von gestern überschreiben?')) {
      return;
    }
  }

  // Copy Sleep
  if (prevEntry.sleepHours !== undefined) elHours.value = prevEntry.sleepHours;
  if (prevEntry.sleepQuality !== undefined) elQual.value = prevEntry.sleepQuality;
  
  // Copy Tags
  const factors = prevEntry.factors || {};
  document.querySelectorAll('.tag-btn[data-factor]').forEach(btn => {
    btn.classList.toggle('on', !!factors[btn.dataset.factor]);
  });
  
  // Copy Meds (only prefill DOM)
  if (typeof getMeds === 'function') {
    const list = document.getElementById('medIntakeList');
    if (list) {
      const takenYesterday = Array.isArray(prevEntry.medsTaken) ? prevEntry.medsTaken : [];
      let updated = false;
      list.querySelectorAll('[data-med-intake]').forEach(cb => {
        // nur vorbefüllen, wenn nicht schon ausgewählt
        if (takenYesterday.includes(cb.value) && !cb.checked) {
          cb.checked = true;
          const chip = cb.closest('.med-chip');
          if (chip) {
            chip.classList.add('taken');
            const check = chip.querySelector('.med-chip-check');
            if (check) check.textContent = '✓';
          }
          updated = true;
        }
      });
      if (updated && typeof updateMedIntakeProgress === 'function') {
        updateMedIntakeProgress();
      }
    }
  }

  showToast('Werte von gestern übernommen (noch nicht gespeichert).');
}

function loadCurrentEntry() {
  const store = getStore();
  const entry = store[currentDate] || {};

  TIMES.forEach(t => {
    const pSel = document.getElementById(`${t.key}_pain`);
    const rSel = document.getElementById(`${t.key}_rls`);
    if (!pSel || !rSel) return;
    pSel.value = entry[`${t.key}_pain`] !== undefined ? entry[`${t.key}_pain`] : '';
    rSel.value = entry[`${t.key}_rls`]  !== undefined ? entry[`${t.key}_rls`]  : '';
    updateScoreBadge(t.key, 'pain');
    updateScoreBadge(t.key, 'rls');
  });

  const notesEl = document.getElementById('dailyNotes');
  const sleepHoursEl = document.getElementById('sleepHours');
  const sleepQualityEl = document.getElementById('sleepQuality');
  if (notesEl) notesEl.value = entry.notes || '';
  if (sleepHoursEl) sleepHoursEl.value = entry.sleepHours !== undefined ? entry.sleepHours : '';
  if (sleepQualityEl) sleepQualityEl.value = entry.sleepQuality !== undefined ? entry.sleepQuality : '';

  const factors = entry.factors || {};
  document.querySelectorAll('.tag-btn[data-factor]').forEach(btn => {
    btn.classList.toggle('on', !!factors[btn.dataset.factor]);
  });

  if (typeof renderMedIntakeForDiary === 'function') {
    renderMedIntakeForDiary(entry.medsTaken || [], entry.medsTakenTimes || {});
  }
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

  const notes = document.getElementById('dailyNotes').value.trim();
  if (notes) entry.notes = notes;
  else delete entry.notes;

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

  const taken = typeof collectMedicationIntakeFromDom === 'function'
    ? collectMedicationIntakeFromDom()
    : [];
  if (taken.length) entry.medsTaken = taken;
  else delete entry.medsTaken;

  const takenTimes = typeof collectMedicationIntakeTimesFromDom === 'function'
    ? collectMedicationIntakeTimesFromDom()
    : {};
  if (Object.keys(takenTimes).length) entry.medsTakenTimes = takenTimes;
  else delete entry.medsTakenTimes;

  // Only save if there is actual data (not just an empty object)
  const hasData = TIMES.some(t => entry[`${t.key}_pain`] !== undefined || entry[`${t.key}_rls`] !== undefined)
    || entry.notes || entry.sleepHours !== undefined || entry.sleepQuality !== undefined
    || entry.factors || entry.medsTaken;

  if (hasData) {
    entry.updated = new Date().toISOString();
    store[currentDate] = entry;
  } else {
    delete store[currentDate];
  }

  saveStore(store);
  if (store[currentDate] && typeof markDataEnteredToday === 'function') markDataEnteredToday();
  buildWeekStrip();
  if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  showToast('✅ Eintrag gespeichert');

  // Pulse animation on save button
  var saveBtn = document.getElementById('saveEntryBtn');
  if (saveBtn) {
    saveBtn.classList.remove('pulse-ok');
    void saveBtn.offsetWidth;
    saveBtn.classList.add('pulse-ok');
    setTimeout(function() { saveBtn.classList.remove('pulse-ok'); }, 700);
  }
}

function refreshDiary() {
  buildWeekStrip();
  loadCurrentEntry();
  updateNavLabel();
  const picker = document.getElementById('datePickerInput');
  if (picker) picker.value = currentDate;
}

function ensureDiaryReady(options) {
  const opts = options || {};
  if (opts.forceToday || !currentDate || !/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
    currentDate = todayStr();
  }

  const grid = document.getElementById('timeBlocksGrid');
  const tags = document.getElementById('influenceTags');
  if (!grid) return;

  if (!document.getElementById('morning_pain') || !document.getElementById('night_rls')) {
    buildTimeBlocks();
  }
  if (tags && !tags.querySelector('[data-factor]')) {
    buildInfluenceTags();
  }

  refreshDiary();
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

// ── Voice input (Web Speech API) ────────────────
var activeRecognition = window.activeRecognition || null;
window.activeRecognition = activeRecognition;

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
  const navDateLabel = document.getElementById('navDateLabel');
  const navDateSub = document.getElementById('navDateSub');
  const datePickerInput = document.getElementById('datePickerInput');
  if (navDateLabel) navDateLabel.textContent = formatDateLabel(currentDate);
  if (navDateSub) navDateSub.textContent = currentDate === todayStr() ? 'Heute' : '';
  if (datePickerInput) datePickerInput.value = currentDate;
  var todayBtn = document.getElementById('todayBtn');
  if (todayBtn) todayBtn.classList.toggle('hidden', currentDate === todayStr());
}

function changeDay(delta) {
  currentDate = addDays(currentDate, delta);
  refreshDiary();
}

function goToDate(val) {
  if (val) { currentDate = val; refreshDiary(); }
}

function goToToday() {
  currentDate = todayStr();
  refreshDiary();
}

