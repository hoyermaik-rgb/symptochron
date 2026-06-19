// ── Export Tab Initialisierung ───────────────────
function initExportTab() {
  var lastExportStr = localStorage.getItem('symptochron_last_pdf_export');
  var spanText = document.getElementById('lastPrintDateSpan');
  var radioSinceLast = document.getElementById('radioSinceLast');
  var sinceLastDateSpan = document.getElementById('sinceLastDateSpan');
  var labelLastPrintRange = document.getElementById('labelLastPrintRange');

  if (lastExportStr) {
    var lastDate = new Date(lastExportStr);
    var dateFormatted = lastDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ', ' + lastDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    }) + ' Uhr';
    
    if (spanText) spanText.textContent = dateFormatted;
    
    var selectionDateFormatted = lastDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    if (sinceLastDateSpan) sinceLastDateSpan.textContent = selectionDateFormatted;
    
    if (radioSinceLast) radioSinceLast.disabled = false;
    if (labelLastPrintRange) {
      labelLastPrintRange.style.opacity = '1';
      labelLastPrintRange.style.cursor = 'pointer';
    }
  } else {
    if (spanText) spanText.textContent = 'Noch nie';
    if (sinceLastDateSpan) sinceLastDateSpan.textContent = '-';
    
    if (radioSinceLast) {
      radioSinceLast.disabled = true;
      radioSinceLast.checked = false;
    }
    if (labelLastPrintRange) {
      labelLastPrintRange.style.opacity = '0.5';
      labelLastPrintRange.style.cursor = 'not-allowed';
    }
    var selectedRadio = document.querySelector('input[name="exportRange"]:checked');
    if (selectedRadio && selectedRadio.value === 'sinceLast') {
      var allRadio = document.querySelector('input[name="exportRange"][value="all"]');
      if (allRadio) allRadio.checked = true;
    }
  }

  var startInput = document.getElementById('exportStartDate');
  var endInput = document.getElementById('exportEndDate');
  if (startInput && !startInput.value) {
    var diary = getStore() || {};
    var dates = Object.keys(diary).sort();
    if (dates.length > 0) {
      startInput.value = dates[0];
    } else {
      startInput.value = todayStr();
    }
  }
  if (endInput && !endInput.value) {
    endInput.value = todayStr();
  }

  toggleExportDateInputs();
}

function toggleExportDateInputs() {
  var customDiv = document.getElementById('customExportDates');
  var checkedVal = document.querySelector('input[name="exportRange"]:checked')?.value;
  if (customDiv) {
    customDiv.style.display = checkedVal === 'custom' ? 'grid' : 'none';
  }
}

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

  // Filter dates based on export settings
  var rangeType = document.querySelector('input[name="exportRange"]:checked')?.value || 'all';
  var filteredDates = [...dates];

  if (rangeType === 'sinceLast') {
    var lastExportStr = localStorage.getItem('symptochron_last_pdf_export');
    if (lastExportStr) {
      var lastDate = new Date(lastExportStr);
      var lastDateStr = lastDate.getFullYear() + '-' + 
                        String(lastDate.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(lastDate.getDate()).padStart(2, '0');
      filteredDates = dates.filter(function(d) { return d >= lastDateStr; });
    }
  } else if (rangeType === 'custom') {
    var startStr = document.getElementById('exportStartDate')?.value;
    var endStr = document.getElementById('exportEndDate')?.value;
    if (startStr) {
      filteredDates = filteredDates.filter(function(d) { return d >= startStr; });
    }
    if (endStr) {
      filteredDates = filteredDates.filter(function(d) { return d <= endStr; });
    }
  }

  if (dates.length > 0 && filteredDates.length === 0) {
    showToast('⚠️ Keine Einträge im ausgewählten Zeitraum vorhanden.');
    return null;
  }

  // Pflichtfeld-Prüfung: Schmerz-Körperkarte mindestens einmal in der Historie ausgefüllt
  var hasAnyBodyMap = Object.keys(store).some(function(d) {
    var e = store[d] || {};
    return e.painAreas && e.painAreas.length > 0;
  });

  if (dates.length > 0 && !hasAnyBodyMap) {
    showToast('⚠️ PDF gesperrt: Fülle die Körperkarte mindestens einmal aus!');
    alert('Hinweis für den PDF-Export:\n\nBitte fülle die Schmerzkörperkarte (Schritt 1b im Tagebuch) für mindestens einen Tag aus, bevor du den Report erstellst. Sie ist ein obligatorischer Teil des ärztlichen Fragebogens.');
    return null;
  }

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
  drawCoverPageL(doc, pName, pBirth, createdAt, filteredDates, store, meds, W, H);

  // ====== SEITE 2: SCHMERZVERLAUF (Grafik) ======
  if (filteredDates.length > 0) {
    drawTrendChartPageL(doc, filteredDates, store, pName, pBirth, createdAt, W, H);
  }

  // ====== SEITE 3: PSYCHOLOGISCHE VERLAUFSKONTROLLE ======
  var phqStore = typeof getPhq9Store === 'function' ? getPhq9Store() : (JSON.parse(localStorage.getItem('symptochron_phq9') || '{}'));
  var gadStore = typeof getGad7Store === 'function' ? getGad7Store() : (JSON.parse(localStorage.getItem('symptochron_gad7') || '{}'));
  var hasPhqData = Object.keys(phqStore).length > 0;
  var hasGadData = Object.keys(gadStore).length > 0;
  if (hasPhqData || hasGadData) {
    drawMoodEvaluationPageL(doc, phqStore, gadStore, pName, pBirth, createdAt, W, H);
  }

  // ====== SEITE 4: MEDIKAMENTENPLAN ======
  drawMedikamentenplanL(doc, meds, pName, pBirth, createdAt, W, H);

  // ====== SEITEN 4+: VERLAUFSDATEN ======
  if (filteredDates.length > 0) {
    doc.addPage('a4', 'l');
    drawDataMatrixL(doc, store, filteredDates, pName, pBirth, createdAt, W, H);
  }

  return doc;
}

