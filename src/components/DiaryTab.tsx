import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Mic, 
  MicOff, 
  HelpCircle, 
  CloudSun, 
  Wind, 
  Save, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Calculator,
  Smile
} from 'lucide-react';
import { DiaryEntry, Medication } from '../types';
import { todayStr, formatLocalDate, addDays, parseDate } from '../utils';
import BodyMap from './BodyMap';

interface DiaryTabProps {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
  selectedDate: string;
  onSetSelectedDate: (date: string) => void;
  onSaveEntry: (date: string, entry: DiaryEntry) => void;
  onCopyFromYesterday: () => void;
  showToast: (msg: string) => void;
}

const TIMES_OF_DAY = [
  { key: 'morning', label: 'Morgen', clock: '06–10 Uhr', color: 'text-amber-500 bg-amber-500/10' },
  { key: 'noon', label: 'Mittag', clock: '10–14 Uhr', color: 'text-blue-400 bg-blue-500/10' },
  { key: 'evening', label: 'Abend', clock: '17–22 Uhr', color: 'text-violet-400 bg-violet-500/10' },
  { key: 'night', label: 'Nacht', clock: '22–06 Uhr', color: 'text-slate-400 bg-slate-500/10' },
];

const FACTORS = [
  { key: 'coffee', label: '☕ Kaffee' },
  { key: 'alcohol', label: '🍷 Alkohol' },
  { key: 'stress', label: '⚠️ Stress' },
  { key: 'sport', label: '🏋️ Sport' },
  { key: 'poorSleep', label: '🛌 Schlafmangel' },
];

