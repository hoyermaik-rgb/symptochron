// ── Willkommensbildschirm (Start-Tab) ───────────────────
// Zeigt Begrüßung, Tagesstatus und schnelle Medikamenten-Bestätigung.

function getGreetingForHour(h) {
  if (h >= 5 && h < 11) return { text: 'Guten Morgen', icon: '☀️' };
  if (h >= 11 && h < 17) return { text: 'Guten Tag', icon: '🌤️' };
  if (h >= 17 && h < 22) return { text: 'Guten Abend', icon: '🌆' };
  return { text: 'Gute Nacht', icon: '🌙' };
}

// Alle heute fälligen Einnahme-Slots (medId_slot bzw. medId für Bedarfsmedikation)
function getTodayMedSlots() {
  const meds = typeof getMeds === 'function' ? getMeds() : [];
  const slots = [];
  const slotMeta = [
    { key: 'morning', icon: '☀️', label: 'Morgens' },
    { key: 'noon', icon: '🌤️', label: 'Mittags' },
    { key: 'evening', icon: '🌆', label: 'Abends' },
    { key: 'night', icon: '🌙', label: 'Nachts' },
  ];
  meds.forEach(m => {
    const sched = m.schedule || {};
    let scheduled = false;
    slotMeta.forEach(s => {
      if (sched[s.key] > 0) {
        scheduled = true;
        slots.push({ id: `${m.id}_${s.key}`, med: m, slot: s, qty: sched[s.key] });
      }
    });
    if (!scheduled) slots.push({ id: m.id, med: m, slot: null, qty: 0 });
  });
  return slots;
}

function getTodayTakenIds() {
  const store = typeof getStore === 'function' ? getStore() : {};
  const entry = store[todayStr()] || {};
  return Array.isArray(entry.medsTaken) ? entry.medsTaken : [];
}

function saveTodayTakenIds(ids, times) {
  const store = getStore();
  const entry = store[todayStr()] || {};
  if (ids.length) entry.medsTaken = ids;
  else delete entry.medsTaken;
  if (times && Object.keys(times).length) entry.medsTakenTimes = times;
  else delete entry.medsTakenTimes;
  entry.updated = new Date().toISOString();
  store[todayStr()] = entry;
  saveStore(store);
  // Tagebuch-Ansicht synchron halten, falls heute geöffnet
  if (typeof currentDate !== 'undefined' && currentDate === todayStr() &&
      typeof renderMedIntakeForDiary === 'function') {
    renderMedIntakeForDiary(ids, times || {});
  }
  if (typeof buildWeekStrip === 'function') buildWeekStrip();
}

function getTodayTakenTimes() {
  const store = typeof getStore === 'function' ? getStore() : {};
  const entry = store[todayStr()] || {};
  return entry.medsTakenTimes ? { ...entry.medsTakenTimes } : {};
}

function isSlotTaken(takenIds, slotId, medId) {
  return takenIds.includes(slotId) || takenIds.includes(medId);
}

// ── Streak: Tage in Folge mit Tagebuch-Eintrag ──────────
function entryHasScores(entry) {
  return !!entry && TIMES.some(t =>
    entry[`${t.key}_pain`] !== undefined || entry[`${t.key}_rls`] !== undefined);
}

