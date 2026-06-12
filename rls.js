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
  const day = x => (x.getDay() + 6) % 7; // Montag = 0
  const weekKey = str => {
    const d = parseDate(str);
    d.setDate(d.getDate() - day(d) + 3); // Donnerstag der gleichen ISO-Woche
    return formatLocalDate(d);
  };
  return weekKey(d1) === weekKey(d2);
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

  if (daily) daily.style.display = shouldShowDetailedRls() ? 'block' : 'none';
  if (survey) survey.style.display = shouldShowWeeklySurvey() ? 'block' : 'none';
  if (wdGroup) wdGroup.style.display = mode === 'detailed_only' ? 'none' : 'block';
}

function surveySeverityLabel(sum) {
  if (sum <= 10) return 'Keine bis minimale Beschwerden';
  if (sum <= 20) return 'Leichte Beschwerden';
  if (sum <= 30) return 'Mittelgradige Beschwerden';
  if (sum <= 40) return 'Schwere Beschwerden';
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
  if (answered.length === 10) {
    el.textContent = `${sum} / 40`;
    sev.textContent = surveySeverityLabel(sum);
  } else {
    el.textContent = answered.length ? `${sum} / 40 (${answered.length}/10)` : '– / 40';
    sev.textContent = 'Bitte alle 10 Fragen beantworten';
  }
}

function saveRlsSurvey() {
  if (surveyAnswers.some(v => v === null)) {
    showToast('⚠️ Bitte alle 10 Fragen bewerten (0–4)');
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

  surveyAnswers = [null, null, null, null, null, null, null, null, null, null];
  buildSurveyQuestions();
  updateSurveySumDisplay();
  renderSurveyHistory();
  updateRlsBanners();
  showToast(`✅ IRLS-Fragebogen gespeichert (${sum}/40)`);
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
      return `<div class="corr-item"><span class="corr-pair">${formatDateShort(d)}</span><span class="corr-val">${s.sum}/40 – ${escHtml(s.severity)}</span></div>`;
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
      surveyBanner.innerHTML = 'Sie nutzen nur die <strong>ausführliche Tagesdoku</strong> – der wöchentliche IRLS-Fragebogen ist deaktiviert.';
    } else if (getActivePreVisitPeriod() && getRlsMode() === 'auto') {
      surveyBanner.style.display = 'block';
      surveyBanner.innerHTML = '<strong>Vor-Termin-Phase:</strong> Bitte die ausführliche tägliche Doku nutzen. Der wöchentliche IRLS-Fragebogen ist bis nach dem Termin pausiert.';
    } else if (isSurveyDue()) {
      surveyBanner.style.display = 'block';
      surveyBanner.innerHTML = `<strong>IRLS-Fragebogen fällig heute (${wdName})</strong> – Bitte den Fragebogen unten ausfüllen.`;
    } else {
      surveyBanner.style.display = 'block';
      surveyBanner.innerHTML = `Nächster IRLS-Fragebogen am <strong>${wdName}</strong> (wöchentlich).`;
    }
  }
  applyRlsVisibility();
}


