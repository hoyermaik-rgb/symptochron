// ══════════════════════════════════════════════
//  MOOD / STIMMUNG TRACKER – MoodPath Integration
// ══════════════════════════════════════════════

let currentMoodDate = todayStr();
let moodScoreOptions = '';

// Mood dimensions (0-10)
const MOOD_DIMENSIONS = [
  { key: 'stimmung', label: 'Stimmung', color: '#a78bfa' },
  { key: 'energie', label: 'Energie', color: '#3b9eff' },
  { key: 'antrieb', label: 'Antrieb', color: '#00d4aa' },
  { key: 'angst', label: 'Angst', color: '#ff6b6b' },
  { key: 'reizbarkeit', label: 'Reizbarkeit', color: '#f59e0b' },
  { key: 'konzentration', label: 'Konzentration', color: '#8aa8cc' },
  { key: 'hoffnungslosigkeit', label: 'Hoffnungslosigkeit', color: '#ef4444' },
];

// Depression symptoms (checkbox style)
const MOOD_SYMPTOMS = [
  { key: 'interessenverlust', label: 'Interessenverlust' },
  { key: 'freudlosigkeit', label: 'Freudlosigkeit' },
  { key: 'gruebeln', label: 'Grübeln' },
  { key: 'schuldgefuehle', label: 'Schuldgefühle' },
  { key: 'wertlosigkeit', label: 'Wertlosigkeitsgefühle' },
  { key: 'antriebslosigkeit', label: 'Antriebslosigkeit' },
  { key: 'appetitverlust', label: 'Appetitverlust' },
  { key: 'appetitsteigerung', label: 'Appetitsteigerung' },
  { key: 'sozialer_rueckzug', label: 'Sozialer Rückzug' },
  { key: 'konzentrationsprobleme', label: 'Konzentrationsprobleme' },
];

// Positive activities
const MOOD_ACTIVITIES = [
  { key: 'spaziergang', label: '🚶 Spaziergang' },
  { key: 'sport', label: '🏋️ Sport' },
  { key: 'meditation', label: '🧘 Meditation' },
  { key: 'freunde', label: '👥 Treffen mit Freunden' },
  { key: 'therapie', label: '🗣️ Therapie' },
  { key: 'hobby', label: '🎨 Hobby' },
  { key: 'arbeit', label: '💼 Arbeit / Produktiv' },
  { key: 'haushalt', label: '🏠 Haushalt' },
  { key: 'natur', label: '🌳 Zeit in der Natur' },
];

function getMoodStore() {
  try {
    return JSON.parse(localStorage.getItem('symptochron_mood') || '{}');
  } catch {
    return {};
  }
}

function saveMoodStore(data) {
  localStorage.setItem('symptochron_mood', JSON.stringify(data));
}

// ── Init Mood Tab ─────────────────────────────────
function initMoodTab() {
  // Populate selects first
  populateMoodSelects();
  
  // Build symptom grid if not already built
  const symptomGrid = document.getElementById('moodSymptomGrid');
  if (symptomGrid && symptomGrid.children.length === 0) {
    buildMoodSymptomGrid();
  }
  
  // Build activity tags if not already built
  const activityRow = document.getElementById('moodActivityTags');
  if (activityRow && activityRow.children.length === 0) {
    buildMoodActivityTags();
  }
  
  refreshMoodTab();
}

function populateMoodSelects() {
  const selects = document.querySelectorAll('.mood-select');
  let opts = '<option value="">–</option>';
  for (let i = 0; i <= 10; i++) {
    opts += `<option value="${i}">${i} – ${moodScoreLabel(i)}</option>`;
  }
  
  if (selects.length === 0) {
    // Falls die Selects noch nicht da sind, später nochmal versuchen
    setTimeout(populateMoodSelects, 100);
    return;
  }
  
  selects.forEach(sel => {
    sel.innerHTML = opts;
  });
}

function moodScoreLabel(n) {
  const labels = ['Sehr schlecht','Schlecht','Eher schlecht','Mittel','Leicht positiv','Gut','Sehr gut','Ausgezeichnet','Hervorragend','Top','Optimal'];
  return labels[n] || '';
}