function computeDiaryStreak() {
  const store = getStore();
  let streak = 0;
  // Heute zählt mit, wenn erfasst – sonst ab gestern rückwärts zählen
  let day = todayStr();
  if (!entryHasScores(store[day])) day = addDays(day, -1);
  while (entryHasScores(store[day])) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

// ── Wochen-Zusammenfassung (Ø Schmerz/RLS, Vergleich Vorwoche) ──
function avgForRange(store, startOffset, endOffset) {
  let painSum = 0, painCnt = 0, rlsSum = 0, rlsCnt = 0, daysWithData = 0;
  for (let i = startOffset; i <= endOffset; i++) {
    const e = store[addDays(todayStr(), i)];
    if (!e) continue;
    let hasAny = false;
    TIMES.forEach(t => {
      if (e[`${t.key}_pain`] !== undefined) { painSum += e[`${t.key}_pain`]; painCnt++; hasAny = true; }
      if (e[`${t.key}_rls`] !== undefined) { rlsSum += e[`${t.key}_rls`]; rlsCnt++; hasAny = true; }
    });
    if (hasAny) daysWithData++;
  }
  return {
    pain: painCnt ? painSum / painCnt : null,
    rls: rlsCnt ? rlsSum / rlsCnt : null,
    days: daysWithData,
  };
}

function renderWeekSummary() {
  const card = document.getElementById('welcomeWeekCard');
  const body = document.getElementById('welcomeWeekBody');
  if (!card || !body) return;

  const store = getStore();
  const thisWeek = avgForRange(store, -6, 0);
  const lastWeek = avgForRange(store, -13, -7);

  if (!thisWeek.days) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  const trend = (cur, prev) => {
    if (cur === null) return '';
    if (prev === null) return '<span class="trend-neutral">– kein Vergleich</span>';
    const diff = cur - prev;
    if (Math.abs(diff) < 0.3) return '<span class="trend-neutral">→ stabil</span>';
    return diff < 0
      ? `<span class="trend-good">↓ ${Math.abs(diff).toFixed(1)} besser</span>`
      : `<span class="trend-bad">↑ ${diff.toFixed(1)} schlechter</span>`;
  };

  // Auffälligkeit / Proaktive Hinweise
  const insights = getPatternInsightsForWelcome(store);
  let insightsHtml = '';
  if (insights.length > 0) {
    insightsHtml = `
      <div class="section-title" style="margin-top: 14px; font-size: 13px; color: var(--text-2);">Auffälligkeit der Woche</div>
      ${insights.slice(0, 1).map(t => `<div class="smart-insight" style="margin-top: 6px;">💡 ${t}</div>`).join('')}
    `;
  }

  body.innerHTML = `
    <div class="week-sum-row">
      <span class="week-sum-label">📅 Erfasste Tage</span>
      <span class="week-sum-val">${thisWeek.days} / 7</span>
    </div>
    ${thisWeek.pain !== null ? `<div class="week-sum-row">
      <span class="week-sum-label">🔥 Ø Schmerz</span>
      <span class="week-sum-val" style="color:var(--accent-pain)">${thisWeek.pain.toFixed(1)}</span>
      ${trend(thisWeek.pain, lastWeek.pain)}
    </div>` : ''}
    ${thisWeek.rls !== null ? `<div class="week-sum-row">
      <span class="week-sum-label">🦵 Ø RLS</span>
      <span class="week-sum-val" style="color:var(--accent-rls)">${thisWeek.rls.toFixed(1)}</span>
      ${trend(thisWeek.rls, lastWeek.rls)}
    </div>` : ''}
    ${insightsHtml}`;
}

// Ermittelt basierend auf denselben Regeln wie Charts.js eine Auffälligkeit für die Startseite
function getPatternInsightsForWelcome(store) {
  const insights = [];
  if (typeof INFLUENCE_TAGS === 'undefined') return insights;
  
  INFLUENCE_TAGS.forEach(tag => {
    const withVals = { pain: [], rls: [] };
    const withoutVals = { pain: [], rls: [] };

    Object.keys(store).forEach(d => {
      const e = store[d];
      const p = typeof dailyAvgPain === 'function' ? dailyAvgPain(e) : null;
      const r = typeof dailyAvgRls === 'function' ? dailyAvgRls(e) : null;
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
      if (typeof MIN_PATTERN_DAYS !== 'undefined' && (w.length < MIN_PATTERN_DAYS || o.length < MIN_PATTERN_DAYS)) return;
      
      const sumW = w.reduce((a, b) => a + b, 0);
      const sumO = o.reduce((a, b) => a + b, 0);
      const avgW = sumW / w.length;
      const avgO = sumO / o.length;
      
      const diff = avgW - avgO;
      if (typeof MIN_TAG_DIFF !== 'undefined' && Math.abs(diff) < MIN_TAG_DIFF) return;
      
      const metricLabel = metric === 'rls' ? 'RLS' : 'Schmerz';
      if (diff > 0) {
        insights.push(`Mit ${tagLabel} lag dein ${metricLabel} im Schnitt um ${diff.toFixed(1)} Punkte höher als ohne.`);
      } else {
        insights.push(`Mit ${tagLabel} lag dein ${metricLabel} im Schnitt um ${Math.abs(diff).toFixed(1)} Punkte niedriger.`);
      }
    });
  });
  return insights;
}

function renderWelcomeScreen() {
  const greetEl = document.getElementById('welcomeGreeting');
  const dateEl = document.getElementById('welcomeDate');
  if (!greetEl) return;

  // Begrüßung & Datum
  const now = new Date();
  const g = getGreetingForHour(now.getHours());
  const pName = typeof getPatientData === 'function' ? (getPatientData().name || '').trim() : '';
  const firstName = pName ? pName.split(' ')[0] : '';
  greetEl.textContent = `${g.icon} ${g.text}${firstName ? ', ' + firstName : ''}!`;
  if (dateEl) dateEl.textContent = formatDateLabel(todayStr());

  // Tagebuch-Status
  const store = getStore();
  const entry = store[todayStr()];
  const hasScores = entry && TIMES.some(t =>
    entry[`${t.key}_pain`] !== undefined || entry[`${t.key}_rls`] !== undefined);
  const diaryStatus = document.getElementById('welcomeDiaryStatus');
  const diaryAction = document.getElementById('welcomeDiaryAction');
  const diaryCard = document.getElementById('welcomeDiaryCard');
  if (diaryStatus) {
    if (hasScores) {
      diaryStatus.textContent = '✅ Erfasst';
      if (diaryAction) diaryAction.textContent = 'Eintrag ansehen ›';
      if (diaryCard) diaryCard.classList.add('done');
    } else {
      diaryStatus.textContent = '⏳ Offen';
      if (diaryAction) diaryAction.textContent = 'Jetzt ausfüllen ›';
      if (diaryCard) diaryCard.classList.remove('done');
    }
  }

  // Medikamenten-Status + Schnellbestätigung
  renderWelcomeMedSection();

  // Streak-Anzeige
  const streakEl = document.getElementById('welcomeStreak');
  if (streakEl) {
    const streak = computeDiaryStreak();
    if (streak >= 2) {
      streakEl.style.display = 'inline-flex';
      streakEl.textContent = `🔥 ${streak} Tage in Folge`;
    } else {
      streakEl.style.display = 'none';
    }
  }

  // Wochen-Zusammenfassung
  renderWeekSummary();

  // Mood-Status (neue Karte)
  renderWelcomeMoodStatus();

  // Untertitel je nach Fortschritt
  const sub = document.getElementById('welcomeSub');
  if (sub) {
    const slots = getTodayMedSlots();
    const taken = getTodayTakenIds();
    const doneCount = slots.filter(s => isSlotTaken(taken, s.id, s.med.id)).length;
    if (hasScores && slots.length && doneCount === slots.length) {
      sub.textContent = 'Alles erledigt für heute – stark! 🎉';
    } else if (hasScores) {
      sub.textContent = 'Tagebuch ist erfasst. Denk noch an deine Medikamente.';
    } else {
      sub.textContent = 'Schön, dass du da bist. Hier siehst du auf einen Blick, was heute noch zu tun ist.';
    }
  }
}

// ── Mood Status auf Welcome ───────────────────────
function renderWelcomeMoodStatus() {
  // Prüfen ob Mood-Daten existieren
  const moodStore = typeof getMoodStore === 'function' ? getMoodStore() : {};
  const todayMood = moodStore[todayStr()];

  // Mood-Karte im Welcome-Bereich (falls vorhanden) oder dynamisch hinzufügen
  let moodCard = document.getElementById('welcomeMoodCard');
  
  if (!moodCard) {
    // Karte erstellen und nach der Med-Karte einfügen
    const medCard = document.getElementById('welcomeMedCard');
    if (!medCard) return;

    moodCard = document.createElement('div');
    moodCard.id = 'welcomeMoodCard';
    moodCard.className = 'welcome-status-card';
    moodCard.onclick = () => switchTab('mood');
    moodCard.innerHTML = `
      <div class="ws-icon">🧠</div>
      <div class="ws-title">Stimmung heute</div>
      <div class="ws-value" id="welcomeMoodStatus">–</div>
      <div class="ws-action" id="welcomeMoodAction">Jetzt erfassen ›</div>
    `;
    medCard.parentNode.insertBefore(moodCard, medCard.nextSibling);
  }

  const statusEl = document.getElementById('welcomeMoodStatus');
  const actionEl = document.getElementById('welcomeMoodAction');

  if (!todayMood || typeof getMoodAverageForDate !== 'function') {
    if (statusEl) statusEl.textContent = '⏳ Offen';
    if (actionEl) actionEl.textContent = 'Jetzt erfassen ›';
    moodCard.classList.remove('done');
    return;
  }

  const avg = getMoodAverageForDate(todayStr());
  if (avg === null) {
    if (statusEl) statusEl.textContent = '⏳ Offen';
    if (actionEl) actionEl.textContent = 'Jetzt erfassen ›';
    moodCard.classList.remove('done');
    return;
  }

  const rounded = Math.round(avg * 10) / 10;
  if (statusEl) {
    statusEl.textContent = `${rounded}/10`;
    statusEl.style.color = avg >= 7 ? 'var(--accent-2)' : avg >= 5 ? 'var(--accent-1)' : 'var(--accent-pain)';
  }
  if (actionEl) actionEl.textContent = 'Details ansehen ›';
  moodCard.classList.add('done');
}

function renderWelcomeMedSection() {
  const statusEl = document.getElementById('welcomeMedStatus');
  const fillEl = document.getElementById('welcomeMedProgressFill');
  const quickCard = document.getElementById('welcomeMedQuick');
  const quickList = document.getElementById('welcomeMedQuickList');
  if (!statusEl) return;

  const slots = getTodayMedSlots();
  const taken = getTodayTakenIds();

  if (!slots.length) {
    statusEl.textContent = 'Keine angelegt';
    if (fillEl) fillEl.style.width = '0%';
    if (quickCard) quickCard.style.display = 'none';
    return;
  }

  const doneCount = slots.filter(s => isSlotTaken(taken, s.id, s.med.id)).length;
  const pct = Math.round((doneCount / slots.length) * 100);
  statusEl.textContent = doneCount === slots.length
    ? '✅ Alle bestätigt'
    : `${doneCount} von ${slots.length} bestätigt`;
  if (fillEl) {
    fillEl.style.width = pct + '%';
    fillEl.classList.toggle('complete', pct === 100);
  }

  if (!quickCard || !quickList) return;
  quickCard.style.display = 'block';

  const times = getTodayTakenTimes();
  quickList.innerHTML = slots.map(s => {
    const checked = isSlotTaken(taken, s.id, s.med.id);
    const isFlex = !s.slot;
    const timeNote = isFlex && checked && times[s.id] ? ` · 🕐 ${times[s.id]}` : '';
    const slotLabel = s.slot ? `${s.slot.icon} ${s.slot.label} · ${s.qty}×` : '📌 bei Bedarf';
    return `<button type="button" class="med-chip welcome-med-chip ${checked ? 'taken' : ''}"
        onclick="toggleWelcomeMedSlot('${s.id}')">
      <span class="med-chip-check">${checked ? '✓' : ''}</span>
      <span class="med-chip-body">
        <span class="med-chip-name">${escHtml(s.med.name)}</span>
        <span class="med-chip-dose">${slotLabel}${s.med.dose ? ' · ' + escHtml(s.med.dose) : ''}${timeNote}</span>
      </span>
    </button>`;
  }).join('');
}

function nowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isFlexSlotId(slotId) {
  return getTodayMedSlots().some(s => s.id === slotId && !s.slot);
}

function toggleWelcomeMedSlot(slotId) {
  const store = getStore();
  const today = todayStr();
  const entry = store[today] || {};

  // Aktuelle Einnahmen aus dem Tagebuch lesen
  let taken = Array.isArray(entry.medsTaken) ? [...entry.medsTaken] : [];
  let takenTimes = entry.medsTakenTimes ? { ...entry.medsTakenTimes } : {};

  const slots = getTodayMedSlots();
  const slotInfo = slots.find(s => s.id === slotId);

  if (taken.includes(slotId)) {
    // Entfernen
    taken = taken.filter(id => id !== slotId);
    delete takenTimes[slotId];
  } else {
    // Hinzufügen
    taken.push(slotId);
    if (slotInfo && !slotInfo.slot) {
      takenTimes[slotId] = nowHHMM();
    }
  }

  // In das Tagebuch-Objekt schreiben
  if (taken.length > 0) {
    entry.medsTaken = taken;
  } else {
    delete entry.medsTaken;
  }

  if (Object.keys(takenTimes).length > 0) {
    entry.medsTakenTimes = takenTimes;
  } else {
    delete entry.medsTakenTimes;
  }

  entry.updated = new Date().toISOString();
  store[today] = entry;
  saveStore(store);

  // UI aktualisieren
  renderWelcomeScreen();

  // Falls das Tagebuch heute geöffnet ist → aktualisieren
  if (typeof currentDate !== 'undefined' && currentDate === today && typeof refreshDiary === 'function') {
    refreshDiary();
  }

  // Charts aktualisieren, falls sichtbar
  if (document.getElementById('tab-charts')?.classList.contains('active') && typeof renderCharts === 'function') {
    renderCharts();
  }
}

function confirmAllMedsToday() {
  const store = getStore();
  const today = todayStr();
  const entry = store[today] || {};

  const slots = getTodayMedSlots();
  let taken = Array.isArray(entry.medsTaken) ? [...entry.medsTaken] : [];
  let takenTimes = entry.medsTakenTimes ? { ...entry.medsTakenTimes } : {};

  let changed = false;

  slots.forEach(s => {
    if (!taken.includes(s.id)) {
      taken.push(s.id);
      changed = true;

      // Zeitstempel nur bei Bedarfsmedikamenten setzen
      if (!s.slot && !takenTimes[s.id]) {
        takenTimes[s.id] = nowHHMM();
      }
    }
  });

  if (!changed) {
    if (typeof showToast === 'function') showToast('Alle Medikamente sind bereits bestätigt');
    return;
  }

  // In das Tagebuch-Objekt schreiben
  entry.medsTaken = taken;
  if (Object.keys(takenTimes).length > 0) {
    entry.medsTakenTimes = takenTimes;
  }

  entry.updated = new Date().toISOString();
  store[today] = entry;
  saveStore(store);

  renderWelcomeScreen();

  // Diary-Ansicht aktualisieren (falls heute offen)
  if (typeof currentDate !== 'undefined' && currentDate === today && typeof refreshDiary === 'function') {
    refreshDiary();
  }

  // Charts aktualisieren
  if (document.getElementById('tab-charts')?.classList.contains('active') && typeof renderCharts === 'function') {
    renderCharts();
  }

  if (typeof showToast === 'function') showToast('✅ Alle Einnahmen für heute bestätigt');
}
