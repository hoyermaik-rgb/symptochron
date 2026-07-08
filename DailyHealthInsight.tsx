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

interface ExportTabProps {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
  mood: Record<string, MoodEntry>;
  rlsSurveys: Record<string, RLSSurvey>;
  sosData: SOSData;
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
  onRestoreBackup,
  onClearAllData,
  showToast,
}: ExportTabProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [scannedFileName, setScannedFileName] = useState('');

  // Local helper to export raw JSON backup
  const handleExportJson = () => {
    const backupObj = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      diary,
      meds,
      mood,
      rlsSurveys,
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

  // Convert diary & meds data to clean comma-separated clinical matrices
  const handleExportCsv = () => {
    const dates = Object.keys(diary).sort();
    if (dates.length === 0) {
      showToast('⚠️ Keine Tagebucheinträge vorhanden zum CSV-Export.');
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
        if (parsed.diary && parsed.meds) {
          onRestoreBackup(parsed);
          showToast('✅ Daten erfolgreich wiederhergestellt!');
          setScannedFileName('');
        } else {
          showToast('❌ Ungültige Backupdatei. Datensätze fehlen.');
        }
      } catch {
        showToast('❌ Parser-Fehler. Keine gültige SymptoChron JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
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