function updateMoodBadge(dim) {
  const sel = document.getElementById(`mood_${dim}`);
  const badge = document.getElementById(`mood_${dim}_badge`);
  if (!sel || !badge) return;
  const val = sel.value;
  badge.textContent = val === '' ? '–' : val;
  badge.style.background = val === '' ? '' : 'rgba(167,139,250,0.15)';
  badge.style.color = val === '' ? '' : '#a78bfa';
  badge.style.borderColor = val === '' ? '' : 'rgba(167,139,250,0.3)';
}

// ── Symptoms Grid ────────────────────────────────
function buildMoodSymptomGrid() {
  const container = document.getElementById('moodSymptomGrid');
  if (!container) return;
  container.innerHTML = MOOD_SYMPTOMS.map(s => `
    <label class="symptom-chip">
      <input type="checkbox" data-symptom="${s.key}" onchange="toggleMoodSymptom(this)">
      <span>${s.label}</span>
    </label>
  `).join('');
}

function toggleMoodSymptom(checkbox) {
  // Visual feedback handled by CSS
}

// ── Activity Tags ────────────────────────────────
function buildMoodActivityTags() {
  const row = document.getElementById('moodActivityTags');
  if (!row) return;
  row.innerHTML = MOOD_ACTIVITIES.map(a => `
    <button type="button" class="tag-btn" data-activity="${a.key}" onclick="toggleMoodActivity('${a.key}')">
      ${a.label}
    </button>
  `).join('');
}

function toggleMoodActivity(key) {
  const btn = document.querySelector(`.tag-btn[data-activity="${key}"]`);
  if (btn) btn.classList.toggle('on');
}

// ── Load / Save Mood Entry ───────────────────────
function loadMoodEntry() {
  const store = getMoodStore();
  const entry = store[currentMoodDate] || {};

  // Load dimensions
  MOOD_DIMENSIONS.forEach(dim => {
    const sel = document.getElementById(`mood_${dim.key}`);
    if (sel) {
      sel.value = entry[dim.key] !== undefined ? entry[dim.key] : '';
      updateMoodBadge(dim.key);
    }
  });

  // Load symptoms
  document.querySelectorAll('#moodSymptomGrid input[type="checkbox"]').forEach(chk => {
    chk.checked = !!(entry.symptoms && entry.symptoms[chk.dataset.symptom]);
  });

  // Load activities
  document.querySelectorAll('.tag-btn[data-activity]').forEach(btn => {
    btn.classList.toggle('on', !!(entry.activities && entry.activities[btn.dataset.activity]));
  });

  // Notes
  const notesEl = document.getElementById('moodNotes');
  if (notesEl) notesEl.value = entry.notes || '';
}

function saveMoodEntry() {
  const store = getMoodStore();
  const entry = store[currentMoodDate] || {};

  // Save dimensions
  MOOD_DIMENSIONS.forEach(dim => {
    const sel = document.getElementById(`mood_${dim.key}`);
    if (sel && sel.value !== '') {
      entry[dim.key] = parseInt(sel.value);
    } else {
      delete entry[dim.key];
    }
  });

  // Save symptoms
  const symptoms = {};
  document.querySelectorAll('#moodSymptomGrid input[type="checkbox"]:checked').forEach(chk => {
    symptoms[chk.dataset.symptom] = true;
  });
  if (Object.keys(symptoms).length) entry.symptoms = symptoms;
  else delete entry.symptoms;

  // Save activities
  const activities = {};
  document.querySelectorAll('.tag-btn[data-activity].on').forEach(btn => {
    activities[btn.dataset.activity] = true;
  });
  if (Object.keys(activities).length) entry.activities = activities;
  else delete entry.activities;

  // Notes
  const notes = document.getElementById('moodNotes').value.trim();
  if (notes) entry.notes = notes;
  else delete entry.notes;

  const hasData = MOOD_DIMENSIONS.some(d => entry[d.key] !== undefined) ||
                  entry.symptoms || entry.activities || entry.notes;

  if (hasData) {
    entry.updated = new Date().toISOString();
    store[currentMoodDate] = entry;
  } else {
    delete store[currentMoodDate];
  }

  saveMoodStore(store);

  // Also update welcome if exists
  if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();

  showToast('✅ Stimmungs-Eintrag gespeichert');

  // Optional: trigger correlation refresh if charts are visible
  if (document.getElementById('tab-charts')?.classList.contains('active')) {
    renderCharts();
  }
}