export default function DiaryTab({
  diary,
  meds,
  selectedDate,
  onSetSelectedDate,
  onSaveEntry,
  onCopyFromYesterday,
  showToast,
}: DiaryTabProps) {
  const currentToday = todayStr();
  const entry = diary[selectedDate] || {};

  // Form states
  const [painScores, setPainScores] = useState<Record<string, number>>({});
  const [rlsScores, setRlsScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [sleepHours, setSleepHours] = useState<number | ''>('');
  const [sleepQuality, setSleepQuality] = useState<number | ''>('');
  const [factors, setFactors] = useState<Record<string, boolean>>({});
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [weather, setWeather] = useState('');
  const [pressure, setPressure] = useState('');
  const [medsTaken, setMedsTaken] = useState<string[]>([]);
  const [medsTakenTimes, setMedsTakenTimes] = useState<Record<string, string>>({});
  const [hasSymptoms, setHasSymptoms] = useState<boolean | null>(null);
  
  // Speech input state
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Sync state on date change
  useEffect(() => {
    const e = diary[selectedDate] || {};
    
    const pScores: Record<string, number> = {};
    const rScores: Record<string, number> = {};
    TIMES_OF_DAY.forEach(t => {
      const pVal = e[`${t.key}_pain` as keyof DiaryEntry];
      if (typeof pVal === 'number') pScores[t.key] = pVal;
      
      const rVal = e[`${t.key}_rls` as keyof DiaryEntry];
      if (typeof rVal === 'number') rScores[t.key] = rVal;
    });

    setPainScores(pScores);
    setRlsScores(rScores);
    setNotes(e.notes || '');
    setSleepHours(e.sleepHours !== undefined ? e.sleepHours : '');
    setSleepQuality(e.sleepQuality !== undefined ? e.sleepQuality : '');
    setFactors(e.factors || {});
    setPainAreas(e.painAreas || []);
    setWeather(e.weather || '');
    setPressure(e.pressure || '');
    setMedsTaken(e.medsTaken || []);
    setMedsTakenTimes(e.medsTakenTimes || {});

    // Determine hasSymptoms based on scores
    const hasAnySymptomVal = TIMES_OF_DAY.some(t => {
      const pVal = e[`${t.key}_pain` as keyof DiaryEntry];
      const rVal = e[`${t.key}_rls` as keyof DiaryEntry];
      return (typeof pVal === 'number' && pVal > 0) || (typeof rVal === 'number' && rVal > 0);
    });
    
    const isZeroed = e.morning_pain === 0 && e.noon_pain === 0 && e.evening_pain === 0 && e.night_pain === 0;
    setHasSymptoms(hasAnySymptomVal ? true : isZeroed ? false : null);
  }, [selectedDate, diary]);

  // Speech input setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'de-DE';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setNotes(prev => (prev ? prev + ' ' : '') + text);
        showToast('🎤 Stimme in Text übersetzt!');
      };

      rec.onend = () => setIsListening(false);
      rec.onerror = () => {
        setIsListening(false);
        showToast('⚠️ Spracheingabe fehlgeschlagen.');
      };

      setRecognition(rec);
    }
  }, []);

  const handleVoiceInput = () => {
    if (!recognition) {
      showToast('⚠️ Spracheingabe wird im Browser nicht unterstützt.');
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      setIsListening(true);
      recognition.start();
    }
  };

  const handleToggleFactor = (key: string) => {
    setFactors(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleMedIntake = (slotId: string) => {
    if (medsTaken.includes(slotId)) {
      setMedsTaken(prev => prev.filter(m => m !== slotId));
      const timesCopy = { ...medsTakenTimes };
      delete timesCopy[slotId];
      setMedsTakenTimes(timesCopy);
    } else {
      setMedsTaken(prev => [...prev, slotId]);
      // If it is a PRN/flexible med (it doesn't have an underscore representing time slot)
      if (!slotId.includes('_')) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setMedsTakenTimes(prev => ({ ...prev, [slotId]: timeStr }));
      }
    }
  };

  const handleScoreChange = (type: 'pain' | 'rls', timeKey: string, val: string) => {
    const setter = type === 'pain' ? setPainScores : setRlsScores;
    if (val === '') {
      setter(prev => {
        const c = { ...prev };
        delete c[timeKey];
        return c;
      });
    } else {
      setter(prev => ({
        ...prev,
        [timeKey]: parseInt(val, 10),
      }));
    }
  };

  const handleSelectNoSymptoms = () => {
    setHasSymptoms(false);
    const zeroScores: Record<string, number> = {};
    TIMES_OF_DAY.forEach(t => {
      zeroScores[t.key] = 0;
    });
    setPainScores(zeroScores);
    setRlsScores(zeroScores);
    showToast('☀️ Als symptomfrei markiert. Regler auf 0 gesetzt.');
  };

  const handleSelectYesSymptoms = () => {
    setHasSymptoms(true);
    setPainScores(prev => {
      const copy = { ...prev };
      TIMES_OF_DAY.forEach(t => {
        if (copy[t.key] === undefined) copy[t.key] = 0;
      });
      return copy;
    });
    setRlsScores(prev => {
      const copy = { ...prev };
      TIMES_OF_DAY.forEach(t => {
        if (copy[t.key] === undefined) copy[t.key] = 0;
      });
      return copy;
    });
  };

  const handleSave = () => {
    const entry: DiaryEntry = {
      notes: notes.trim() || undefined,
      sleepHours: sleepHours !== '' ? Number(sleepHours) : undefined,
      sleepQuality: sleepQuality !== '' ? Number(sleepQuality) : undefined,
      factors: Object.keys(factors).some(k => factors[k]) ? factors : undefined,
      painAreas: painAreas.length > 0 ? painAreas : undefined,
      weather: weather || undefined,
      pressure: pressure || undefined,
      medsTaken: medsTaken.length > 0 ? medsTaken : undefined,
      medsTakenTimes: Object.keys(medsTakenTimes).length > 0 ? medsTakenTimes : undefined,
      updated: new Date().toISOString(),
    };

    TIMES_OF_DAY.forEach(t => {
      if (painScores[t.key] !== undefined) {
        (entry as any)[`${t.key}_pain`] = painScores[t.key];
      }
      if (rlsScores[t.key] !== undefined) {
        (entry as any)[`${t.key}_rls`] = rlsScores[t.key];
      }
    });

    onSaveEntry(selectedDate, entry);
  };

  // Get index labels for 0-10 intensity
  const getIntensityLabel = (val: number) => {
    const labels = [
      'Keine', 'Minimal', 'Sehr leicht', 'Leicht', 'Mäßig', 
      'Mittel', 'Deutlich', 'Stark', 'Sehr stark', 'Extrem', 'Unerträglich'
    ];
    return labels[val] || '';
  };

  const getStyleClassForValue = (type: 'pain' | 'rls', val: number | undefined) => {
    if (val === undefined) return 'bg-slate-950 border-slate-800 text-slate-500';
    if (val === 0) return 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400';
    if (val <= 3) return 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400';
    if (val <= 5) return 'bg-amber-600/10 border-amber-500/20 text-amber-400';
    
    if (type === 'pain') {
      return 'bg-rose-600/10 border-rose-500/20 text-rose-400';
    } else {
      return 'bg-violet-600/15 border-violet-500/20 text-violet-400';
    }
  };

  // Generate 7-day horizontal navigation strip
  const weekList: string[] = [];
  for (let i = -3; i <= 3; i++) {
    weekList.push(addDays(selectedDate, i));
  }

  // Scheduled meds for local list
  const activeSchedules = meds.filter(m => m.active);

  return (
    <div className="space-y-6">
      {/* Date Navigator */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-3xl shadow-md">
        <button
          type="button"
          onClick={() => onSetSelectedDate(addDays(selectedDate, -1))}
          className="p-2 hover:bg-slate-800 text-slate-300 rounded-xl transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
            {formatLocalDate(selectedDate)}
          </div>
          {selectedDate === currentToday && (
            <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Heute
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedDate !== currentToday && (
            <button
              type="button"
              onClick={() => onSetSelectedDate(currentToday)}
              className="px-2.5 py-1 text-xs font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg transition-all"
            >
              Heute
            </button>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && onSetSelectedDate(e.target.value)}
            className="p-1 px-2 text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={() => onSetSelectedDate(addDays(selectedDate, 1))}
          className="p-2 hover:bg-slate-800 text-slate-300 rounded-xl transition-all"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Week selection strip */}
      <div className="flex gap-2 justify-between overflow-x-auto pb-1 no-scrollbar">
        {weekList.map(dateStr => {
          const parsed = parseDate(dateStr);
          const hasLog = !!diary[dateStr];
          const isActive = dateStr === selectedDate;

          const daysAbbr = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSetSelectedDate(dateStr)}
              className={`flex-1 min-w-[44px] flex flex-col items-center py-2.5 rounded-xl border transition-all ${
                isActive 
                  ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-md shadow-blue-500/5' 
                  : hasLog 
                    ? 'bg-slate-900 border-slate-800 text-slate-300' 
                    : 'bg-slate-900/40 border-slate-900/60 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase">{daysAbbr[parsed.getDay()]}</span>
              <span className="font-mono text-xs font-black mt-1">{parsed.getDate()}</span>
              
              <div className="flex gap-1 justify-center mt-1.5 h-1">
                {hasLog && (
                  <span className="h-1 w-1 rounded-full bg-rose-500" />
                )}
                {hasLog && (
                  <span className="h-1 w-1 rounded-full bg-violet-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Prefill button overlay */}
      <div className="flex justify-end pr-1">
        <button
          type="button"
          onClick={onCopyFromYesterday}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-colors shadow-inner"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Wie gestern ausfüllen</span>
        </button>
      </div>

      {/* Step 1: Pain and RLS Evaluation cards */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex gap-3">
          <span className="flex h-6 w-6 items-center justify-center bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-black font-mono rounded-full">
            1
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Symptome &amp; Intensitäten</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Symptom-Spitzen von 0 (keine) bis 10 (unerträglich)</p>
          </div>
        </div>

        {hasSymptoms === null && (
          <div className="bg-slate-950/40 p-6 border border-slate-850 rounded-2xl text-center space-y-4">
            <p className="text-xs text-slate-350 font-sans">
              Hattest du am {formatLocalDate(selectedDate)} Symptome (Schmerzen oder unruhige Beine)?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleSelectYesSymptoms}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
              >
                Ja, Symptome vorhanden
              </button>
              <button
                type="button"
                onClick={handleSelectNoSymptoms}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-750 cursor-pointer"
              >
                Nein, symptomfrei ☀️
              </button>
            </div>
          </div>
        )}

        {hasSymptoms === false && (
          <div className="bg-emerald-950/10 p-5 border border-emerald-500/20 rounded-2xl flex flex-col items-center text-center space-y-2">
            <span className="text-xl">☀️</span>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Du warst symptomfrei!</div>
            <p className="text-[11px] text-slate-400">
              Alle Symptomschnittstellen wurden für diesen Tag automatisch auf 0 gesetzt.
            </p>
            <button
              type="button"
              onClick={handleSelectYesSymptoms}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
            >
              Symptome nachträglich eintragen
            </button>
          </div>
        )}

        {hasSymptoms === true && (
          <>
            <div className="flex justify-between items-center bg-slate-950/30 p-3 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-400 font-medium">
                Symptomerfassung aktiv
              </span>
              <button
                type="button"
                onClick={handleSelectNoSymptoms}
                className="text-[10px] text-rose-455 hover:text-rose-400 font-bold cursor-pointer"
              >
                Als symptomfrei markieren (Zurücksetzen)
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TIMES_OF_DAY.map((t) => {
                const pVal = painScores[t.key];
                const rVal = rlsScores[t.key];

                return (
                  <div key={t.key} className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md ${t.color}`}>
                          {t.label}
                        </span>
                        <span className="text-[10px] text-slate-500">{t.clock}</span>
                      </div>
                    </div>

                    {/* Pain select slider row */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Schmerz</span>
                          <span className="text-rose-400 font-bold">{pVal !== undefined ? getIntensityLabel(pVal) : '–'}</span>
                        </div>
                        <select
                          value={pVal !== undefined ? pVal : ''}
                          onChange={(e) => handleScoreChange('pain', t.key, e.target.value)}
                          className="w-full py-2 px-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-rose-500 transition-colors"
                        >
                          <option value="">–</option>
                          {Array.from({ length: 11 }).map((_, i) => (
                            <option key={i} value={i}>{i} – {getIntensityLabel(i)}</option>
                          ))}
                        </select>
                      </div>
                      <span className={`flex h-11 w-11 items-center justify-center border font-mono text-sm font-bold rounded-xl transition-all ${getStyleClassForValue('pain', pVal)}`}>
                        {pVal !== undefined ? pVal : '–'}
                      </span>
                    </div>

                    {/* Rls select slider row */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">RLS</span>
                          <span className="text-violet-400 font-bold">{rVal !== undefined ? getIntensityLabel(rVal) : '–'}</span>
                        </div>
                        <select
                          value={rVal !== undefined ? rVal : ''}
                          onChange={(e) => handleScoreChange('rls', t.key, e.target.value)}
                          className="w-full py-2 px-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-colors"
                        >
                          <option value="">–</option>
                          {Array.from({ length: 11 }).map((_, i) => (
                            <option key={i} value={i}>{i} – {getIntensityLabel(i)}</option>
                          ))}
                        </select>
                      </div>
                      <span className={`flex h-11 w-11 items-center justify-center border font-mono text-sm font-bold rounded-xl transition-all ${getStyleClassForValue('rls', rVal)}`}>
                        {rVal !== undefined ? rVal : '–'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Step 1b: Body Mapper pain localizations */}
      {hasSymptoms === true && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-black font-mono rounded-full">
              1b
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Schmerzlokalisation</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Wähle Schmerzstellen auf der interaktiven Körperkarte</p>
            </div>
          </div>

          <BodyMap activeAreas={painAreas} onChange={setPainAreas} />
        </div>
      )}

      {/* Step 2: Medication confirmations */}
      {activeSchedules.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-black font-mono rounded-full">
              2
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Medikamenten-Einnahme</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Hake eingenommene Dosen ab</p>
            </div>
          </div>

          <div className="space-y-4">
            {activeSchedules.map(med => {
              const slots = ['morning', 'noon', 'evening', 'night'];
              const slotsGerman = ['Morgens', 'Mittags', 'Abends', 'Nachts'];

              // If has fixed scheduled. If not, bedarf (prn)
              const hasRegularSchedule = slots.some(s => med.schedule[s] > 0);

              if (hasRegularSchedule) {
                return (
                  <div key={med.id} className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-200">{med.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{med.dose}</span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {slots.map((sKey, sIdx) => {
                        const qty = med.schedule[sKey];
                        if (qty <= 0) return null;
                        const slotId = `${med.id}_${sKey}`;
                        const isTaken = medsTaken.includes(slotId);

                        return (
                          <button
                            key={sKey}
                            type="button"
                            onClick={() => handleToggleMedIntake(slotId)}
                            className={`flex flex-col items-center justify-center p-2 min-w-[62px] rounded-xl border transition-all active:scale-95 ${
                              isTaken 
                                ? 'bg-emerald-600/10 border-emerald-500/35 text-emerald-400 font-bold' 
                                : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider">{slotsGerman[sIdx]}</span>
                            <span className="font-mono text-xs font-bold mt-1 text-blue-400">{qty}×</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              } else {
                // Bedarfs-Medikation
                const isTaken = medsTaken.includes(med.id);
                return (
                  <div key={med.id} className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-200">{med.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">{med.dose || 'bei Bedarf'}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleMedIntake(med.id)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        isTaken 
                          ? 'bg-emerald-600/10 border-emerald-500/35 text-emerald-400' 
                          : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {isTaken ? '✓ Eingenommen' : 'Einnehmen'}
                    </button>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* Step 3: Sleep parameters / duration */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex gap-3">
          <span className="flex h-6 w-6 items-center justify-center bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-black font-mono rounded-full">
            3
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Schlaf-Parameter</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Protokoll der letzten Nacht</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Schlafdauer (Stunden)</label>
            <input
              type="number"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="z.B. 6.5"
              className="w-full py-3.5 px-4 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Schlafqualität</label>
            <select
              value={sleepQuality}
              onChange={(e) => setSleepQuality(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full py-3.5 px-4 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">–</option>
              <option value="1">1 – Sehr schlecht</option>
              <option value="2">2 – Schlecht</option>
              <option value="3">3 – Mittel</option>
              <option value="4">4 – Gut</option>
              <option value="5">5 – Sehr gut</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step 4: Influence factors & Weather context */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex gap-3">
          <span className="flex h-6 w-6 items-center justify-center bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-black font-mono rounded-full">
            4
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Einflussfaktoren &amp; Wetter</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Kontextdaten für statistische Trigger-Korrelationen</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300">Tägliche Begleitfaktoren:</span>
            <div className="flex flex-wrap gap-2">
              {FACTORS.map(f => {
                const isActive = !!factors[f.key];
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleToggleFactor(f.key)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' 
                        : 'bg-slate-950/40 border-slate-850 text-slate-450 hover:text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-850/60">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Wetterlage</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full py-3.5 px-4 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">–</option>
                <option value="sun">☀ Sonnig / Klar</option>
                <option value="cloud">☁ Bewölkt</option>
                <option value="rain">🌧 Regnerisch / Kühl</option>
                <option value="storm">⛈ Gewitter / Wechselhaft</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Luftdruck-Befund</label>
              <select
                value={pressure}
                onChange={(e) => setPressure(e.target.value)}
                className="w-full py-3.5 px-4 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">–</option>
                <option value="high">↑ Hochdruckgebiet</option>
                <option value="normal">→ Normal</option>
                <option value="low">↓ Tiefdruckgebiet</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Step 5: Notes area */}
      <div className="card diary-step">
        <div className="card-header">
          <div className="step-badge">5</div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Notizen</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Symptom-Chroniken, Besonderheiten oder Befinden</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="z.B. nachmittags Kaffee getrunken, nachts kribbelnde Beine v.a. links im Oberschenkel, kalte Güsse halfen etwas..."
            className="notes-area focus:border-violet-500 min-h-[90px] pr-12 text-slate-200 placeholder:text-slate-700"
          />
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`absolute right-3.5 bottom-3.5 p-2 rounded-xl transition-all active:scale-95 ${
              isListening 
                ? 'bg-rose-600 text-white animate-pulse' 
                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isListening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Bottom spacer for floating save button */}
      <div className="h-28" />

      {/* Floating Save Action */}
      <div className="fixed bottom-[65px] left-0 right-0 p-4 z-90 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={handleSave}
          className="pointer-events-auto w-full max-w-sm flex items-center justify-center gap-2 py-4 bg-violet-600 hover:bg-violet-500 active:scale-[0.98] text-white rounded-2xl text-sm font-bold shadow-xl shadow-violet-600/35 transition-all"
        >
          <Save className="h-4 w-4" />
          <span>Eintrag speichern</span>
        </button>
      </div>
    </div>
  );
}
