import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { DiaryEntry, Medication, SOSData, MoodEntry, RLSSurvey } from '../types';
import { formatDateShort, dailyAvgPain } from '../utils';
import { AREA_LABELS } from './BodyMap';

interface GeneratePdfProps {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
  patient: { name: string; bday: string };
  rangeType: 'all' | 'sinceLast' | 'custom';
  customStart?: string;
  customEnd?: string;
}

export function generatePDFReport({
  diary,
  meds,
  patient,
  rangeType,
  customStart,
  customEnd,
}: GeneratePdfProps): jsPDF | null {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });

  // Get and sort dates
  const dates = Object.keys(diary).sort();
  let filteredDates = [...dates];

  if (rangeType === 'sinceLast') {
    const lastExportStr = localStorage.getItem('symptochron_last_pdf_export');
    if (lastExportStr) {
      const lastDate = new Date(lastExportStr);
      const lastDateStr = lastDate.toISOString().split('T')[0];
      filteredDates = dates.filter(d => d >= lastDateStr);
    }
  } else if (rangeType === 'custom') {
    if (customStart) {
      filteredDates = filteredDates.filter(d => d >= customStart);
    }
    if (customEnd) {
      filteredDates = filteredDates.filter(d => d <= customEnd);
    }
  }

  // Mandatory check: body map must be used at least once
  const hasAnyBodyMap = filteredDates.some(d => {
    const e = diary[d];
    return e && e.painAreas && e.painAreas.length > 0;
  });

  if (dates.length > 0 && !hasAnyBodyMap) {
    alert(
      'Hinweis für den PDF-Export:\n\nBitte fülle die Schmerzkörperkarte (Schritt 1b im Tagebuch) für mindestens einen Tag aus, bevor du den Report erstellst. Sie ist ein obligatorischer Teil des ärztlichen Fragebogens.'
    );
    return null;
  }

  const pName = patient.name || 'Nicht angegeben';
  const pBirth = patient.bday ? formatDateShort(patient.bday) : 'Nicht angegeben';
  const createdAt = formatDateShort(new Date().toISOString().split('T')[0]);

  const W = 297;
  const H = 210;

  // PAGE 1: COVER PAGE
  drawCoverPage(doc, pName, pBirth, createdAt, filteredDates, diary, meds, W, H);

  // PAGE 2: TRENDS & BODY HEATMAP
  if (filteredDates.length > 0) {
    drawTrendsPage(doc, filteredDates, diary, pName, pBirth, createdAt, W, H);
  }

  // PAGE 3: MEDICATION PLAN
  drawMedicationPage(doc, meds, pName, pBirth, createdAt, W, H);

  // PAGE 4+: DATAMATRIX (Chronological records)
  if (filteredDates.length > 0) {
    doc.addPage('a4', 'l');
    drawDataMatrix(doc, diary, filteredDates, pName, pBirth, createdAt, W, H);
  }

  return doc;
}

