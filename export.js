// ── Export CSV ───────────────────────────────────
function exportCSV() {
  const store = getStore();
  const moodStore = typeof getMoodStore === 'function' ? getMoodStore() : {};
  const dates = Object.keys(store).sort();

  if (dates.length === 0) { showToast('⚠️ Keine Daten zum Exportieren'); return; }

  const header = 'datum,morgen_schmerz,morgen_rls,mittag_schmerz,mittag_rls,abend_schmerz,abend_rls,nacht_schmerz,nacht_rls,schlafdauer_stunden,schlafqualitaet_1_5,stimmung,energie,angst,notizen';
  const rows = dates.map(d => {
    const e = store[d];
    const m = moodStore[d] || {};
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
      m.stimmung ?? '',
      m.energie ?? '',
      m.angst ?? '',
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
    reminderSettings: typeof getReminderSettings === 'function' ? getReminderSettings() : (JSON.parse(localStorage.getItem('painDiaryReminderSettings') || '{"enabled":false}')),
    mood: typeof getMoodStore === 'function' ? getMoodStore() : {},
    phq9: typeof getPhq9Store === 'function' ? getPhq9Store() : (JSON.parse(localStorage.getItem('symptochron_phq9') || '{}')),
    gad7: typeof getGad7Store === 'function' ? getGad7Store() : (JSON.parse(localStorage.getItem('symptochron_gad7') || '{}')),
    crisis: typeof getCrisisData === 'function' ? getCrisisData() : (JSON.parse(localStorage.getItem('symptochron_crisis') || '{}')),
    sos: typeof getSOSData === 'function' ? getSOSData() : (JSON.parse(localStorage.getItem('symptochron_sos_data') || '{}')),
    exportedAt: new Date().toISOString(),
    version: 7,
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

// ══════════════════════════════════════════════════
//  PDF EXPORT – Komplett im Querformat (Landscape)
// ══════════════════════════════════════════════════

function buildPdfDocument() {
  var lib = window.jspdf || window.jsPDF;
  if (!lib) { showToast('⏳ PDF-Bibliothek lädt nicht oder fehlt...'); return null; }

  var jsPDF = lib.jsPDF || lib;
  // ALLES im Querformat
  var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });

  var store = getStore() || {};
  var dates = Object.keys(store).sort();
  var meds  = getMeds() || [];

  var patient = typeof getPatientData === 'function' ? getPatientData() : {
    name: document.getElementById('patientName')?.value || '',
    bday: document.getElementById('patientBday')?.value || '',
  };
  var pName  = patient.name || document.getElementById('patientName')?.value || 'Nicht angegeben';
  var pBirth = patient.bday || document.getElementById('patientBday')?.value || 'Nicht angegeben';
  var createdAt = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Landscape: 297 × 210mm
  var W = 297, H = 210;

  // ====== SEITE 1: DECKBLATT ======
  drawCoverPageL(doc, pName, pBirth, createdAt, dates, store, meds, W, H);

  // ====== SEITE 2: MEDIKAMENTENPLAN ======
  drawMedikamentenplanL(doc, meds, pName, pBirth, createdAt, W, H);

  // ====== SEITEN 3+: VERLAUFSDATEN ======
  if (dates.length > 0) {
    doc.addPage('a4', 'l');
    drawDataMatrixL(doc, store, dates, pName, pBirth, createdAt, W, H);
  }

  return doc;
}

function downloadPdfDocument(doc) {
  try {
    var filename = 'symptochron_bericht_' + todayStr() + '.pdf';
    var blob = doc.output('blob');
    var blobUrl = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    showToast('✅ PDF-Bericht erstellt!');
  } catch(e) {
    doc.output('dataurlnewwindow');
  }
}

function exportPDF() {
  var doc = buildPdfDocument();
  if (doc) downloadPdfDocument(doc);
}

// ── PDF-Vorschau vor dem Download ────────────────
var pdfPreviewUrl = null;

function previewPDF() {
  var doc = buildPdfDocument();
  if (!doc) return;

  var modal = document.getElementById('pdfPreviewModal');
  var frame = document.getElementById('pdfPreviewFrame');
  // Fallback: ohne Modal (oder auf kleinen Geräten ohne PDF-Viewer) direkt herunterladen
  var isSmallScreen = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  if (!modal || !frame || isSmallScreen) {
    downloadPdfDocument(doc);
    return;
  }

  try {
    if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); pdfPreviewUrl = null; }
    var blob = doc.output('blob');
    pdfPreviewUrl = URL.createObjectURL(blob);
    frame.src = pdfPreviewUrl + '#toolbar=0&view=FitH';
    modal.classList.add('open');
  } catch (e) {
    downloadPdfDocument(doc);
  }
}

