import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smile, 
  ChevronLeft, 
  ChevronRight, 
  Mic, 
  MicOff, 
  AlertOctagon, 
  Save, 
  Plus, 
  SmilePlus, 
  Heart, 
  Flame, 
  ClipboardCheck, 
  Calendar 
} from 'lucide-react';
import { MoodEntry, UiPrefs } from '../types';
import { 
  todayStr, 
  formatLocalDate, 
  phq9SeverityLabel, 
  gad7SeverityLabel, 
  addDays 
} from '../utils';

interface MoodTabProps {
  mood: Record<string, MoodEntry>;
  selectedDate: string;
  onSetSelectedDate: (date: string) => void;
  onSaveMood: (date: string, entry: MoodEntry) => void;
  phq9: Record<string, { answers: number[]; sum: number; severity: string; updated: string }>;
  onSavePhq9: (date: string, answers: number[]) => void;
  gad7: Record<string, { answers: number[]; sum: number; severity: string; updated: string }>;
  onSaveGad7: (date: string, answers: number[]) => void;
  crisisPlan: {
    therapist: string;
    doctor: string;
    person1: string;
    person2: string;
    plan: string;
    warningSigns: string;
  };
  onSaveCrisisPlan: (data: any) => void;
  showToast: (msg: string) => void;
}

const MOOD_DIMENSIONS = [
  { key: 'stimmung', label: 'Stimmung', color: 'accent-violet-500' },
  { key: 'energie', label: 'Energie', color: 'accent-blue-500' },
  { key: 'antrieb', label: 'Antrieb', color: 'accent-emerald-500' },
  { key: 'angst', label: 'Angst / Unruhe', color: 'accent-rose-500' },
  { key: 'reizbarkeit', label: 'Reizbarkeit', color: 'accent-amber-500' },
  { key: 'konzentration', label: 'Konzentration', color: 'accent-cyan-500' },
  { key: 'hoffnungslosigkeit', label: 'Hoffnungslosigkeit', color: 'accent-violet-400' },
];

const DEPRESSION_SYMPTOMS = [
  { key: 'interessenverlust', label: 'Interessenverlust' },
  { key: 'freudlosigkeit', label: 'Freudlosigkeit' },
  { key: 'gruebeln', label: 'Grübeln / Grübelzwang' },
  { key: 'schuldgefuehle', label: 'Schuldgefühle' },
  { key: 'wertlosigkeit', label: 'Wertlosigkeit' },
  { key: 'antriebslosigkeit', label: 'Antriebsmangel' },
  { key: 'appetitverlust', label: 'Appetitverlust' },
  { key: 'appetitsteigerung', label: 'Appetitsteigerung' },
  { key: 'sozialer_rueckzug', label: 'Sozialer Rückzug' },
  { key: 'konzentrationsprobleme', label: 'Konzentrationsmangel' },
];

const POSITIVE_ACTIVITIES = [
  { key: 'spaziergang', label: '🚶 Spaziergang' },
  { key: 'sport', label: '🏋️ Sport' },
  { key: 'meditation', label: '🧘 Meditation' },
  { key: 'freunde', label: '👥 Treffen mit Freunden' },
  { key: 'therapie', label: '🗣️ Therapie' },
  { key: 'hobby', label: '🎨 Hobby' },
  { key: 'arbeit', label: '💼 Arbeit / Produktiv' },
  { key: 'haushalt', label: '🏠 Haushalt' },
  { key: 'natur', label: '🌳 Zeit in der Natur' },
];

const PHQ9_QUESTIONS = [
  'Wenig Interesse oder Freude an Ihren Tätigkeiten?',
  'Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit?',
  'Schwierigkeiten ein-/durchzuschlafen oder vermehrtes Schlafen?',
  'Müdigkeit oder das Gefühl, keine Energie zu haben?',
  'Verminderter Appetit oder übermäßiges Essen?',
  'Schlechtes Gewissen oder Gefühl, ein Versager zu sein?',
  'Konzentrationsschwierigkeiten beim Lesen oder Fernsehen?',
  'Ungewöhnlich verlangsamte oder unruhige Bewegungen/Sprache?',
  'Gedanken, dass Sie besser tot wären oder sich zu verletzen?'
];

