// ── Medications module ─────────────────────────
(function () {
  const STORAGE_KEY = 'painDiaryMeds';
  const SLOT_KEYS = ['morning', 'noon', 'evening', 'night'];
  const MED_TIME_SLOTS = [
    { key: 'morning', icon: '☀️', label: 'Morgens', short: 'Mo' },
    { key: 'noon', icon: '🌤️', label: 'Mittags', short: 'Mi' },
    { key: 'evening', icon: '🌆', label: 'Abends', short: 'Ab' },
    { key: 'night', icon: '🌙', label: 'Nachts', short: 'Na' },
  ];

  function normalizeQty(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0 ? num : 0;
  }

  function emptySchedule(schedule) {
    const src = schedule || {};
    return {
      morning: normalizeQty(src.morning),
      noon: normalizeQty(src.noon),
      evening: normalizeQty(src.evening),
      night: normalizeQty(src.night),
    };
  }

  function buildLegacyTimeString(schedule) {
    const parts = [];
    if (schedule.morning) parts.push(`${schedule.morning}× Morgens`);
    if (schedule.noon) parts.push(`${schedule.noon}× Mittags`);
    if (schedule.evening) parts.push(`${schedule.evening}× Abends`);
    if (schedule.night) parts.push(`${schedule.night}× Nachts`);
    return parts.join(' · ');
  }

  function mergeSchedules(existing, incoming) {
    const a = emptySchedule(existing);
    const b = emptySchedule(incoming);
    return {
      morning: a.morning || b.morning || 0,
      noon: a.noon || b.noon || 0,
      evening: a.evening || b.evening || 0,
      night: a.night || b.night || 0,
    };
  }

  function normalizeMedication(raw, index = 0) {
    const schedule = emptySchedule(raw?.schedule);
    const normalized = {
      id: String(raw?.id || `med_${index}_${Date.now().toString(36)}`),
      name: (raw?.name || '').trim(),
      pzn: raw?.pzn ? String(raw.pzn).replace(/\D/g, '').slice(0, 8) : undefined,
      dose: (raw?.dose || '').trim(),
      form: (raw?.form || '').trim() || undefined,
      note: (raw?.note || '').trim(),
      schedule,
      time: (raw?.time || '').trim() || buildLegacyTimeString(schedule),
      source: raw?.source || 'manual',
      active: raw?.active !== false,
      createdAt: raw?.createdAt || raw?.created || new Date().toISOString(),
      updatedAt: raw?.updatedAt || raw?.updated || raw?.createdAt || new Date().toISOString(),
    };

    if (!normalized.note) delete normalized.note;
    if (!normalized.time) delete normalized.time;
    if (!normalized.pzn) delete normalized.pzn;
    if (!normalized.form) delete normalized.form;
    if (!normalized.dose) normalized.dose = '';
    return normalized;
  }

  function normalizeMedicationList(list) {
    const src = Array.isArray(list) ? list : [];
    return src
      .map((item, index) => normalizeMedication(item, index))
      .filter(item => item.name);
  }

  function getMeds() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const normalized = normalizeMedicationList(raw);
      const changed = JSON.stringify(raw) !== JSON.stringify(normalized);
      if (changed) saveMeds(normalized);
      return normalized;
    } catch {
      return [];
    }
  }

  function saveMeds(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMedicationList(list)));
  }

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

  function medHasLocalWarning(name, warnings) {
    return warnings.some(w => w.medA === name || w.medB === name);
  }

  function findMedicationDuplicate(existing, med) {
    if (med.pzn) {
      const byPzn = existing.find(item => item.pzn && item.pzn === med.pzn);
      if (byPzn) return byPzn;
    }
    const medKey = [normalizeMedName(med.name), med.dose || '', med.form || '', JSON.stringify(emptySchedule(med.schedule))].join('|');
    return existing.find(item => [normalizeMedName(item.name), item.dose || '', item.form || '', JSON.stringify(emptySchedule(item.schedule))].join('|') === medKey) || null;
  }

  function mergeImportedMedications(existing, incoming, defaultSource = 'import') {
    const result = normalizeMedicationList(existing);
    const additions = normalizeMedicationList(incoming).map(item => ({ ...item, source: item.source || defaultSource }));

    additions.forEach(med => {
      const duplicate = findMedicationDuplicate(result, med);
      if (!duplicate) {
        result.push(med);
        return;
      }
      duplicate.name = duplicate.name || med.name;
      duplicate.pzn = duplicate.pzn || med.pzn;
      duplicate.dose = duplicate.dose || med.dose;
      duplicate.form = duplicate.form || med.form;
      duplicate.note = duplicate.note || med.note;
      duplicate.schedule = mergeSchedules(duplicate.schedule, med.schedule);
      duplicate.time = duplicate.time || med.time || buildLegacyTimeString(duplicate.schedule);
      duplicate.updatedAt = new Date().toISOString();
      if (!duplicate.source && med.source) duplicate.source = med.source;
    });

    return normalizeMedicationList(result);
  }

  function refreshDiaryMedicationIntake() {
    if (typeof renderMedIntakeForDiary !== 'function' && typeof window.renderMedIntakeForDiary !== 'function') return;
    const store = typeof getStore === 'function' ? getStore() : {};
    const dateKey = typeof currentDate !== 'undefined' ? currentDate : todayStr();
    const entry = store[dateKey] || {};
    renderMedIntakeForDiary(entry.medsTaken || [], entry.medsTakenTimes || {});
  }

  function refreshMedicationUi() {
    renderMedList();
    refreshMedInteractionAlert();
    refreshDiaryMedicationIntake();
    if (typeof window.renderWelcomeScreen === 'function') window.renderWelcomeScreen();
  }

  function setMedicationModalMode(mode) {
    const title = document.getElementById('medModalTitle');
    const saveBtn = document.getElementById('medModalSaveBtn');
    if (title) title.textContent = mode === 'edit' ? '💊 Medikament bearbeiten' : '💊 Medikament hinzufügen';
    if (saveBtn) saveBtn.textContent = mode === 'edit' ? 'Änderungen speichern' : 'Speichern';
  }

  function fillMedicationForm(med) {
    document.getElementById('medName').value = med.name || '';
    document.getElementById('medPzn').value = med.pzn || '';
    document.getElementById('medDose').value = med.dose || '';
    document.getElementById('medForm').value = med.form || '';
    document.getElementById('medNote').value = med.note || '';
    document.getElementById('medMorning').value = med.schedule?.morning || '';
    document.getElementById('medNoon').value = med.schedule?.noon || '';
    document.getElementById('medEvening').value = med.schedule?.evening || '';
    document.getElementById('medNight').value = med.schedule?.night || '';
  }

  // Kompakte Chip-Darstellung: 1 Antippen = Einnahme bestätigt
  function buildMedIntakeChip(med, slotId, checked, qtyLabel, opts) {
    const isFlex = !!(opts && opts.flex);
    const time = opts && opts.time ? opts.time : '';
    const timeLabel = isFlex && checked && time ? ` · 🕐 ${escHtml(time)}` : '';
    return `<label class="med-chip ${checked ? 'taken' : ''}">
      <input type="checkbox" data-med-intake="${slotId}" ${isFlex ? 'data-flex="1"' : ''} ${time ? `data-taken-time="${escHtml(time)}"` : ''} ${checked ? 'checked' : ''} onchange="onMedIntakeToggle(this)" />
      <span class="med-chip-check">${checked ? '✓' : ''}</span>
      <span class="med-chip-body">
        <span class="med-chip-name">${escHtml(med.name)}</span>
        <span class="med-chip-dose">${qtyLabel}${med.dose ? ' · ' + escHtml(med.dose) : ''}<span class="med-chip-time">${timeLabel}</span></span>
      </span>
    </label>`;
  }

  function currentTimeHHMM() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function renderMedIntakeForDiary(takenIds, takenTimes) {
    const meds = getMeds();
    const card = document.getElementById('medIntakeCard');
    const list = document.getElementById('medIntakeList');
    if (!card || !list) return;
    const times = takenTimes || {};

    if (!meds.length) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';

    const groupsHtml = MED_TIME_SLOTS.map(slot => {
      const chips = meds.map(m => {
        const sched = emptySchedule(m.schedule);
        if (!(sched[slot.key] > 0)) return '';
        const slotId = `${m.id}_${slot.key}`;
        const checked = takenIds.includes(slotId) || takenIds.includes(m.id);
        return buildMedIntakeChip(m, slotId, checked, `${sched[slot.key]}×`);
      }).filter(Boolean).join('');

      if (!chips) return '';
      return `<div class="med-slot-row">
        <div class="med-slot-label" style="color:var(--${slot.key === 'morning' ? 'morning' : slot.key === 'noon' ? 'noon' : slot.key === 'evening' ? 'evening' : 'night'})">${slot.icon} ${slot.label}</div>
        <div class="med-chip-row">${chips}</div>
      </div>`;
    }).filter(Boolean).join('');

    const unscheduledChips = meds.map(m => {
      const sched = emptySchedule(m.schedule);
      if (Object.values(sched).some(v => v > 0)) return '';
      const checked = takenIds.includes(m.id);
      return buildMedIntakeChip(m, m.id, checked, 'bei Bedarf', { flex: true, time: times[m.id] || '' });
    }).filter(Boolean).join('');

    list.innerHTML = groupsHtml + (unscheduledChips ? `<div class="med-slot-row">
      <div class="med-slot-label">📌 Bei Bedarf</div>
      <div class="med-chip-row">${unscheduledChips}</div>
    </div>` : '');

    updateMedIntakeProgress();
  }

  function onMedIntakeToggle(cb) {
    const chip = cb.closest('.med-chip');
    // Bedarfsmedikation: Uhrzeit der Einnahme automatisch festhalten
    if (cb.dataset.flex === '1') {
      if (cb.checked && !cb.dataset.takenTime) {
        cb.dataset.takenTime = currentTimeHHMM();
      } else if (!cb.checked) {
        delete cb.dataset.takenTime;
      }
    }
    if (chip) {
      chip.classList.toggle('taken', cb.checked);
      const check = chip.querySelector('.med-chip-check');
      if (check) check.textContent = cb.checked ? '✓' : '';
      const timeEl = chip.querySelector('.med-chip-time');
      if (timeEl) {
        timeEl.textContent = cb.checked && cb.dataset.takenTime ? ` · 🕐 ${cb.dataset.takenTime}` : '';
      }
    }
    updateMedIntakeProgress();
  }

  function updateMedIntakeProgress() {
    const list = document.getElementById('medIntakeList');
    const fill = document.getElementById('medIntakeProgressFill');
    const text = document.getElementById('medIntakeProgressText');
    if (!list) return;
    const all = list.querySelectorAll('[data-med-intake]');
    const done = list.querySelectorAll('[data-med-intake]:checked');
    const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;
    if (fill) {
      fill.style.width = pct + '%';
      fill.classList.toggle('complete', pct === 100 && all.length > 0);
    }
    if (text) text.textContent = `${done.length} / ${all.length}`;
  }

  function setAllMedIntake(checked) {
    const list = document.getElementById('medIntakeList');
    if (!list) return;
    list.querySelectorAll('[data-med-intake]').forEach(cb => {
      cb.checked = checked;
      onMedIntakeToggle(cb);
    });
    if (typeof showToast === 'function') {
      showToast(checked ? '✅ Alle Einnahmen markiert – nicht vergessen zu speichern' : 'Einnahmen zurückgesetzt');
    }
  }

  function toggleMedicationTimeGroup(slotKey, checked) {
    document.querySelectorAll(`[data-med-intake$="_${slotKey}"]`).forEach(cb => {
      cb.checked = checked;
      onMedIntakeToggle(cb);
    });
  }

  function collectMedicationIntakeFromDom() {
    const taken = [];
    document.querySelectorAll('[data-med-intake]:checked').forEach(cb => {
      taken.push(cb.dataset.medIntake);
    });
    return taken;
  }

  // Uhrzeiten der Bedarfsmedikation aus dem DOM einsammeln
  function collectMedicationIntakeTimesFromDom() {
    const times = {};
    document.querySelectorAll('[data-med-intake][data-flex="1"]:checked').forEach(cb => {
      if (cb.dataset.takenTime) times[cb.dataset.medIntake] = cb.dataset.takenTime;
    });
    return times;
  }

  function isMedicationTaken(entry, medId) {
    const taken = Array.isArray(entry?.medsTaken) ? entry.medsTaken : [];
    return taken.some(id => id === medId || id.startsWith(`${medId}_`));
  }

  function getMedicationTakenSlots(entry, medId) {
    const taken = Array.isArray(entry?.medsTaken) ? entry.medsTaken : [];
    return taken.filter(id => id === medId || id.startsWith(`${medId}_`));
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

  function renderMedList() {
    const meds = getMeds();
    const list = document.getElementById('medList');
    const empty = document.getElementById('medEmpty');
    if (!list || !empty) return;
    const warnings = findLocalInteractions(meds);

    if (meds.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      refreshMedInteractionAlert();
      return;
    }
    empty.style.display = 'none';

    const rows = meds.map(m => {
      const warn = medHasLocalWarning(m.name, warnings);
      const sched = emptySchedule(m.schedule);
      return `<tr class="med-plan-row ${warn ? 'warn' : ''}">
        <td>
          <div class="med-plan-name-cell">
            <div class="med-plan-name-main">${warn ? '🔴 ' : ''}${escHtml(m.name)}</div>
            <div class="med-plan-name-sub">${m.pzn ? `PZN ${escHtml(m.pzn)}` : '—'}</div>
          </div>
        </td>
        <td>${escHtml(m.dose || '–')}</td>
        <td>${escHtml(m.form || '–')}</td>
        <td class="med-plan-center">${sched.morning || '–'}</td>
        <td class="med-plan-center">${sched.noon || '–'}</td>
        <td class="med-plan-center">${sched.evening || '–'}</td>
        <td class="med-plan-center">${sched.night || '–'}</td>
        <td>${escHtml(m.note || '–')}</td>
        <td>
          <div class="med-plan-actions">
            <button class="btn-secondary" type="button" style="padding:6px 10px" onclick="openMedModal('${escHtml(m.id)}')">✎</button>
            <button class="btn-danger" type="button" style="padding:6px 10px" onclick="deleteMedicationById('${escHtml(m.id)}')">✕</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    list.innerHTML = `<div class="med-plan-table-wrap">
      <table class="med-plan-table">
        <thead>
          <tr>
            <th>Medikament</th>
            <th>Dosis</th>
            <th>Form</th>
            <th>Mo</th>
            <th>Mi</th>
            <th>Ab</th>
            <th>Na</th>
            <th>Hinweis</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
    refreshMedInteractionAlert();
  }

  function openMedModal(editId) {
    const modal = document.getElementById('medModal');
    if (!modal) return;

    ['medName', 'medPzn', 'medDose', 'medMorning', 'medNoon', 'medEvening', 'medNight', 'medForm', 'medNote'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    delete modal.dataset.editingId;
    setMedicationModalMode('create');

    if (editId) {
      const med = getMeds().find(item => item.id === editId);
      if (med) {
        modal.dataset.editingId = editId;
        setMedicationModalMode('edit');
        fillMedicationForm(med);
      }
    }

    modal.classList.add('open');
    document.getElementById('medName')?.focus();
  }

  function closeMedModal() {
    const modal = document.getElementById('medModal');
    if (modal) delete modal.dataset.editingId;
    setMedicationModalMode('create');
    document.getElementById('medModal')?.classList.remove('open');
    ['medName', 'medPzn', 'medDose', 'medMorning', 'medNoon', 'medEvening', 'medNight', 'medForm', 'medNote'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function createMedicationFromForm() {
    const name = document.getElementById('medName')?.value.trim() || '';
    const pzn = (document.getElementById('medPzn')?.value || '').trim().replace(/\D/g, '').slice(0, 8);
    const dose = document.getElementById('medDose')?.value.trim() || '';
    const form = document.getElementById('medForm')?.value.trim() || '';
    const note = document.getElementById('medNote')?.value.trim() || '';

    const schedule = {
      morning: normalizeQty(document.getElementById('medMorning')?.value),
      noon: normalizeQty(document.getElementById('medNoon')?.value),
      evening: normalizeQty(document.getElementById('medEvening')?.value),
      night: normalizeQty(document.getElementById('medNight')?.value),
    };

    if (!name) return { error: '⚠️ Bitte Medikamentenname eingeben' };
    if (!Object.values(schedule).some(v => v > 0)) {
      return { error: '⚠️ Bitte mindestens eine Einnahmezeit angeben' };
    }

    return {
      id: Date.now().toString(36),
      name,
      pzn: pzn || undefined,
      dose,
      form: form || undefined,
      note: note || undefined,
      schedule,
      time: buildLegacyTimeString(schedule),
      source: 'manual',
      active: true,
    };
  }

  function saveMedication() {
    const med = createMedicationFromForm();
    if (med.error) {
      showToast(med.error);
      return;
    }

    const modal = document.getElementById('medModal');
    const editingId = modal?.dataset.editingId;
    const meds = getMeds();

    const isEditing = !!editingId;
    if (editingId) {
      const idx = meds.findIndex(item => item.id === editingId);
      if (idx >= 0) med.id = editingId;
      if (idx >= 0) meds[idx] = normalizeMedication({ ...meds[idx], ...med, updatedAt: new Date().toISOString() }, idx);
      else meds.push(normalizeMedication(med, meds.length));
    } else {
      meds.push(normalizeMedication(med, meds.length));
    }

    saveMeds(meds);
    refreshMedicationUi();
    closeMedModal();
    const warnings = findLocalInteractions(getMeds());
    if (warnings.length) showToast(`⚠️ Medikament ${isEditing ? 'aktualisiert' : 'gespeichert'} – Wechselwirkung prüfen`);
    else showToast(`✅ Medikament ${isEditing ? 'aktualisiert' : 'gespeichert'}`);
  }

  function cleanupMedicationReferences(id) {
    if (!id || typeof getStore !== 'function' || typeof saveStore !== 'function') return;
    const store = getStore();
    let changed = false;
    Object.keys(store).forEach(dateKey => {
      const entry = store[dateKey];
      if (!Array.isArray(entry?.medsTaken)) return;
      const filtered = entry.medsTaken.filter(value => value !== id && !value.startsWith(`${id}_`));
      if (filtered.length !== entry.medsTaken.length) {
        changed = true;
        if (filtered.length) entry.medsTaken = filtered;
        else delete entry.medsTaken;
      }
    });
    if (changed) saveStore(store);
  }

  function deleteMedicationById(id) {
    if (!confirm('Medikament entfernen?')) return;
    const meds = getMeds();
    const filtered = meds.filter(m => m.id !== id);
    if (filtered.length === meds.length) return;
    saveMeds(filtered);
    cleanupMedicationReferences(id);
    refreshMedicationUi();
    showToast('🗑 Medikament entfernt');
  }

  function deleteMed(idOrIndex) {
    if (typeof idOrIndex === 'number') {
      const meds = getMeds();
      const med = meds[idOrIndex];
      if (!med) return;
      deleteMedicationById(med.id);
      return;
    }
    deleteMedicationById(String(idOrIndex));
  }

  function importParsedMedications(incoming, source = 'import') {
    const current = getMeds();
    const merged = mergeImportedMedications(current, incoming.map(item => ({ ...item, source: item.source || source })), source);
    saveMeds(merged);
    refreshMedicationUi();
    return merged;
  }

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
      } catch { }
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
    } catch { }

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
    if (!box || !btn) return;

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
    } catch {
      box.innerHTML = localHtml + `<p style="color:var(--accent-pain);font-size:12px">RxNav nicht erreichbar.${local.length ? ' Offline-Hinweise oben beachten.' : ''}</p>`;
      showToast('❌ RxNav nicht erreichbar');
    }

    btn.disabled = false;
    btn.textContent = '🔍 Wechselwirkungen prüfen';
  }

  const api = {
    getMeds,
    saveMeds,
    normalizeMedication,
    normalizeMedicationList,
    buildLegacyTimeString,
    normalizeMedName,
    medNameMatches,
    findLocalInteractions,
    renderMedIntakeForDiary,
    onMedIntakeToggle,
    updateMedIntakeProgress,
    setAllMedIntake,
    collectMedicationIntakeFromDom,
    collectMedicationIntakeTimesFromDom,
    isMedicationTaken,
    getMedicationTakenSlots,
    toggleMedicationTimeGroup,
    refreshMedInteractionAlert,
    renderMedList,
    openMedModal,
    closeMedModal,
    createMedicationFromForm,
    saveMedication,
    deleteMed,
    deleteMedicationById,
    cleanupMedicationReferences,
    mergeImportedMedications,
    findMedicationDuplicate,
    importParsedMedications,
    resolveRxcui,
    checkDrugInteractions,
  };

  window.SymptoChronMeds = api;
  Object.assign(window, api);
})();