function downloadPdfDocument(doc) {
  try {
    var filename = 'symptochron_bericht_' + todayStr() + '.pdf';
    var blob = doc.output('blob');

    // Save last print date
    localStorage.setItem('symptochron_last_pdf_export', new Date().toISOString());
    if (typeof initExportTab === 'function') initExportTab();

    // Check if Web Share API is available and can share files
    if (navigator.share && navigator.canShare) {
      var file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'SymptoChron Verlaufbericht',
          text: 'Hier ist mein aktueller medizinischer Verlaufsbericht von SymptoChron.'
        }).then(function() {
          showToast('✅ PDF-Bericht geteilt!');
        }).catch(function(err) {
          if (err.name === 'AbortError') {
            console.log('Teilen vom Nutzer abgebrochen.');
            return;
          }
          console.error('Teilen fehlgeschlagen, lade herunter:', err);
          fallbackDownload(blob, filename);
        });
        return;
      }
    }

    // Fallback: Normaler Download
    fallbackDownload(blob, filename);
  } catch(e) {
    try {
      doc.output('dataurlnewwindow');
    } catch(err) {
      showToast('❌ PDF-Erstellung fehlgeschlagen');
    }
  }
}

function fallbackDownload(blob, filename) {
  var blobUrl = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
  showToast('✅ PDF-Bericht heruntergeladen!');
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
  
  // Passe Button-Text dynamisch an Web Share Fähigkeiten an
  var btn = document.getElementById('btnDownloadOrShare');
  if (btn) {
    if (navigator.share && navigator.canShare) {
      var testFile = new File([new Blob(['test'], {type: 'application/pdf'})], 'test.pdf', {type: 'application/pdf'});
      if (navigator.canShare({ files: [testFile] })) {
        btn.innerHTML = '📤 Report teilen / senden';
      } else {
        btn.innerHTML = '⬇️ Herunterladen';
      }
    } else {
      btn.innerHTML = '⬇️ Herunterladen';
    }
  }

  // Fallback: ohne Modal (oder auf kleinen Geräten ohne PDF-Viewer) direkt teilen/herunterladen
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

  var phqStore = typeof getPhq9Store === 'function' ? getPhq9Store() : (JSON.parse(localStorage.getItem('symptochron_phq9') || '{}'));
  var gadStore = typeof getGad7Store === 'function' ? getGad7Store() : (JSON.parse(localStorage.getItem('symptochron_gad7') || '{}'));
  var hasMoodData = Object.keys(phqStore).length > 0 || Object.keys(gadStore).length > 0;

  var pageNum = 1;
  var sections = [
    { page: 'S. ' + pageNum, title: 'Deckblatt', desc: 'Patientendaten & Übersicht' }
  ];

  if (dates.length > 0) {
    pageNum++;
    sections.push({ page: 'S. ' + pageNum, title: 'Schmerzverlauf', desc: 'Grafische Auswertung' });
  }

  if (hasMoodData) {
    pageNum++;
    sections.push({ page: 'S. ' + pageNum, title: 'Verlaufskontrolle', desc: 'PHQ-9 & GAD-7 Status' });
  }

  pageNum++;
  sections.push({ page: 'S. ' + pageNum, title: 'Medikamentenplan', desc: 'Tabelle der Medikation' });

  if (dates.length > 0) {
    sections.push({ page: 'S. ' + (pageNum + 1) + '+', title: 'Chronol. Verlauf', desc: 'Tageszeitliche Messwerte' });
  }

  var numSec = sections.length;
  var boxW, boxGap;
  if (numSec === 5) {
    boxW = 49;
    boxGap = 52.5;
  } else if (numSec === 4) {
    boxW = 62;
    boxGap = 66;
  } else if (numSec === 3) {
    boxW = 83;
    boxGap = 88;
  } else {
    boxW = 125;
    boxGap = 132;
  }

  sections.forEach(function(s, idx) {
    var sx = m + (idx * boxGap);
    // Box
    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(sx, y, boxW, 24, 2, 2, 'FD');

    // Page badge
    doc.setFillColor(59, 158, 255);
    doc.roundedRect(sx + 3, y + 3, 14, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(s.page, sx + 10, y + 8.5, { align: 'center' });

    // Title
    doc.setTextColor(10, 22, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(numSec >= 4 ? 7.5 : 9);
    doc.text(s.title, sx + 19, y + 8.5);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(numSec >= 4 ? 6.5 : 7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.desc, sx + 4, y + 18);
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

function drawTrendChartPageL(doc, dates, store, pName, pBirth, createdAt, W, H) {
  doc.addPage('a4', 'l');

  var m = 15, mr = W - m;
  var contentW = mr - m;

  // ── Header Banner ──
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 22, 'F');

  // Blauer Akzent
  doc.setFillColor(59, 158, 255);
  doc.rect(0, 22, W, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('SCHMERZVERLAUF (TREND)', m, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('SymptoChron – Generiert am ' + createdAt, mr, 9, { align: 'right' });

  // ── Patient Info Header ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Patient: ' + pName + '  ·  Geburtsdatum: ' + pBirth, m, 28);

  // ── Chart Area Layout (Schmaler für Körperkarte daneben) ──
  var chartX = 22;
  var chartY = 46;
  var chartW = 180; // Schmaler für die Schmerzkörperkarte auf der rechten Seite (214 - 274 mm)
  var chartH = 110;
  var chartBottom = chartY + chartH;

  // ── Draw Threshold Bands (Farbbänder) ──
  var hUnit = chartH / 10;
  
  // Green (0 to 3.5)
  doc.setFillColor(240, 253, 244);
  doc.rect(chartX, chartBottom - 3.5 * hUnit, chartW, 3.5 * hUnit, 'F');
  
  // Orange (3.5 to 5.5)
  doc.setFillColor(255, 251, 235);
  doc.rect(chartX, chartBottom - 5.5 * hUnit, chartW, 2.0 * hUnit, 'F');
  
  // Red (5.5 to 10)
  doc.setFillColor(254, 242, 242);
  doc.rect(chartX, chartBottom - 10 * hUnit, chartW, 4.5 * hUnit, 'F');

  // ── Draw Gridlines & Y-Axis Labels ──
  doc.setLineWidth(0.15);
  for (var val = 0; val <= 10; val++) {
    var gy = chartBottom - val * hUnit;
    
    // Draw line
    if (val === 0 || val === 10) {
      doc.setDrawColor(148, 163, 184);
    } else {
      doc.setDrawColor(226, 232, 240);
    }
    doc.line(chartX, gy, chartX + chartW, gy);

    // Label on the left
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(val), chartX - 3, gy + 2.5, { align: 'right' });
    
    // Threshold Zone labels
    if (val === 2) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 125, 50);
      doc.text('Leicht', chartX + chartW + 3, gy + 1, { align: 'left' });
    } else if (val === 5) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text('Mittel', chartX + chartW + 3, gy + 1, { align: 'left' });
    } else if (val === 8) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('Stark', chartX + chartW + 3, gy + 1, { align: 'left' });
    }
  }

  // Draw vertical axis borders
  doc.setDrawColor(148, 163, 184);
  doc.line(chartX, chartY, chartX, chartBottom);
  doc.line(chartX + chartW, chartY, chartX + chartW, chartBottom);

  // ── Process Data Points ──
  var xCoords = [];
  var yCoords = [];
  var areaCounts = {};
  
  if (dates.length > 0) {
    var stepX = dates.length > 1 ? chartW / (dates.length - 1) : chartW;
    
    for (var i = 0; i < dates.length; i++) {
      var dateStr = dates[i];
      var e = store[dateStr] || {};
      
      // Calculate max pain
      var maxPain = 0;
      var vals = [e.morning_pain, e.noon_pain, e.evening_pain, e.night_pain].map(Number).filter(function(v) { return !isNaN(v) && v >= 0; });
      if (vals.length > 0) {
        maxPain = Math.max.apply(null, vals);
      }
      
      var px = chartX + (dates.length > 1 ? i * stepX : chartW / 2);
      var py = chartBottom - maxPain * hUnit;
      
      xCoords.push(px);
      yCoords.push(py);

      // Accumulate pain areas
      var areas = e.painAreas || [];
      areas.forEach(function(area) {
        areaCounts[area] = (areaCounts[area] || 0) + 1;
      });

      // Weather & Pressure Labels above data points
      var wText = '';
      var wColor = [100, 116, 139];
      if (e.weather === 'sun') { wText = 'S'; wColor = [217, 119, 6]; }       // Orange
      else if (e.weather === 'cloud') { wText = 'W'; wColor = [100, 116, 139]; } // Grey
      else if (e.weather === 'rain') { wText = 'R'; wColor = [59, 130, 246]; }   // Blue
      else if (e.weather === 'storm') { wText = 'G'; wColor = [185, 28, 28]; }   // Red

      var pText = '';
      var pColor = [100, 116, 139];
      if (e.pressure === 'high') { pText = '+'; pColor = [34, 197, 94]; }       // Green
      else if (e.pressure === 'low') { pText = '-'; pColor = [239, 68, 68]; }    // Red

      // Draw weather text
      if (wText) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(wColor[0], wColor[1], wColor[2]);
        doc.text(wText, px, py - 6.5, { align: 'center' });
      }

      // Draw pressure text
      if (pText) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(pColor[0], pColor[1], pColor[2]);
        doc.text(pText, px, py - 3.5, { align: 'center' });
      }
    }

    // ── Draw Filled Area Under Curve using Trapezoids ──
    if (dates.length > 1) {
      doc.setFillColor(215, 230, 250);
      for (var i = 0; i < xCoords.length - 1; i++) {
        var x1 = xCoords[i];
        var y1 = yCoords[i];
        var x2 = xCoords[i+1];
        var y2 = yCoords[i+1];
        
        var yTop = Math.max(y1, y2);
        var rectH = chartBottom - yTop;
        var rectW = x2 - x1;
        doc.rect(x1, yTop, rectW, rectH, 'F');
        
        if (y1 !== y2) {
          if (y1 < y2) {
            doc.triangle(x1, y1, x2, yTop, x1, yTop, 'F');
          } else {
            doc.triangle(x2, y2, x1, yTop, x2, yTop, 'F');
          }
        }
      }
    }

    // ── Draw Trend Line ──
    doc.setDrawColor(59, 158, 255);
    doc.setLineWidth(0.8);
    for (var i = 0; i < xCoords.length - 1; i++) {
      doc.line(xCoords[i], yCoords[i], xCoords[i+1], yCoords[i+1]);
    }

    // ── Draw Data Dots ──
    doc.setFillColor(59, 158, 255);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    for (var i = 0; i < xCoords.length; i++) {
      doc.circle(xCoords[i], yCoords[i], 1.2, 'FD');
    }

    // ── Draw Therapy Milestones (Ereignis-Marker) ──
    var milestones = [];
    try {
      milestones = JSON.parse(localStorage.getItem('symptochron_milestones') || '[]');
    } catch (e) {}

    if (milestones.length > 0 && dates.length > 1) {
      var stepX = chartW / (dates.length - 1);
      milestones.forEach(function(m) {
        var mDate = m.date;
        if (mDate >= dates[0] && mDate <= dates[dates.length - 1]) {
          var mIndex = -1;
          for (var j = 0; j < dates.length; j++) {
            if (dates[j] === mDate) {
              mIndex = j;
              break;
            }
          }

          if (mIndex === -1) {
            for (var j = 0; j < dates.length - 1; j++) {
              if (mDate > dates[j] && mDate < dates[j+1]) {
                var t1 = new Date(dates[j]).getTime();
                var t2 = new Date(dates[j+1]).getTime();
                var tm = new Date(mDate).getTime();
                if (t2 > t1) {
                  mIndex = j + (tm - t1) / (t2 - t1);
                }
                break;
              }
            }
          }

          if (mIndex >= 0 && mIndex <= dates.length - 1) {
            var px = chartX + mIndex * stepX;

            // Draw vertical dashed line
            doc.setDrawColor(239, 68, 68); // Red-orange marker
            doc.setLineWidth(0.35);
            
            var dashLength = 2.5;
            var gapLength = 1.5;
            var currY = chartY;
            while (currY < chartBottom) {
              var nextY = Math.min(currY + dashLength, chartBottom);
              doc.line(px, currY, px, nextY);
              currY = nextY + gapLength;
            }

            // Draw flag marker at the top of the line
            doc.setFillColor(239, 68, 68);
            doc.circle(px, chartY, 1.2, 'F');

            // Draw milestone description vertically
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(185, 28, 28); // Darker red for readability
            doc.text(m.desc, px + 2.2, chartBottom - 4, { angle: 270 });
          }
        }
      });
    }

    // ── Draw Date X-Axis Labels ──
    var maxLabels = 10;
    var labelStep = Math.ceil(dates.length / maxLabels);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    
    for (var i = 0; i < dates.length; i++) {
      if (i % labelStep === 0 || i === dates.length - 1) {
        var dateParts = dates[i].split('-');
        var dayStr = dateParts[2] + '.' + dateParts[1] + '.';
        
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.15);
        doc.line(xCoords[i], chartBottom, xCoords[i], chartBottom + 2);
        
        doc.text(dayStr, xCoords[i], chartBottom + 6, { align: 'center' });
      }
    }
  } else {
    // Empty state
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(148, 163, 184);
    doc.text('Keine Daten für das Diagramm vorhanden.', chartX + chartW / 2, chartY + chartH / 2, { align: 'center' });
  }

  // ── DRAW SCHMERZLOKALISATION (BODY HEATMAP) ON THE RIGHT ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(10, 22, 40);
  doc.text('SCHMERZLOKALISATION', 214, 40);

  // Find max count for gradient scaling
  var maxC = 1;
  for (var key in areaCounts) {
    if (areaCounts[key] > maxC) maxC = areaCounts[key];
  }

  var s = 0.28; // scale
  var oxFront = 214;
  var oxBack = 246;
  var oySil = 44;

  // Local helper to draw a silhouette
  function drawSilhouette(ox, oy, isFront) {
    var parts = [];
    if (isFront) {
      parts = [
        { key: 'front-head', type: 'circle', cx: 50, cy: 15, r: 10 },
        { key: 'front-neck', type: 'rect', x: 46, y: 25, w: 8, h: 6, rx: 1 },
        { key: 'front-shoulder-l', type: 'rect', x: 22, y: 32, w: 9, h: 10, rx: 3 },
        { key: 'front-shoulder-r', type: 'rect', x: 69, y: 32, w: 9, h: 10, rx: 3 },
        { key: 'front-chest', type: 'rect', x: 32, y: 32, w: 36, h: 24, rx: 2 },
        { key: 'front-abdomen', type: 'rect', x: 34, y: 57, w: 32, h: 20, rx: 2 },
        { key: 'front-arm-l', type: 'rect', x: 19, y: 43, w: 10, h: 34, rx: 4 },
        { key: 'front-arm-r', type: 'rect', x: 71, y: 43, w: 10, h: 34, rx: 4 },
        { key: 'front-hand-l', type: 'rect', x: 18, y: 78, w: 12, h: 10, rx: 3 },
        { key: 'front-hand-r', type: 'rect', x: 70, y: 78, w: 12, h: 10, rx: 3 },
        { key: 'front-hip-l', type: 'rect', x: 34, y: 78, w: 15, h: 12, rx: 2 },
        { key: 'front-hip-r', type: 'rect', x: 51, y: 78, w: 15, h: 12, rx: 2 },
        { key: 'front-leg-l', type: 'rect', x: 34, y: 91, w: 13, h: 50, rx: 4 },
        { key: 'front-leg-r', type: 'rect', x: 53, y: 91, w: 13, h: 50, rx: 4 },
        { key: 'front-foot-l', type: 'rect', x: 31, y: 142, w: 16, h: 8, rx: 2 },
        { key: 'front-foot-r', type: 'rect', x: 53, y: 142, w: 16, h: 8, rx: 2 }
      ];
    } else {
      parts = [
        { key: 'back-head', type: 'circle', cx: 50, cy: 15, r: 10 },
        { key: 'back-neck', type: 'rect', x: 46, y: 25, w: 8, h: 6, rx: 1 },
        { key: 'back-shoulder-l', type: 'rect', x: 22, y: 32, w: 9, h: 10, rx: 3 },
        { key: 'back-shoulder-r', type: 'rect', x: 69, y: 32, w: 9, h: 10, rx: 3 },
        { key: 'back-upper', type: 'rect', x: 32, y: 32, w: 36, h: 24, rx: 2 },
        { key: 'back-lower', type: 'rect', x: 34, y: 57, w: 32, h: 20, rx: 2 },
        { key: 'back-arm-l', type: 'rect', x: 19, y: 43, w: 10, h: 34, rx: 4 },
        { key: 'back-arm-r', type: 'rect', x: 71, y: 43, w: 10, h: 34, rx: 4 },
        { key: 'back-hand-l', type: 'rect', x: 18, y: 78, w: 12, h: 10, rx: 3 },
        { key: 'back-hand-r', type: 'rect', x: 70, y: 78, w: 12, h: 10, rx: 3 },
        { key: 'back-glute', type: 'rect', x: 34, y: 78, w: 32, h: 12, rx: 3 },
        { key: 'back-leg-l', type: 'rect', x: 34, y: 91, w: 13, h: 50, rx: 4 },
        { key: 'back-leg-r', type: 'rect', x: 53, y: 91, w: 13, h: 50, rx: 4 },
        { key: 'back-foot-l', type: 'rect', x: 31, y: 142, w: 16, h: 8, rx: 2 },
        { key: 'back-foot-r', type: 'rect', x: 53, y: 142, w: 16, h: 8, rx: 2 }
      ];
    }

    doc.setLineWidth(0.12);
    doc.setDrawColor(180, 190, 205);

    parts.forEach(function(p) {
      var count = areaCounts[p.key] || 0;
      var r = 241, g = 245, b = 249; // default slate-50 fill

      if (count > 0) {
        var intensity = count / maxC;
        r = 255;
        g = Math.round(220 - intensity * 170);
        b = Math.round(220 - intensity * 170);
      }

      doc.setFillColor(r, g, b);

      if (p.type === 'circle') {
        doc.circle(ox + p.cx * s, oy + p.cy * s, p.r * s, 'FD');
      } else {
        doc.roundedRect(ox + p.x * s, oy + p.y * s, p.w * s, p.h * s, (p.rx || 0) * s, (p.rx || 0) * s, 'FD');
      }
    });
  }

  // Draw silhouettes
  drawSilhouette(oxFront, oySil, true);
  drawSilhouette(oxBack, oySil, false);

  // Labels below silhouettes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Vorderseite', oxFront + 50 * s, oySil + 164 * s, { align: 'center' });
  doc.text('Rückseite', oxBack + 50 * s, oySil + 164 * s, { align: 'center' });

  // Compile AREA LABELS mapping
  var AREA_LABELS = {
    'front-head': 'Kopf (vorne)',
    'front-neck': 'Hals/Nacken',
    'front-shoulder-l': 'Schulter (L)',
    'front-shoulder-r': 'Schulter (R)',
    'front-chest': 'Brust',
    'front-abdomen': 'Bauch',
    'front-arm-l': 'Arm (L, vorne)',
    'front-arm-r': 'Arm (R, vorne)',
    'front-hand-l': 'Hand (L, vorne)',
    'front-hand-r': 'Hand (R, vorne)',
    'front-hip-l': 'Hüfte (L)',
    'front-hip-r': 'Hüfte (R)',
    'front-leg-l': 'Bein (L, vorne)',
    'front-leg-r': 'Bein (R, vorne)',
    'front-foot-l': 'Fuß (L, vorne)',
    'front-foot-r': 'Fuß (R, vorne)',
    'back-head': 'Hinterkopf',
    'back-neck': 'Nacken (hinten)',
    'back-shoulder-l': 'Schulter (L, hinten)',
    'back-shoulder-r': 'Schulter (R, hinten)',
    'back-upper': 'Oberer Rücken',
    'back-lower': 'Unterer Rücken',
    'back-arm-l': 'Arm (L, hinten)',
    'back-arm-r': 'Arm (R, hinten)',
    'back-hand-l': 'Hand (L, hinten)',
    'back-hand-r': 'Hand (R, hinten)',
    'back-glute': 'Gesäß',
    'back-leg-l': 'Bein (L, hinten)',
    'back-leg-r': 'Bein (R, hinten)',
    'back-foot-l': 'Fuß (L, hinten)',
    'back-foot-r': 'Fuß (R, hinten)'
  };

  // Sort areas by frequency
  var sortedAreas = [];
  for (var area in areaCounts) {
    if (areaCounts[area] > 0) {
      sortedAreas.push({ area: area, count: areaCounts[area] });
    }
  }
  sortedAreas.sort(function(a, b) { return b.count - a.count; });

  // Print top 5 pain areas
  var listY = 96;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Häufigste Schmerzbereiche:', 214, listY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  var ly = listY + 7;
  var maxList = Math.min(5, sortedAreas.length);
  if (maxList === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text('Keine Schmerzbereiche gewählt.', 214, ly);
  } else {
    for (var i = 0; i < maxList; i++) {
      var entry = sortedAreas[i];
      var label = AREA_LABELS[entry.area] || entry.area;
      doc.text((i + 1) + '. ' + label + ' (' + entry.count + 'x)', 214, ly);
      ly += 5.5;
    }
  }

  // ── Footer ──
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.2);
  doc.line(m, H - 14, mr, H - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Die Grafik stellt die maximale tägliche Schmerzstärke (Skala 0–10) im gewählten Zeitraum dar.', m, H - 9);
  doc.text('Wetter-Legende: S = Sonne, W = Wolken, R = Regen, G = Gewitter | Luftdruck: + = Hoch, - = Tief', m, H - 5.5);
  doc.text('Generiert am ' + createdAt, mr, H - 6, { align: 'right' });
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

  // ── Dynamische Layout-Parameter ──
  var bannerH = 22;
  var infoY = 28;
  var infoH = 16;
  var tableStartY = 48;
  var hdrH = 12;
  var summaryGap = 6;
  var sigGap = 12;
  var maxRowsHeight = 105;

  if (meds.length > 8) {
    // Kompakteres Layout bei vielen Medikamenten
    bannerH = 18;
    infoY = 23;
    infoH = 12;
    tableStartY = 40;
    hdrH = 9;
    summaryGap = 4;
    sigGap = 8;
    maxRowsHeight = 125;
  }

  // ── Header Banner ──
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, bannerH, 'F');

  // Roter Akzent (wie offizieller Medikamentenplan)
  doc.setFillColor(220, 38, 38);
  doc.rect(0, bannerH, W, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(bannerH === 18 ? 16 : 20);
  doc.text('MEDIKAMENTENPLAN', m, bannerH === 18 ? 12.5 : 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('SymptoChron – Generiert am ' + createdAt, mr, bannerH === 18 ? 7.5 : 9, { align: 'right' });

  y = infoY;

  // ── Patient Info Box ──
  doc.setFillColor(242, 245, 250);
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(m, y, contentW, infoH, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(infoH === 12 ? 6 : 7);
  doc.setTextColor(100, 116, 139);
  doc.text('Name, Vorname', m + 4, y + (infoH === 12 ? 3.5 : 5));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(infoH === 12 ? 8.5 : 10);
  doc.setTextColor(30, 41, 59);
  doc.text(pName, m + 4, y + (infoH === 12 ? 9 : 12));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(infoH === 12 ? 6 : 7);
  doc.setTextColor(100, 116, 139);
  doc.text('Geburtsdatum', m + 120, y + (infoH === 12 ? 3.5 : 5));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(infoH === 12 ? 8.5 : 10);
  doc.setTextColor(30, 41, 59);
  doc.text(pBirth, m + 120, y + (infoH === 12 ? 9 : 12));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(infoH === 12 ? 6 : 7);
  doc.setTextColor(100, 116, 139);
  doc.text('Datum', m + 200, y + (infoH === 12 ? 3.5 : 5));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(infoH === 12 ? 8.5 : 10);
  doc.setTextColor(30, 41, 59);
  doc.text(createdAt, m + 200, y + (infoH === 12 ? 9 : 12));

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

  y = tableStartY;

  // ── Tabellen-Kopf ──
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
    doc.setFontSize(hdrH === 9 ? 7.5 : 8.5);
    doc.setTextColor(c.bg ? 255 : 30, c.bg ? 255 : 41, c.bg ? 255 : 59);
    
    // Text vertikal mittig
    var hdrTextY = y + (hdrH + (hdrH === 9 ? 7.5 : 8.5) * 0.35) / 2;
    doc.text(c.label, c.x + c.w / 2, hdrTextY, { align: 'center' });
  }

  // Tageszeit-Icons im Tabellenkopf
  var icons = [null, null, null, '☀', '⛅', '🌆', '🌙', null];
  for (var ii = 0; ii < cols.length; ii++) {
    if (icons[ii]) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(hdrH === 9 ? 7 : 8);
      doc.text(icons[ii], cols[ii].x + 2, y + (hdrH === 9 ? 3.0 : 3.5));
    }
  }

  y += hdrH;

  // ── Dynamische Skalierung für Tabellenzeilen ──
  var rowH = 12;
  var fontSize = 8.5;
  var nameFontSize = 9;
  var valFontSize = 11;
  var stkFontSize = 6;
  var noteFontSize = 8;
  var drawStk = true;

  if (meds.length > 0) {
    var neededHeight = meds.length * 12;
    if (neededHeight > maxRowsHeight) {
      rowH = maxRowsHeight / meds.length;
      if (rowH < 5.5) rowH = 5.5; // absolute Untergrenze

      var scale = rowH / 12;
      fontSize = Math.max(5.5, 8.5 * scale);
      nameFontSize = Math.max(6.0, 9 * scale);
      valFontSize = Math.max(7.5, 11 * scale);
      stkFontSize = Math.max(4.0, 6 * scale);
      noteFontSize = Math.max(5.5, 8 * scale);

      if (rowH < 8.5) {
        drawStk = false;
      }
    }
  }

  // ── Daten-Zeilen ──
  if (meds.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(m, y, contentW, 18, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text('Keine Medikamente hinterlegt.', m + contentW / 2, y + 10, { align: 'center' });
    y += 18;
  } else {
    for (var mi = 0; mi < meds.length; mi++) {
      var med = meds[mi];
      var sched = med.schedule || {};

      // Alternierender Hintergrund
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

      // Proportionale vertikale Ausrichtung
      var textY = y + rowH * 0.625;
      var nameY = y + rowH * 0.625;
      var noteY = y + rowH * 0.625;

      // Medikamentenname
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(nameFontSize);
      doc.setTextColor(30, 41, 59);
      var nameText = doc.splitTextToSize(med.name || '–', cols[0].w - 5);
      doc.text(nameText[0], cols[0].x + 2.5, nameY);

      // Dosis
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(51, 65, 85);
      var doseText = doc.splitTextToSize(med.dose || '–', cols[1].w - 5);
      doc.text(doseText[0], cols[1].x + 2.5, textY);

      // Darreichungsform
      var formText = doc.splitTextToSize(med.form || '–', cols[2].w - 5);
      doc.text(formText[0], cols[2].x + 2.5, textY);

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
        doc.setFontSize(valFontSize);
        doc.setTextColor(hasVal ? 30 : 180, hasVal ? 41 : 190, hasVal ? 59 : 200);

        if (drawStk) {
          var valY = y + rowH * 0.667;
          doc.text(hasVal ? String(val) : '–', colObj.x + colObj.w / 2, valY, { align: 'center' });

          if (hasVal) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(stkFontSize);
            doc.setTextColor(148, 163, 184);
            var stkY = y + rowH * 0.958;
            doc.text('Stk', colObj.x + colObj.w / 2, stkY, { align: 'center' });
          }
        } else {
          // Nur der Wert zentriert
          var valY = y + (rowH + valFontSize * 0.35) / 2;
          doc.text(hasVal ? String(val) : '–', colObj.x + colObj.w / 2, valY, { align: 'center' });
        }
      }

      // Hinweis
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(noteFontSize);
      doc.setTextColor(100, 116, 139);
      var noteText = doc.splitTextToSize(med.note || '', cols[7].w - 5);
      doc.text(noteText[0] || '', cols[7].x + 2.5, noteY);

      y += rowH;
    }
  }

  // ── Zusammenfassung unter der Tabelle ──
  y += summaryGap;
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
  y += sigGap;
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

  // Spalten-Positionen (Wetter-Spalte hinzugefügt)
  var colX = {
    date:    lm + 2,
    sp_mo:   lm + 28,
    sp_mi:   lm + 43,
    sp_ab:   lm + 58,
    sp_na:   lm + 73,
    gap:     lm + 88,
    rl_mo:   lm + 93,
    rl_mi:   lm + 108,
    rl_ab:   lm + 123,
    rl_na:   lm + 138,
    schlaf:  lm + 158,
    qual:    lm + 178,
    wetter:  lm + 196,
    notes:   lm + 218,
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

    // Wetter & Luftdruck
    var wLabel = '–';
    var wMap = { 'sun': 'Sonne', 'cloud': 'Wolken', 'rain': 'Regen', 'storm': 'Gewitter' };
    var pMap = { 'high': '(+)', 'normal': '(o)', 'low': '(-)' };
    if (data.weather || data.pressure) {
      var wStr = wMap[data.weather] || '–';
      var pStr = pMap[data.pressure] || '';
      wLabel = wStr + ' ' + pStr;
      wLabel = wLabel.trim();
    }
    doc.text(wLabel, colX.wetter, y + 5.5);

    // Notizen + Auslöser + Bedarfsmedikation
    var noteParts = [];
    var medsList = typeof getMeds === 'function' ? getMeds() : [];
    var prnEntries = [];
    medsList.forEach(function(m) {
      var sched = m.schedule || {};
      var hasSchedule = (sched.morning > 0 || sched.noon > 0 || sched.evening > 0 || sched.night > 0);
      if (!hasSchedule) {
        var takenTimes = data.medsTakenTimes && data.medsTakenTimes[m.id];
        if (takenTimes) {
          prnEntries.push(m.name + ' (' + takenTimes + ')');
        } else if (data.medsTaken && data.medsTaken.includes(m.id)) {
          prnEntries.push(m.name);
        }
      }
    });

    if (prnEntries.length > 0) {
      noteParts.push('Bedarf: ' + prnEntries.join(', '));
    }

    var factorLabels = data.factors
      ? INFLUENCE_TAGS.filter(function(tag) { return data.factors[tag.key]; }).map(function(tag) { return tag.label.replace(/^[^\s]+\s/, ''); })
      : [];
    if (factorLabels.length > 0) {
      noteParts.push('Auslöser: ' + factorLabels.join(', '));
    }

    if (data.notes) {
      noteParts.push(data.notes);
    }

    var noteText = noteParts.join(' | ');

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    var splitNote = doc.splitTextToSize(noteText || '', rm - colX.notes - 2);
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
  doc.rect(colX.schlaf - 3, y, rm - colX.schlaf + 3, hdrH, 'F');  // Schlaf + Wetter + Notizen

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

  // Schlaf & Wetter & Notizen
  doc.text('Schlaf', colX.schlaf, y + 8);
  doc.text('Qual.', colX.qual, y + 8);
  doc.text('Wetter / Druck', colX.wetter, y + 8);
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
  if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  showToast('🗑 Alle Daten gelöscht');
}

