import React, { useState } from 'react';
import {
  FileText,
  DownloadCloud,
  UploadCloud,
  Trash2,
  Info,
  Check,
  ArrowRight,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { DiaryEntry, Medication, MoodEntry, RLSSurvey, SOSData } from '../types';
import PdfExport from './PdfExport';
import { generateFhirBundle } from '../fhirMapper';
import { validateBackupSchema } from '../utils';

interface ExportTabProps {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
  mood: Record<string, MoodEntry>;
  rlsSurveys: Record<string, RLSSurvey>;
  sosData: SOSData;
  isDemoMode?: boolean;
  onRestoreBackup: (backup: any) => void;
  onClearAllData: () => void;
  showToast: (msg: string) => void;
}

export default function ExportTab({
  diary,
  meds,
  mood,
  rlsSurveys,
  sosData,
  isDemoMode = false,
  onRestoreBackup,
  onClearAllData,
  showToast,
}: ExportTabProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [scannedFileName, setScannedFileName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [aiConsent, setAiConsent] = useState(() => localStorage.getItem('symptochron_ai_consent') === 'true');

  const handleToggleAiConsent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const consented = e.target.checked;
    setAiConsent(consented);
    if (consented) {
      localStorage.setItem('symptochron_ai_consent', 'true');
      showToast('✅ KI-Einwilligung erteilt. Du kannst nun AI-Trends und Daily Insights nutzen.');
    } else {
      localStorage.removeItem('symptochron_ai_consent');
      localStorage.removeItem('symptochron_ai_analysis');
      localStorage.removeItem('symptochron_ai_analysis_date');
      localStorage.removeItem('symptochron_insight_data');
      localStorage.removeItem('symptochron_insight_date');
      showToast('🔒 KI-Einwilligung widerrufen. Alle lokalen KI-Caches wurden gelöscht.');
    }
  };

  const filterByDateRange = <T extends Record<string, any>>(data: T): T => {
    if (!startDate && !endDate) return data;
    const filtered = {} as any;
    Object.keys(data).forEach(key => {
      const isAfterStart = !startDate || key >= startDate;
      const isBeforeEnd = !endDate || key <= endDate;
      if (isAfterStart && isBeforeEnd) {
        filtered[key] = data[key];
      }
    });
    return filtered as T;
  };

  const handleSendMailTemplate = () => {
    const subject = encodeURIComponent('SymptoChron Verlaufsprotokoll & Medikationsplan');
    let body = `Sehr geehrtes Praxisteam,\n\nanbei sende ich Ihnen meinen aktuellen Medikationsplan sowie mein Symptomtagebuch aus der SymptoChron-App.\n\n`;
    body += `HINWEIS: Aus Datenschutzgründen (DSGVO) sind in dieser E-Mail keine sensiblen Patientendaten im Klartext enthalten.\n`;
    body += `Bitte beachten Sie die an diese E-Mail angehängten Dokumente (z.B. passwortgeschützte Zip-Datei oder PDF-Report).\n\n`;
    body += `Mit freundlichen Grüßen,\n${sosData.patientName || 'Patient/in'}`;

    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
    showToast('✉️ E-Mail-Entwurf geöffnet. Bitte hänge deine Backup-Zip oder das PDF manuell an!');
  };

  // Local helper to export raw JSON backup
  const handleExportJson = () => {
    if (isDemoMode) {
      showToast('⚠️ Demo-Daten können nicht als echtes Backup exportiert werden.');
      return;
    }

    const backupObj = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      diary: filterByDateRange(diary),
      meds,
      mood: filterByDateRange(mood),
      rlsSurveys: filterByDateRange(rlsSurveys),
      sosData,
    };

    const strObj = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([strObj], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SymptoChron_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('💾 JSON-Daten-Backup heruntergeladen!');
  };

  // Convert to HL7 FHIR Format
  const handleExportFhir = () => {
    if (isDemoMode) {
      showToast('⚠️ Demo-Daten können nicht als FHIR-Export ausgegeben werden.');
      return;
    }

    // Note: To be fully strict, we should load bloodPressure from props,
    // but we can omit it or pass empty array for now since it's not in props of ExportTab yet.
    const bundle = generateFhirBundle(
      filterByDateRange(diary),
      meds,
      filterByDateRange(mood),
      filterByDateRange(rlsSurveys),
      sosData,
      [] // bp placeholder
    );

    const strObj = JSON.stringify(bundle, null, 2);
    const blob = new Blob([strObj], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SymptoChron_FHIR_Bundle_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('⚕️ HL7 FHIR Bundle heruntergeladen!');
  };

  // Convert diary & meds data to clean comma-separated clinical matrices
  const handleExportCsv = () => {
    if (isDemoMode) {
      showToast('⚠️ Demo-Daten können nicht als echte CSV exportiert werden.');
      return;
    }

    let dates = Object.keys(diary).sort();
    if (startDate) dates = dates.filter(d => d >= startDate);
    if (endDate) dates = dates.filter(d => d <= endDate);

    if (dates.length === 0) {
      showToast('⚠️ Keine Tagebucheinträge im ausgewählten Zeitraum vorhanden.');
      return;
    }

    let csvContent = 'Datum;Morgen_Schmerz;Mittag_Schmerz;Abend_Schmerz;Nacht_Schmerz;Morgen_RLS;Mittag_RLS;Abend_RLS;Nacht_RLS;Schlafstunden;Schlafqualitaet;Notizen\n';

    dates.forEach(d => {
      const e = diary[d];
      const mPain = e.morning_pain !== undefined ? e.morning_pain : '';
      const nPain = e.noon_pain !== undefined ? e.noon_pain : '';
      const ePain = e.evening_pain !== undefined ? e.evening_pain : '';
      const niPain = e.night_pain !== undefined ? e.night_pain : '';

      const mRls = e.morning_rls !== undefined ? e.morning_rls : '';
      const nRls = e.noon_rls !== undefined ? e.noon_rls : '';
      const eRls = e.evening_rls !== undefined ? e.evening_rls : '';
      const niRls = e.night_rls !== undefined ? e.night_rls : '';

      const hrs = e.sleepHours !== undefined ? e.sleepHours : '';
      const qual = e.sleepQuality !== undefined ? e.sleepQuality : '';
      const notesClean = e.notes ? e.notes.replace(/;/g, ',').replace(/\n/g, ' ') : '';

      csvContent += `${d};${mPain};${nPain};${ePain};${niPain};${mRls};${nRls};${eRls};${niRls};${hrs};${qual};${notesClean}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SymptoChron_Symptome_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('📊 CSV-Symptomdaten heruntergeladen!');
  };

  // Handle backup file drop restore processes
  const handleFileDropRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setScannedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);

        // AP-08: Run strict schema and type validation
        const val = validateBackupSchema(parsed);
        if (!val.valid) {
          showToast(`❌ Import fehlgeschlagen: ${val.errors[0]}`);
          console.error("Backup schema validation errors:", val.errors);
          setScannedFileName('');
          return;
        }

        onRestoreBackup(parsed);
        showToast('✅ Daten erfolgreich wiederhergestellt!');
        setScannedFileName('');
      } catch (err) {
        showToast('❌ Parser-Fehler. Keine gültige SymptoChron JSON.');
        setScannedFileName('');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {isDemoMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 text-sm text-amber-200 leading-relaxed">
          Demo-Modus aktiv: Exporte sind gesperrt, damit keine Beispieldaten in echte Arztberichte, Backups oder FHIR-Dateien gelangen. Du kannst unten ein echtes Backup importieren oder alle lokalen Daten löschen und neu starten.
        </div>
      )}

      {/* Clinician PDF report layout block */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <FileText className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Klinischer Arzt-Report (PDF)</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Erstellt eine professionelle Übersicht für deinen Arzttermin</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-sans pl-1">
          Der klinische Report wird im Querformat (Landscape) generiert. Er bündelt dein Patientenprofil, Medikamentenverordnungen, eine Wochenübersicht und eine lückenlose Datenmatrix, was Ärzten die zielgenaue Anpassung von Schmerz- oder RLS-Therapien extrem erleichtert.
        </p>

        <PdfExport
          diary={diary}
          meds={meds}
          mood={mood}
          rlsSurveys={rlsSurveys}
          sosData={sosData}
          isDemoMode={isDemoMode}
        />
      </div>

      {/* Manual data portability tools */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-emerald-600/10 border border-emerald-500/25 rounded-2xl">
            <DownloadCloud className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Daten-Backups</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Exportiere oder importiere Backups zur Datenportabilität</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 Pt-1">
          <div className="space-y-3.5 bg-slate-950/40 p-5 border border-slate-850 rounded-2xl">
            <span className="text-xs font-bold text-slate-200 block">Exportieren:</span>

            {/* Datumsfilter */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 mb-2">
              <div className="space-y-1">
                <label className="font-semibold uppercase tracking-wider block">Startdatum</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full py-1.5 px-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold uppercase tracking-wider block">Enddatum</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full py-1.5 px-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-505 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 transition-all cursor-pointer"
              >
                <DownloadCloud className="h-4 w-4" /> JSON-Sicherungsdatei herunterladen
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-slate-100 border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                📊 CSV-Tabelle herunterladen (z.B. für Excel)
              </button>
              <button
                type="button"
                onClick={handleSendMailTemplate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/35 text-blue-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ✉️ E-Mail an Arztpraxis vorbereiten
              </button>
              <button
                type="button"
                onClick={handleExportFhir}
                className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ⚕️ HL7 FHIR Export (ePA Standard)
              </button>
            </div>
          </div>

          <div className="space-y-3.5 bg-slate-950/40 p-5 border border-slate-850 rounded-2xl">
            <span className="text-xs font-bold text-slate-200 block">Wiederherstellen (Import):</span>

            <div className="relative border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/45 rounded-xl aspect-[16/6] flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all">
              <input
                type="file"
                accept=".json"
                onChange={handleFileDropRestore}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <UploadCloud className="h-8 w-8 text-slate-550 mb-2" />
              <span className="text-[11px] text-slate-400 font-semibold block">
                {scannedFileName ? `Ausgewählt: ${scannedFileName}` : 'Hier klicken zum Auswählen (.json)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy & AI Consent Section */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Datenschutz & KI-Dienste</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Verwalte deine Einwilligung für optionale Auswertungen</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-sans pl-1">
          Die App nutzt zur Trendanalyse und Generierung täglicher Gesundheitstipps die externe Google Gemini API. Dabei werden alle Notizen und Texte lokal anonymisiert (AI Privacy Guard), sodass keine Klarnamen oder Kontaktdaten an Dritte übermittelt werden. Die Nutzung ist vollkommen freiwillig und erfordert dein Einverständnis.
        </p>

        <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-200 block">KI-gestützte Funktionen aktivieren</span>
            <span className="text-[10px] text-slate-500 block">Erlaubt den optionalen Datenabgleich mit der Gemini API (Anonymisiert)</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={handleToggleAiConsent}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-450 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
          </label>
        </div>
      </div>

      {/* Sensitive clean slate data removal */}
      <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest text-rose-450 flex items-center gap-2">
            <Trash2 className="h-4.5 w-4.5 text-rose-500" /> Gefahrenbereich
          </h4>
          <p className="text-[10px] text-slate-500 mt-1">Hier kannst du alle auf diesem Endgerät lokal gespeicherten Daten unwiderruflich löschen</p>
        </div>

        {showClearConfirm ? (
          <div className="p-4 bg-rose-600/10 border border-rose-500/25 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-rose-400 leading-normal">
              Bist du absolut sicher? Dies löscht alle deine Symptomtagebücher, Medikamente, Notizen, Arzttermine und Fragebögen unwiederruflich von diesem Browser-Speicher!
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClearAllData}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
              >
                Ja, alle Daten löschen
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 bg-slate-900 border border-slate-800 text-slate-350 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="px-5 py-3 bg-rose-600/10 hover:bg-rose-600/15 border border-rose-500/20 hover:border-rose-550/40 text-rose-450 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Alle lokalen App-Daten löschen
          </button>
        )}
      </div>
    </div>
  );
}
export type { ExportTabProps }; // Exporting interface as well