function closePdfPreview() {
  var modal = document.getElementById('pdfPreviewModal');
  var frame = document.getElementById('pdfPreviewFrame');
  if (modal) modal.classList.remove('open');
  if (frame) frame.src = 'about:blank';
  if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); pdfPreviewUrl = null; }
}

function downloadPreviewedPDF() {
  var doc = buildPdfDocument();
  if (doc) downloadPdfDocument(doc);
  closePdfPreview();
}

// ══════════════════════════════════════════════════
//  SEITE 1: DECKBLATT (Querformat)
// ══════════════════════════════════════════════════
function drawCoverPageL(doc, pName, pBirth, createdAt, dates, store, meds, W, H) {
  var m = 15, mr = W - m;

  // ── Dunkler Header-Bereich ──
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 32, 'F');

  // Blauer Akzent
  doc.setFillColor(59, 158, 255);
  doc.rect(0, 32, W, 2, 'F');

  // Titel
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('SymptoChron', m, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('MEDIZINISCHER VERLAUFSBERICHT', m, 27);

  // Patientendaten rechts im Header
  doc.setTextColor(200, 215, 240);
  doc.setFontSize(9);
  doc.text('Patient: ' + pName, mr - 120, 13);
  doc.text('Geburtsdatum: ' + pBirth, mr - 120, 19);
  doc.text('Erstellt am: ' + createdAt, mr - 120, 25);

  // ── Statistik-Karten nebeneinander ──
  var y = 44;
  var boxW = 82, boxH = 26, gap = 8;
  var totalW = boxW * 3 + gap * 2;
  var startX = m + (mr - m - totalW) / 2;

  drawStatBoxL(doc, startX, y, boxW, boxH, String(dates.length), 'Tage erfasst');
  drawStatBoxL(doc, startX + boxW + gap, y, boxW, boxH, computeAvgPain(store, dates), 'Ø Max. Schmerz / 10');
  drawStatBoxL(doc, startX + (boxW + gap) * 2, y, boxW, boxH, String(meds.length), 'Medikamente hinterlegt');

  // ── Trennlinie ──
  y += boxH + 12;
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.3);
  doc.line(m, y, mr, y);

  // ── Inhaltsübersicht – zwei Spalten ──
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(10, 22, 40);
  doc.text('Inhalt dieses Berichts', m, y);
  y += 9;

  var sections = [
    { page: 'S. 1', title: 'Deckblatt', desc: 'Patientendaten und Zusammenfassung' },
    { page: 'S. 2', title: 'Medikamentenplan', desc: 'Tabellarische Übersicht der aktuellen Medikation' },
    { page: 'S. 3+', title: 'Chronologischer Verlauf', desc: 'Schmerz- und RLS-Daten nach Tageszeiten' },
  ];

  sections.forEach(function(s, idx) {
    var sx = m + (idx * 88);
    // Box
    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(sx, y, 85, 24, 2, 2, 'FD');

    // Page badge
    doc.setFillColor(59, 158, 255);
    doc.roundedRect(sx + 3, y + 3, 18, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(s.page, sx + 12, y + 8.5, { align: 'center' });

    // Title
    doc.setTextColor(10, 22, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(s.title, sx + 24, y + 8.5);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.desc, sx + 5, y + 18);
  });

  // ── Legendbox unten ──
  y += 36;
  doc.setFillColor(242, 245, 250);
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(m, y, mr - m, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('Farblegende Schmerz- und RLS-Werte:', m + 5, y + 6);

  // Pain legend
  var legY = y + 12;
  var legX = m + 5;

  // Grün
  doc.setFillColor(46, 125, 50);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('0–3 Leicht', legX + 10, legY + 1);

  // Orange
  legX += 50;
  doc.setFillColor(217, 119, 6);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.text('4–5 Mittel', legX + 10, legY + 1);

  // Rot
  legX += 50;
  doc.setFillColor(185, 28, 28);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.text('6–10 Stark', legX + 10, legY + 1);

  // Violett (RLS)
  legX += 55;
  doc.setFillColor(109, 40, 217);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.text('RLS-Werte (Violett-Töne)', legX + 10, legY + 1);

  // ── Footer ──
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.2);
  doc.line(m, H - 14, mr, H - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Dieser Bericht wurde mit SymptoChron erstellt und ersetzt keine ärztliche Beratung. Bitte besprechen Sie alle Werte mit Ihrem Arzt.', m, H - 9);
  doc.text('Generiert am ' + createdAt, mr, H - 9, { align: 'right' });
}

function drawStatBoxL(doc, x, y, w, h, value, label) {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(10, 22, 40);
  doc.text(String(value), x + w / 2, y + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + w / 2, y + 21, { align: 'center' });
}

function computeAvgPain(store, dates) {
  if (!dates.length) return '–';
  var sum = 0, cnt = 0;
  dates.forEach(function(d) {
    var e = store[d] || {};
    var vals = [e.morning_pain, e.noon_pain, e.evening_pain, e.night_pain].map(Number).filter(function(v) { return !isNaN(v) && v >= 0; });
    if (vals.length > 0) {
      sum += Math.max.apply(null, vals);
      cnt++;
    }
  });
  return cnt > 0 ? (sum / cnt).toFixed(1) : '–';
}

// ══════════════════════════════════════════════════
//  SEITE 2: MEDIKAMENTENPLAN (Querformat)
// ══════════════════════════════════════════════════
function drawMedikamentenplanL(doc, meds, pName, pBirth, createdAt, W, H) {
  doc.addPage('a4', 'l');

  var m = 15, mr = W - m;
  var contentW = mr - m;
  var y = 0;

  // ── Header Banner ──
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 22, 'F');

  // Roter Akzent (wie offizieller Medikamentenplan)
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 22, W, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MEDIKAMENTENPLAN', m, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('SymptoChron – Generiert am ' + createdAt, mr, 9, { align: 'right' });

  y = 28;

  // ── Patient Info Box ──
  doc.setFillColor(242, 245, 250);
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(m, y, contentW, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Name, Vorname', m + 4, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(pName, m + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Geburtsdatum', m + 120, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(pBirth, m + 120, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Datum', m + 200, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(createdAt, m + 200, y + 12);

  y += 20;

  // ── Tabellen-Spalten (breit im Querformat) ──
  var cols = [
    { key: 'name',    label: 'Medikament',         w: 58, bg: null },
    { key: 'dose',    label: 'Wirkstoff / Dosis',   w: 40, bg: null },
    { key: 'form',    label: 'Darreichungsform',    w: 34, bg: null },
    { key: 'morning', label: 'Morgens',             w: 24, bg: [245, 180, 30] },
    { key: 'noon',    label: 'Mittags',             w: 24, bg: [59, 130, 246] },
    { key: 'evening', label: 'Abends',              w: 24, bg: [139, 92, 246] },
    { key: 'night',   label: 'Nachts',              w: 24, bg: [30, 64, 175] },
    { key: 'note',    label: 'Hinweis / Bemerkung', w: contentW - 58 - 40 - 34 - 24*4, bg: null },
  ];

  // x-Positionen berechnen
  var rx = m;
  for (var ci = 0; ci < cols.length; ci++) {
    cols[ci].x = rx;
    rx += cols[ci].w;
  }

  // ── Tabellen-Kopf ──
  var hdrH = 12;
  for (var hi = 0; hi < cols.length; hi++) {
    var c = cols[hi];
    if (c.bg) {
      doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    } else {
      doc.setFillColor(226, 232, 240);
    }
    doc.rect(c.x, y, c.w, hdrH, 'F');

    doc.setDrawColor(200, 210, 225);
    doc.setLineWidth(0.25);
    doc.rect(c.x, y, c.w, hdrH, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(c.bg ? 255 : 30, c.bg ? 255 : 41, c.bg ? 255 : 59);
    doc.text(c.label, c.x + c.w / 2, y + 8, { align: 'center' });
  }

  // Tageszeit-Icons
  doc.setFontSize(10);
  var icons = [null, null, null, '☀', '⛅', '🌆', '🌙', null];
  for (var ii = 0; ii < cols.length; ii++) {
    if (icons[ii]) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(icons[ii], cols[ii].x + 2, y + 4);
    }
  }

  y += hdrH;

  // ── Daten-Zeilen ──
  if (meds.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(m, y, contentW, 18, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text('Keine Medikamente hinterlegt.', m + contentW / 2, y + 11, { align: 'center' });
    y += 18;
  } else {
    for (var mi = 0; mi < meds.length; mi++) {
      var med = meds[mi];
      var rowH = 12;
      var sched = med.schedule || {};

      // Seitenumbruch
      if (y + rowH > H - 28) {
        doc.addPage('a4', 'l');
        y = 16;
        // Header neu zeichnen
        for (var ri = 0; ri < cols.length; ri++) {
          var rc = cols[ri];
          if (rc.bg) { doc.setFillColor(rc.bg[0], rc.bg[1], rc.bg[2]); }
          else { doc.setFillColor(226, 232, 240); }
          doc.rect(rc.x, y, rc.w, hdrH, 'F');
          doc.setDrawColor(200, 210, 225);
          doc.setLineWidth(0.25);
          doc.rect(rc.x, y, rc.w, hdrH, 'D');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(rc.bg ? 255 : 30, rc.bg ? 255 : 41, rc.bg ? 255 : 59);
          doc.text(rc.label, rc.x + rc.w / 2, y + 8, { align: 'center' });
        }
        y += hdrH;
      }

      // Alternating background
      var isEven = mi % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 253 : 255);
      doc.rect(m, y, contentW, rowH, 'F');

      // Zeilen-Trennlinie
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(m, y + rowH, mr, y + rowH);

      // Vertikale Linien für Zeit-Spalten
      for (var vi = 3; vi <= 6; vi++) {
        doc.setDrawColor(230, 235, 245);
        doc.setLineWidth(0.08);
        doc.line(cols[vi].x, y, cols[vi].x, y + rowH);
      }

      // Medikamentenname
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      var nameText = doc.splitTextToSize(med.name || '–', cols[0].w - 6);
      doc.text(nameText[0], cols[0].x + 3, y + 7.5);

      // Dosis
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      var doseText = doc.splitTextToSize(med.dose || '–', cols[1].w - 6);
      doc.text(doseText[0], cols[1].x + 3, y + 7.5);

      // Darreichungsform
      var formText = doc.splitTextToSize(med.form || '–', cols[2].w - 6);
      doc.text(formText[0], cols[2].x + 3, y + 7.5);

      // Tageszeit-Slots – hervorgehobene Zellen
      var slots = ['morning', 'noon', 'evening', 'night'];
      var slotBgs = [
        [255, 248, 225],  // helles Gelb
        [227, 237, 255],  // helles Blau
        [237, 230, 255],  // helles Lila
        [219, 230, 255],  // helles Navy
      ];

      for (var si = 0; si < slots.length; si++) {
        var val = sched[slots[si]];
        var hasVal = val && val > 0;
        var colObj = cols[3 + si];

        // Zellenhintergrund
        if (hasVal) {
          doc.setFillColor(slotBgs[si][0], slotBgs[si][1], slotBgs[si][2]);
          doc.rect(colObj.x + 0.5, y + 0.5, colObj.w - 1, rowH - 1, 'F');
        }

        // Wert
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(hasVal ? 30 : 180, hasVal ? 41 : 190, hasVal ? 59 : 200);
        doc.text(hasVal ? String(val) : '–', colObj.x + colObj.w / 2, y + 8, { align: 'center' });

        // "Stk" Einheit
        if (hasVal) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(148, 163, 184);
          doc.text('Stk', colObj.x + colObj.w / 2, y + 11.5, { align: 'center' });
        }
      }

      // Hinweis
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      var noteText = doc.splitTextToSize(med.note || '', cols[7].w - 6);
      doc.text(noteText[0] || '', cols[7].x + 3, y + 7.5);

      y += rowH;
    }
  }

  // ── Zusammenfassung unter der Tabelle ──
  y += 6;
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.3);
  doc.line(m, y, mr, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('Anzahl Medikamente: ' + meds.length, m, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Einnahmezeiten: ☀ Morgens 06–10 Uhr   ⛅ Mittags 10–14 Uhr   🌆 Abends 17–22 Uhr   🌙 Nachts 22–06 Uhr', m + 80, y);

  // ── Unterschriftszeilen ──
  y += 12;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.2);
  doc.line(m, y, m + 80, y);
  doc.line(m + 110, y, m + 190, y);
  doc.line(m + 220, y, m + 280, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Datum', m, y + 4);
  doc.text('Unterschrift Arzt', m + 110, y + 4);
  doc.text('Unterschrift Patient', m + 220, y + 4);

  // ── Footer Disclaimer ──
  doc.setDrawColor(200, 210, 225);
  doc.line(m, H - 14, mr, H - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('WICHTIG: Dieser Medikamentenplan dient ausschließlich als Übersicht und Gedächtnisstütze. Er ersetzt weder die Packungsbeilage noch die ärztliche oder apothekerliche Beratung.', m, H - 10);
  doc.text('Änderungen der Medikation dürfen nur durch den behandelnden Arzt erfolgen.', m, H - 6);
  doc.text('Erstellt mit SymptoChron · ' + createdAt, mr, H - 6, { align: 'right' });
}

// ══════════════════════════════════════════════════
//  SEITEN 3+: CHRONOLOGISCHE VERLAUFSDATEN (Querformat)
// ══════════════════════════════════════════════════
function drawDataMatrixL(doc, store, dates, pName, pBirth, createdAt, W, H) {
  var lm = 15, rm = W - lm;

  drawMatrixHeaderL(doc, pName, pBirth, createdAt, lm, rm, W);

  var y = 28;

  // Spalten-Positionen
  var colX = {
    date:    lm + 2,
    sp_mo:   lm + 28,
    sp_mi:   lm + 44,
    sp_ab:   lm + 60,
    sp_na:   lm + 76,
    gap:     lm + 92,
    rl_mo:   lm + 98,
    rl_mi:   lm + 114,
    rl_ab:   lm + 130,
    rl_na:   lm + 146,
    schlaf:  lm + 168,
    qual:    lm + 188,
    notes:   lm + 206,
  };

  drawMatrixColHeadersL(doc, y, colX, lm, rm);
  y += 12;

  // Farbhelfer
  function getPainColor(val) {
    if (!val || isNaN(val) || val == 0) return { r: 180, g: 190, b: 200, bold: false };
    if (val <= 3) return { r: 46, g: 125, b: 50, bold: true };
    if (val <= 5) return { r: 217, g: 119, b: 6, bold: true };
    return { r: 185, g: 28, b: 28, bold: true };
  }

  function getRlsColor(val) {
    if (!val || isNaN(val) || val == 0) return { r: 180, g: 190, b: 200, bold: false };
    if (val <= 3) return { r: 124, g: 58, b: 237, bold: true };
    if (val <= 6) return { r: 109, g: 40, b: 217, bold: true };
    return { r: 91, g: 33, b: 182, bold: true };
  }

  dates.forEach(function(dateStr) {
    // Seitenumbruch
    if (y > H - 20) {
      doc.addPage('a4', 'l');
      y = 18;
      drawMatrixHeaderL(doc, pName, pBirth, createdAt, lm, rm, W);
      y = 28;
      drawMatrixColHeadersL(doc, y, colX, lm, rm);
      y += 12;
    }

    var data = store[dateStr] || {};

    // Alternating background
    var dateIdx = dates.indexOf(dateStr);
    if (dateIdx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(lm, y - 1, rm - lm, 9, 'F');
    }

    // Trennlinie
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.12);
    doc.line(lm, y + 8, rm, y + 8);

    // Datum
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(dateStr, colX.date, y + 5.5);

    // Schmerz-Werte
    var sTimes = ['morning_pain', 'noon_pain', 'evening_pain', 'night_pain'];
    var sXs = [colX.sp_mo, colX.sp_mi, colX.sp_ab, colX.sp_na];
    for (var pi = 0; pi < sTimes.length; pi++) {
      var pVal = data[sTimes[pi]];
      var pCfg = getPainColor(pVal);
      doc.setTextColor(pCfg.r, pCfg.g, pCfg.b);
      doc.setFont('helvetica', pCfg.bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.text(pVal !== undefined && pVal !== '' ? String(pVal) : '–', sXs[pi], y + 5.5);
    }

    // RLS-Werte
    var rTimes = ['morning_rls', 'noon_rls', 'evening_rls', 'night_rls'];
    var rXs = [colX.rl_mo, colX.rl_mi, colX.rl_ab, colX.rl_na];
    for (var ri = 0; ri < rTimes.length; ri++) {
      var rVal = data[rTimes[ri]];
      var rCfg = getRlsColor(rVal);
      doc.setTextColor(rCfg.r, rCfg.g, rCfg.b);
      doc.setFont('helvetica', rCfg.bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.text(rVal !== undefined && rVal !== '' ? String(rVal) : '–', rXs[ri], y + 5.5);
    }

    // Schlaf
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.text(data.sleepHours !== undefined ? data.sleepHours + ' h' : '–', colX.schlaf, y + 5.5);
    doc.text(data.sleepQuality !== undefined ? data.sleepQuality + '/5' : '–', colX.qual, y + 5.5);

    // Notizen + Auslöser
    var noteText = data.notes || '';
    var factorLabels = data.factors
      ? INFLUENCE_TAGS.filter(function(tag) { return data.factors[tag.key]; }).map(function(tag) { return tag.label.replace(/^[^\s]+\s/, ''); })
      : [];
    if (factorLabels.length > 0) {
      noteText += ' [Auslöser: ' + factorLabels.join(', ') + ']';
    }
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    var splitNote = doc.splitTextToSize(noteText || '', 85);
    doc.text(splitNote[0] || '', colX.notes, y + 5.5);

    y += 9;
  });

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Generiert mit SymptoChron · ' + createdAt, lm, H - 6);
}

function drawMatrixHeaderL(doc, pName, pBirth, createdAt, lm, rm, W) {
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SymptoChron – Chronologische Verlaufsmatrix', lm, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('Patient: ' + pName + '  |  Geb.: ' + pBirth + '  |  ' + createdAt, rm, 12, { align: 'right' });
}

function drawMatrixColHeadersL(doc, y, colX, lm, rm) {
  var hdrH = 12;

  // Schmerz-Sektion
  doc.setFillColor(255, 235, 235);
  doc.rect(colX.sp_mo - 3, y, colX.sp_na - colX.sp_mo + 18, hdrH, 'F');

  // RLS-Sektion
  doc.setFillColor(240, 235, 255);
  doc.rect(colX.rl_mo - 3, y, colX.rl_na - colX.rl_mo + 18, hdrH, 'F');

  // Rest
  doc.setFillColor(226, 232, 240);
  doc.rect(lm, y, colX.sp_mo - lm - 3, hdrH, 'F');    // Datum
  doc.rect(colX.schlaf - 3, y, rm - colX.schlaf + 3, hdrH, 'F');  // Schlaf + Notizen

  // Gesamtrahmen
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.25);
  doc.rect(lm, y, rm - lm, hdrH, 'D');

  // Spalten-Labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  doc.text('Datum', colX.date, y + 8);

  // SCHMERZ Überschrift
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(7.5);
  doc.text('SCHMERZ (0–10)', (colX.sp_mo + colX.sp_na) / 2, y + 3.5, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text('Mo', colX.sp_mo, y + 9);
  doc.text('Mi', colX.sp_mi, y + 9);
  doc.text('Ab', colX.sp_ab, y + 9);
  doc.text('Na', colX.sp_na, y + 9);

  // RLS Überschrift
  doc.setTextColor(109, 40, 217);
  doc.setFontSize(7.5);
  doc.text('RLS (0–10)', (colX.rl_mo + colX.rl_na) / 2, y + 3.5, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text('Mo', colX.rl_mo, y + 9);
  doc.text('Mi', colX.rl_mi, y + 9);
  doc.text('Ab', colX.rl_ab, y + 9);
  doc.text('Na', colX.rl_na, y + 9);

  // Schlaf & Notizen
  doc.text('Schlaf', colX.schlaf, y + 8);
  doc.text('Qual.', colX.qual, y + 8);
  doc.text('Notizen / Besonderheiten', colX.notes, y + 8);
}

// ── Import ───────────────────────────────────────
function importData(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();

  reader.onload = function(e) {
    var content = e.target.result;

    if (file.name.endsWith('.json')) {
      try {
        var data = JSON.parse(content);
        if (data.diary) {
          var store = getStore();
          Object.assign(store, data.diary);
          saveStore(store);
        }
        if (data.medications) {
          var mergedMeds = typeof mergeImportedMedications === 'function'
            ? mergeImportedMedications(getMeds(), data.medications, 'import')
            : getMeds().concat(data.medications);
          if (typeof saveMeds === 'function') saveMeds(mergedMeds);
        }
        if (data.settings) saveSettings(Object.assign(getSettings(), data.settings));
        if (data.patient && typeof data.patient === 'object') {
          if (typeof data.patient.name === 'string') localStorage.setItem('symptochron_patient_name', data.patient.name);
          if (typeof data.patient.bday === 'string') localStorage.setItem('symptochron_patient_bday', data.patient.bday);
          if (typeof loadPatientData === 'function') loadPatientData();
        }
        if (data.rlsDaily) {
          var rd = getRlsDaily();
          Object.assign(rd, data.rlsDaily);
          saveRlsDailyStore(rd);
        }
        if (data.rlsSurveys) {
          var rs = getRlsSurveys();
          Object.assign(rs, data.rlsSurveys);
          saveRlsSurveys(rs);
        }
        if (data.bloodPressure && typeof getBloodPressureEntries === 'function' && typeof saveBloodPressureEntries === 'function') {
          var bp = mergeBloodPressureEntries(getBloodPressureEntries(), data.bloodPressure);
          saveBloodPressureEntries(bp);
        }
        if (data.reminderSettings) {
          localStorage.setItem('painDiaryReminderSettings', JSON.stringify(data.reminderSettings));
          if (typeof scheduleDailyReminder === 'function') scheduleDailyReminder();
        }
        if (data.mood) {
          var moodStore = (typeof getMoodStore === 'function' ? getMoodStore() : {});
          localStorage.setItem('symptochron_mood', JSON.stringify(Object.assign(moodStore, data.mood)));
        }
        if (data.phq9) {
          var phq9Store = (typeof getPhq9Store === 'function' ? getPhq9Store() : JSON.parse(localStorage.getItem('symptochron_phq9') || '{}'));
          localStorage.setItem('symptochron_phq9', JSON.stringify(Object.assign(phq9Store, data.phq9)));
        }
        if (data.gad7) {
          var gad7Store = (typeof getGad7Store === 'function' ? getGad7Store() : JSON.parse(localStorage.getItem('symptochron_gad7') || '{}'));
          localStorage.setItem('symptochron_gad7', JSON.stringify(Object.assign(gad7Store, data.gad7)));
        }
        if (data.crisis) {
          localStorage.setItem('symptochron_crisis', JSON.stringify(data.crisis));
        }
        if (data.sos) {
          localStorage.setItem('symptochron_sos_data', JSON.stringify(data.sos));
        }
        buildWeekStrip();
        if (typeof renderMedList === 'function') renderMedList();
        if (typeof refreshDiary === 'function') refreshDiary();
        if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
        if (typeof initRlsTab === 'function') initRlsTab();
        if (typeof initMoodTab === 'function') initMoodTab();
        if (typeof loadSOSData === 'function') loadSOSData();
        showToast('✅ JSON importiert');
      } catch(ex) {
        showToast('❌ Ungültige JSON-Datei');
      }
      return;
    }

    // CSV import
    try {
      var lines = content.trim().split('\n');
      var header = lines[0].toLowerCase().replace(/\r/g,'').split(',');
      var store = getStore();
      var imported = 0;

      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].replace(/\r/g,'');
        if (!line.trim()) continue;
        var cols = parseCSVLine(line);

        var datum = cols[0] ? cols[0].trim() : '';
        if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;

        var entry = {};
        var mapping = {
          morgen_schmerz: 'morning_pain', morgen_rls:  'morning_rls',
          mittag_schmerz: 'noon_pain',    mittag_rls:  'noon_rls',
          abend_schmerz:  'evening_pain', abend_rls:   'evening_rls',
          nacht_schmerz:  'night_pain',   nacht_rls:   'night_rls',
        };

        header.forEach(function(h, idx) {
          var key = mapping[h.trim()];
          if (key && cols[idx] !== undefined && cols[idx].trim() !== '') {
            var v = parseInt(cols[idx]);
            if (!isNaN(v) && v >= 0 && v <= 10) entry[key] = v;
          }
          if (h.trim() === 'notizen' && cols[idx]) {
            entry.notes = cols[idx].replace(/^"|"$/g,'').replace(/""/g,'"').trim();
          }
          if (h.trim() === 'schlafdauer_stunden' && cols[idx] && cols[idx].trim()) {
            var sv = parseFloat(cols[idx]);
            if (!isNaN(sv)) entry.sleepHours = sv;
          }
          if (h.trim() === 'schlafqualitaet_1_5' && cols[idx] && cols[idx].trim()) {
            var qv = parseInt(cols[idx], 10);
            if (!isNaN(qv) && qv >= 1 && qv <= 5) entry.sleepQuality = qv;
          }
        });

        if (Object.keys(entry).length > 0) {
          store[datum] = Object.assign(store[datum] || {}, entry);
          imported++;
        }
      }

      saveStore(store);
      buildWeekStrip();
      if (typeof refreshDiary === 'function') refreshDiary();
      if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
      showToast('✅ ' + imported + ' Einträge importiert');
    } catch(err) {
      showToast('❌ Importfehler: ' + err.message);
    }

    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSVLine(line) {
  var result = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
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

  [
    'painDiary',
    'painDiaryMeds',
    'painDiarySettings',
    'painDiaryRlsDaily',
    'painDiaryRlsSurvey',
    'painDiaryBloodPressure',
    'painDiaryReminderSettings',
    'symptochron_patient_name',
    'symptochron_patient_bday',
    'symptochron_mood',
    'symptochron_phq9',
    'symptochron_gad7',
    'symptochron_crisis',
    'symptochron_sos_data',
    'symptochron_onboarded',
    'symptochron_prefs',
    'symptochron_theme',
    'symptochron_pin_hash'
  ].forEach(key => localStorage.removeItem(key));

  if (typeof scheduleDailyReminder === 'function') scheduleDailyReminder();
  if (typeof buildWeekStrip === 'function') buildWeekStrip();
  if (typeof loadCurrentEntry === 'function') loadCurrentEntry();
  if (typeof renderMedList === 'function') renderMedList();
  if (typeof loadPatientData === 'function') loadPatientData();
  if (typeof initRlsTab === 'function') initRlsTab();
  if (typeof refreshMoodTab === 'function') refreshMoodTab();
  if (typeof loadSOSData === 'function') loadSOSData();
  if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  showToast('🗑 Alle Daten gelöscht');
}