// === PAGE 1: COVER PAGE ===
function drawCoverPage(
  doc: jsPDF,
  pName: string,
  pBirth: string,
  createdAt: string,
  dates: string[],
  diary: Record<string, DiaryEntry>,
  meds: Medication[],
  W: number,
  H: number
) {
  const m = 15;
  const mr = W - m;

  // Dark header block
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 32, 'F');

  // Accent line
  doc.setFillColor(59, 158, 255);
  doc.rect(0, 32, W, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('SymptoChron', m, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('MEDIZINISCHER VERLAUFSBERICHT', m, 27);

  // Patient metadata
  doc.setTextColor(200, 215, 240);
  doc.setFontSize(9);
  doc.text('Patient: ' + pName, mr - 120, 13);
  doc.text('Geburtsdatum: ' + pBirth, mr - 120, 19);
  doc.text('Erstellt am: ' + createdAt, mr - 120, 25);

  // Metrics Boxes
  const y = 44;
  const boxW = 82;
  const boxH = 26;
  const gap = 8;
  const totalW = boxW * 3 + gap * 2;
  const startX = m + (mr - m - totalW) / 2;

  // Compute Avg pain
  let painSum = 0;
  let painCnt = 0;
  dates.forEach(d => {
    const p = dailyAvgPain(diary[d]);
    if (p !== null) {
      painSum += p;
      painCnt++;
    }
  });
  const avgPainStr = painCnt > 0 ? (painSum / painCnt).toFixed(1) : '–';

  drawStatBox(doc, startX, y, boxW, boxH, String(dates.length), 'Tage erfasst');
  drawStatBox(doc, startX + boxW + gap, y, boxW, boxH, avgPainStr, 'Ø Schmerzintensität / 10');
  drawStatBox(doc, startX + (boxW + gap) * 2, y, boxW, boxH, String(meds.length), 'Medikamente angelegt');

  // Divider
  let curY = y + boxH + 12;
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.3);
  doc.line(m, curY, mr, curY);

  // Contents
  curY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(10, 22, 40);
  doc.text('Inhalt dieses Berichts', m, curY);
  curY += 9;

  const sections = [
    { page: 'S. 1', title: 'Deckblatt', desc: 'Patientendaten & Übersicht' },
  ];
  if (dates.length > 0) {
    sections.push({ page: 'S. 2', title: 'Schmerzverlauf', desc: 'Symptom-Trends & Körpermap' });
    sections.push({ page: 'S. 3', title: 'Medikationsplan', desc: 'Medikamenten-Übersicht und Dosis' });
    sections.push({ page: 'S. 4+', title: 'Verlaufsmatrix', desc: 'Chronologische Tagebucheinträge' });
  } else {
    sections.push({ page: 'S. 2', title: 'Medikationsplan', desc: 'Medikamenten-Übersicht und Dosis' });
  }

  const sBoxW = sections.length === 4 ? 62 : 85;
  const sBoxGap = sections.length === 4 ? 65.5 : 88;

  sections.forEach((s, idx) => {
    const sx = m + idx * sBoxGap;
    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(sx, curY, sBoxW, 24, 2, 2, 'FD');

    // Page number badge
    doc.setFillColor(59, 158, 255);
    doc.roundedRect(sx + 3, curY + 3, 14, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(s.page, sx + 10, curY + 8.5, { align: 'center' });

    // Section title
    doc.setTextColor(10, 22, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sections.length === 4 ? 8 : 9);
    doc.text(s.title, sx + 19, curY + 8.5);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(sections.length === 4 ? 6.5 : 7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.desc, sx + 4, curY + 18);
  });

  // Color key legend
  curY += 36;
  doc.setFillColor(242, 245, 250);
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(m, curY, mr - m, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('Farblegende Schmerz- und RLS-Werte:', m + 5, curY + 6);

  const legY = curY + 12;
  let legX = m + 5;

  doc.setFillColor(46, 125, 50);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('0–3 Leicht / Stabil', legX + 10, legY + 1);

  legX += 50;
  doc.setFillColor(217, 119, 6);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.text('4–5 Mittelgradig', legX + 10, legY + 1);

  legX += 50;
  doc.setFillColor(185, 28, 28);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.text('6–10 Stark', legX + 10, legY + 1);

  legX += 45;
  doc.setFillColor(109, 40, 217);
  doc.roundedRect(legX, legY - 3, 8, 5, 1, 1, 'F');
  doc.text('RLS (Violett-Töne)', legX + 10, legY + 1);

  // Footer disclaimer
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.2);
  doc.line(m, H - 14, mr, H - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Dieser Bericht dient der Patientendokumentation und dem informativen Austausch mit medizinischem Fachpersonal. Er stellt keine direkte Diganose dar.',
    m,
    H - 9
  );
  doc.text('Erstellt mit SymptoChron', mr, H - 9, { align: 'right' });
}

function drawStatBox(doc: jsPDF, x: number, y: number, w: number, h: number, val: string, label: string) {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(10, 22, 40);
  doc.text(val, x + w / 2, y + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + w / 2, y + 21, { align: 'center' });
}

// === PAGE 2: TRENDS & BODY HEATMAP ===
function drawTrendsPage(
  doc: jsPDF,
  dates: string[],
  diary: Record<string, DiaryEntry>,
  pName: string,
  pBirth: string,
  createdAt: string,
  W: number,
  H: number
) {
  doc.addPage('a4', 'l');
  const m = 15;
  const mr = W - m;

  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 22, 'F');

  doc.setFillColor(59, 158, 255);
  doc.rect(0, 22, W, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('SYMPTOM-VERLAUF', m, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('SymptoChron – Generiert am ' + createdAt, mr, 9, { align: 'right' });

  // Patient Sub-header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Patient: ${pName}  ·  Geburtsdatum: ${pBirth}`, m, 28);

  // Line chart coordinates mapping (left-half width)
  const chartX = 22;
  const chartY = 46;
  const chartW = 175;
  const chartH = 110;
  const chartBottom = chartY + chartH;

  const hUnit = chartH / 10;

  // Background Zones
  doc.setFillColor(240, 253, 244); // Green (0-3.5)
  doc.rect(chartX, chartBottom - 3.5 * hUnit, chartW, 3.5 * hUnit, 'F');

  doc.setFillColor(255, 251, 235); // Orange (3.5-5.5)
  doc.rect(chartX, chartBottom - 5.5 * hUnit, chartW, 2.0 * hUnit, 'F');

  doc.setFillColor(254, 242, 242); // Red (5.5-10)
  doc.rect(chartX, chartBottom - 10 * hUnit, chartW, 4.5 * hUnit, 'F');

  // Axis gridlines
  doc.setLineWidth(0.15);
  for (let val = 0; val <= 10; val++) {
    const gy = chartBottom - val * hUnit;
    if (val === 0 || val === 10) {
      doc.setDrawColor(148, 163, 184);
    } else {
      doc.setDrawColor(226, 232, 240);
    }
    doc.line(chartX, gy, chartX + chartW, gy);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(val), chartX - 3, gy + 2.5, { align: 'right' });

    if (val === 2) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 125, 50);
      doc.text('Leicht', chartX + chartW + 3, gy + 1);
    } else if (val === 5) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text('Mittel', chartX + chartW + 3, gy + 1);
    } else if (val === 8) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('Stark', chartX + chartW + 3, gy + 1);
    }
  }

  // Draw chart data
  const xCoords: number[] = [];
  const yCoords: number[] = [];
  const areaCounts: Record<string, number> = {};

  if (dates.length > 0) {
    const stepX = dates.length > 1 ? chartW / (dates.length - 1) : chartW;

    dates.forEach((dateStr, i) => {
      const entry = diary[dateStr];
      if (!entry) return;

      const p = dailyAvgPain(entry) || 0;
      const px = chartX + (dates.length > 1 ? i * stepX : chartW / 2);
      const py = chartBottom - p * hUnit;

      xCoords.push(px);
      yCoords.push(py);

      // Map pain areas
      if (entry.painAreas) {
        entry.painAreas.forEach(area => {
          areaCounts[area] = (areaCounts[area] || 0) + 1;
        });
      }

      // Small weather markers
      let wMark = '';
      if (entry.weather === 'sun') wMark = 'S';
      else if (entry.weather === 'cloud') wMark = 'W';
      else if (entry.weather === 'rain') wMark = 'R';
      else if (entry.weather === 'storm') wMark = 'G';

      if (wMark) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(wMark, px, py - 4, { align: 'center' });
      }
    });

    // Fill under curve
    if (dates.length > 1) {
      doc.setFillColor(215, 230, 250);
      for (let i = 0; i < xCoords.length - 1; i++) {
        const x1 = xCoords[i];
        const y1 = yCoords[i];
        const x2 = xCoords[i + 1];
        const y2 = yCoords[i + 1];
        const yTop = Math.max(y1, y2);
        doc.rect(x1, yTop, x2 - x1, chartBottom - yTop, 'F');
        if (y1 !== y2) {
          if (y1 < y2) doc.triangle(x1, y1, x2, yTop, x1, yTop, 'F');
          else doc.triangle(x2, y2, x1, yTop, x2, yTop, 'F');
        }
      }
    }

    // Draw main timeline trends line
    doc.setDrawColor(59, 158, 255);
    doc.setLineWidth(0.8);
    for (let i = 0; i < xCoords.length - 1; i++) {
      doc.line(xCoords[i], yCoords[i], xCoords[i + 1], yCoords[i + 1]);
    }

    // Draw nodes
    doc.setFillColor(59, 158, 255);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    for (let i = 0; i < xCoords.length; i++) {
      doc.circle(xCoords[i], yCoords[i], 1.2, 'FD');
    }

    // Timeline Axis Labels
    const maxLabels = 8;
    const labelStep = Math.ceil(dates.length / maxLabels);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);

    dates.forEach((dateStr, i) => {
      if (i % labelStep === 0 || i === dates.length - 1) {
        const parts = dateStr.split('-');
        const shortStr = `${parts[2]}.${parts[1]}.`;
        doc.text(shortStr, xCoords[i], chartBottom + 5, { align: 'center' });
      }
    });
  }

  // Draw Pain Heatmap on the right side
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 22, 40);
  doc.text('SCHMERZLOKALISATION', 215, 40);

  // Layout parameters for silhouettes
  const s = 0.28; // scale multiplier
  const oxFront = 214;
  const oxBack = 246;
  const oySil = 44;

  let maxC = 1;
  Object.keys(areaCounts).forEach(key => {
    if (areaCounts[key] > maxC) maxC = areaCounts[key];
  });

  const drawSilShape = (item: { key: string; type: string; props: any }, ox: number) => {
    const count = areaCounts[item.key] || 0;
    let r = 241, g = 245, b = 249; // Default soft slate

    if (count > 0) {
      const scale = count / maxC;
      r = 255;
      g = Math.round(220 - scale * 170);
      b = Math.round(220 - scale * 170);
    }

    doc.setFillColor(r, g, b);
    doc.setDrawColor(180, 190, 205);
    doc.setLineWidth(0.12);

    if (item.type === 'circle') {
      doc.circle(ox + item.props.cx * s, oySil + item.props.cy * s, item.props.r * s, 'FD');
    } else {
      doc.roundedRect(
        ox + item.props.x * s,
        oySil + item.props.y * s,
        item.props.width * s,
        item.props.height * s,
        (item.props.rx || 0) * s,
        (item.props.rx || 0) * s,
        'FD'
      );
    }
  };

  // Human shapes mappings
  const frontOutline = [
    { key: 'front-head', type: 'circle', props: { cx: 50, cy: 15, r: 10 } },
    { key: 'front-neck', type: 'rect', props: { x: 46, y: 25, width: 8, height: 6, rx: 1 } },
    { key: 'front-shoulder-l', type: 'rect', props: { x: 22, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'front-shoulder-r', type: 'rect', props: { x: 69, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'front-chest', type: 'rect', props: { x: 32, y: 32, width: 36, height: 24, rx: 2 } },
    { key: 'front-abdomen', type: 'rect', props: { x: 34, y: 57, width: 32, height: 20, rx: 2 } },
    { key: 'front-arm-l', type: 'rect', props: { x: 19, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'front-arm-r', type: 'rect', props: { x: 71, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'front-hand-l', type: 'rect', props: { x: 18, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'front-hand-r', type: 'rect', props: { x: 70, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'front-hip-l', type: 'rect', props: { x: 34, y: 78, width: 15, height: 12, rx: 2 } },
    { key: 'front-hip-r', type: 'rect', props: { x: 51, y: 78, width: 15, height: 12, rx: 2 } },
    { key: 'front-leg-l', type: 'rect', props: { x: 34, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'front-leg-r', type: 'rect', props: { x: 53, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'front-foot-l', type: 'rect', props: { x: 31, y: 142, width: 16, height: 8, rx: 2 } },
    { key: 'front-foot-r', type: 'rect', props: { x: 53, y: 142, width: 16, height: 8, rx: 2 } }
  ];

  const backOutline = [
    { key: 'back-head', type: 'circle', props: { cx: 50, cy: 15, r: 10 } },
    { key: 'back-neck', type: 'rect', props: { x: 46, y: 25, width: 8, height: 6, rx: 1 } },
    { key: 'back-shoulder-l', type: 'rect', props: { x: 22, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'back-shoulder-r', type: 'rect', props: { x: 69, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'back-upper', type: 'rect', props: { x: 32, y: 32, width: 36, height: 24, rx: 2 } },
    { key: 'back-lower', type: 'rect', props: { x: 34, y: 57, width: 32, height: 20, rx: 2 } },
    { key: 'back-arm-l', type: 'rect', props: { x: 19, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'back-arm-r', type: 'rect', props: { x: 71, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'back-hand-l', type: 'rect', props: { x: 18, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'back-hand-r', type: 'rect', props: { x: 70, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'back-glute', type: 'rect', props: { x: 34, y: 78, width: 32, height: 12, rx: 3 } },
    { key: 'back-leg-l', type: 'rect', props: { x: 34, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'back-leg-r', type: 'rect', props: { x: 53, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'back-foot-l', type: 'rect', props: { x: 31, y: 142, width: 16, height: 8, rx: 2 } },
    { key: 'back-foot-r', type: 'rect', props: { x: 53, y: 142, width: 16, height: 8, rx: 2 } }
  ];

  frontOutline.forEach(item => drawSilShape(item, oxFront));
  backOutline.forEach(item => drawSilShape(item, oxBack));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Vorderseite', oxFront + 50 * s, oySil + 162 * s, { align: 'center' });
  doc.text('Rückseite', oxBack + 50 * s, oySil + 162 * s, { align: 'center' });

  // List most logged segments
  const sorted = Object.keys(areaCounts)
    .map(key => ({ key, val: areaCounts[key] }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 4);

  let ly = 96;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Hauptschmerz-Lokalisierungen:', 215, ly);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  if (sorted.length === 0) {
    doc.text('Keine Angaben gemacht.', 215, ly + 6);
  } else {
    sorted.forEach((item, idx) => {
      const label = AREA_LABELS[item.key] || item.key;
      doc.text(`${idx + 1}. ${label} (${item.val} Erfassungen)`, 215, ly + 6 + idx * 5);
    });
  }

  // Footer references
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.2);
  doc.line(m, H - 14, mr, H - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Wetter-Legende: S = Sonne, W = Wolken, R = Regen, G = Gewitter | Luftdruck: + = Hoch, - = Tief', m, H - 9);
  doc.text('Generiert am ' + createdAt, mr, H - 9, { align: 'right' });
}

function drawSilhouetteShape(
  doc: jsPDF,
  item: any,
  ox: number,
  oyY: number,
  seg: any,
  counts: Record<string, number>,
  maxC: number
) {
  const s = 0.28;
  const count = counts[item.key] || 0;
  let r = 241, g = 245, b = 249;

  if (count > 0) {
    const scale = count / maxC;
    r = 255;
    g = Math.round(220 - scale * 170);
    b = Math.round(220 - scale * 170);
  }

  doc.setFillColor(r, g, b);
  doc.setDrawColor(180, 190, 205);
  doc.setLineWidth(0.12);

  if (item.type === 'circle') {
    doc.circle(ox + item.props.cx * s, oyY + item.props.cy * s, item.props.r * s, 'FD');
  } else {
    doc.roundedRect(
      ox + item.props.x * s,
      oyY + item.props.y * s,
      item.props.width * s,
      item.props.height * s,
      (item.props.rx || 0) * s,
      (item.props.rx || 0) * s,
      'FD'
    );
  }
}

// === PAGE 3: MEDICATION PLAN ===
function drawMedicationPage(doc: jsPDF, meds: Medication[], pName: string, pBirth: string, createdAt: string, W: number, H: number) {
  doc.addPage('a4', 'l');
  const m = 15;
  const mr = W - m;
  const contentW = mr - m;

  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 22, 'F');

  doc.setFillColor(220, 38, 38); // Red clinical line
  doc.rect(0, 22, W, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MEDIKAMENTENPLAN', m, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('SymptoChron – Generiert am ' + createdAt, mr, 9, { align: 'right' });

  // Patient Info Card
  doc.setFillColor(242, 245, 250);
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(m, 28, contentW, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Name, Vorname', m + 4, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(pName, m + 4, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Geburtsdatum', m + 110, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(pBirth, m + 110, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Behandlungsdatum', m + 200, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(createdAt, m + 200, 40);

  // Table Columns
  const cols = [
    { key: 'name', label: 'Medikament', w: 60, x: m },
    { key: 'dose', label: 'Stärke / Dosis', w: 40, x: m + 60 },
    { key: 'form', label: 'Darreichungsform', w: 34, x: m + 100 },
    { key: 'morning', label: 'Morgens', w: 24, x: m + 134, bg: [245, 180, 30] },
    { key: 'noon', label: 'Mittags', w: 24, x: m + 158, bg: [59, 130, 246] },
    { key: 'evening', label: 'Abends', w: 24, x: m + 182, bg: [139, 92, 246] },
    { key: 'night', label: 'Nachts', w: 24, x: m + 206, bg: [30, 64, 175] },
    { key: 'note', label: 'Hinweis / Bemerkung', w: contentW - 230, x: m + 230 },
  ];

  // Headings
  let y = 50;
  cols.forEach(c => {
    if (c.bg) {
      doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    } else {
      doc.setFillColor(226, 232, 240);
    }
    doc.rect(c.x, y, c.w, 10, 'F');
    doc.setDrawColor(200, 210, 225);
    doc.setLineWidth(0.25);
    doc.rect(c.x, y, c.w, 10, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(c.bg ? 255 : 30, c.bg ? 255 : 41, c.bg ? 255 : 59);
    doc.text(c.label, c.x + c.w / 2, y + 6, { align: 'center' });
  });

  y += 10;

  // Render rows
  if (meds.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(m, y, contentW, 14, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('Keine aktiven Medikamente erfasst.', m + contentW / 2, y + 8, { align: 'center' });
    y += 14;
  } else {
    meds.forEach((med, idx) => {
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 253 : 255);
      doc.rect(m, y, contentW, 11, 'F');

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(m, y + 11, mr, y + 11);

      // Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(med.name, m + 2.5, y + 7);

      // Dose & Form
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(med.dose, m + 62.5, y + 7);
      doc.text(med.form || '–', m + 102.5, y + 7);

      // Schedule inputs
      const slots = ['morning', 'noon', 'evening', 'night'];
      slots.forEach((sKey, sIdx) => {
        const val = med.schedule[sKey];
        const hasVal = val > 0;
        const colObj = cols[3 + sIdx];

        if (hasVal) {
          doc.setFillColor(255, 248, 225); // highlighted background
          doc.rect(colObj.x + 0.5, y + 0.5, colObj.w - 1, 10, 'F');
        }

        doc.setFont('helvetica', hasVal ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.setTextColor(hasVal ? 30 : 180, hasVal ? 41 : 190, hasVal ? 59 : 200);
        doc.text(hasVal ? String(val) : '–', colObj.x + colObj.w / 2, y + 6.5, { align: 'center' });
      });

      // Notes
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const limitNote = med.note && med.note.length > 34 ? `${med.note.slice(0, 32)}...` : med.note || '';
      doc.text(limitNote, m + 232.5, y + 7);

      y += 11;
    });
  }

  // Signature Block
  y += 14;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.2);
  doc.line(m, y, m + 70, y);
  doc.line(m + 95, y, m + 165, y);
  doc.line(m + 190, y, m + 260, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Datum / Ort', m, y + 4);
  doc.text('Unterschrift Ärztin/Arzt', m + 95, y + 4);
  doc.text('Unterschrift Patient', m + 190, y + 4);

  // Disclaimer bottom
  doc.setDrawColor(200, 210, 225);
  doc.line(m, H - 14, mr, H - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'HINWEIS: Dieser Medikationsplan dient als Gedankenstütze. Jegliche Änderungen an Ihrer Medikation sollten mit Ihrem behandelnden Arzt abgesprochen werden.',
    m,
    H - 8
  );
}

// === PAGE 4+: DATAMATRIX CHRONOLOGY ===
function drawDataMatrix(
  doc: jsPDF,
  diary: Record<string, DiaryEntry>,
  dates: string[],
  pName: string,
  pBirth: string,
  createdAt: string,
  W: number,
  H: number
) {
  const lm = 15;
  const rm = W - lm;

  drawMatrixHeader(doc, pName, pBirth, createdAt, lm, rm, W);

  let y = 28;

  const colX = {
    date: lm + 2,
    sp_mo: lm + 30,
    sp_mi: lm + 44,
    sp_ab: lm + 58,
    sp_na: lm + 72,
    rl_mo: lm + 92,
    rl_mi: lm + 106,
    rl_ab: lm + 120,
    rl_na: lm + 134,
    schlaf: lm + 154,
    qual: lm + 172,
    weather: lm + 188,
    notes: lm + 212,
  };

  drawMatrixColHeaders(doc, y, colX, lm, rm);
  y += 12;

  dates.forEach((dateStr, idx) => {
    // Page break handling
    if (y > H - 20) {
      doc.addPage('a4', 'l');
      drawMatrixHeader(doc, pName, pBirth, createdAt, lm, rm, W);
      y = 28;
      drawMatrixColHeaders(doc, y, colX, lm, rm);
      y += 12;
    }

    const entry = diary[dateStr];
    if (!entry) return;

    // Alternating shading
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(lm, y - 1, rm - lm, 9, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.12);
    doc.line(lm, y + 8, rm, y + 8);

    // Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const dateFormatted = dateStr.split('-').reverse().join('.');
    doc.text(dateFormatted, colX.date, y + 5.5);

    // Pain scores
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    const checkDrawValue = (v: number | undefined) => (v !== undefined ? String(v) : '–');

    doc.text(checkDrawValue(entry.morning_pain), colX.sp_mo, y + 5.5);
    doc.text(checkDrawValue(entry.noon_pain), colX.sp_mi, y + 5.5);
    doc.text(checkDrawValue(entry.evening_pain), colX.sp_ab, y + 5.5);
    doc.text(checkDrawValue(entry.night_pain), colX.sp_na, y + 5.5);

    // RLS scores
    doc.text(checkDrawValue(entry.morning_rls), colX.rl_mo, y + 5.5);
    doc.text(checkDrawValue(entry.noon_rls), colX.rl_mi, y + 5.5);
    doc.text(checkDrawValue(entry.evening_rls), colX.rl_ab, y + 5.5);
    doc.text(checkDrawValue(entry.night_rls), colX.rl_na, y + 5.5);

    // Sleep
    doc.text(entry.sleepHours !== undefined ? `${entry.sleepHours}h` : '–', colX.schlaf, y + 5.5);
    doc.text(entry.sleepQuality !== undefined ? `${entry.sleepQuality}/5` : '–', colX.qual, y + 5.5);

    // Weather / Pressure
    const wMap: Record<string, string> = { sun: 'Sonne', cloud: 'Wolken', rain: 'Regen', storm: 'Gewitter' };
    const pMap: Record<string, string> = { high: '(+)', normal: '(o)', low: '(-)' };
    const wStr = entry.weather ? wMap[entry.weather] || '–' : '–';
    const pStr = entry.pressure ? pMap[entry.pressure] || '' : '';
    doc.text(`${wStr} ${pStr}`.trim(), colX.weather, y + 5.5);

    // Notes
    let noteText = entry.notes || '–';
    if (entry.factors) {
      const activeFactors = Object.keys(entry.factors)
        .filter(k => entry.factors?.[k])
        .join(', ');
      if (activeFactors) {
        noteText += ` [Faktoren: ${activeFactors}]`;
      }
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 120, 140);
    const croppedNote = noteText.length > 40 ? `${noteText.substring(0, 38)}...` : noteText;
    doc.text(croppedNote, colX.notes, y + 5.5);

    y += 9;
  });

  // Footer matrix
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Verlaufsübersicht – SymptoChron', lm, H - 7);
}

function drawMatrixHeader(doc: jsPDF, pName: string, pBirth: string, createdAt: string, lm: number, rm: number, W: number) {
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SymptoChron – Chronologische Verlaufsmatrix', lm, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text(`Patient: ${pName} | Geb.: ${pBirth} | Stand: ${createdAt}`, rm, 11, { align: 'right' });
}

function drawMatrixColHeaders(doc: jsPDF, y: number, colX: any, lm: number, rm: number) {
  const hdrH = 12;

  // Pain Zone BG
  doc.setFillColor(255, 235, 235);
  doc.rect(colX.sp_mo - 3, y, colX.sp_na - colX.sp_mo + 18, hdrH, 'F');

  // RLS Zone BG
  doc.setFillColor(240, 235, 255);
  doc.rect(colX.rl_mo - 3, y, colX.rl_na - colX.rl_mo + 18, hdrH, 'F');

  // Other Zones
  doc.setFillColor(226, 232, 240);
  doc.rect(lm, y, colX.sp_mo - lm - 3, hdrH, 'F');
  doc.rect(colX.schlaf - 3, y, rm - colX.schlaf + 3, hdrH, 'F');

  // Border outline
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.25);
  doc.rect(lm, y, rm - lm, hdrH, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  doc.text('Datum', colX.date, y + 8);

  // Pain headers
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(7.5);
  doc.text('SCHMERZ (0-10)', (colX.sp_mo + colX.sp_na) / 2, y + 3.5, { align: 'center' });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.text('Mo', colX.sp_mo, y + 9);
  doc.text('Mi', colX.sp_mi, y + 9);
  doc.text('Ab', colX.sp_ab, y + 9);
  doc.text('Na', colX.sp_na, y + 9);

  // RLS headers
  doc.setTextColor(109, 40, 217);
  doc.setFontSize(7.5);
  doc.text('RLS (0-10)', (colX.rl_mo + colX.rl_na) / 2, y + 3.5, { align: 'center' });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.text('Mo', colX.rl_mo, y + 9);
  doc.text('Mi', colX.rl_mi, y + 9);
  doc.text('Ab', colX.rl_ab, y + 9);
  doc.text('Na', colX.rl_na, y + 9);

  // Other headers
  doc.text('Schlaf', colX.schlaf, y + 8);
  doc.text('Qual.', colX.qual, y + 8);
  doc.text('Wetter / Luftdruck', colX.weather, y + 8);
  doc.text('Notizen / Besonderheiten', colX.notes, y + 8);
}

export default function PdfExport({ diary, meds, mood, rlsSurveys, sosData }: {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
  mood: Record<string, MoodEntry>;
  rlsSurveys: Record<string, RLSSurvey>;
  sosData: SOSData;
}) {
  const [rangeType, setRangeType] = useState<'all' | 'sinceLast' | 'custom'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleTriggerExport = () => {
    const doc = generatePDFReport({
      diary,
      meds,
      patient: {
        name: sosData.personal?.name || sosData.patientName || 'Erika Mustermann',
        bday: sosData.personal?.birthdate || sosData.dob || '12.04.1978'
      },
      rangeType,
      customStart,
      customEnd
    });

    if (doc) {
      doc.save(`SymptoChron_ArztReport_${new Date().toISOString().split('T')[0]}.pdf`);
      localStorage.setItem('symptochron_last_pdf_export', new Date().toISOString());
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 text-left block">Zeitbereich</label>
          <select
            value={rangeType}
            onChange={(e) => setRangeType(e.target.value as any)}
            className="w-full py-2.5 px-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300"
          >
            <option value="all">Gesamter Verlauf</option>
            <option value="sinceLast">Seit letztem Export</option>
            <option value="custom">Eigener Zeitraum</option>
          </select>
        </div>

        {rangeType === 'custom' && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 text-left block">Startdatum</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full py-2 px-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 text-left block">Enddatum</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full py-2 px-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200"
              />
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleTriggerExport}
        className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/10 cursor-pointer"
      >
        <FileText className="h-4.5 w-4.5" /> 🩺 PDF Report generieren
      </button>
    </div>
  );
}
