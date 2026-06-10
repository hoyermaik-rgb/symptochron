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
    patient: typeof getPatientData === 'function' ? getPatientData() : null,
    rlsDaily: getRlsDaily(),
    rlsSurveys: getRlsSurveys(),
    bloodPressure: typeof getBloodPressureEntries === 'function' ? getBloodPressureEntries() : [],
    exportedAt: new Date().toISOString(),
    version: 4,
  };
  downloadFile(JSON.stringify(data, null, 2), `schmerztagebuch_backup_${todayStr()}.json`, 'application/json');
  showToast('✅ JSON-Backup erstellt');
}

function medicationTimeLabel(med) {
  if (med?.time) return med.time;
  if (typeof buildLegacyTimeString === 'function' && med?.schedule) {
    return buildLegacyTimeString(med.schedule) || 'Nach Plan';
  }
  return 'Nach Plan';
}

function mergeBloodPressureEntries(existing, incoming) {
  const current = Array.isArray(existing) ? existing : [];
  const additions = Array.isArray(incoming) ? incoming : [];
  const seen = new Set(current.map(entry => [entry.id || '', entry.date || '', entry.time || '', entry.systolic || '', entry.diastolic || ''].join('|')));
  const merged = [...current];
  additions.forEach(entry => {
    const key = [entry.id || '', entry.date || '', entry.time || '', entry.systolic || '', entry.diastolic || ''].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(entry);
  });
  return merged;
}

