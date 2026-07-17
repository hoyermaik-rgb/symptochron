import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Plus,
  Trash,
  Edit,
  RefreshCw,
  AlertTriangle,
  Search,
  Info,
  Bell,
  Check,
  ScanLine,
  FileText
} from 'lucide-react';
import { Medication } from '../types';
import { todayStr, validateMedication, isValidPzn } from '../utils';
import { jsPDF } from 'jspdf';

interface MedsTabProps {
  meds: Medication[];
  onAddMed: (med: Medication) => void;
  onDeleteMed: (id: string) => void;
  onUpdateMed: (med: Medication) => void;
  onRefillMed: (id: string) => void;
  settings: Record<string, any>;
  onSaveSettings: (settings: any) => void;
  showToast: (msg: string) => void;
  patientName?: string;
  patientBday?: string;
}

const LOCAL_DRUG_CONFLICTS = [
  { drugs: ['ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'celecoxib'], conflict: ['warfarin', 'marcumar', 'phenprocoumon', 'rivaroxaban', 'apixaban'], message: 'NSAID + Blutverdünner: Extrem erhöhtes Blutungsrisiko (Magen-Darm-Blutung).', severity: 'high' },
  { drugs: ['ibuprofen', 'diclofenac', 'naproxen'], conflict: ['lithium'], message: 'NSAID + Lithium: Kann die Lithiumausscheidung hemmen und zu Vergiftungen führen.', severity: 'high' },
  { drugs: ['tramadol', 'morphin', 'tilidin', 'oxycodon', 'fentanyl', 'buprenorphin'], conflict: ['gabapentin', 'pregabalin'], message: 'Opioid + Gabapentinoid: Gefahr einer dämpfenden Wirkung auf das ZNS (Atemdepression).', severity: 'high' },
  { drugs: ['tramadol', 'morphin', 'tilidin'], conflict: ['citalopram', 'sertralin', 'escitalopram', 'fluoxetin', 'venlafaxin', 'duloxetin', 'amitriptylin'], message: 'Opioid + Antidepressiva: Risiko eines lebensbedrohlichen Serotoninsyndroms.', severity: 'high' },
  { drugs: ['pramipexol', 'ropinirol', 'rotigotin', 'levodopa', 'carbidopa'], conflict: ['metoclopramid', 'haloperidol', 'risperidon', 'quetiapin'], message: 'Dopaminagonisten + Antagonisten (z.B. MCP gegen Übelkeit): Heben gegenseitig ihre therapeutische Wirkung auf.', severity: 'moderate' },
  { drugs: ['pramipexol', 'ropinirol'], conflict: ['ciprofloxacin', 'erythromycin'], message: 'Dopaminagonisten + Antibiotika: Kann Wirkstoffkonzentrationen unvorhersehbar anheben.', severity: 'moderate' },
  { drugs: ['gabapentin'], conflict: ['pregabalin'], message: 'Doppelmedikation! Beide Wirkstoffe blockieren dieselben Calciumkanäle. Überdosierungsrisiko.', severity: 'moderate' },
];

export default function MedsTab({
  meds,
  onAddMed,
  onDeleteMed,
  onUpdateMed,
  onRefillMed,
  settings,
  onSaveSettings,
  showToast,
  patientName,
  patientBday,
}: MedsTabProps) {
  const handleExportSingleMedPlanPdf = () => {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
      const W = 210;
      const H = 297;
      const m = 15;
      const mr = W - m;
      const contentW = mr - m;
      const createdAt = new Date().toLocaleDateString('de-DE');

      const drawDataMatrix = (d: jsPDF, x: number, y: number, size: number) => {
        const cells = 18;
        const cellSize = size / cells;
        d.setFillColor(0, 0, 0);
        for (let r = 0; r < cells; r++) {
          for (let c = 0; c < cells; c++) {
            let isBlack = false;
            // DataMatrix Finder Pattern (L-shape left/bottom, alternating top/right)
            if (c === 0 || r === cells - 1) isBlack = true;
            else if (r === 0) isBlack = c % 2 === 0;
            else if (c === cells - 1) isBlack = r % 2 === 1;
            else {
              // Pseudo-random data for mockup
              const hash = (r * 13 + c * 7) % 11;
              isBlack = hash > 4;
            }
            if (isBlack) {
              d.rect(x + c * cellSize, y + r * cellSize, cellSize, cellSize, 'F');
            }
          }
        }
      };

      // Title / Header
      doc.setFillColor(10, 22, 40);
      doc.rect(0, 0, W, 25, 'F');

      doc.setFillColor(220, 38, 38); // Clinical Red line
      doc.rect(0, 25, W, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('BUNDESEINHEITLICHER MEDIKATIONSPLAN', m, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(160, 180, 210);
      doc.text('SymptoChron – Generiert am ' + createdAt, mr, 10, { align: 'right' });

      // Patient Info Box
      doc.setFillColor(242, 245, 250);
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(m, 32, contentW - 35, 18, 2, 2, 'FD');

      // MIO-DataMatrix Code (Mockup)
      drawDataMatrix(doc, mr - 25, 32, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(100, 116, 139);
      doc.text('MIO-XML / PVS-Scan', mr - 16, 52, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Name, Vorname des Patienten', m + 4, 37);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(patientName || 'Nicht angegeben', m + 4, 44);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Geburtsdatum', m + 100, 37);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(patientBday || 'Nicht angegeben', m + 100, 44);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Druckdatum', m + 150, 37);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(createdAt, m + 150, 44);

      // Columns Configuration
      const cols = [
        { key: 'name', label: 'Präparat / Wirkstoff', w: 50, x: m },
        { key: 'dose', label: 'Stärke', w: 22, x: m + 50 },
        { key: 'form', label: 'Form', w: 22, x: m + 72 },
        { key: 'morning', label: 'Morg.', w: 14, x: m + 94, bg: [245, 180, 30] },
        { key: 'noon', label: 'Mitt.', w: 14, x: m + 108, bg: [59, 130, 246] },
        { key: 'evening', label: 'Abend.', w: 14, x: m + 122, bg: [139, 92, 246] },
        { key: 'night', label: 'Nacht', w: 14, x: m + 136, bg: [30, 64, 175] },
        { key: 'note', label: 'Hinweise / Bemerkungen', w: contentW - 150, x: m + 150 },
      ];

      // Headings
      let y = 56;
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
        doc.text(c.label, c.x + c.w / 2, y + 6.5, { align: 'center' });
      });

      y += 10;

      // Render rows
      if (meds.length === 0) {
        doc.setFillColor(255, 255, 255);
        doc.rect(m, y, contentW, 14, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('Keine aktiven Medikamente erfasst.', m + contentW / 2, y + 9, { align: 'center' });
        y += 14;
      } else {
        meds.forEach((med, idx) => {
          const isEven = idx % 2 === 0;
          doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 253 : 255);
          doc.rect(m, y, contentW, 12, 'F');

          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.15);
          doc.rect(m, y, contentW, 12, 'D');

          // Text values
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);
          doc.text(med.name, m + 2.5, y + 7.5);

          // PZN indicator if exists
          if (med.pzn) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(120, 130, 140);
            doc.text(`PZN: ${med.pzn}`, m + 2.5, y + 10.5);
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(med.dose || '—', m + 52.5, y + 7.5);
          doc.text(med.form || '—', m + 74.5, y + 7.5);

          // Schedule inputs
          const dailyCount = Object.keys(med.schedule).reduce((acc, k) => acc + (med.schedule[k] || 0), 0);
          if (dailyCount === 0) {
            // Span schedule columns for PRN text
            doc.setFillColor(254, 243, 199);
            doc.rect(m + 94.5, y + 0.5, 55, 11, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(217, 119, 6);
            doc.text('Bei Bedarf / PRN', m + 122, y + 7.5, { align: 'center' });
          } else {
            const slots = ['morning', 'noon', 'evening', 'night'];
            slots.forEach((sKey, sIdx) => {
              const val = med.schedule[sKey];
              const hasVal = val > 0;
              const colObj = cols[3 + sIdx];

              if (hasVal) {
                doc.setFillColor(255, 248, 225);
                doc.rect(colObj.x + 0.5, y + 0.5, colObj.w - 1, 11, 'F');
              }

              doc.setFont('helvetica', hasVal ? 'bold' : 'normal');
              doc.setFontSize(9.5);
              doc.setTextColor(hasVal ? 30 : 180, hasVal ? 41 : 190, hasVal ? 59 : 200);
              doc.text(hasVal ? String(val) : '—', colObj.x + colObj.w / 2, y + 7.5, { align: 'center' });
            });
          }

          // Notes
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          const limitNote = med.note && med.note.length > 25 ? `${med.note.slice(0, 23)}...` : med.note || '';
          doc.text(limitNote, m + 152.5, y + 7.5);

          y += 12;
        });
      }

      // Signatures
      y += 15;
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(m, y, m + 50, y);
      doc.line(m + 65, y, m + 115, y);
      doc.line(m + 130, y, m + 180, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Datum / Ort', m, y + 4);
      doc.text('Unterschrift Ärztin/Arzt', m + 65, y + 4);
      doc.text('Unterschrift Patient', m + 130, y + 4);

      // Disclaimer
      doc.setDrawColor(200, 210, 225);
      doc.line(m, H - 15, mr, H - 15);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'HINWEIS: Dieser Plan ist eine Orientierungshilfe. Änderungen stimmen Sie bitte mit Ihrem Arzt ab.',
        m,
        H - 9
      );

      doc.save(`Medikationsplan_${patientName ? patientName.replace(/\s+/g, '_') : 'Patient'}_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('📄 Medikationsplan PDF heruntergeladen!');
    } catch (err) {
      console.error(err);
      showToast('❌ Fehler beim PDF-Export.');
    }
  };
  interface DrugConflict {
    medA: string;
    medB: string;
    message: string;
    severity: 'high' | 'moderate';
  }

  const [selectedConflict, setSelectedConflict] = useState<DrugConflict | null>(null);

  // Medication form modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [form, setForm] = useState('');
  const [pzn, setPzn] = useState('');
  const [stock, setStock] = useState<number | ''>('');
  const [packSize, setPackSize] = useState<number | ''>('');
  const [thresholdDays, setThresholdDays] = useState(7);
  const [morning, setMorning] = useState<number>(0);
  const [noon, setNoon] = useState<number>(0);
  const [evening, setEvening] = useState<number>(0);
  const [night, setNight] = useState<number>(0);
  const [note, setNote] = useState('');
  const [wirkstoff, setWirkstoff] = useState('');
  const [source, setSource] = useState('Manuelle Eingabe');
  const [stand, setStand] = useState('');
  const [verified, setVerified] = useState(false);

  // Scanner Simulator & Real Camera States
  const [showScanner, setShowScanner] = useState(false);
  const [scanLaserActive, setScanLaserActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [hasStartedCamera, setHasStartedCamera] = useState(false);

  useEffect(() => {
    let qrScanner: Html5Qrcode | null = null;
    if (showScanner) {
      setCameraPermissionError(null);
      setHasStartedCamera(false);
      setScanLaserActive(true);

      const timeoutId = setTimeout(() => {
        const element = document.getElementById("pzn-reader-canvas");
        if (!element) return;

        try {
          qrScanner = new Html5Qrcode("pzn-reader-canvas");
          qrScanner.start(
            { facingMode: "environment" },
            {
              fps: 15,
              qrbox: (width, height) => {
                const w = Math.min(width, 360) * 0.85;
                const h = 120;
                return { width: w, height: h };
              }
            },
            (decodedText) => {
              let cleanCode = decodedText.trim();

              // 1. Detect BMP (XML DataMatrix)
              if (cleanCode.includes('<MP') || cleanCode.includes('<M ') || cleanCode.includes('v="')) {
                 handleRealBmpScan(cleanCode);
                 setShowScanner(false);
                 return;
              }

              // 2. Detect 1D PZN Code
              if (cleanCode.startsWith('*') && cleanCode.endsWith('*')) {
                cleanCode = cleanCode.substring(1, cleanCode.length - 1);
              }
              const digitMatch = cleanCode.match(/\d{7,13}/);
              if (digitMatch) {
                const code = digitMatch[0];
                showToast(`📷 Barcode erkannt: PZN ${code}`);
                handleMockPznScan(code);
                setShowScanner(false);
              } else {
                showToast(`📷 Code erkannt: "${cleanCode}". Format nicht als PZN oder BMP-Plan erkannt.`);
              }
            },
            () => {
              // Ignore silent frame errors
            }
          ).then(() => {
            setHasStartedCamera(true);
          }).catch((err) => {
            console.error("Camera start failed:", err);
            setCameraPermissionError(
              "Kamera-Zugriff fehlgeschlagen oder blockiert. Verwende den PZN Emulator oder tippe sie manuell ein."
            );
          });
        } catch (e) {
          console.error("Scanner init error:", e);
        }
      }, 350);

      return () => {
        clearTimeout(timeoutId);
        if (qrScanner) {
          if (qrScanner.isScanning) {
            qrScanner.stop().catch((e) => console.error("Error stopping scanner:", e));
          }
        }
      };
    }
  }, [showScanner]);

  // BfArM Database Search & Scan States
  const [searchTerm, setSearchTerm] = useState('');
  const [bfarmResults, setBfarmResults] = useState<any[] | null>(null);
  const [bfarmSource, setBfarmSource] = useState<string | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);

  // Alarm settings states
  const [morningTime, setMorningTime] = useState(settings.alarmTimes?.morning || '08:00');
  const [noonTime, setNoonTime] = useState(settings.alarmTimes?.noon || '12:00');
  const [eveningTime, setEveningTime] = useState(settings.alarmTimes?.evening || '18:00');
  const [nightTime, setNightTime] = useState(settings.alarmTimes?.night || '22:00');

  const handleOpenAddForm = () => {
    setName('');
    setDose('');
    setForm('');
    setPzn('');
    setStock('');
    setPackSize('');
    setThresholdDays(7);
    setMorning(0);
    setNoon(0);
    setEvening(0);
    setNight(0);
    setNote('');
    setWirkstoff('');
    setSource('Manuelle Eingabe');
    setStand('');
    setVerified(false);
    setEditingMed(null);
    setShowAddForm(true);
  };

  const handleOpenEdit = (m: Medication) => {
    setEditingMed(m);
    setName(m.name);
    setDose(m.dose);
    setForm(m.form || '');
    setPzn(m.pzn || '');
    setStock(m.stock !== undefined ? m.stock : '');
    setPackSize(m.packSize !== undefined ? m.packSize : '');
    setThresholdDays(m.thresholdDays);
    setMorning(m.schedule.morning);
    setNoon(m.schedule.noon);
    setEvening(m.schedule.evening);
    setNight(m.schedule.night);
    setNote(m.note || '');
    setWirkstoff(m.wirkstoff || '');
    setSource(m.source || 'Manuelle Eingabe');
    setStand(m.stand || '');
    setVerified(!!m.verified);
    setShowAddForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      showToast('⚠️ Medikamentenname ist ein Pflichtfeld.');
      return;
    }

    const payload: Medication = {
      id: editingMed ? editingMed.id : 'med_' + Date.now().toString(36),
      name: name.trim(),
      pzn: pzn.trim() || undefined,
      wirkstoff: wirkstoff.trim() || undefined,
      dose: dose.trim(),
      form: form.trim() || undefined,
      note: note.trim() || undefined,
      schedule: {
        morning: Number(morning),
        noon: Number(noon),
        evening: Number(evening),
        night: Number(night),
      },
      stock: stock !== '' ? Number(stock) : undefined,
      packSize: packSize !== '' ? Number(packSize) : undefined,
      thresholdDays: Number(thresholdDays),
      active: editingMed ? editingMed.active : true,
      source: source.trim() || undefined,
      stand: stand.trim() || undefined,
      verified: verified,
    };

    const validation = validateMedication(payload);
    if (!validation.valid) {
      showToast(`⚠️ ${validation.errors.join(' ')}`);
      return;
    }

    if (editingMed) {
      onUpdateMed(payload);
      showToast('✅ Medikament aktualisiert.');
    } else {
      onAddMed(payload);
      showToast('✅ Medikament hinzugefügt.');
    }

    setShowAddForm(false);
  };

  const handleRealBmpScan = (xmlString: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "text/xml");
      const medNodes = doc.getElementsByTagName("M"); // 'M' represents Medikament in German BMP XML

      if (medNodes.length === 0) {
        showToast('⚠️ Keine Medikamente im gescannten Plan (XML) gefunden.');
        return;
      }

      let importedCount = 0;
      for (let i = 0; i < medNodes.length; i++) {
        const node = medNodes[i];
        const pzn = node.getAttribute("p") || '';
        const name = node.getAttribute("a") || 'Unbekanntes Präparat';
        const form = node.getAttribute("f") || '';
        const doseStr = node.getAttribute("d") || '';

        // BMP Dosage schema: m (morning), v (noon), h (evening), z (night)
        const m = node.getAttribute("m") || '0';
        const v = node.getAttribute("v") || '0';
        const h = node.getAttribute("h") || '0';
        const z = node.getAttribute("z") || '0';

        const parseDose = (val: string) => val && val.match(/\d/) ? Number(val.replace(/[^\d.]/g, '')) : 0;

        const newMed: Medication = {
          id: 'med_bmp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
          name: name,
          pzn: pzn || undefined,
          wirkstoff: node.getAttribute("w") || undefined,
          dose: doseStr || 'Nach Plan',
          form: form || undefined,
          schedule: {
            morning: parseDose(m),
            noon: parseDose(v),
            evening: parseDose(h),
            night: parseDose(z)
          },
          stock: 50,
          packSize: 50,
          thresholdDays: 7,
          active: true,
          verified: true,
          source: 'Medikationsplan (BMP Scan)',
          stand: todayStr(),
          note: 'Importiert aus gescanntem BMP-Code (MIO XML)'
        };
        onAddMed(newMed);
        importedCount++;
      }
      showToast(`✅ Erfolgreich! ${importedCount} Medikamente aus BMP eingelesen.`);
    } catch (e) {
      console.error(e);
      showToast('❌ Fehler beim Auslesen des BMP XML-Formats.');
    }
  };

  const handleTriggerMockScan = (pznOrBmp: string) => {
    setScanLaserActive(true);
    showToast('⏳ Analysiere Barcode / QR-Code...');

    setTimeout(() => {
      setScanLaserActive(false);
      setShowScanner(false);

      if (pznOrBmp === 'BMP') {
        // German Bundesmedikationsplan (BMP) import with real German PZNs!
        const bmpImport = [
          {
            id: 'med_bmp1_' + Date.now().toString(36),
            name: 'Pramipexol AL 0,18 mg Tabletten',
            pzn: '01243549',
            wirkstoff: 'Pramipexol-dihydrochlorid-monohydrat',
            dose: '0,18 mg',
            form: 'Tablette',
            schedule: { morning: 0, noon: 0, evening: 0, night: 1 },
            stock: 100,
            packSize: 100,
            thresholdDays: 7,
            active: true,
            verified: true,
            source: 'BfArM-Datenbank (Local Copy - Offline)',
            stand: '09.07.2026',
            note: 'Aus BMP importiert (Wirkstoff: Pramipexol-dihydrochlorid-monohydrat)'
          },
          {
            id: 'med_bmp2_' + Date.now().toString(36),
            name: 'Ibuflam 400 mg Lichtenstein Filmtabletten',
            pzn: '03131754',
            wirkstoff: 'Ibuprofen',
            dose: '400 mg',
            form: 'Filmtablette',
            schedule: { morning: 1, noon: 0, evening: 1, night: 0 },
            stock: 50,
            packSize: 50,
            thresholdDays: 5,
            active: true,
            verified: true,
            source: 'BfArM-Datenbank (Local Copy - Offline)',
            stand: '09.07.2026',
            note: 'Aus BMP importiert (Wirkstoff: Ibuprofen)'
          },
        ];

        bmpImport.forEach(onAddMed);
        showToast('✅ BMP importiert: 2 deutsche Medikamente mit PZNs angelegt!');
      } else {
        // German PZN Scan
        handleMockPznScan(pznOrBmp);
      }
    }, 1800);
  };

  const handleMockPznScan = async (code: string) => {
    setOnlineLoading(true);
    try {
      const response = await fetch('/api/bfarm/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: code }),
      });
      const data = await response.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const prod = data.results[0];
        const newMed: Medication = {
          id: 'med_pzn_' + Date.now().toString(36),
          name: prod.name,
          pzn: prod.pzn,
          wirkstoff: prod.wirkstoff,
          dose: prod.dose,
          form: prod.form,
          schedule: { morning: 0, noon: 0, evening: 1, night: 1 }, // standard RLS dosage evening/night
          stock: Number(prod.packungsgröße) || 100,
          packSize: Number(prod.packungsgröße) || 100,
          thresholdDays: 7,
          active: true,
          source: prod.source || (data.source === 'local_bfarm_db' ? 'BfArM-Datenbank (Local Copy - Offline)' : 'KI-Echtzeit-Schnittstelle (Unverifiziert)'),
          stand: prod.stand || (data.source === 'local_bfarm_db' ? '09.07.2026' : ''),
          verified: prod.verified !== undefined ? prod.verified : (data.source === 'local_bfarm_db'),
          note: `Importiert via PZN Scan (ATC: ${prod.atc}, Wirkstoff: ${prod.wirkstoff}, Hersteller: ${prod.hersteller})`
        };
        onAddMed(newMed);
        showToast(`✅ PZN-Scan erfolgreich! ${prod.name} geladen.`);
      } else {
        showToast(`⚠️ PZN ${code} nicht in der lokalen Datenbank gefunden. Es wurde kein Datensatz angelegt.`);
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Fehler bei der Verbindung zum BfArM PZN-Auflöser.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleQueryBfarm = async (customQuery?: string) => {
    const q = customQuery !== undefined ? customQuery : searchTerm;
    if (!q.trim()) return;
    setOnlineLoading(true);
    setBfarmResults(null);
    setBfarmSource(null);

    try {
      const response = await fetch('/api/bfarm/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = await response.json();
      if (data && Array.isArray(data.results)) {
        setBfarmResults(data.results);
        setBfarmSource('Lokale SymptoChron-SQLite-Medikamentendatenbank');
        if (data.results.length === 0) {
          showToast('⚠️ Keine Treffer im BfArM-Bestand gefunden.');
        } else {
          showToast(`✅ ${data.results.length} Medikamente im BfArM-Verzeichnis gefunden!`);
        }
      } else {
        showToast('⚠️ Fehler bei der Datenübertragung.');
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Fehler bei der Verbindung zum BfArM-Portal.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleImportBfarmMed = (prod: any) => {
    setName(prod.name);
    setDose(prod.dose);
    setForm(prod.form);
    setPzn(prod.pzn);
    setWirkstoff(prod.wirkstoff || '');
    setSource(prod.source || bfarmSource || 'BfArM-Datenbank (Local Copy - Offline)');
    setStand(prod.stand || '09.07.2026');
    setVerified(prod.verified !== undefined ? prod.verified : true);
    setPackSize(Number(prod.packungsgröße) || 100);
    setStock(Number(prod.packungsgröße) || 100);
    setMorning(0);
    setNoon(0);
    setEvening(0);
    setNight(0);
    setEditingMed(null);
    setShowAddForm(true);
    showToast(`📝 Daten für "${prod.name}" übertragen! Tragezeiten festlegen & speichern.`);
  };

  const handleSaveAlarms = () => {
    onSaveSettings({
      ...settings,
      alarmTimes: {
        morning: morningTime,
        noon: noonTime,
        evening: eveningTime,
        night: nightTime,
      },
    });
    showToast('⏰ Wecker-Uhrzeiten gespeichert.');
  };

  const handleToggleNotifications = () => {
    const isEn = !settings.notificationsEnabled;

    if (isEn) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        Notification.requestPermission().then((permission) => {
          if (permission !== 'granted') {
            showToast('⚠️ Benachrichtigungs-Berechtigung wurde blockiert/abgelehnt.');
          } else {
            showToast('🔔 Benachrichtigungen & Wecker aktiv!');
            try {
              const testNotif = new Notification('🔔 Symptochron Push-Aktiv', {
                body: 'Bereit! Du wirst nun pünktlich an deine Medikamente erinnert.',
              });
              testNotif.onclick = () => window.focus();
            } catch (err) {
              console.error(err);
            }
          }
        });
      } else {
        showToast('⚠️ Ihr Browser unterstützt keine Desktop-Benachrichtigungen.');
      }
    } else {
      showToast('🔕 Erinnerungen deaktiviert.');
    }

    onSaveSettings({
      ...settings,
      notificationsEnabled: isEn,
    });
  };

  const handleSendTestNotification = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('⚠️ Ihr Browser unterstützt keine Desktop-Benachrichtigungen.');
      return;
    }
    if (Notification.permission !== 'granted') {
      showToast('⚠️ Berechtigung nicht erteilt. Bitte aktiviere die Push-Erinnerungen zuerst.');
      return;
    }

    const testMeds = meds.filter(m => m.active);
    const bodyText = testMeds.length > 0
      ? `Beispiel für fällige Medikamente:\n` + testMeds.slice(0, 3).map(m => `• ${m.name} (${m.dose})`).join('\n')
      : 'Keine aktiven Medikamente eingetragen. Trage Medikamente ein, um sie hier zu sehen!';

    try {
      const notif = new Notification('🔔 Symptochron Test-Erinnerung', {
        body: bodyText,
        requireInteraction: true
      });
      notif.onclick = () => window.focus();
      showToast('🚀 Test-Push gesendet!');
    } catch (err) {
      console.error(err);
      showToast('⚠️ Fehler beim Senden. Im Iframe sind Berechtigungen evtl. eingeschränkt.');
    }
  };

  // Verify internal overlaps
  const getInternalConflicts = (): DrugConflict[] => {
    const conflictsList: DrugConflict[] = [];

    for (let i = 0; i < meds.length; i++) {
      for (let j = i + 1; j < meds.length; j++) {
        const aName = meds[i].name.toLowerCase();
        const bName = meds[j].name.toLowerCase();

        LOCAL_DRUG_CONFLICTS.forEach(rule => {
          const aInDrugs = rule.drugs.some(k => aName.includes(k));
          const bInConflict = rule.conflict.some(k => bName.includes(k));
          const bInDrugs = rule.drugs.some(k => bName.includes(k));
          const aInConflict = rule.conflict.some(k => aName.includes(k));

          if ((aInDrugs && bInConflict) || (bInDrugs && aInConflict)) {
            conflictsList.push({
              medA: meds[i].name,
              medB: meds[j].name,
              message: rule.message,
              severity: rule.severity as 'high' | 'moderate',
            });
          }
        });
      }
    }
    return conflictsList;
  };

  const conflicts = getInternalConflicts();

  return (
    <div className="space-y-6">
      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-amber-500/5 border border-amber-500/25 rounded-2xl text-xs space-y-3">
          <div className="font-bold flex items-center gap-1.5 text-amber-450">
            <AlertTriangle className="h-4.5 w-4.5" />
            <span>Erkannte Wechselwirkungen (Klicken für Details):</span>
          </div>
          <div className="space-y-1.5">
            {conflicts.map((con, idx) => {
              const isHigh = con.severity === 'high';
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedConflict(con)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:scale-[1.01] transition-all ${
                    isHigh
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-350 hover:bg-rose-500/15'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-350 hover:bg-amber-500/15'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                    <span className="text-[12px]">{isHigh ? '🚨' : '⚠️'}</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                      isHigh ? 'bg-rose-500/20 text-rose-450' : 'bg-amber-500/20 text-amber-450'
                    }`}>
                      {isHigh ? 'Kritisch (Sehr hoch)' : 'Moderat (Mittel)'}
                    </span>
                    <span className="font-bold text-slate-200">{con.medA} + {con.medB}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Details →</span>
                </div>
              );
            })}
          </div>

          {/* Medical Disclaimer */}
          <div className="pt-2 border-t border-amber-500/10 text-[9px] text-slate-500 leading-relaxed font-sans">
            ⚠️ <strong>Haftungsausschluss:</strong> Diese automatische Prüfung ist eine Ergänzung und ersetzt nicht die fachliche Beratung durch eine Ärztin/einen Arzt oder in einer Apotheke. Der Prüfungs-Regelsatz ist lokal hinterlegt und erhebt keinen Anspruch auf Vollständigkeit.
          </div>
        </div>
      )}

      {/* Main Meds List card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Medikationsplan</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Aktive Dauer- und Bedarfsmedikation</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSingleMedPlanPdf}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-850 hover:border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <FileText className="h-4 w-4 text-rose-500" /> Plan drucken (PDF)
            </button>
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/15 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Hinzufügen
            </button>
          </div>
        </div>

        {meds.length > 0 ? (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-955/20">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="p-3.5 pl-4">Präparat / Wirkstoff</th>
                    <th className="p-3.5">Stärke</th>
                    <th className="p-3.5">Form</th>
                    <th className="p-3.5 text-center w-14">Morg.</th>
                    <th className="p-3.5 text-center w-14">Mitt.</th>
                    <th className="p-3.5 text-center w-14">Abend.</th>
                    <th className="p-3.5 text-center w-14">Nacht</th>
                    <th className="p-3.5">Hinweise</th>
                    <th className="p-3.5">Bestand</th>
                    <th className="p-3.5 text-right pr-4">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {meds.map((med) => {
                    const dailyCount = Object.keys(med.schedule).reduce((acc, k) => acc + (med.schedule[k] || 0), 0);
                    const hasStock = med.stock !== undefined && med.stock !== null;

                    let stockDays = 0;
                    let isStockLow = false;
                    if (hasStock) {
                      if (dailyCount > 0) {
                        stockDays = Math.floor(med.stock! / dailyCount);
                        isStockLow = stockDays < med.thresholdDays;
                      } else {
                        isStockLow = med.stock! < 10;
                      }
                    }

                    const isPrn = dailyCount === 0;

                    return (
                      <tr key={med.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3.5 pl-4 font-bold text-slate-100">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span>{med.name}</span>
                              {med.verified ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={`Verifiziert aus: ${med.source || 'BfArM'} (${med.stand || 'Datenstand unbekannt'})`}>
                                  ✓ Verifiziert
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700/50" title={med.source || 'Manuelle Eingabe'}>
                                  Manuell
                                </span>
                              )}
                            </div>
                            {med.wirkstoff && <span className="text-[10px] text-slate-400 font-medium mt-0.5">{med.wirkstoff}</span>}
                            {med.pzn && <span className="text-[9px] text-slate-500 font-mono mt-0.5">PZN {med.pzn}</span>}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono">{med.dose || '—'}</td>
                        <td className="p-3.5 text-slate-300">{med.form || '—'}</td>

                        {isPrn ? (
                          <td colSpan={4} className="p-3.5 text-center text-[10px] text-amber-500 font-bold bg-amber-500/5 uppercase tracking-wider">
                            Bei Bedarf
                          </td>
                        ) : (
                          <>
                            <td className="p-3.5 text-center font-mono text-slate-100 font-bold w-14 border-l border-r border-slate-850/40">
                              {med.schedule.morning > 0 ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  {med.schedule.morning}
                                </span>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="p-3.5 text-center font-mono text-slate-100 font-bold w-14 border-r border-slate-850/40">
                              {med.schedule.noon > 0 ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {med.schedule.noon}
                                </span>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="p-3.5 text-center font-mono text-slate-100 font-bold w-14 border-r border-slate-850/40">
                              {med.schedule.evening > 0 ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  {med.schedule.evening}
                                </span>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="p-3.5 text-center font-mono text-slate-100 font-bold w-14 border-r border-slate-850/40">
                              {med.schedule.night > 0 ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                  {med.schedule.night}
                                </span>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                          </>
                        )}

                        <td className="p-3.5 text-slate-400 italic max-w-[200px] truncate" title={med.note}>
                          {med.note || '—'}
                        </td>
                        <td className="p-3.5">
                          {hasStock ? (
                            <div className="flex flex-col">
                              <span className={`font-bold ${isStockLow ? 'text-rose-405 font-black' : 'text-slate-300'}`}>
                                {med.stock!.toFixed(0)} Stk.
                              </span>
                              {dailyCount > 0 && (
                                <span className="text-[9px] text-slate-500">
                                  {stockDays} Tage
                                </span>
                              )}
                              {isStockLow && (
                                <button
                                  type="button"
                                  onClick={() => onRefillMed(med.id)}
                                  className="mt-1 flex items-center justify-center gap-0.5 py-0.5 px-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/35 text-rose-405 text-[9px] font-bold rounded cursor-pointer"
                                >
                                  Refill
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(med)}
                              className="p-1 px-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 hover:border-slate-800 rounded-md text-[10px] font-bold cursor-pointer"
                            >
                              Bearb.
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMed(med.id)}
                              className="p-1 text-slate-400 hover:text-rose-450 hover:bg-rose-500/10 rounded-md transition-all cursor-pointer"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Layout (Visible only on small screens) */}
            <div className="block md:hidden space-y-3">
              {meds.map((med) => {
                const dailyCount = Object.keys(med.schedule).reduce((acc, k) => acc + (med.schedule[k] || 0), 0);
                const hasStock = med.stock !== undefined && med.stock !== null;

                let stockDays = 0;
                let isStockLow = false;
                if (hasStock) {
                  if (dailyCount > 0) {
                    stockDays = Math.floor(med.stock! / dailyCount);
                    isStockLow = stockDays < med.thresholdDays;
                  } else {
                    isStockLow = med.stock! < 10;
                  }
                }

                const isPrn = dailyCount === 0;

                return (
                  <div key={med.id} className="bg-slate-900 border border-slate-850 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-slate-100">{med.name}</span>
                          {med.verified ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={`Verifiziert aus: ${med.source || 'BfArM'} (${med.stand || 'Datenstand unbekannt'})`}>
                              ✓ Verifiziert
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700/50" title={med.source || 'Manuelle Eingabe'}>
                              Manuell
                            </span>
                          )}
                        </div>
                        {med.wirkstoff && <div className="text-[10px] text-slate-400 font-medium mt-0.5">{med.wirkstoff}</div>}
                        {med.pzn && <div className="text-[9px] text-slate-500 font-mono mt-0.5">PZN {med.pzn}</div>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(med)}
                          className="p-1 px-2.5 bg-slate-955 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMed(med.id)}
                          className="p-1 text-slate-400 hover:text-rose-450 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                      {med.dose && <div className="bg-slate-950/60 p-1 px-2 rounded border border-slate-850">Stärke: <span className="text-slate-250 font-bold">{med.dose}</span></div>}
                      {med.form && <div className="bg-slate-955/60 p-1 px-2 rounded border border-slate-850">Form: <span className="text-slate-250 font-bold">{med.form}</span></div>}
                    </div>

                    {/* Schedule Row */}
                    <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-850/60 flex justify-between items-center text-center">
                      {isPrn ? (
                        <div className="w-full text-center text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                          Bei Bedarf
                        </div>
                      ) : (
                        ['morning', 'noon', 'evening', 'night'].map((slot, idx) => {
                          const val = med.schedule[slot];
                          const label = ['Morg.', 'Mitt.', 'Abend.', 'Nacht'][idx];
                          const bg = ['bg-blue-500/10 text-blue-400 border-blue-500/20', 'bg-amber-500/10 text-amber-400 border-amber-500/20', 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', 'bg-purple-500/10 text-purple-400 border-purple-500/20'][idx];
                          return (
                            <div key={slot} className="flex-1 flex flex-col items-center">
                              <span className="text-[8px] uppercase tracking-wide text-slate-500 block mb-0.5">{label}</span>
                              {val > 0 ? (
                                <span className={`inline-flex items-center justify-center h-5.5 w-5.5 rounded-full text-[10px] font-black border ${bg}`}>
                                  {val}
                                </span>
                              ) : <span className="text-slate-700 text-[10px]">—</span>}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {med.note && (
                      <p className="text-[10px] text-slate-400 italic bg-slate-955/30 p-2 rounded-lg border border-slate-900">{med.note}</p>
                    )}

                    {hasStock && (
                      <div className="flex justify-between items-center p-2.5 bg-slate-955/60 border border-slate-900 rounded-xl">
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase font-bold text-slate-500">Bestand</span>
                          <span className={`text-[11px] font-bold ${isStockLow ? 'text-rose-400 font-extrabold' : 'text-slate-300'}`}>
                            {med.stock!.toFixed(0)} Stück {dailyCount > 0 && `(ca. ${stockDays} Tage)`}
                          </span>
                        </div>
                        {isStockLow && (
                          <button
                            type="button"
                            onClick={() => onRefillMed(med.id)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-rose-600/10 border border-rose-500/30 text-rose-400 text-[9px] font-bold rounded-lg cursor-pointer"
                          >
                            Auffüllen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-36 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/25">
            <span className="text-xs text-slate-500 italic p-4 text-center">
              Noch keine Medikamente angelegt. Füge dein erstes Medikament hinzu, um die Erfassung zu starten.
            </span>
          </div>
        )}
      </div>

      {/* Simulated Scanner Section */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <ScanLine className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Medikationsplan / PZN scannen</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Scanne Barcodes auf deutschen Medikamentenschachteln (PZN) oder BMP Pläne</p>
          </div>
        </div>

        {showScanner ? (
          <div className="space-y-4">
            {/* Real Camera scanner or fallback simulation */}
            <div className="relative w-full max-w-lg mx-auto bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col p-5 min-h-[420px]">

              {/* Corner indicators */}
              <div className="absolute top-4 left-4 h-6 w-6 border-t-3 border-l-3 border-blue-500 pointer-events-none z-10" />
              <div className="absolute top-4 right-4 h-6 w-6 border-t-3 border-r-3 border-blue-500 pointer-events-none z-10" />
              <div className="absolute bottom-4 left-4 h-6 w-6 border-b-3 border-l-3 border-blue-500 pointer-events-none z-10" />
              <div className="absolute bottom-4 right-4 h-6 w-6 border-b-3 border-r-3 border-blue-500 pointer-events-none z-10" />

              {/* Scanning laser sweep */}
              {scanLaserActive && (
                <motion.div
                  initial={{ top: '10%' }}
                  animate={{ top: '90%' }}
                  transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse', ease: 'easeInOut' }}
                  className="absolute left-4 right-4 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-lg shadow-red-500/50 z-20"
                />
              )}

              {/* Real-time Camera Feed Canvas */}
              <div className="relative w-full aspect-video md:aspect-[4/3] bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden mb-4 z-0">
                <div id="pzn-reader-canvas" className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:absolute [&_video]:inset-0" />

                {/* Loader overlay */}
                {!hasStartedCamera && !cameraPermissionError && (
                  <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-950/90 text-slate-400 text-xs text-center p-4">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mb-2" />
                    <span className="font-bold text-slate-200">Kamera wird gestartet...</span>
                    <span className="text-[10px] text-slate-550 mt-1">Bitte erteile die Berechtigung für deine rückseitige Kamera, falls gefragt.</span>
                  </div>
                )}

                {/* Camera error / fallback indicator */}
                {cameraPermissionError && (
                  <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-950/95 text-slate-400 text-xs text-center p-6 space-y-2">
                    <AlertTriangle className="h-6 w-6 text-amber-500 mb-1" />
                    <span className="font-bold text-slate-200">Kamera-Modus nicht verfügbar</span>
                    <p className="text-[10px] text-slate-550 max-w-xs leading-normal">
                      {cameraPermissionError}
                    </p>
                    <span className="text-[9px] bg-slate-900 text-amber-500 px-2 py-0.5 rounded border border-slate-800">
                      Nutze die Schnellauswahl unten, um eine PZN zu simulieren
                    </span>
                  </div>
                )}
              </div>

              <div className="text-center space-y-1 relative z-10 mb-4">
                <span className="inline-block px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[9px] font-bold uppercase rounded-full">
                  Kamera-Erfassung aktiv
                </span>
                <p className="text-[10px] text-slate-400 leading-normal max-w-sm mx-auto">
                  Halte den Barcode (PZN) einer deutschen Medikamentenschachtel in das Suchfeld oder nutze die RLS-Datenbankschnellwahl:
                </p>
              </div>

              {/* Interactive simulated drug boxes to scan */}
              <div className="grid grid-cols-2 gap-2 mb-4 relative z-10 max-h-48 overflow-y-auto p-1 scrollbar-thin">
                {[
                  { name: 'Sifrol (Pramipexol)', pzn: '06554550', type: 'Dopaminagonist' },
                  { name: 'Restex (L-Dopa)', pzn: '03135249', type: 'Dopamin-Vorstufe' },
                  { name: 'Neupro Pflaster', pzn: '04863028', type: 'Dopaminagonist' },
                  { name: 'Lyrica Kapseln', pzn: '10237424', type: 'Antikonvulsivum' },
                  { name: 'Magnesium Verla', pzn: '04958220', type: 'Mineralpräparat' },
                  { name: 'Targin Retard', pzn: '06431267', type: 'Opioidanalgetikum' }
                ].map(box => (
                  <button
                    key={box.pzn}
                    type="button"
                    onClick={() => handleTriggerMockScan(box.pzn)}
                    className="p-2 border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 hover:border-blue-500/50 rounded-xl text-left transition text-[10px] cursor-pointer"
                  >
                    <div className="font-bold text-slate-200 truncate">{box.name}</div>
                    <div className="text-slate-500 font-mono text-[9px] flex justify-between mt-0.5">
                      <span>PZN {box.pzn}</span>
                      <span className="text-[8px] text-slate-400 bg-slate-950 px-1 rounded">{box.type}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Direct PZN entry for simulation */}
              <div className="border-t border-slate-900/60 pt-3 flex flex-col gap-2 relative z-10">
                <div className="flex gap-1.5 justify-center">
                  <button
                    type="button"
                    onClick={() => handleTriggerMockScan('BMP')}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-xl shadow-lg shadow-blue-600/15 transition-all cursor-pointer"
                  >
                    Bundeseinheitlichen Plan (BMP) einlesen
                  </button>
                </div>

                {/* Manual Simulated Scan Input */}
                <div className="flex gap-1 bg-slate-900 p-1 border border-slate-800 rounded-xl">
                  <input
                    type="text"
                    id="sim-pzn-input"
                    placeholder="Eigene PZN eingeben (z.B. 01243549)"
                    maxLength={8}
                    className="flex-1 px-2.5 py-1 text-[10px] text-slate-300 font-mono bg-transparent outline-none border-none focus:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.currentTarget as HTMLInputElement).value;
                        if (val) handleTriggerMockScan(val);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('sim-pzn-input') as HTMLInputElement;
                      if (input?.value) {
                        handleTriggerMockScan(input.value);
                      } else {
                        showToast('⚠️ Bitte eine PZN-Nummer eingeben.');
                      }
                    }}
                    className="px-3 py-1 bg-slate-950 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold border border-slate-850 cursor-pointer"
                  >
                    Code scannen
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowScanner(false)}
              className="mx-auto block py-2 px-4 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/10 hover:bg-blue-600/15 border border-blue-500/35 text-blue-400 rounded-xl text-xs font-bold shadow-md shadow-blue-600/5 transition-all cursor-pointer"
          >
            <ScanLine className="h-4.5 w-4.5" /> Kamera-Scanner &amp; PZN Emulator starten
          </button>
        )}
      </div>

      {/* BfArM Arzneimittel-Informationssystem */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-emerald-600/10 border border-emerald-500/25 rounded-2xl">
            <Search className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">BfArM-Datenbank (PharmNet.Bund)</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Offizielle Arzneimittel- und Zulassungsdaten des BfArM (Deutsch, seit 2025 kostenfrei)</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="PZN (z.B. 03135249) oder Medikamentenname (z.B. Pramipexol, Restex)"
            className="flex-1 py-3 px-4 bg-slate-955 border border-slate-850 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-650"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQueryBfarm();
            }}
          />
          <button
            type="button"
            onClick={() => handleQueryBfarm()}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            Suchen
          </button>
        </div>

        {onlineLoading && (
          <div className="text-xs text-slate-500 italic pl-1 flex items-center gap-2">
            <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
            <span>Durchsuche deutsches Arzneimittelregister...</span>
          </div>
        )}

        {bfarmSource && (
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] text-slate-500 font-mono tracking-tight uppercase">Datenquelle:</span>
            <span className="text-[9px] bg-slate-950 border border-slate-850 text-emerald-450 px-2 py-0.5 rounded-full font-bold">
              {bfarmSource}
            </span>
          </div>
        )}

        {bfarmResults && bfarmResults.length > 0 && (
          <div className="space-y-3">
            {bfarmResults.map((prod: any, idx: number) => {
              const isProdVerified = prod.verified !== undefined ? prod.verified : true;
              return (
                <div
                  key={prod.pzn + '_' + idx}
                  className={`p-4 bg-slate-950/70 border rounded-2xl text-xs leading-normal font-sans space-y-2.5 transition ${
                    isProdVerified ? 'border-slate-850 hover:border-slate-800' : 'border-amber-500/30 hover:border-amber-500/50 shadow-lg shadow-amber-500/5'
                  }`}
                >
                  {!isProdVerified && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold rounded-xl mb-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Unverifizierter KI-Vorschlag. Bitte Wirkstoff, Stärke und Form manuell abgleichen!</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-slate-200 text-sm block">{prod.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-medium block">
                        Wirkstoff: <span className="text-slate-300 font-bold">{prod.wirkstoff || 'Nicht spezifiziert'}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImportBfarmMed(prod)}
                      className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="h-3 w-3" /> Im Plan anlegen
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-900 text-[10px] text-slate-400 font-mono">
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850/40">
                      <span className="text-[8px] text-slate-500 uppercase font-sans font-bold block">PZN-Nummer</span>
                      <span className="text-slate-300 font-semibold">{prod.pzn}</span>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850/40">
                      <span className="text-[8px] text-slate-500 uppercase font-sans font-bold block">ATC-Code</span>
                      <span className="text-slate-300 font-semibold">{prod.atc || 'N/A'}</span>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850/40">
                      <span className="text-[8px] text-slate-500 uppercase font-sans font-bold block">Dosierung / Form</span>
                      <span className="text-slate-300 truncate block">{prod.dose || '—'} • {prod.form || '—'}</span>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850/40">
                      <span className="text-[8px] text-slate-500 uppercase font-sans font-bold block">Unternehmen</span>
                      <span className="text-slate-300 truncate block">{prod.hersteller || '—'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bfarmResults !== null && bfarmResults.length === 0 && (
          <div className="p-5 bg-slate-950/70 border border-slate-850 rounded-2xl text-xs leading-normal text-slate-300 space-y-3.5">
            <div className="flex items-center gap-2 text-amber-500 font-bold">
              <AlertTriangle className="h-4 w-4" />
              <span>Präparat oder PZN nicht im BfArM-Bestand gefunden</span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Es konnten keine passenden Einträge für deine Suchanfrage im lokalen BfArM-Verzeichnis oder über den Echtzeit-Abgleich gefunden werden.
            </p>

            <div className="pt-2 border-t border-slate-900 space-y-2">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Suchhilfe & nächste Schritte:</span>
              <ul className="list-disc pl-4 space-y-1 text-[10px] text-slate-400">
                <li>Prüfe die Pharmazentralnummer (PZN) auf Tippfehler. Eine gültige PZN hat 7 oder 8 Ziffern.</li>
                <li>Stelle sicher, dass die PZN-Prüfziffer korrekt ist (Plausibilitätsprüfung läuft automatisch).</li>
                <li>Bei ausländischen Präparaten oder Nahrungsergänzungsmitteln existiert oft keine deutsche PZN.</li>
              </ul>
            </div>

            <div className="pt-3 flex gap-2">
              <a
                href={`https://www.google.com/search?q=PZN+${encodeURIComponent(searchTerm)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-300 hover:text-slate-100 text-[10px] font-bold rounded-xl transition cursor-pointer"
              >
                🔍 Im Web nach PZN suchen
              </a>
              <button
                type="button"
                onClick={() => {
                  setName(searchTerm.match(/^\d+$/) ? '' : searchTerm);
                  setDose('');
                  setForm('');
                  setPzn(searchTerm.match(/^\d+$/) ? searchTerm : '');
                  setWirkstoff('');
                  setSource('Manuelle Eingabe (Nicht gefunden)');
                  setStand('');
                  setVerified(false);
                  setEditingMed(null);
                  setShowAddForm(true);
                }}
                className="flex-1 py-2 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-400 hover:text-white text-[10px] font-bold rounded-xl transition cursor-pointer"
              >
                ➕ Trotzdem manuell anlegen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Einnahme Wecker & Alarm settings */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex gap-3">
          <span className="flex h-6 w-6 items-center justify-center bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-black font-mono rounded-full">
            ⏰
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Einnahme-Wecker</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Lokale Wecker-Uhrzeiten für Erinnerungen</p>
          </div>
        </div>

        {/* Alarm times controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'morning', label: '☀️ Morgens' },
            { key: 'noon', label: '🌤️ Mittags' },
            { key: 'evening', label: '🌆 Abends' },
            { key: 'night', label: '🌙 Nachts' },
          ].map(slot => {
            const path = `alarmTimes.${slot.key}`;
            const configured = settings.alarmTimes?.[slot.key] || '08:00';
            return (
              <div key={slot.key} className="space-y-1 bg-slate-950/35 p-3.5 border border-slate-850 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{slot.label}</span>
                <input
                  type="time"
                  value={configured}
                  onChange={(e) => {
                    const cAlarms = { ...settings.alarmTimes, [slot.key]: e.target.value };
                    onSaveSettings({ ...settings, alarmTimes: cAlarms });
                  }}
                  className="w-full py-1.5 px-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold font-mono text-center text-slate-200"
                />
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-850/60 flex items-center justify-between flex-wrap gap-2.5">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-300">Push-Erinnerungen</div>
            <div className="text-[10px] text-slate-500">Erinnert an verpasste Einnahmen</div>
          </div>

          <div className="flex items-center gap-2">
            {settings.notificationsEnabled && (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Testen
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleNotifications}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                settings.notificationsEnabled
                  ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300'
              }`}
            >
              {settings.notificationsEnabled ? '✓ Aktiviert' : 'Deaktiviert'}
            </button>
          </div>
        </div>
      </div>

      {/* Medication Entry Modal overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 bg-slate-900 border border-slate-850 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] space-y-5">
            <h3 className="text-lg font-bold text-slate-100 tracking-tight">
              {editingMed ? '💊 Medikament bearbeiten' : '💊 Medikament hinzufügen'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Medikamentenname *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Produkt- oder Wirkstoffbezeichnung"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Wirkstoff</label>
                <input
                  type="text"
                  value={wirkstoff}
                  onChange={(e) => setWirkstoff(e.target.value)}
                  placeholder="z.B. Pramipexol"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Dosis / Stärke *</label>
                <input
                  type="text"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="z.B. 400 mg oder 0,18 mg"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Form</label>
                <input
                  type="text"
                  value={form}
                  onChange={(e) => setForm(e.target.value)}
                  placeholder="z.B. Tablette oder Kapsel"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">PZN (optional)</label>
                <input
                  type="text"
                  value={pzn}
                  onChange={(e) => setPzn(e.target.value)}
                  placeholder="8-stellig"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Stock (Stück)</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="z.B. 60"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Packungsgröße (Auffüllwert)</label>
                <input
                  type="number"
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="z.B. 100"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Warnschwelle (Tage)</label>
                <input
                  type="number"
                  value={thresholdDays}
                  onChange={(e) => setThresholdDays(parseInt(e.target.value, 10) || 7)}
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Datenquelle</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="z.B. Manuelle Eingabe"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Datenstand / Version</label>
                <input
                  type="text"
                  value={stand}
                  onChange={(e) => setStand(e.target.value)}
                  placeholder="z.B. 09.07.2026"
                  className="w-full py-3 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-850/60 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="verified-checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                    className="h-4 w-4 bg-slate-950 border border-slate-850 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="verified-checkbox" className="text-[10px] font-bold uppercase text-slate-400 cursor-pointer select-none">
                    Offiziell verifiziert (BfArM-Datenbestand)
                  </label>
                </div>
                {verified && source !== 'BfArM-Datenbank (Local Copy - Offline)' && (
                  <span className="text-[9px] text-amber-500 font-semibold leading-normal">
                    ⚠️ Hinweis: Dieser Eintrag wurde manuell angelegt oder stammt aus einer KI-Suche. Bitte verifiziere die PZN, den Wirkstoff und den Hersteller gründlich, bevor du ihn als verifiziert markierst.
                  </span>
                )}
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-850/60 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Einnahmeschema</label>
                <span className="text-[10px] text-slate-500 block">Leere Felder bedeuten Bedarfseinnahmen</span>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'morning', label: '☀️ Mo', val: morning, set: setMorning },
                    { key: 'noon', label: '🌤️ Mi', val: noon, set: setNoon },
                    { key: 'evening', label: '🌆 Ab', val: evening, set: setEvening },
                    { key: 'night', label: '🌙 Na', val: night, set: setNight },
                  ].map(slot => (
                    <div key={slot.key} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-semibold text-slate-400 uppercase">{slot.label}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={slot.val || ''}
                        onChange={(e) => slot.set(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="0"
                        className="w-full text-center py-2 px-1 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Einnahmehinweis</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="z.B. nach dem Essen, nicht zerkauen"
                  className="w-full py-3.5 px-4 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-850/50">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl text-xs"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Conflict Detail Modal */}
      {selectedConflict && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-850 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-black uppercase tracking-wider">
                Wechselwirkungs-Details
              </h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500">Betroffene Präparate:</span>
                <div className="font-bold text-slate-100 mt-1 flex items-center gap-2">
                  <span>{selectedConflict.medA}</span>
                  <span className="text-slate-500">⇆</span>
                  <span>{selectedConflict.medB}</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500">Risiko / Auswirkung:</span>
                <p className="mt-1 font-semibold leading-relaxed text-slate-200">
                  {selectedConflict.message}
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl leading-relaxed text-[11px] text-slate-450">
                💡 <strong>Ärztlicher Hinweis:</strong> Wechselwirkungen können die Wirkung verändern oder Nebenwirkungen verstärken. Besprich diese Kombination bitte bei deiner nächsten Konsultation mit deiner Ärztin/deinem Arzt oder frage in der Apotheke nach Alternativen.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedConflict(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export type { MedsTabProps }; // Exporting interface as well
