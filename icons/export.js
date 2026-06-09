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
    bloodPressure: typeof getBloodPressureEntries === 'function' ? getBloodPressureEntries() : [],
    exportedAt: new Date().toISOString(),
    version: 3,
  };
  downloadFile(JSON.stringify(data, null, 2), `schmerztagebuch_backup_${todayStr()}.json`, 'application/json');
  showToast('✅ JSON-Backup erstellt');
}

// ── Export PDF mit Deckblatt & Farbskala ───────────────────────────
function exportPDF() {
  if (!window.jspdf) { showToast('⏳ PDF-Bibliothek lädt...'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const store = getStore();
  const dates = Object.keys(store).sort();
  const meds  = getMeds();

  const lm = 20, rm = 190;
  
  // Stammdaten aus der App holen
  const pName = document.getElementById('patientName')?.value || 'Nicht angegeben';
  const pBirth = document.getElementById('patientBirth')?.value || 'Nicht angegeben';
  const pInsurance = document.getElementById('patientInsurance')?.value || 'Nicht angegeben';

  // ==========================================
  // SEITE 1: DAS DECKBLATT
  // ==========================================
  
  // Header-Balken oben links/rechts
  doc.setFillColor(10, 22, 40); // Dein edler, dunkler Grundton
  doc.rect(0, 0, 210, 40, 'F');
  
  // Titel links im Balken
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SymptoChron', lm, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('MEDIZINISCHER VERLAUFSBERICHT', lm, 26);
  
  // STAMMDATEN OBEN RECHTS (Garantierte Darstellung auf dem Deckblatt!)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient: ${pName}`, 130, 15);
  doc.text(`Geb.: ${pBirth}`, 130, 21);
  doc.text(`Kasse: ${pInsurance}`, 130, 27);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 130, 33);

  // Haupttitel in der Mitte
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Chronologischer Verlauf', lm, 75);
  
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Erfasste Daten zur Schmerzintensität und Restless-Legs-Symptomatik', lm, 83);

  // DIE VISUELLE GRAPHIK IM WELLEN-FORMAT (wird mathematisch gezeichnet)
  doc.setFillColor(20, 35, 60);
  doc.beginPath();
  doc.moveTo(0, 100);
  // Zeichnet eine geschwungene Wellenform über die Breite des Blattes
  doc.bezierCurveTo(40, 90, 70, 115, 110, 100);
  doc.bezierCurveTo(150, 85, 180, 110, 210, 95);
  doc.lineTo(210, 125);
  doc.lineTo(0, 125);
  doc.fill();

  // Zeitraum & Statistik-Boxen unten auf dem Deckblatt
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Übersicht des Erfassungszeitraums', lm, 145);
  
  // Berechnungen für die Statistik
  let totalDays = dates.length;
  let avgPain = 0;
  let totalRlsDays = 0;

  if (totalDays > 0) {
    let painSum = 0;
    dates.forEach(d => {
      painSum += Number(store[d].painScore || 0);
      if (store[d].rlsScore && Number(store[d].rlsScore) > 0) {
        totalRlsDays++;
      }
    });
    avgPain = (painSum / totalDays).toFixed(1);
  }

  // Boxen zeichnen
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  
  // Box 1: Tage
  doc.rect(lm, 155, 80, 25, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('ERFASSTE TAGE GESAMT', lm + 5, 162);
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalDays} Tage`, lm + 5, 175);

  // Box 2: Schmerz-Schnitt
  doc.rect(lm + 90, 155, 80, 25, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Ø SCHMERZINTENSITÄT', lm + 95, 162);
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgPain} / 10`, lm + 95, 175);

  // DER MEDIKAMENTENPLAN AUF DEM DECKBLATT
  doc.setTextColor(10, 22, 40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Aktueller Dauermedikationsplan', lm, 195);
  
  doc.setLineWidth(0.2);
  doc.line(lm, 198, rm, 198);

  let medY = 206;
  doc.setFontSize(10);
  if (meds && meds.length > 0) {
    meds.forEach(med => {
      if (medY < 270) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`• ${med.name || 'Unbekanntes Medikament'}`, lm, medY);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        // Konstruiert die Einnahme-Zeiten falls vorhanden
        let scheduleText = `${med.dosage || ''} | ${med.schedule || 'Nach Plan'}`;
        doc.text(scheduleText, lm + 60, medY);
        medY += 7;
      }
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('Keine Dauermedikation in der App hinterlegt.', lm, medY);
  }

  // Footer Deckblatt
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Generiert mit SymptoChron – Patientenselbstmanagement', lm, 285);


  // ==========================================
  // AB SEITE 2: DIE DATEN-TABELLEN
  // ==========================================
  doc.addPage();
  
  // Kleiner kompakter Header für Folgeseiten
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SymptoChron Verlaufsprotokoll', lm, 13);
  
  // Stammdaten dezent oben rechts auf Folgeseiten wiederholen
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient: ${pName} | Geb: ${pBirth}`, 135, 13);

  let y = 32;
  doc.setTextColor(30, 30, 30);
  
  // Tabellenkopf zeichnen
  doc.setFillColor(241, 245, 249);
  doc.rect(lm, y, 170, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Datum', lm + 2, y + 5.5);
  doc.text('Schmerz', lm + 30, y + 5.5);
  doc.text('RLS', lm + 55, y + 5.5);
  doc.text('Notizen / Besonderheiten', lm + 75, y + 5.5);
  
  y += 8;

  // Schleife über alle 41 Tage
  dates.forEach((dateStr) => {
    // Prüfen auf Seitenumbruch, damit nichts unten rausfällt
    if (y > 270) {
      doc.addPage();
      // Header auf neuer Seite wiederholen
      doc.setFillColor(10, 22, 40);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('SymptoChron Verlaufsprotokoll', lm, 13);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Patient: ${pName} | Geb: ${pBirth}`, 135, 13);
      y = 30;
    }

    const data = store[dateStr];
    const pScore = Number(data.painScore || 0);
    const rScore = Number(data.rlsScore || 0);
    
    // Zeilenhintergrund (leichtes graues Gittermuster für die Lesbarkeit)
    doc.setDrawColor(241, 245, 249);
    doc.line(lm, y + 7, rm, y + 7);

    // Datum schreiben
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(dateStr, lm + 2, y + 5);

    // ── DEINE FARBSKALA FÜR SCHMERZ ──
    // 1-3: Grün | 4-5: Gelb/Orange | ab 6: Fett & Rot
    if (pScore >= 1 && pScore <= 3) {
      doc.setTextColor(46, 125, 50); // Kräftiges Grün
      doc.setFont('helvetica', 'bold');
    } else if (pScore >= 4 && pScore <= 5) {
      doc.setTextColor(217, 119, 6); // Sattes Orange/Gelb
      doc.setFont('helvetica', 'bold');
    } else if (pScore >= 6) {
      doc.setTextColor(185, 28, 28); // Signalrot
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11); // Größer darstellen!
    } else {
      doc.setTextColor(148, 163, 184); // 0 = Hellgrau
      doc.setFont('helvetica', 'normal');
    }
    doc.text(`${pScore} / 10`, lm + 30, y + 5);
    doc.setFontSize(9); // Wieder zurücksetzen

    // ── DEINE INTERPRETATION FÜR RLS ──
    if (rScore > 0) {
      doc.setTextColor(109, 40, 217); // Lila für RLS
      doc.setFont('helvetica', 'bold');
      if (rScore >= 6) doc.setFontSize(11); // Auch RLS ab Stufe 6 dicker machen
    } else {
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(`${rScore} / 10`, lm + 55, y + 5);
    doc.setFontSize(9);

    // Notiztext (Abschneiden, falls er zu lang für die Zeile wird)
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    let noteText = data.notes || '';
    if (data.triggers && data.triggers.length > 0) {
      noteText += ` (Faktoren: ${data.triggers.join(', ')})`;
    }
    let shortNote = doc.splitTextToSize(noteText, 90);
    doc.text(shortNote[0] || 'Keine Einträge', lm + 75, y + 5);

    y += 8; // Zur nächsten Zeile wandern
  });

  // Dokument im Browser öffnen oder Druckdialog triggern
  doc.openInNewWindow();
}

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
        if (data.bloodPressure && typeof getBloodPressureEntries === 'function' && typeof saveBloodPressureEntries === 'function') {
          const bp = getBloodPressureEntries();
          bp.push(...data.bloodPressure);
          saveBloodPressureEntries(bp);
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
  localStorage.removeItem('painDiaryBloodPressure');
  buildWeekStrip();
  loadCurrentEntry();
  renderMedList();
  initRlsTab();
  showToast('🗑 Alle Daten gelöscht');
}