function refreshMoodTab() {
  const label = document.getElementById('moodDateLabel');
  const sub = document.getElementById('moodDateSub');
  const todayBtn = document.getElementById('moodTodayBtn');
  const picker = document.getElementById('moodDatePicker');

  if (label) label.textContent = formatDateLabel(currentMoodDate);
  if (sub) sub.textContent = currentMoodDate === todayStr() ? 'Heute' : '';
  if (todayBtn) todayBtn.classList.toggle('hidden', currentMoodDate === todayStr());
  if (picker) picker.value = currentMoodDate;

  loadMoodEntry();
}

function changeMoodDay(delta) {
  currentMoodDate = addDays(currentMoodDate, delta);
  refreshMoodTab();
}

function goToMoodDate(val) {
  if (val) {
    currentMoodDate = val;
    refreshMoodTab();
  }
}

function goToMoodToday() {
  currentMoodDate = todayStr();
  refreshMoodTab();
}

// ── Integration: Mood in Welcome & Charts ─────────
function getMoodAverageForDate(dateStr) {
  const store = getMoodStore();
  const entry = store[dateStr];
  if (!entry) return null;

  const vals = MOOD_DIMENSIONS.map(d => entry[d.key]).filter(v => v !== undefined);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Expose for other modules
window.getMoodAverageForDate = getMoodAverageForDate;
window.MOOD_DIMENSIONS = MOOD_DIMENSIONS;
window.getMoodStore = getMoodStore;

// ── Auto-init when tab is switched ───────────────
const originalSwitchTab = window.switchTab;
window.switchTab = function(name) {
  originalSwitchTab(name);
  if (name === 'mood') {
    // Immer initialisieren, wenn der Tab geöffnet wird
    setTimeout(() => {
      if (typeof initMoodTab === 'function') {
        initMoodTab();
      }
    }, 50);
  }
};

// Make sure mood tab is in valid tabs list
if (typeof window.validTabs !== 'undefined') {
  window.validTabs.push('mood');
}

// ── PHQ-9 Fragebogen ─────────────────────────────
const PHQ9_QUESTIONS = [
  'Wenig Interesse oder Freude an Ihren Tätigkeiten',
  'Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit',
  'Schwierigkeiten einzuschlafen oder durchzuschlafen oder zu viel Schlaf',
  'Müdigkeit oder das Gefühl, keine Energie zu haben',
  'Verminderter Appetit oder übermäßiges Essen',
  'Schlechtes Gewissen oder das Gefühl, ein Versager zu sein',
  'Konzentrationsschwierigkeiten beim Lesen der Zeitung oder Fernsehen',
  'Ungewöhnlich langsam oder unruhig in Bewegungen oder Sprache',
  'Gedanken, dass Sie besser tot wären oder sich selbst wehtun könnten'
];

const PHQ9_OPTIONS = [
  { value: 0, label: 'Überhaupt nicht' },
  { value: 1, label: 'An einzelnen Tagen' },
  { value: 2, label: 'An mehr als der Hälfte der Tage' },
  { value: 3, label: 'Beinahe jeden Tag' }
];

function getPhq9Store() {
  try {
    return JSON.parse(localStorage.getItem('symptochron_phq9') || '{}');
  } catch {
    return {};
  }
}

function savePhq9Store(data) {
  localStorage.setItem('symptochron_phq9', JSON.stringify(data));
}

let phq9Answers = Array(9).fill(null);

// ── Mood Chart Integration ───────────────────────
let moodChartInstance = null;

function renderMoodChart() {
  const canvas = document.getElementById('moodTrendChart');
  if (!canvas) return;

  const moodStore = getMoodStore();
  const dates = Object.keys(moodStore).sort().slice(-30); // letzte 30 Tage

  if (dates.length < 3) {
    canvas.parentElement.innerHTML = '<div class="empty-state" style="padding:20px"><p>Noch zu wenig Mood-Daten für einen Verlauf.</p></div>';
    return;
  }

  const labels = [];
  const stimmungData = [];
  const energieData = [];
  const angstData = [];

  dates.forEach(d => {
    const e = moodStore[d];
    const dateObj = parseDate(d);
    labels.push(`${dateObj.getDate()}.${dateObj.getMonth() + 1}.`);

    stimmungData.push(e.stimmung !== undefined ? e.stimmung : null);
    energieData.push(e.energie !== undefined ? e.energie : null);
    angstData.push(e.angst !== undefined ? e.angst : null);
  });

  if (moodChartInstance) moodChartInstance.destroy();

  const ctx = canvas.getContext('2d');
  moodChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Stimmung',
          data: stimmungData,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167,139,250,0.1)',
          borderWidth: 2.5,
          tension: 0.3,
          spanGaps: true
        },
        {
          label: 'Energie',
          data: energieData,
          borderColor: '#3b9eff',
          backgroundColor: 'rgba(59,158,255,0.1)',
          borderWidth: 2.5,
          tension: 0.3,
          spanGaps: true
        },
        {
          label: 'Angst',
          data: angstData,
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255,107,107,0.1)',
          borderWidth: 2.5,
          tension: 0.3,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' }
      },
      scales: {
        y: { min: 0, max: 10, ticks: { stepSize: 2 } }
      }
    }
  });
}