const GAD7_QUESTIONS = [
  'Sich nervös, ängstlich oder angespannt fühlen?',
  'Nicht in der Lage sein, Sorgen zu stoppen oder zu kontrollieren?',
  'Sich zu viele Sorgen über verschiedene Dinge machen?',
  'Schwierigkeiten, sich zu entspannen?',
  'So unruhig sein, dass es schwerfällt, still zu sitzen?',
  'Leicht verärgert, ungeduldig oder gereizt sein?',
  'Angst haben, dass etwas Schlimmes passieren könnte?'
];

export default function MoodTab({
  mood,
  selectedDate,
  onSetSelectedDate,
  onSaveMood,
  phq9,
  onSavePhq9,
  gad7,
  onSaveGad7,
  crisisPlan,
  onSaveCrisisPlan,
  showToast,
}: MoodTabProps) {
  const currentToday = todayStr();
  const entry = mood[selectedDate] || {};

  // Form states
  const [dims, setDims] = useState<Record<string, number>>({});
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>({});
  const [activities, setActivities] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  
  // Custom Speech Setup
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Questionnaire form states
  const [phqAnswers, setPhqAnswers] = useState<(number | null)[]>(Array(9).fill(null));
  const [gadAnswers, setGadAnswers] = useState<(number | null)[]>(Array(7).fill(null));

  // Crisis contacts local states
  const [therapist, setTherapist] = useState(crisisPlan.therapist || '');
  const [doctor, setDoctor] = useState(crisisPlan.doctor || '');
  const [person1, setPerson1] = useState(crisisPlan.person1 || '');
  const [person2, setPerson2] = useState(crisisPlan.person2 || '');
  const [plan, setPlan] = useState(crisisPlan.plan || '');
  const [warningSigns, setWarningSigns] = useState(crisisPlan.warningSigns || '');

  // Update states on date change
  useEffect(() => {
    const e = mood[selectedDate] || {};
    const dValues: Record<string, number> = {};
    MOOD_DIMENSIONS.forEach(d => {
      const v = (e as any)[d.key];
      if (typeof v === 'number') dValues[d.key] = v;
    });

    setDims(dValues);
    setSymptoms(e.symptoms || {});
    setActivities(e.activities || {});
    setNotes(e.notes || '');
  }, [selectedDate, mood]);

  // Handle Speech setup
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
        showToast('🎤 Stimme aufgezeichnet!');
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
      showToast('⚠️ Spracheingabe wird nicht unterstützt.');
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      setIsListening(true);
      recognition.start();
    }
  };

  const handleSaveCrisis = () => {
    onSaveCrisisPlan({
      therapist,
      doctor,
      person1,
      person2,
      plan,
      warningSigns,
    });
    showToast('💾 Krisenplan gespeichert.');
  };

  const handleSaveMoodLog = () => {
    const payload: MoodEntry = {
      symptoms: Object.keys(symptoms).some(k => symptoms[k]) ? symptoms : undefined,
      activities: Object.keys(activities).some(k => activities[k]) ? activities : undefined,
      notes: notes.trim() || undefined,
      updated: new Date().toISOString(),
    };

    MOOD_DIMENSIONS.forEach(d => {
      if (dims[d.key] !== undefined) {
        (payload as any)[d.key] = dims[d.key];
      }
    });

    onSaveMood(selectedDate, payload);
  };

  const getMoodDimensionLabel = (key: string, val: number): string => {
    switch (key) {
      case 'stimmung':
        if (val <= 2) return 'Sehr gedrückt';
        if (val <= 4) return 'Leicht gedrückt';
        if (val <= 6) return 'Ausgeglichen';
        if (val <= 8) return 'Sehr gut';
        return 'Ausgezeichnet';
      case 'energie':
      case 'antrieb':
        if (val <= 2) return 'Blockiert';
        if (val <= 4) return 'Träge / Müde';
        if (val <= 6) return 'Normal';
        if (val <= 8) return 'Voller Elan';
        return 'Tatkräftig';
      case 'angst':
        if (val <= 2) return 'Völlig ruhig';
        if (val <= 4) return 'Leichte Unruhe';
        if (val <= 6) return 'Angespannt';
        if (val <= 8) return 'Ausgeprägte Angst';
        return 'Panisch';
      case 'reizbarkeit':
        if (val <= 2) return 'Sehr geduldig';
        if (val <= 4) return 'Leicht genervt';
        if (val <= 6) return 'Gereizt';
        if (val <= 8) return 'Sehr wütend';
        return 'Explosiv';
      case 'konzentration':
        if (val <= 2) return 'Völlig zerstreut';
        if (val <= 4) return 'Ablenkbar';
        if (val <= 6) return 'Fokussiert';
        if (val <= 8) return 'Gute Konzentration';
        return 'Hyperfokus';
      case 'hoffnungslosigkeit':
        if (val <= 2) return 'Voller Zuversicht';
        if (val <= 4) return 'Leicht besorgt';
        if (val <= 6) return 'Mutlos';
        if (val <= 8) return 'Verzweifelt';
        return 'Hoffnungslos';
      default:
        return '';
    }
  };

  const handleToggleSymptom = (key: string) => {
    setSymptoms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleActivity = (key: string) => {
    setActivities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePhqSelect = (idx: number, val: number) => {
    setPhqAnswers(prev => {
      const c = [...prev];
      c[idx] = val;
      return c;
    });
  };

  const handleGadSelect = (idx: number, val: number) => {
    setGadAnswers(prev => {
      const c = [...prev];
      c[idx] = val;
      return c;
    });
  };

  const handleSavePhq9 = () => {
    if (phqAnswers.some(ans => ans === null)) {
      alert('Bitte beantworte alle 9 Fragen, um den PHQ-9 auszuwerten.');
      return;
    }
    onSavePhq9(todayStr(), phqAnswers as number[]);
    setPhqAnswers(Array(9).fill(null));
    showToast('✅ PHQ-9 Fragebogen gespeichert.');
  };

  const handleSaveGad7 = () => {
    if (gadAnswers.some(ans => ans === null)) {
      alert('Bitte beantworte alle 7 Fragen, um den GAD-7 auszuwerten.');
      return;
    }
    onSaveGad7(todayStr(), gadAnswers as number[]);
    setGadAnswers(Array(7).fill(null));
    showToast('✅ GAD-7 Fragebogen gespeichert.');
  };

  const phqSum = phqAnswers.reduce((a: number, b) => a + (b || 0), 0);
  const phqCompleted = phqAnswers.filter(ans => ans !== null).length;

  const gadSum = gadAnswers.reduce((a: number, b) => a + (b || 0), 0);
  const gadCompleted = gadAnswers.filter(ans => ans !== null).length;

  return (
    <div className="space-y-6">
      {/* Date controls */}
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
            className="p-1 px-2 text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-300"
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

      {/* MoodPath Sliders Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex gap-3">
          <div className="p-2.5 bg-violet-600/10 border border-violet-500/25 rounded-2xl">
            <Smile className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Mentaler Check-In</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Erfasse dein Befinden auf einer Skala von 0 bis 10</p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {MOOD_DIMENSIONS.map((dim) => {
            const val = dims[dim.key] !== undefined ? dims[dim.key] : '';

            return (
              <div key={dim.key} className="flex flex-col gap-2.5 bg-slate-950/25 p-4 border border-slate-850/60 rounded-2xl">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-slate-300">{dim.label}</span>
                  {val !== '' && (
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                      {getMoodDimensionLabel(dim.key, Number(val))}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={val !== '' ? val : 5}
                    onChange={(e) => setDims(prev => ({ ...prev, [dim.key]: parseInt(e.target.value, 10) }))}
                    className={`flex-1 h-1.5 rounded-lg appearance-none bg-slate-950 cursor-pointer ${dim.color}`}
                  />
                  <span className="inline-flex h-9 w-9 items-center justify-center font-mono text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/25 rounded-lg shrink-0 shadow-lg shadow-violet-500/5">
                    {val !== '' ? val : '–'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Symptoms list checkboxes */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">Symptome (Wochen-Check)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DEPRESSION_SYMPTOMS.map(item => {
            const isChecked = !!symptoms[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleToggleSymptom(item.key)}
                className={`p-3 text-left rounded-xl border text-[11px] leading-tight transition-all active:scale-[0.98] ${
                  isChecked
                    ? 'bg-rose-500/12 border-rose-500 text-rose-400 font-bold'
                    : 'bg-slate-950/30 border-slate-850 text-slate-500 hover:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Positive Activities */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">Positive Aktivitäten</h4>
        <div className="flex flex-wrap gap-2">
          {POSITIVE_ACTIVITIES.map(item => {
            const isChecked = !!activities[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleToggleActivity(item.key)}
                className={`px-3 py-1.5 border text-xs font-medium rounded-full active:scale-95 transition-all ${
                  isChecked
                    ? 'bg-emerald-600/15 border-emerald-500 text-emerald-400 font-bold shadow-md shadow-emerald-500/5'
                    : 'bg-slate-950/35 border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mood notebook section */}
      <div className="card diary-step">
        <div className="card-header">
          <div className="step-badge">🧠</div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Stimmungs-Notizbuch</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Welche Auslöser, Ereignisse oder Medikamente spürst du?</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Aufbauendes Telefonat mit Bekannten, anhaltende Angstgefühle am Vormittag nach wenig Schlaf, Sport tat gut..."
            className="notes-area focus:border-violet-500 min-h-[90px] pr-12 text-slate-200"
          />
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`absolute right-3.5 bottom-3.5 p-2 rounded-xl transition-all active:scale-95 ${
              isListening 
                ? 'bg-rose-600 text-white animate-pulse' 
                : 'bg-slate-950 border border-slate-850 text-slate-405 hover:text-slate-200'
            }`}
          >
            {isListening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      <div className="flex justify-center p-3">
        <button
          type="button"
          onClick={handleSaveMoodLog}
          className="w-full max-w-sm flex items-center justify-center gap-2 py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-600/25 transition-all cursor-pointer"
        >
          <Save className="h-4 w-4" /> Stimmung speichern
        </button>
      </div>

      {/* PHQ-9 Depression Screener */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-violet-600/10 border border-violet-500/25 rounded-2xl">
            <ClipboardCheck className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">PHQ-9 Depressionstest</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Symptom-Schweregrad der letzten 2 Wochen</p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {PHQ9_QUESTIONS.map((q, idx) => {
            const currentVal = phqAnswers[idx];

            return (
              <div key={idx} className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl space-y-3">
                <div className="text-xs font-semibold leading-relaxed text-slate-200">
                  <strong className="text-violet-400 mr-1">{idx + 1}.</strong> {q}
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {['Überhaupt nicht', 'An manchen Tagen', 'Mehr als die Hälfte', 'Beinahe jeden Tag'].map((lbl, val) => {
                    const isActive = currentVal === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePhqSelect(idx, val)}
                        className={`py-2 px-1 text-[9px] font-bold rounded-lg border transition-all active:scale-95 flex flex-col items-center justify-center min-h-[36px] ${
                          isActive 
                            ? 'bg-violet-600/15 border-violet-500 text-violet-400 font-extrabold shadow-md shadow-violet-500/5' 
                            : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-350'
                        }`}
                      >
                        <span className="text-xs leading-none mb-0.5">{val}</span>
                        <span className="leading-tight truncate max-w-full">{lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result summary card */}
        <div className="bg-gradient-to-br from-violet-600/10 via-blue-600/5 to-slate-900 border border-violet-500/20 p-6 rounded-3xl text-center space-y-3">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">PHQ-9 Ergebnis</div>
          <div className="font-mono text-3xl font-black text-violet-400">
            {phqCompleted === 9 ? `${phqSum} / 27` : '– / 27'}
          </div>
          <div className="inline-block text-xs font-bold text-slate-200 bg-violet-600/10 border border-violet-500/20 px-4 py-1.5 rounded-full">
            {phqCompleted === 9 
              ? phq9SeverityLabel(phqSum) 
              : `${phqCompleted} von 9 Fragen beantwortet`}
          </div>

          <button
            type="button"
            onClick={handleSavePhq9}
            disabled={phqCompleted < 9}
            className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all ${
              phqCompleted === 9 
                ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 cursor-pointer' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-40'
            }`}
          >
            PHQ-9 speichern
          </button>
        </div>
      </div>

      {/* GAD-7 Anxiety Screener */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <ClipboardCheck className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">GAD-7 Angst-Screener</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Symptom-Schweregrad von generalisierter Angst</p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {GAD7_QUESTIONS.map((q, idx) => {
            const currentVal = gadAnswers[idx];

            return (
              <div key={idx} className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl space-y-3">
                <div className="text-xs font-semibold leading-relaxed text-slate-200">
                  <strong className="text-blue-400 mr-1">{idx + 1}.</strong> {q}
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {['Überhaupt nicht', 'An manchen Tagen', 'Mehr als die Hälfte', 'Beinahe jeden Tag'].map((lbl, val) => {
                    const isActive = currentVal === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleGadSelect(idx, val)}
                        className={`py-2 px-1 text-[9px] font-bold rounded-lg border transition-all active:scale-95 flex flex-col items-center justify-center min-h-[36px] ${
                          isActive 
                            ? 'bg-blue-600/15 border-blue-500 text-blue-400 font-extrabold shadow-md shadow-blue-500/5' 
                            : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-350'
                        }`}
                      >
                        <span className="text-xs leading-none mb-0.5">{val}</span>
                        <span className="leading-tight truncate max-w-full">{lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result summary card */}
        <div className="bg-gradient-to-br from-blue-600/10 via-violet-600/5 to-slate-900 border border-blue-500/20 p-6 rounded-3xl text-center space-y-3">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">GAD-7 Ergebnis</div>
          <div className="font-mono text-3xl font-black text-blue-400">
            {gadCompleted === 7 ? `${gadSum} / 21` : '– / 21'}
          </div>
          <div className="inline-block text-xs font-bold text-slate-200 bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 rounded-full">
            {gadCompleted === 7 
              ? gad7SeverityLabel(gadSum) 
              : `${gadCompleted} von 7 Fragen beantwortet`}
          </div>

          <button
            type="button"
            onClick={handleSaveGad7}
            disabled={gadCompleted < 7}
            className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all ${
              gadCompleted === 7 
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 cursor-pointer' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-40'
            }`}
          >
            GAD-7 speichern
          </button>
        </div>
      </div>

      {/* Crisis / SOS Plan */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex gap-3">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl">
            <AlertOctagon className="h-5 w-5 text-rose-400 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Persönlicher Krisenplan</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Wichtige Hilfskontakte &amp; Schutzpläne</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Therapeut / Behandelnder Psychiater</label>
            <input
              type="text"
              value={therapist}
              onChange={(e) => setTherapist(e.target.value)}
              placeholder="Name &amp; Telefonnummer"
              className="w-full py-3 px-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Hausarzt</label>
            <input
              type="text"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              placeholder="Name &amp; Telefonnummer"
              className="w-full py-3 px-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Vertrauensperson 1</label>
            <input
              type="text"
              value={person1}
              onChange={(e) => setPerson1(e.target.value)}
              placeholder="Name &amp; Verbindung"
              className="w-full py-3 px-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Vertrauensperson 2</label>
            <input
              type="text"
              value={person2}
              onChange={(e) => setPerson2(e.target.value)}
              placeholder="Name &amp; Verbindung"
              className="w-full py-3 px-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Persönlicher Notfallplan (Was hilft jetzt?)</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="z.B. Meditationsübung starten, Hund streicheln, Lieblingsmusik hören, spazieren gehen, ..."
              className="notes-area min-h-[70px] text-slate-200"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Meine Frühwarnzeichen</label>
            <textarea
              value={warningSigns}
              onChange={(e) => setWarningSigns(e.target.value)}
              placeholder="z.B. sozialer Rückzug, Grübeln am Abend über Stunden, Schlaflosigkeit, extreme Reizbarkeit, ..."
              className="notes-area min-h-[70px] text-slate-200"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveCrisis}
          className="w-full py-3 bg-rose-600/10 hover:bg-rose-600/15 border border-rose-500/25 hover:border-rose-500/40 text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
        >
          Krisenplan-Änderungen anwenden
        </button>

        <div className="p-4 bg-rose-600/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl leading-normal">
          <strong>⚠️ Sofortige Hilfe bei akuten Belastungsphasen:</strong>
          <br /><br />
          Solltest du dich in einer aussichtslosen situativen Belastung befinden, zögere nicht, kostenlos die Telefonseelsorge zu kontaktieren:
          <br />
          📞 <strong>0800 111 0 111</strong> oder 📞 <strong>0800 111 0 222</strong>
          <br /> In akuten medizinischen Gefahrensituationen wähle direkt den <strong>Notruf 112</strong>.
        </div>
      </div>
    </div>
  );
}
