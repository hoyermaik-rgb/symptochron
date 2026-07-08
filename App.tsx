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
  ScanLine 
} from 'lucide-react';
import { Medication } from '../types';
import { todayStr } from '../utils';

interface MedsTabProps {
  meds: Medication[];
  onAddMed: (med: Medication) => void;
  onDeleteMed: (id: string) => void;
  onUpdateMed: (med: Medication) => void;
  onRefillMed: (id: string) => void;
  settings: Record<string, any>;
  onSaveSettings: (settings: any) => void;
  showToast: (msg: string) => void;
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
}: MedsTabProps) {
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
                showToast(`📷 Code erkannt: "${cleanCode}". Enthält keine gültige PZN (7-13 Ziffern).`);
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
    };

    if (editingMed) {
      onUpdateMed(payload);
      showToast('✅ Medikament aktualisiert.');
    } else {
      onAddMed(payload);
      showToast('✅ Medikament hinzugefügt.');
    }

    setShowAddForm(false);
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
            pzn: '01243542',
            dose: '0,18 mg',
            form: 'Tablette',
            schedule: { morning: 0, noon: 0, evening: 0, night: 1 },
            stock: 100,
            packSize: 100,
            thresholdDays: 7,
            active: true,
            note: 'Aus BMP importiert (Wirkstoff: Pramipexol-dihydrochlorid-monohydrat)'
          },
          {
            id: 'med_bmp2_' + Date.now().toString(36),
            name: 'Ibuflam 400 mg Lichtenstein Filmtabletten',
            pzn: '03131751',
            dose: '400 mg',
            form: 'Filmtablette',
            schedule: { morning: 1, noon: 0, evening: 1, night: 0 },
            stock: 50,
            packSize: 50,
            thresholdDays: 5,
            active: true,
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
          dose: prod.dose,
          form: prod.form,
          schedule: { morning: 0, noon: 0, evening: 1, night: 1 }, // standard RLS dosage evening/night
          stock: Number(prod.packungsgröße) || 100,
          packSize: Number(prod.packungsgröße) || 100,
          thresholdDays: 7,
          active: true,
          note: `Importiert via PZN Scan (ATC: ${prod.atc}, Wirkstoff: ${prod.wirkstoff}, Hersteller: ${prod.hersteller})`
        };
        onAddMed(newMed);
        showToast(`✅ PZN-Scan erfolgreich! ${prod.name} geladen.`);
      } else {
        // Fallback guess if offline
        const fallbackMed: Medication = {
          id: 'med_pzn_' + Date.now().toString(36),
          name: `Unbekanntes Präparat (PZN: ${code})`,
          pzn: code,
          dose: '300 mg',
          form: 'Tablette',
          schedule: { morning: 0, noon: 0, evening: 0, night: 1 },
          stock: 100,
          packSize: 100,
          thresholdDays: 7,
          active: true,
          note: `Verbindung fehlgeschlagen oder PZN unbekannt. Bitte manuell im BfArM-Verzeichnis prüfen.`
        };
        onAddMed(fallbackMed);
        showToast(`⚠️ PZN ${code} nicht im BfArM-Sollbestand gefunden. Platzhalter angelegt.`);
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
        setBfarmSource(data.source === 'local_bfarm_db' ? 'BfArM-Datenbank (Local Copy - Offline)' : 'BfArM KI-Echtzeit-Schnittstelle');
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
  const getInternalConflicts = () => {
    const conflicts: string[] = [];
    const normalizedList = meds.map(m => m.name.toLowerCase());

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
            conflicts.push(`⚠️ Konflikt zwischen ${meds[i].name} und ${meds[j].name}: ${rule.message}`);
          }
        });
      }
    }
    return conflicts;
  };

  const conflicts = getInternalConflicts();

  return (
    <div className="space-y-6">
      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 text-rose-450 rounded-2xl text-xs space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-rose-400">
            <AlertTriangle className="h-4.5 w-4.5" />
            <span>Kritischer Wechselwirkungs-Hinweis (lokale Prüfung):</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {conflicts.map((con, idx) => (
              <li key={idx} className="leading-relaxed">{con}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Meds List card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Medikationsplan</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Aktive Dauer- und Bedarfsmedikation</p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddForm}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/15 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Hinzufügen
          </button>
        </div>

        {meds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  isStockLow = med.stock! < 10; // For PRN meds, warn if total counts < 10
                }
              }

              return (
                <div key={med.id} className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-slate-100">{med.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(med)}
                          className="p-1 px-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 hover:border-slate-800 rounded-lg text-[10px] font-bold"
                        >
                          ✎ Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMed(med.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-450 hover:bg-rose-500/10 rounded-lg transition-all"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
                      {med.dose && (
                        <span className="bg-slate-950 px-2 py-0.5 border border-slate-850 rounded-md">
                          Dosis: {med.dose}
                        </span>
                      )}
                      {med.form && (
                        <span className="bg-slate-950 px-2 py-0.5 border border-slate-850 rounded-md">
                          Form: {med.form}
                        </span>
                      )}
                    </div>

                    {((med.schedule.morning > 0) || (med.schedule.noon > 0) || (med.schedule.evening > 0) || (med.schedule.night > 0)) ? (
                      <div className="flex gap-2.5 pt-2">
                        {['morning', 'noon', 'evening', 'night'].map((k, i) => {
                          const val = med.schedule[k];
                          if (val <= 0) return null;
                          const labels = ['Mo', 'Mi', 'Ab', 'Na'];
                          return (
                            <span key={k} className="text-[10px] text-slate-400 bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                              <span className="font-bold text-blue-400">{labels[i]}</span>
                              <span className="font-mono text-slate-100 font-black">{val}×</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="inline-block text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20 rounded-md">
                        Bedarfsmedikation
                      </span>
                    )}

                    {med.note && (
                      <p className="text-[11px] text-slate-500 italic pt-1">{med.note}</p>
                    )}
                  </div>

                  {/* Stock Tracker Widget */}
                  {hasStock && (
                    <div className="flex justify-between items-center p-3 bg-slate-950/45 border border-slate-850/60 rounded-xl flex-wrap gap-2 pt-2.5">
                      <div className="flex flex-col space-y-0.5">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Bestand</span>
                        <span className={`text-xs font-bold leading-none ${isStockLow ? 'text-rose-400 font-extrabold' : 'text-slate-300'}`}>
                          {med.stock!.toFixed(0)} Stück {dailyCount > 0 && `(ca. ${stockDays} Tage)`}
                        </span>
                      </div>

                      {isStockLow && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-rose-400 py-0.5 font-bold uppercase">Knapp!</span>
                          <button
                            type="button"
                            onClick={() => onRefillMed(med.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600/15 border border-rose-500/30 hover:border-rose-400 text-rose-400 text-[10px] font-bold rounded-lg active:scale-95 transition-all"
                          >
                            <RefreshCw className="h-3 w-3" /> Auffüllen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                  { name: 'Sifrol (Pramipexol)', pzn: '06554556', type: 'Dopaminagonist' },
                  { name: 'Restex (L-Dopa)', pzn: '03135246', type: 'L-Dopa / Benserazid' },
                  { name: 'Neupro Pflaster', pzn: '04863024', type: 'Rotigotin' },
                  { name: 'Lyrica Kapseln', pzn: '10237421', type: 'Pregabalin' },
                  { name: 'Magnesium Verla', pzn: '04958223', type: 'Mineralpräparat' },
                  { name: 'Targin Retard', pzn: '06431268', type: 'Opioidanalgetikum' }
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
                    placeholder="Eigene PZN eingeben (z.B. 01243542)"
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
            placeholder="PZN (z.B. 03135246) oder Medikamentenname (z.B. Pramipexol, Restex)"
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
            {bfarmResults.map((prod: any, idx: number) => (
              <div
                key={prod.pzn + '_' + idx}
                className="p-4 bg-slate-950/70 border border-slate-850 hover:border-slate-800 rounded-2xl text-xs leading-normal font-sans space-y-2.5 transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-200 text-sm block">{prod.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-medium block">
                      Wirkstoff: <span className="text-slate-300 font-bold">{prod.wirkstoff}</span>
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
                    <span className="text-slate-300 truncate block">{prod.dose} • {prod.form}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850/40">
                    <span className="text-[8px] text-slate-500 uppercase font-sans font-bold block">Unternehmen</span>
                    <span className="text-slate-300 truncate block">{prod.hersteller}</span>
                  </div>
                </div>
              </div>
            ))}
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
                  : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-400'
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

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Dosis / Stärke</label>
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
    </div>
  );
}
export type { MedsTabProps }; // Exporting interface as well