// ── Trend-Analyse / Rückfallwarnung ─────────────
function analyzeMoodTrend() {
  const moodStore = getMoodStore();
  const dates = Object.keys(moodStore).sort();

  if (dates.length < 7) {
    return {
      trend: 'neutral',
      message: 'Noch nicht genug Daten für eine Trendanalyse (mind. 7 Tage).',
      severity: 'info'
    };
  }

  const last7 = dates.slice(-7);
  const prev7 = dates.slice(-14, -7);

  let last7Avg = 0, prev7Avg = 0, last7Count = 0, prev7Count = 0;

  last7.forEach(d => {
    const avg = getMoodAverageForDate(d);
    if (avg !== null) {
      last7Avg += avg;
      last7Count++;
    }
  });

  prev7.forEach(d => {
    const avg = getMoodAverageForDate(d);
    if (avg !== null) {
      prev7Avg += avg;
      prev7Count++;
    }
  });

  if (last7Count < 4 || prev7Count < 4) {
    return {
      trend: 'neutral',
      message: 'Noch zu wenige Tage mit Mood-Daten für eine verlässliche Analyse.',
      severity: 'info'
    };
  }

  last7Avg /= last7Count;
  prev7Avg /= prev7Count;

  const diff = last7Avg - prev7Avg;

  if (diff <= -1.5) {
    return {
      trend: 'worsening',
      message: `⚠️ Deine Stimmung ist in den letzten 7 Tagen deutlich gesunken (${prev7Avg.toFixed(1)} → ${last7Avg.toFixed(1)}).`,
      severity: 'warning'
    };
  } else if (diff >= 1.5) {
    return {
      trend: 'improving',
      message: `✅ Deine Stimmung hat sich in den letzten 7 Tagen deutlich verbessert (${prev7Avg.toFixed(1)} → ${last7Avg.toFixed(1)}).`,
      severity: 'good'
    };
  } else {
    return {
      trend: 'stable',
      message: `Deine Stimmung ist relativ stabil (${last7Avg.toFixed(1)} / 10).`,
      severity: 'info'
    };
  }
}

// ── PHQ-9 Funktionen ─────────────────────────────
function buildPhq9Questions() {
  const container = document.getElementById('phq9Questions');
  if (!container) return;

  container.innerHTML = '';

  PHQ9_QUESTIONS.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'survey-q';
    div.innerHTML = `
      <p><strong>${idx + 1}.</strong> ${q}</p>
      <div class="survey-scale">
        ${PHQ9_OPTIONS.map(opt => `
          <button type="button" class="scale-btn" data-q="${idx}" data-val="${opt.value}">
            ${opt.value} – ${opt.label}
          </button>
        `).join('')}
      </div>
    `;

    div.querySelectorAll('.scale-btn').forEach(btn => {
      btn.onclick = () => {
        const qIdx = parseInt(btn.dataset.q);
        const val = parseInt(btn.dataset.val);
        phq9Answers[qIdx] = val;

        // Visuelles Feedback
        div.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        updatePhq9Sum();
      };
    });

    container.appendChild(div);
  });
}

