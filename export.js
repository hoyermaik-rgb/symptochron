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
    doc.text('IRLS-Fragebogen (10 Fragen)', lm, y); y += 8;
    surveyDates.slice(-10).forEach(d => {
      const s = surveys[d];
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`${formatDateShort(d)}: ${s.sum}/40 – ${s.severity}`, lm, y);
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