function drawPdfPageHeader(doc, title, pName, pBirth, lm) {
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, lm, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient: ${pName} | Geb: ${pBirth}`, 220, 12);
}

function drawMedicationPlanPdfPage(doc, meds, pName, pBirth, lm, rm) {
  doc.addPage();
  drawPdfPageHeader(doc, 'SymptoChron – Medikamentenplan', pName, pBirth, lm);

  doc.setTextColor(10, 22, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Fester Medikamentenplan', lm, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Tabellarische Übersicht der aktuellen Dauermedikation', lm, 34);

  let y = 42;
  doc.setFillColor(226, 232, 240);
  doc.rect(lm, y, rm - lm, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Medikament', lm + 2, y + 6.5);
  doc.text('Dosis', lm + 78, y + 6.5);
  doc.text('Form', lm + 112, y + 6.5);
  doc.text('Mo', lm + 142, y + 6.5);
  doc.text('Mi', lm + 156, y + 6.5);
  doc.text('Ab', lm + 170, y + 6.5);
  doc.text('Na', lm + 184, y + 6.5);
  doc.text('Hinweis', lm + 198, y + 6.5);
  y += 10;

  if (!meds.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Keine Medikamente hinterlegt.', lm, y + 6);
    return;
  }

  meds.forEach(m => {
    if (y > 185) {
      doc.addPage();
      drawPdfPageHeader(doc, 'SymptoChron – Medikamentenplan', pName, pBirth, lm);
      y = 26;
      doc.setFillColor(226, 232, 240);
      doc.rect(lm, y, rm - lm, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Medikament', lm + 2, y + 6.5);
      doc.text('Dosis', lm + 78, y + 6.5);
      doc.text('Form', lm + 112, y + 6.5);
      doc.text('Mo', lm + 142, y + 6.5);
      doc.text('Mi', lm + 156, y + 6.5);
      doc.text('Ab', lm + 170, y + 6.5);
      doc.text('Na', lm + 184, y + 6.5);
      doc.text('Hinweis', lm + 198, y + 6.5);
      y += 10;
    }

    const sched = m.schedule || {};
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(lm, y + 8, rm, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(m.name || 'Medikament', 72)[0], lm + 2, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(m.dose || '–', 30)[0], lm + 78, y + 5.5);
    doc.text(doc.splitTextToSize(m.form || '–', 24)[0], lm + 112, y + 5.5);
    doc.text(String(sched.morning || '–'), lm + 144, y + 5.5);
    doc.text(String(sched.noon || '–'), lm + 158, y + 5.5);
    doc.text(String(sched.evening || '–'), lm + 172, y + 5.5);
    doc.text(String(sched.night || '–'), lm + 186, y + 5.5);
    doc.text(doc.splitTextToSize(m.note || '–', 72)[0], lm + 198, y + 5.5);
    y += 8.5;
  });
}

function exportPDF() {
  const lib = window.jspdf || window.jsPDF;
  if (!lib) { showToast('⏳ PDF-Bibliothek lädt nicht oder fehlt...'); return; }
  
  const { jsPDF } = lib;
  // REPARIERT: Wechsel auf Querformat (orientation: 'landscape')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  const store = getStore() || {};
  const dates = Object.keys(store).sort();
  const meds  = getMeds() || [];

  // Seitenränder für Querformat (Breite ist jetzt 297mm statt 210mm)
  const lm = 15, rm = 282;
  
  const patient = typeof getPatientData === 'function' ? getPatientData() : {
    name: document.getElementById('patientName')?.value || '',
    bday: document.getElementById('patientBday')?.value || '',
  };
  const pName = patient.name || document.getElementById('patientName')?.value || 'Nicht angegeben';
  const pBirth = patient.bday || document.getElementById('patientBday')?.value || 'Nicht angegeben';

  // ==========================================
  // SEITE 1: DAS DECKBLATT (Im Querformat-Design)
  // ==========================================
  doc.setFillColor(10, 22, 40); 
  doc.rect(0, 0, 297, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('SymptoChron', lm, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('MEDIZINISCHER VERLAUFSBERICHT (KOMPAKT-QUERFORMAT)', lm, 26);
  
  // Stammdaten rechtsbündig im Header verschoben
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`Patient: ${pName}`, 210, 15);
  doc.text(`Geb.: ${pBirth}`, 210, 21);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 210, 27);

  doc.setTextColor(10, 22, 40);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Chronologischer Verlauf', lm, 70);
  
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(12);
  doc.text('Erfasste Daten zur Schmerzintensität und Restless-Legs-Symptomatik nach Tageszeiten', lm, 78);

  // Dekorative Kante (Nativ)
  doc.setFillColor(20, 35, 60);
  doc.triangle(0, 90, 297, 90, 297, 105, 'F');
  doc.rect(0, 105, 297, 5, 'F');

  doc.setTextColor(10, 22, 40);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Übersicht des Erfassungszeitraums', lm, 135);
  
  let totalDays = dates.length;
  let avgPain = 0;

  if (totalDays > 0) {
    let painSum = 0;
    let countValues = 0;
    dates.forEach(d => {
      const e = store[d] || {};
      const dayValues = [e.morning_pain, e.noon_pain, e.evening_pain, e.night_pain].map(Number).filter(v => !isNaN(v) && v >= 0);
      if (dayValues.length > 0) {
        painSum += Math.max(...dayValues);
        countValues++;
      }
    });
    avgPain = countValues > 0 ? (painSum / countValues).toFixed(1) : "0.0";
  }

  // Statistikboxen nebeneinander im Querformat gestreckt
  doc.setDrawColor(200, 210, 225);
  doc.setFillColor(240, 244, 248);
  
  doc.rect(lm, 143, 120, 28, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ERFASSTE TAGE GESAMT', lm + 6, 151);
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalDays} Tage`, lm + 6, 164);

  doc.rect(lm + 130, 143, 120, 28, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Ø MAXIMALER SCHMERZWERT', lm + 136, 151);
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgPain} / 10`, lm + 136, 164);

  // Hinweis auf festen Medikamentenplan auf Seite 2
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Medikationsplan', lm, 190);
  doc.line(lm, 193, rm, 193);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Der vollständige tabellarische Medikamentenplan befindet sich auf Seite 2.${meds.length ? ` Aktuell ${meds.length} Medikament${meds.length === 1 ? '' : 'e'} hinterlegt.` : ''}`, lm, 202);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Generiert mit SymptoChron', lm, 285);

  // ==========================================
  // SEITE 2: FESTER MEDIKAMENTENPLAN
  // ==========================================
  drawMedicationPlanPdfPage(doc, meds, pName, pBirth, lm, rm);

  // ==========================================
  // AB SEITE 3: DIE MATRIX-TABELLE
  // ==========================================
  if (totalDays > 0) {
    doc.addPage();
    drawPdfPageHeader(doc, 'SymptoChron – Chronologische Verlaufsmatrix', pName, pBirth, lm);

    let y = 28;
    
    // Tabellen-Header zeichnen
    doc.setFillColor(226, 232, 240);
    doc.rect(lm, y, rm - lm, 10, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    
    // Spalten-Beschriftungen (Präzise berechnet für 267mm Gesamtbreite)
    doc.text('Datum', lm + 2, y + 6.5);
    doc.text('S (Mo)', lm + 24, y + 6.5);
    doc.text('S (Mi)', lm + 39, y + 6.5);
    doc.text('S (Ab)', lm + 54, y + 6.5);
    doc.text('S (Na)', lm + 69, y + 6.5);
    
    doc.text('R (Mo)', lm + 89, y + 6.5);
    doc.text('R (Mi)', lm + 104, y + 6.5);
    doc.text('R (Ab)', lm + 119, y + 6.5);
    doc.text('R (Na)', lm + 134, y + 6.5);
    
    doc.text('Schlaf', lm + 154, y + 6.5);
    doc.text('Qual.', lm + 172, y + 6.5);
    doc.text('Notizen / Besonderheiten / Auslöser', lm + 188, y + 6.5);
    
    y += 10;

    // Hilfsfunktion zur Bestimmung der Schmerzfarbe (Skala)
    const getPainColor = (val) => {
      if (!val || isNaN(val) || val == 0) return { r: 148, g: 163, b: 184, bold: false }; // Keine Angabe (Grau)
      if (val <= 3) return { r: 46, g: 125, b: 50, bold: true };    // Grün (Mild)
      if (val <= 5) return { r: 217, g: 119, b: 6, bold: true };   // Orange (Mittel)
      return { r: 185, g: 28, b: 28, bold: true };                 // Rot (Stark!)
    };

    // Hilfsfunktion zur Bestimmung der RLS-Farbe (Skala)
    const getRlsColor = (val) => {
      if (!val || isNaN(val) || val == 0) return { r: 148, g: 163, b: 184, bold: false };
      if (val <= 3) return { r: 124, g: 58, b: 237, bold: true };  // Helles Violett
      if (val <= 6) return { r: 109, g: 40, b: 217, bold: true };  // Mittleres Violett
      return { r: 91, g: 33, b: 182, bold: true };                 // Tiefes, dunkles Violett
    };

    dates.forEach((dateStr) => {
      // Zeilen-Umbruchschutz für Querformat
      if (y > 185) {
        doc.addPage();
        drawPdfPageHeader(doc, 'SymptoChron – Chronologische Verlaufsmatrix', pName, pBirth, lm);
        y = 26;
        doc.setFillColor(226, 232, 240);
        doc.rect(lm, y, rm - lm, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('Datum', lm + 2, y + 6.5);
        doc.text('S (Mo)', lm + 24, y + 6.5);
        doc.text('S (Mi)', lm + 39, y + 6.5);
        doc.text('S (Ab)', lm + 54, y + 6.5);
        doc.text('S (Na)', lm + 69, y + 6.5);
        doc.text('R (Mo)', lm + 89, y + 6.5);
        doc.text('R (Mi)', lm + 104, y + 6.5);
        doc.text('R (Ab)', lm + 119, y + 6.5);
        doc.text('R (Na)', lm + 134, y + 6.5);
        doc.text('Schlaf', lm + 154, y + 6.5);
        doc.text('Qual.', lm + 172, y + 6.5);
        doc.text('Notizen / Besonderheiten / Auslöser', lm + 188, y + 6.5);
        y += 10;
      }

      const data = store[dateStr] || {};
      
      // Trennlinie zeichnen
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(lm, y + 7, rm, y + 7);

      // 1. Datum drucken
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(dateStr, lm + 2, y + 5);

      // 2. Schmerzwerte (S) mit Farbskala ausgeben
      const sTimes = ['morning_pain', 'noon_pain', 'evening_pain', 'night_pain'];
      let sX = lm + 24;
      sTimes.forEach(key => {
        const val = data[key];
        const cfg = getPainColor(val);
        doc.setTextColor(cfg.r, cfg.g, cfg.b);
        doc.setFont('helvetica', cfg.bold ? 'bold' : 'normal');
        doc.text(val !== undefined && val !== '' ? String(val) : '–', sX, y + 5);
        sX += 15;
      });

      // 3. RLS-Werte (R) mit Farbskala ausgeben
      const rTimes = ['morning_rls', 'noon_rls', 'evening_rls', 'night_rls'];
      let rX = lm + 89;
      rTimes.forEach(key => {
        const val = data[key];
        const cfg = getRlsColor(val);
        doc.setTextColor(cfg.r, cfg.g, cfg.b);
        doc.setFont('helvetica', cfg.bold ? 'bold' : 'normal');
        doc.text(val !== undefined && val !== '' ? String(val) : '–', rX, y + 5);
        rX += 15;
      });

      // 4. Schlafwerte ausgeben
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const sh = data.sleepHours;
      doc.text(sh !== undefined && sh !== '' ? `${sh} h` : '–', lm + 154, y + 5);

      const sq = data.sleepQuality;
      doc.text(sq !== undefined && sq !== '' ? `${sq}/5` : '–', lm + 172, y + 5);

      // 5. Kombinierte Notizen & Einflussfaktoren ausgeben
      let noteText = data.notes || '';
      const factorLabels = data.factors
        ? INFLUENCE_TAGS.filter(tag => data.factors[tag.key]).map(tag => tag.label.replace(/^[^\s]+\s/, ''))
        : [];
      if (factorLabels.length > 0) {
        noteText += ` [Auslöser: ${factorLabels.join(', ')}]`;
      }
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      let shortNote = doc.splitTextToSize(noteText, 92);
      doc.text(shortNote[0] || 'Keine Einträge', lm + 188, y + 5);

      y += 7.5; // Zeilenabstand optimal kompakt halten
    });
  }

  // PDF-Download ausführen
  try {
    const filename = `symptochron_matrix_${todayStr()}.pdf`;
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    
    if (typeof showToast === 'function') {
      showToast('✅ PDF im Querformat gedruckt!');
    }
  } catch(e) {
    doc.output('dataurlnewwindow');
  }
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
          const mergedMeds = typeof mergeImportedMedications === 'function'
            ? mergeImportedMedications(getMeds(), data.medications, 'import')
            : [...getMeds(), ...data.medications];
          saveMeds(mergedMeds);
        }
        if (data.settings) saveSettings({ ...getSettings(), ...data.settings });
        if (data.patient && typeof data.patient === 'object') {
          if (typeof data.patient.name === 'string') localStorage.setItem('symptochron_patient_name', data.patient.name);
          if (typeof data.patient.bday === 'string') localStorage.setItem('symptochron_patient_bday', data.patient.bday);
          if (typeof loadPatientData === 'function') loadPatientData();
        }
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
        if (data.bloodPressure && typeof getBloodPressureEntries === 'function' && typeof saveBloodPressureEntries === 'function') {
          const bp = mergeBloodPressureEntries(getBloodPressureEntries(), data.bloodPressure);
          saveBloodPressureEntries(bp);
        }
        buildWeekStrip();
        renderMedList();
        if (typeof refreshDiary === 'function') refreshDiary();
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
      if (typeof refreshDiary === 'function') refreshDiary();
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
  localStorage.removeItem('painDiaryBloodPressure');
  localStorage.removeItem('painDiaryReminderSettings');
  localStorage.removeItem('symptochron_patient_name');
  localStorage.removeItem('symptochron_patient_bday');
  buildWeekStrip();
  loadCurrentEntry();
  renderMedList();
  if (typeof loadPatientData === 'function') loadPatientData();
  initRlsTab();
  showToast('🗑 Alle Daten gelöscht');
}