function updatePhq9Sum() {
  const sumEl = document.getElementById('phq9Sum');
  const severityEl = document.getElementById('phq9Severity');
  if (!sumEl || !severityEl) return;

  const answered = phq9Answers.filter(v => v !== null).length;
  const sum = phq9Answers.reduce((a, b) => a + (b || 0), 0);

  sumEl.textContent = `${sum} / 27 (${answered}/9 beantwortet)`;

  if (answered < 9) {
    severityEl.textContent = 'Bitte alle Fragen beantworten';
    severityEl.style.background = 'rgba(167,139,250,0.2)';
    severityEl.style.color = 'var(--accent-rls)';
  } else {
    let severity = '';
    let color = '';

    if (sum <= 4) {
      severity = 'Minimale depressive Symptome';
      color = 'rgba(0,212,170,0.2)';
    } else if (sum <= 9) {
      severity = 'Leichte depressive Symptome';
      color = 'rgba(59,158,255,0.2)';
    } else if (sum <= 14) {
      severity = 'Mittelgradige depressive Symptome';
      color = 'rgba(245,158,11,0.2)';
    } else if (sum <= 19) {
      severity = 'Schwerwiegende depressive Symptome';
      color = 'rgba(255,107,107,0.2)';
    } else {
      severity = 'Schwerste depressive Symptome';
      color = 'rgba(220,38,38,0.25)';
    }

    severityEl.textContent = severity;
    severityEl.style.background = color;
    severityEl.style.color = 'var(--text-1)';
  }
}

function savePhq9() {
  const answered = phq9Answers.filter(v => v !== null).length;
  if (answered < 9) {
    showToast('⚠️ Bitte alle 9 Fragen beantworten');
    return;
  }

  const sum = phq9Answers.reduce((a, b) => a + b, 0);
  const store = getPhq9Store();

  const entry = {
    date: todayStr(),
    answers: [...phq9Answers],
    sum: sum,
    severity: document.getElementById('phq9Severity')?.textContent || '',
    updated: new Date().toISOString()
  };

  store[todayStr()] = entry;
  savePhq9Store(store);

  showToast('✅ PHQ-9 gespeichert');
  renderPhq9History();
}

