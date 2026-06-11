// ── Blood pressure module ───────────────────────
const BP_STORAGE_KEY = 'painDiaryBloodPressure';
const REMINDER_STORAGE_KEY = 'painDiaryReminderSettings';
let dailyReminderTimer = null;

function getBloodPressureEntries() {
  try { return JSON.parse(localStorage.getItem(BP_STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveBloodPressureEntries(entries) {
  localStorage.setItem(BP_STORAGE_KEY, JSON.stringify(entries));
}

function getReminderSettings() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || '{"enabled":false}');
  } catch {
    return { enabled: false };
  }
}

function saveReminderSettings(settings) {
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
}

function getBloodPressureDailyAverages() {
  const grouped = {};
  getBloodPressureEntries().forEach(entry => {
    if (!grouped[entry.date]) grouped[entry.date] = { sys: [], dia: [], pulse: [], count: 0 };
    grouped[entry.date].sys.push(entry.systolic);
    grouped[entry.date].dia.push(entry.diastolic);
    if (entry.pulse) grouped[entry.date].pulse.push(entry.pulse);
    grouped[entry.date].count++;
  });

  Object.keys(grouped).forEach(date => {
    const g = grouped[date];
    grouped[date] = {
      systolic: avgNumber(g.sys),
      diastolic: avgNumber(g.dia),
      pulse: avgNumber(g.pulse),
      count: g.count,
    };
  });
  return grouped;
}

function avgNumber(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function initBloodPressureModule() {
  renderAppMenu();
  ensureBloodPressureModal();
  scheduleDailyReminder();
}

function renderAppMenu() {
  const mount = document.getElementById('appMenuMount');
  if (!mount) return;
  const reminder = getReminderSettings();
  mount.innerHTML = `
    <div class="app-menu-backdrop" id="appMenuBackdrop" onclick="closeAppMenu()"></div>
    <aside class="app-menu-panel" id="appMenuPanel" aria-hidden="true">
      <div class="app-menu-title">Zusatzmodule</div>
      <button class="menu-action" type="button" onclick="openBloodPressurePanel()">
        <span>🫀 Blutdrucktabelle</span>
        <span>›</span>
      </button>
      <button class="menu-action" type="button" onclick="toggleDailyReminder()">
        <span>🔔 Erinnerung 22:05</span>
        <span id="dailyReminderState">${reminder.enabled ? 'aktiv' : 'aus'}</span>
      </button>
      <button class="menu-action" type="button" onclick="togglePinProtection()">
        <span>🔒 PIN-Schutz</span>
        <span>${typeof isPinEnabled === 'function' && isPinEnabled() ? 'aktiv' : 'aus'}</span>
      </button>
      <button class="menu-action" type="button" onclick="switchTab('sos'); closeAppMenu()">
        <span>🆘 SOS &amp; Daten</span>
        <span>›</span>
      </button>
    </aside>
  `;
}

function toggleAppMenu(forceOpen) {
  const panel = document.getElementById('appMenuPanel');
  const backdrop = document.getElementById('appMenuBackdrop');
  if (!panel || !backdrop) return;
  const open = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
}

function closeAppMenu() {
  toggleAppMenu(false);
}

function ensureBloodPressureModal() {
  if (document.getElementById('bloodPressureModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'bloodPressureModal';
  modal.innerHTML = `
    <div class="modal" style="max-width:720px">
      <div class="card-header" style="margin-bottom:14px">
        <div class="card-icon" style="background:rgba(0,212,170,0.15)">🫀</div>
        <div>
          <div class="card-title">Blutdrucktabelle</div>
          <div class="card-subtitle">2- bis 3-mal täglich messen und speichern</div>
        </div>
      </div>
      <div class="bp-form-grid">
        <div class="form-group">
          <label class="form-label">Datum</label>
          <input class="form-input" type="date" id="bpDate" />
        </div>
        <div class="form-group">
          <label class="form-label">Zeit</label>
          <input class="form-input" type="time" id="bpTime" />
        </div>
        <div class="form-group">
          <label class="form-label">Systolisch</label>
          <input class="form-input" type="number" id="bpSystolic" min="70" max="260" placeholder="z.B. 128" />
        </div>
        <div class="form-group">
          <label class="form-label">Diastolisch</label>
          <input class="form-input" type="number" id="bpDiastolic" min="40" max="160" placeholder="z.B. 82" />
        </div>
        <div class="form-group">
          <label class="form-label">Puls</label>
          <input class="form-input" type="number" id="bpPulse" min="35" max="220" placeholder="optional" />
        </div>
        <div class="form-group">
          <label class="form-label">Situation</label>
          <select class="form-input" id="bpContext">
            <option value="Ruhe">Ruhe</option>
            <option value="Morgens">Morgens</option>
            <option value="Mittags">Mittags</option>
            <option value="Abends">Abends</option>
            <option value="Belastung">Belastung</option>
            <option value="Beschwerden">Beschwerden</option>
          </select>
        </div>
        <div class="form-group full">
          <label class="form-label">Notiz</label>
          <input class="form-input" id="bpNote" placeholder="z.B. vor Medikament, nach Spaziergang, Kopfschmerz" />
        </div>
      </div>
      <button class="btn-primary" style="margin-top:12px" onclick="saveBloodPressureEntry()">Blutdruck speichern</button>
      <div id="bpSummary"></div>
      <div class="bp-table-wrap">
        <table class="bp-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Zeit</th>
              <th>Blutdruck</th>
              <th>Puls</th>
              <th>Situation</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="bpTableBody"></tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeBloodPressurePanel()">Schließen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openBloodPressurePanel() {
  closeAppMenu();
  ensureBloodPressureModal();
  fillBloodPressureDefaults();
  renderBloodPressureTable();
  document.getElementById('bloodPressureModal').classList.add('open');
}

function closeBloodPressurePanel() {
  const modal = document.getElementById('bloodPressureModal');
  if (modal) modal.classList.remove('open');
}

function fillBloodPressureDefaults() {
  const now = new Date();
  const date = document.getElementById('bpDate');
  const time = document.getElementById('bpTime');
  if (date && !date.value) date.value = todayStr();
  if (time && !time.value) {
    time.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

function saveBloodPressureEntry() {
  const date = document.getElementById('bpDate')?.value || todayStr();
  const time = document.getElementById('bpTime')?.value || '';
  const systolic = Number(document.getElementById('bpSystolic')?.value);
  const diastolic = Number(document.getElementById('bpDiastolic')?.value);
  const pulseValue = document.getElementById('bpPulse')?.value;
  const pulse = pulseValue ? Number(pulseValue) : null;

  if (!systolic || !diastolic || systolic < 70 || diastolic < 40) {
    showToast('Bitte Blutdruckwerte prüfen');
    return;
  }
  if (diastolic >= systolic) {
    showToast('Diastolisch sollte unter systolisch liegen');
    return;
  }

  const entries = getBloodPressureEntries();
  entries.push({
    id: 'bp_' + Date.now(),
    date,
    time,
    systolic,
    diastolic,
    pulse,
    context: document.getElementById('bpContext')?.value || '',
    note: document.getElementById('bpNote')?.value.trim() || '',
  });
  saveBloodPressureEntries(entries);
  markDataEnteredToday();
  clearBloodPressureFormValues();
  renderBloodPressureTable();
  if (typeof renderBloodPressureAnalysis === 'function') renderBloodPressureAnalysis();
  showToast('Blutdruck gespeichert');
}

function clearBloodPressureFormValues() {
  ['bpSystolic', 'bpDiastolic', 'bpPulse', 'bpNote'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function deleteBloodPressureEntry(id) {
  saveBloodPressureEntries(getBloodPressureEntries().filter(entry => entry.id !== id));
  renderBloodPressureTable();
  if (typeof renderBloodPressureAnalysis === 'function') renderBloodPressureAnalysis();
}

function renderBloodPressureTable() {
  const tbody = document.getElementById('bpTableBody');
  if (!tbody) return;
  const entries = getBloodPressureEntries().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const latest = entries.slice(0, 30);
  tbody.innerHTML = latest.length
    ? latest.map(entry => `
      <tr>
        <td>${escHtml(entry.date)}</td>
        <td>${escHtml(entry.time || '–')}</td>
        <td><strong>${entry.systolic}/${entry.diastolic}</strong> mmHg</td>
        <td>${entry.pulse ? entry.pulse + ' bpm' : '–'}</td>
        <td>${escHtml(entry.context || '–')}</td>
        <td><button class="bp-delete-btn" onclick="deleteBloodPressureEntry('${entry.id}')">Löschen</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" style="color:var(--text-2);text-align:center">Noch keine Blutdruckwerte gespeichert.</td></tr>';

  renderBloodPressureSummary(entries);
}

function renderBloodPressureSummary(entries) {
  const el = document.getElementById('bpSummary');
  if (!el) return;
  const todayEntries = entries.filter(entry => entry.date === todayStr());
  const recent = entries.slice(0, 14);
  const avgSys = avgNumber(recent.map(entry => entry.systolic));
  const avgDia = avgNumber(recent.map(entry => entry.diastolic));
  const elevated = recent.filter(entry => entry.systolic >= 140 || entry.diastolic >= 90).length;
  el.innerHTML = `
    <div class="bp-chip-row">
      <div class="bp-chip">
        <div class="bp-chip-value">${todayEntries.length}/3</div>
        <div class="bp-chip-label">Messungen heute</div>
      </div>
      <div class="bp-chip">
        <div class="bp-chip-value">${avgSys ? Math.round(avgSys) + '/' + Math.round(avgDia) : '–'}</div>
        <div class="bp-chip-label">Ø letzte 14 Messungen</div>
      </div>
      <div class="bp-chip">
        <div class="bp-chip-value">${elevated}</div>
        <div class="bp-chip-label">erhöhte Werte zuletzt</div>
      </div>
    </div>
  `;
}

function renderBloodPressureAnalysis() {
  const el = document.getElementById('bloodPressureAnalysis');
  if (!el) return;
  const bpDaily = getBloodPressureDailyAverages();
  const store = typeof getStore === 'function' ? getStore() : {};
  const dates = Object.keys(bpDaily).sort();

  if (dates.length < 3) {
    el.innerHTML = '<div class="empty-state" style="padding:16px"><p>Nach einigen Blutdruckmessungen erscheint hier der Vergleich mit deinen Schmerz-Werten.</p></div>';
    return;
  }

  const sysValues = dates.map(date => bpDaily[date].systolic).filter(v => v !== null);
  const diaValues = dates.map(date => bpDaily[date].diastolic).filter(v => v !== null);
  const avgSys = avgNumber(sysValues);
  const avgDia = avgNumber(diaValues);
  const elevatedDays = dates.filter(date => bpDaily[date].systolic >= 140 || bpDaily[date].diastolic >= 90).length;

  const painPairs = dates.map(date => {
    const pain = store[date] ? dailyAvgPain(store[date]) : null;
    const bp = bpDaily[date].systolic;
    return pain !== null && bp !== null ? [bp, pain] : null;
  }).filter(Boolean);
  const correlation = painPairs.length >= 5 ? pearsonCorrelation(painPairs.map(p => p[0]), painPairs.map(p => p[1])) : null;
  const relationText = correlation === null
    ? 'Für die Schmerz-Korrelation werden mindestens 5 gemeinsame Tage benötigt.'
    : correlation > 0.3
      ? 'Höherer systolischer Blutdruck fällt in deinen Daten eher mit stärkeren Schmerzen zusammen.'
      : correlation < -0.3
        ? 'Höherer systolischer Blutdruck fällt in deinen Daten eher mit niedrigeren Schmerzen zusammen.'
        : 'Bisher ist kein deutlicher Zusammenhang zwischen Blutdruck und Schmerz sichtbar.';

  el.innerHTML = `
    <div class="bp-analysis-grid">
      <div class="bp-chip">
        <div class="bp-chip-value">${Math.round(avgSys)}/${Math.round(avgDia)}</div>
        <div class="bp-chip-label">Ø Blutdruck</div>
      </div>
      <div class="bp-chip">
        <div class="bp-chip-value">${elevatedDays}</div>
        <div class="bp-chip-label">Tage mit erhöhten Werten</div>
      </div>
      <div class="bp-chip">
        <div class="bp-chip-value">${correlation === null ? '–' : correlation.toFixed(2)}</div>
        <div class="bp-chip-label">Korrelation mit Schmerz</div>
      </div>
    </div>
    <div class="smart-insight" style="margin-top:10px">${relationText}</div>
  `;
}

function markDataEnteredToday() {
  const settings = getReminderSettings();
  settings.lastDataDate = todayStr();
  saveReminderSettings(settings);
}

async function toggleDailyReminder() {
  const settings = getReminderSettings();
  if (!settings.enabled) {
    if (!('Notification' in window)) {
      showToast('Benachrichtigungen werden hier nicht unterstützt');
      return;
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Benachrichtigung nicht aktiviert');
        return;
      }
    }
    if (Notification.permission === 'denied') {
      showToast('Benachrichtigungen sind im Browser blockiert');
      return;
    }
    settings.enabled = true;
    showToast('Erinnerung um 22:05 aktiviert');
  } else {
    settings.enabled = false;
    showToast('Erinnerung deaktiviert');
  }
  saveReminderSettings(settings);
  renderAppMenu();
  scheduleDailyReminder();
}

function scheduleDailyReminder() {
  if (dailyReminderTimer) clearTimeout(dailyReminderTimer);
  const settings = getReminderSettings();
  if (!settings.enabled) return;

  const now = new Date();
  const next = new Date(now);
  next.setHours(22, 5, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  dailyReminderTimer = setTimeout(() => {
    sendDailyReminderIfNeeded();
    scheduleDailyReminder();
  }, next.getTime() - now.getTime());
}

// Offene (geplante) Medikamenten-Einnahmen für heute ermitteln
function getOpenMedIntakesToday() {
  if (typeof getMeds !== 'function') return [];
  const store = typeof getStore === 'function' ? getStore() : {};
  const entry = store[todayStr()] || {};
  const taken = Array.isArray(entry.medsTaken) ? entry.medsTaken : [];
  const slotLabels = { morning: 'morgens', noon: 'mittags', evening: 'abends', night: 'nachts' };
  const open = [];
  getMeds().forEach(med => {
    const sched = med.schedule || {};
    Object.keys(slotLabels).forEach(key => {
      if (!(sched[key] > 0)) return;
      const slotId = `${med.id}_${key}`;
      if (!taken.includes(slotId) && !taken.includes(med.id)) {
        open.push(`${med.name} (${slotLabels[key]})`);
      }
    });
  });
  return open;
}

function sendDailyReminderIfNeeded() {
  const store = typeof getStore === 'function' ? getStore() : {};
  const today = todayStr();
  const hasDiary = !!store[today];
  const hasBloodPressure = getBloodPressureEntries().some(entry => entry.date === today);
  const openMeds = getOpenMedIntakesToday();

  // Nichts offen? Dann keine Erinnerung nötig.
  if ((hasDiary || hasBloodPressure) && openMeds.length === 0) return;

  let title = 'Kleine Erinnerung';
  let body;
  if (openMeds.length > 0 && !hasDiary) {
    const medList = openMeds.slice(0, 3).join(', ') + (openMeds.length > 3 ? ` und ${openMeds.length - 3} weitere` : '');
    body = `Tagebuch ist noch offen und es fehlen Einnahmen: ${medList}.`;
    title = '💊 Medikamente & Tagebuch offen';
  } else if (openMeds.length > 0) {
    const medList = openMeds.slice(0, 3).join(', ') + (openMeds.length > 3 ? ` und ${openMeds.length - 3} weitere` : '');
    body = `Noch nicht bestätigt: ${medList}. Schon eingenommen? Kurz antippen!`;
    title = '💊 Einnahme noch nicht bestätigt';
  } else {
    body = 'Du hast heute noch keine Werte eingetragen. Ein kurzer Eintrag reicht schon.';
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, { body, tag: 'daily-entry-reminder', icon: 'icons/icon-192.png' }))
      .catch(() => new Notification(title, { body }));
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (typeof showToast === 'function') {
    showToast(body);
  }
}

document.addEventListener('DOMContentLoaded', initBloodPressureModule);