// ── PDF Page: Psychologische Verlaufskontrolle (PHQ-9 & GAD-7) ──
function drawMoodEvaluationPageL(doc, phqStore, gadStore, pName, pBirth, createdAt, W, H) {
  doc.addPage('a4', 'l');
  var m = 15, mr = W - m;
  var contentW = mr - m;

  // ── Header Banner ──
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 22, 'F');

  // Purple Accent Line (violett/purple)
  doc.setFillColor(167, 139, 250);
  doc.rect(0, 22, W, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PSYCHOLOGISCHE VERLAUFSKONTROLLE: PHQ-9 & GAD-7', m, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('SymptoChron - Generiert am ' + createdAt, mr, 9, { align: 'right' });

  // ── Patient Info Header ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Patient: ' + pName + '  .  Geburtsdatum: ' + pBirth, m, 28);

  // ── Retrieve latest entries ──
  var phqDates = Object.keys(phqStore).sort();
  var latestPhqDate = phqDates[phqDates.length - 1];
  var latestPhq = latestPhqDate ? phqStore[latestPhqDate] : null;

  var gadDates = Object.keys(gadStore).sort();
  var latestGadDate = gadDates[gadDates.length - 1];
  var latestGad = latestGadDate ? gadStore[latestGadDate] : null;

  // Columns layout
  var x1 = 15;
  var w = 129;
  var x2 = 153;
  var yStart = 32;
  var hCol = 78;

  var compactPhqLabels = [
    'Interesse/Freude an Taetigkeiten',
    'Niedergeschlagenheit/Hoffnungslosigkeit',
    'Ein-/Durchschlafstörungen/Vielschlaf',
    'Müdigkeit/Energiemangel',
    'Appetitverlust/uebermaessiges Essen',
    'Schlechtes Gewissen/Versagensgefühle',
    'Konzentrationsschwierigkeiten',
    'Verlangsamte/unruhige Bewegungen',
    'Suizidalität/Selbstverletzungswunsch'
  ];

  var compactGadLabels = [
    'Nervoesität/Angst/Spannung',
    'Unkontrollierbare Sorgen',
    'Sorgen über verschiedene Dinge',
    'Entspannungsschwierigkeiten',
    'Ruhelosigkeit/Stillsitzprobleme',
    'Leichte Reizbarkeit/Verärgerung',
    'Angst vor schlimmen Ereignissen'
  ];

  function getAnswerLabel(val) {
    if (val === 0) return '0 (nicht)';
    if (val === 1) return '1 (einzelne Tage)';
    if (val === 2) return '2 (halbe Tage)';
    if (val === 3) return '3 (jeden Tag)';
    return '-';
  }

  // Draw Column 1: PHQ-9
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(x1, yStart, w, hCol, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 22, 40);
  doc.text('PHQ-9 Depressions-Screening', x1 + 5, yStart + 6);

  if (latestPhq) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Befund vom ' + latestPhqDate.split('-').reverse().join('.') + '  .  Gesamtscore: ' + latestPhq.sum + ' / 27', x1 + 5, yStart + 11);

    // Draw severity badge background
    var sevColor = [226, 232, 240];
    var sevText = latestPhq.severity || 'Unbekannt';
    if (latestPhq.sum <= 4) sevColor = [240, 253, 244]; // green
    else if (latestPhq.sum <= 9) sevColor = [239, 246, 255]; // blue
    else if (latestPhq.sum <= 14) sevColor = [255, 251, 235]; // amber
    else sevColor = [254, 242, 242]; // red

    doc.setFillColor(sevColor[0], sevColor[1], sevColor[2]);
    doc.roundedRect(x1 + 5, yStart + 14, w - 10, 6, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(sevText, x1 + 8, yStart + 18.2);

    // Questions list
    var qY = yStart + 25;
    var answers = latestPhq.answers || [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    compactPhqLabels.forEach(function(lbl, idx) {
      var val = answers[idx];
      var ansText = getAnswerLabel(val);

      doc.setFont('helvetica', 'bold');
      doc.text((idx + 1) + '. ' + lbl + ':', x1 + 5, qY);
      
      doc.setFont('helvetica', 'normal');
      doc.text(ansText, x1 + 80, qY);
      
      doc.setDrawColor(241, 245, 249);
      doc.line(x1 + 5, qY + 1.8, x1 + w - 5, qY + 1.8);

      qY += 5.3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Keine PHQ-9 Daten im gewählten Zeitraum erfasst.', x1 + 10, yStart + 35);
  }

  // Draw Column 2: GAD-7
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(x2, yStart, w, hCol, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 22, 40);
  doc.text('GAD-7 Angst-Screening', x2 + 5, yStart + 6);

  if (latestGad) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Befund vom ' + latestGadDate.split('-').reverse().join('.') + '  .  Gesamtscore: ' + latestGad.sum + ' / 21', x2 + 5, yStart + 11);

    // Severity badge
    var sevColor = [226, 232, 240];
    var sevText = latestGad.severity || 'Unbekannt';
    if (latestGad.sum <= 4) sevColor = [240, 253, 244]; // green
    else if (latestGad.sum <= 9) sevColor = [239, 246, 255]; // blue
    else if (latestGad.sum <= 14) sevColor = [255, 251, 235]; // amber
    else sevColor = [254, 242, 242]; // red

    doc.setFillColor(sevColor[0], sevColor[1], sevColor[2]);
    doc.roundedRect(x2 + 5, yStart + 14, w - 10, 6, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(sevText, x2 + 8, yStart + 18.2);

    // Questions list
    var qY = yStart + 25;
    var answers = latestGad.answers || [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    compactGadLabels.forEach(function(lbl, idx) {
      var val = answers[idx];
      var ansText = getAnswerLabel(val);

      doc.setFont('helvetica', 'bold');
      doc.text((idx + 1) + '. ' + lbl + ':', x2 + 5, qY);
      
      doc.setFont('helvetica', 'normal');
      doc.text(ansText, x2 + 80, qY);

      doc.setDrawColor(241, 245, 249);
      doc.line(x2 + 5, qY + 1.8, x2 + w - 5, qY + 1.8);

      qY += 5.3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Keine GAD-7 Daten im gewählten Zeitraum erfasst.', x2 + 10, yStart + 35);
  }

  // ── Table of Historical Trend ──
  var tableY = yStart + hCol + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 22, 40);
  doc.text('Chronologischer Verlauf (letzte 5 Erfassungen)', m, tableY);

  // Combine dates and sort descending
  var allMoodDatesSet = new Set();
  phqDates.forEach(function(d) { allMoodDatesSet.add(d); });
  gadDates.forEach(function(d) { allMoodDatesSet.add(d); });
  var sortedAllDates = Array.from(allMoodDatesSet).sort().reverse().slice(0, 5); // latest 5

  var thY = tableY + 3;
  var colX = [m, m + 30, m + 55, m + 140, m + 165];

  // Draw Header Row
  doc.setFillColor(241, 245, 249);
  doc.rect(m, thY, contentW, 6, 'F');
  doc.setDrawColor(200, 210, 225);
  doc.line(m, thY, mr, thY);
  doc.line(m, thY + 6, mr, thY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Datum', colX[0] + 2, thY + 4.2);
  doc.text('PHQ-9 Score', colX[1] + 2, thY + 4.2);
  doc.text('PHQ-9 Bewertung (Depression)', colX[2] + 2, thY + 4.2);
  doc.text('GAD-7 Score', colX[3] + 2, thY + 4.2);
  doc.text('GAD-7 Bewertung (Angst)', colX[4] + 2, thY + 4.2);

  var rowY = thY + 6;
  if (sortedAllDates.length > 0) {
    sortedAllDates.forEach(function(d) {
      var phqE = phqStore[d];
      var gadE = gadStore[d];

      // Zebra striping
      doc.setFillColor(255, 255, 255);
      doc.rect(m, rowY, contentW, 6, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      // Date formatted
      var formattedDate = d.split('-').reverse().join('.');
      doc.text(formattedDate, colX[0] + 2, rowY + 4.2);

      // PHQ-9
      if (phqE) {
        doc.text(String(phqE.sum) + ' / 27', colX[1] + 2, rowY + 4.2);
        doc.text(phqE.severity || '-', colX[2] + 2, rowY + 4.2);
      } else {
        doc.setTextColor(160, 170, 185);
        doc.text('-', colX[1] + 2, rowY + 4.2);
        doc.text('Keine Erfassung', colX[2] + 2, rowY + 4.2);
        doc.setTextColor(51, 65, 85);
      }

      // GAD-7
      if (gadE) {
        doc.text(String(gadE.sum) + ' / 21', colX[3] + 2, rowY + 4.2);
        doc.text(gadE.severity || '-', colX[4] + 2, rowY + 4.2);
      } else {
        doc.setTextColor(160, 170, 185);
        doc.text('-', colX[3] + 2, rowY + 4.2);
        doc.text('Keine Erfassung', colX[4] + 2, rowY + 4.2);
        doc.setTextColor(51, 65, 85);
      }

      // Draw bottom line for row
      doc.setDrawColor(226, 232, 240);
      doc.line(m, rowY + 6, mr, rowY + 6);
      rowY += 6;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Keine historischen Einträge vorhanden.', m + 2, rowY + 4.5);
  }

  // ── Footer ──
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.2);
  doc.line(m, H - 14, mr, H - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Schweregrade: PHQ-9 (0-4: minimal, 5-9: leicht, 10-14: mittelgradig, 15-19: schwerwiegend, 20+: schwerste). GAD-7 (0-4: minimal, 5-9: leicht, 10-14: mittelgradig, 15+: schwere Angstsymptome).', m, H - 9);
  doc.text('Generiert am ' + createdAt, mr, H - 9, { align: 'right' });
}

// ── Therapy Milestones Management ────────────────
function getMilestones() {
  try {
    return JSON.parse(localStorage.getItem('symptochron_milestones') || '[]');
  } catch (e) {
    return [];
  }
}

function saveMilestones(list) {
  localStorage.setItem('symptochron_milestones', JSON.stringify(list));
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMilestones() {
  const container = document.getElementById('milestonesList');
  if (!container) return;

  const milestones = getMilestones();
  if (milestones.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-3);margin:4px 0">Noch keine Meilensteine eingetragen.</p>';
    return;
  }

  // Sort chronologically
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  container.innerHTML = milestones.map((m, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
      <div>
        <strong style="font-size:13px;color:var(--text-1);">${m.date.split('-').reverse().join('.')}</strong>
        <span style="margin-left:8px;font-size:12.5px;color:var(--text-2);">${escHtml(m.desc)}</span>
      </div>
      <button class="btn-danger" type="button" style="padding:4px 8px;font-size:11px;" onclick="deleteMilestone(${idx})">Löschen</button>
    </div>
  `).join('');
}

function addMilestone() {
  const dateEl = document.getElementById('milestoneDate');
  const descEl = document.getElementById('milestoneDesc');
  if (!dateEl || !descEl) return;

  const date = dateEl.value;
  const desc = descEl.value.trim();

  if (!date) {
    showToast('⚠️ Bitte ein Datum auswählen');
    return;
  }
  if (!desc) {
    showToast('⚠️ Bitte eine Beschreibung eingeben');
    return;
  }

  const milestones = getMilestones();
  milestones.push({ date, desc });
  saveMilestones(milestones);

  dateEl.value = '';
  descEl.value = '';
  renderMilestones();
  showToast('✅ Meilenstein hinzugefügt');
}

function deleteMilestone(idx) {
  const milestones = getMilestones();
  milestones.sort((a, b) => a.date.localeCompare(b.date));
  milestones.splice(idx, 1);
  saveMilestones(milestones);
  renderMilestones();
  showToast('🗑 Meilenstein gelöscht');
}

// Expose to window
window.getMilestones = getMilestones;
window.renderMilestones = renderMilestones;
window.addMilestone = addMilestone;
window.deleteMilestone = deleteMilestone;

// Extension for export tab init
const originalInitExportTab = window.initExportTab;
window.initExportTab = function() {
  if (originalInitExportTab) originalInitExportTab();
  setTimeout(() => {
    if (document.getElementById('milestonesList')) {
      renderMilestones();
    }
  }, 100);
};