function renderPhq9History() {
  const container = document.getElementById('phq9History');
  if (!container) return;

  const store = getPhq9Store();
  const dates = Object.keys(store).sort().reverse().slice(0, 5);

  if (dates.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-3)">Noch keine PHQ-9 Fragebögen ausgefüllt.</p>';
    return;
  }

  container.innerHTML = dates.map(d => {
    const e = store[d];
    return `
      <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${d}</strong>
            <span style="margin-left:8px;font-size:12px;color:var(--text-3)">Score: ${e.sum}/27</span>
          </div>
          <div style="font-size:12px;color:var(--accent-rls)">${e.severity}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Mood Tab Erweiterung ─────────────────────────
const originalInitMoodTab = window.initMoodTab;
window.initMoodTab = function() {
  if (originalInitMoodTab) originalInitMoodTab();
  
  // PHQ-9 initialisieren, falls Container existiert
  setTimeout(() => {
    if (document.getElementById('phq9Questions')) {
      buildPhq9Questions();
      renderPhq9History();
    }
    if (document.getElementById('moodTrendChart')) {
      renderMoodChart();
    }
    
    // Trend-Analyse anzeigen
    const trendContainer = document.getElementById('moodTrendAnalysis');
    if (trendContainer) {
      const analysis = analyzeMoodTrend();
      trendContainer.innerHTML = `
        <div class="smart-insight ${analysis.severity === 'warning' ? 'warn' : ''}">
          ${analysis.message}
        </div>
      `;
    }
  }, 100);
};

// ── GAD-7 Funktionen ─────────────────────────────
function buildGad7Questions() {
  const container = document.getElementById('gad7Questions');
  if (!container) return;

  container.innerHTML = '';

  GAD7_QUESTIONS.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'survey-q';
    div.innerHTML = `
      <p><strong>${idx + 1}.</strong> ${q}</p>
      <div class="survey-scale">
        ${GAD7_OPTIONS.map(opt => `
          <button type="button" class="scale-btn" data-q="${idx}" data-val="${opt.value}">
            ${opt.value} – ${opt.label}
          </button>
        `).join('')}
      </div>
    `;

    div.querySelectorAll('.scale-btn').forEach(btn => {
      btn.onclick = () => {
        const qIdx = parseInt(btn.dataset.q);
        const val = parseInt(btn.dataset.val);
        gad7Answers[qIdx] = val;

        div.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        updateGad7Sum();
      };
    });

    container.appendChild(div);
  });
}

function updateGad7Sum() {
  const sumEl = document.getElementById('gad7Sum');
  const severityEl = document.getElementById('gad7Severity');
  if (!sumEl || !severityEl) return;

  const answered = gad7Answers.filter(v => v !== null).length;
  const sum = gad7Answers.reduce((a, b) => a + (b || 0), 0);

  sumEl.textContent = `${sum} / 21 (${answered}/7 beantwortet)`;

  if (answered < 7) {
    severityEl.textContent = 'Bitte alle Fragen beantworten';
    severityEl.style.background = 'rgba(167,139,250,0.2)';
    severityEl.style.color = 'var(--accent-rls)';
  } else {
    let severity = '';
    let color = '';

    if (sum <= 4) {
      severity = 'Minimale Angstsymptome';
      color = 'rgba(0,212,170,0.2)';
    } else if (sum <= 9) {
      severity = 'Leichte Angstsymptome';
      color = 'rgba(59,158,255,0.2)';
    } else if (sum <= 14) {
      severity = 'Mittelgradige Angstsymptome';
      color = 'rgba(245,158,11,0.2)';
    } else {
      severity = 'Schwere Angstsymptome';
      color = 'rgba(255,107,107,0.2)';
    }

    severityEl.textContent = severity;
    severityEl.style.background = color;
    severityEl.style.color = 'var(--text-1)';
  }
}

function saveGad7() {
  const answered = gad7Answers.filter(v => v !== null).length;
  if (answered < 7) {
    showToast('⚠️ Bitte alle 7 Fragen beantworten');
    return;
  }

  const sum = gad7Answers.reduce((a, b) => a + b, 0);
  const store = getGad7Store();

  const entry = {
    date: todayStr(),
    answers: [...gad7Answers],
    sum: sum,
    severity: document.getElementById('gad7Severity')?.textContent || '',
    updated: new Date().toISOString()
  };

  store[todayStr()] = entry;
  saveGad7Store(store);

  showToast('✅ GAD-7 gespeichert');
  renderGad7History();
}

function renderGad7History() {
  const container = document.getElementById('gad7History');
  if (!container) return;

  const store = getGad7Store();
  const dates = Object.keys(store).sort().reverse().slice(0, 5);

  if (dates.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-3)">Noch keine GAD-7 Fragebögen ausgefüllt.</p>';
    return;
  }

  container.innerHTML = dates.map(d => {
    const e = store[d];
    return `
      <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${d}</strong>
            <span style="margin-left:8px;font-size:12px;color:var(--text-3)">Score: ${e.sum}/21</span>
          </div>
          <div style="font-size:12px;color:var(--accent-rls)">${e.severity}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Erweiterung der initMoodTab-Funktion für GAD-7
const originalInitMoodTab2 = window.initMoodTab;
window.initMoodTab = function() {
  if (originalInitMoodTab2) originalInitMoodTab2();
  
  setTimeout(() => {
    if (document.getElementById('gad7Questions')) {
      buildGad7Questions();
      renderGad7History();
    }
  }, 150);
};

// ── Krisenbereich Funktionen ─────────────────────
function getCrisisData() {
  try {
    return JSON.parse(localStorage.getItem('symptochron_crisis') || '{}');
  } catch {
    return {};
  }
}

function saveCrisisData() {
  const data = {
    therapist: document.getElementById('crisisTherapist')?.value.trim() || '',
    doctor: document.getElementById('crisisDoctor')?.value.trim() || '',
    person1: document.getElementById('crisisPerson1')?.value.trim() || '',
    person2: document.getElementById('crisisPerson2')?.value.trim() || '',
    plan: document.getElementById('crisisPlan')?.value.trim() || '',
    warningSigns: document.getElementById('crisisWarningSigns')?.value.trim() || '',
    updated: new Date().toISOString()
  };
  
  localStorage.setItem('symptochron_crisis', JSON.stringify(data));
}

function loadCrisisData() {
  const data = getCrisisData();
  
  const fields = {
    'crisisTherapist': data.therapist,
    'crisisDoctor': data.doctor,
    'crisisPerson1': data.person1,
    'crisisPerson2': data.person2,
    'crisisPlan': data.plan,
    'crisisWarningSigns': data.warningSigns
  };
  
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fields[id] || '';
  });
}

// Krisenbereich in initMoodTab laden
const originalInitMoodTab3 = window.initMoodTab;
window.initMoodTab = function() {
  if (originalInitMoodTab3) originalInitMoodTab3();
  
  setTimeout(() => {
    if (document.getElementById('crisisTherapist')) {
      loadCrisisData();
    }
  }, 200);
};