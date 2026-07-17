import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Calendar, 
  Plus, 
  Trash, 
  ChevronDown, 
  Check, 
  ClipboardCheck, 
  AlertCircle 
} from 'lucide-react';
import { Appointment, RLSSurvey, DiaryEntry } from '../types';
import { 
  todayStr, 
  formatDateShort, 
  surveySeverityLabel, 
  addDays, 
  parseDate 
} from '../utils';

interface RLSTabProps {
  diary: Record<string, DiaryEntry>;
  appointments: Appointment[];
  rlsSurveys: Record<string, RLSSurvey>;
  onAddAppointment: (appt: Appointment) => void;
  onDeleteAppointment: (id: string) => void;
  onSaveSurvey: (answers: number[]) => void;
  rlsMode: 'auto' | 'weekly_only' | 'detailed_only';
  onSetRlsMode: (mode: 'auto' | 'weekly_only' | 'detailed_only') => void;
  surveyWeekday: number;
  onSetSurveyWeekday: (day: number) => void;
}

const IRLS_QUESTIONS = [
  'Wie würden Sie insgesamt die RLS-Beschwerden in Beinen oder Armen beschreiben?',
  'Wie würden Sie insgesamt den Drang beschreiben, sich wegen des RLS bewegen zu müssen?',
  'Wie stark war Ihre Erleichterung der Beschwerden durch Bewegung?',
  'Wie stark waren Ihre Schlafstörungen durch das Restless-Legs-Syndrom?',
  'Wie stark war Ihre Müdigkeit oder Schläfrigkeit am Tage durch das RLS?',
  'Wie ausgeprägt war das Restless-Legs-Syndrom insgesamt?',
  'Wie oft traten die Beschwerden auf (Häufigkeit)?',
  'Wie ausgeprägt war der Bewegungsdrang oder die Unruhe an typischen Symptimtagen?',
  'Wie stark hat sich das RLS auf Ihre täglichen Aktivitäten (Arbeit, Freizeit) ausgewirkt?',
  'Wie stark haben sich die Beschwerden auf Ihre Stimmung ausgewirkt (Gefühle, Reizbarkeit)?',
];

export default function RLSTab({
  diary,
  appointments,
  rlsSurveys,
  onAddAppointment,
  onDeleteAppointment,
  onSaveSurvey,
  rlsMode,
  onSetRlsMode,
  surveyWeekday,
  onSetSurveyWeekday,
}: RLSTabProps) {
  const current = todayStr();
  const [apptDate, setApptDate] = useState('');
  const [apptType, setApptType] = useState<'pain' | 'rls'>('rls');
  const [preVisitDays, setPreVisitDays] = useState(14);
  const [surveyAnswers, setSurveyAnswers] = useState<(number | null)[]>(Array(10).fill(null));

  // Determine current pre-visit window state
  const getActivePreVisit = () => {
    for (const appt of appointments) {
      const start = addDays(appt.date, -appt.preVisitDays);
      if (current >= start && current <= appt.date) {
        return appt;
      }
    }
    return null;
  };

  const activePreVisit = getActivePreVisit();

  const handleAddAppt = () => {
    if (!apptDate) return;
    onAddAppointment({
      id: 'appt_' + Date.now(),
      date: apptDate,
      type: apptType,
      preVisitDays,
    });
    setApptDate('');
  };

  const handleSelectAnswer = (qIndex: number, val: number) => {
    setSurveyAnswers(prev => {
      const c = [...prev];
      c[qIndex] = val;
      return c;
    });
  };

  const handleSubmitSurvey = () => {
    if (surveyAnswers.some(ans => ans === null)) {
      alert('Bitte beantworte alle 10 Fragen, um den Fragebogen auszuwerten.');
      return;
    }
    onSaveSurvey(surveyAnswers as number[]);
    setSurveyAnswers(Array(10).fill(null));
  };

  const currentSurveySum = surveyAnswers.reduce((a: number, b) => a + (b || 0), 0);
  const completedAnswers = surveyAnswers.filter(ans => ans !== null).length;

  const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-violet-600/10 border border-violet-500/25 rounded-2xl">
            <Activity className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">RLS-Protokollmodus</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Modus konfigurieren und Dokumentation timen</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5 flex flex-col">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Modus</label>
            <select
              value={rlsMode}
              onChange={(e) => onSetRlsMode(e.target.value as any)}
              className="py-3 px-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value="auto">Automatisch (Vor-Termin-Phase)</option>
              <option value="weekly_only">Nur wöchentlicher IRLS-Fragebogen</option>
              <option value="detailed_only">Ausschließlich tägliche RLS-Doku</option>
            </select>
          </div>

          {rlsMode !== 'detailed_only' && (
            <div className="space-y-1.5 flex flex-col">
              <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Erinnerungs-Wochentag</label>
              <select
                value={surveyWeekday}
                onChange={(e) => onSetSurveyWeekday(parseInt(e.target.value))}
                className="py-3 px-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500"
              >
                {weekdayNames.map((n, i) => (
                  <option key={i} value={i}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Appointment Tracker with Pre-Visit Warning */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Arzttermine verwalten</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Sichert tägliche Symptomprotokolle vor Arztkonsultationen</p>
          </div>
        </div>

        {/* Appointment warning widget */}
        <AnimatePresence>
          {activePreVisit && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-2xl text-xs leading-relaxed"
            >
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <strong>Vor-Termin-Phase aktiv!</strong> 
                <br /> Bitte fülle täglich das Tagebuch aus, um deinem Arzt für den anstehenden Termin am <strong>{formatDateShort(activePreVisit.date)}</strong> ein lückenloses Symptombild bereitzustellen.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add appointment form */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/45 p-4 border border-slate-850 rounded-2xl items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Termin</label>
            <input
              type="date"
              value={apptDate}
              onChange={(e) => setApptDate(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Facharzt</label>
            <select
              value={apptType}
              onChange={(e) => setApptType(e.target.value as any)}
              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300"
            >
              <option value="rls">RLS-Facharzt / Neurologe</option>
              <option value="pain">Schmerztherapeut</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vorbereitung</label>
            <select
              value={preVisitDays}
              onChange={(e) => setPreVisitDays(Number(e.target.value))}
              className="w-full py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300"
            >
              <option value="7">7 Tage vorher</option>
              <option value="10">10 Tage vorher</option>
              <option value="14">14 Tage vorher</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddAppt}
            className="flex items-center justify-center gap-1.5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/15 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Speichern
          </button>
        </div>

        {/* Appointments List */}
        {appointments.length > 0 ? (
          <div className="space-y-2">
            {appointments.map((appt) => {
              const apptLabel = appt.type === 'pain' ? 'Schmerzspezialist' : 'Neurologe / RLS-Arzt';
              return (
                <div key={appt.id} className="flex justify-between items-center p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                  <div>
                    <div className="text-xs font-bold text-slate-200">{formatDateShort(appt.date)}</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">{apptLabel}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-950 px-2.5 py-1 border border-slate-850 rounded-lg">
                      {appt.preVisitDays} Tage Doku
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteAppointment(appt.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-450 hover:bg-rose-500/10 rounded-xl transition-all"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 block p-2 text-center italic">
            Keine anstehenden Arzttermine eingetragen.
          </span>
        )}
      </div>

      {/* IRLS Survey Sheet */}
      {rlsMode !== 'detailed_only' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex gap-3">
            <div className="p-2.5 bg-violet-600/10 border border-violet-500/25 rounded-2xl">
              <ClipboardCheck className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">IRLS Fragebogen (Wöchentlich)</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Internationales Diagnoseinstrument für RLS-Patienten</p>
            </div>
          </div>

          {/* Questionnaire list */}
          <div className="space-y-4 pt-2">
            {IRLS_QUESTIONS.map((q, idx) => {
              const currentVal = surveyAnswers[idx];

              return (
                <div key={idx} className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl space-y-3.5">
                  <div className="text-xs font-semibold leading-relaxed text-slate-200">
                    <strong className="text-violet-400 mr-1">{idx + 1}.</strong> {q}
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 5 }).map((_, val) => {
                      const isActive = currentVal === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleSelectAnswer(idx, val)}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all active:scale-95 ${
                            isActive 
                              ? 'bg-violet-600/15 border-violet-500 text-violet-400 shadow-md shadow-violet-500/5' 
                              : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {val}
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
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ergebnis</div>
            <div className="font-mono text-3xl font-black text-violet-400">
              {completedAnswers === 10 ? `${currentSurveySum} / 40` : '– / 40'}
            </div>
            <div className="inline-block text-xs font-bold text-slate-200 bg-violet-600/10 border border-violet-500/20 px-4 py-1.5 rounded-full">
              {completedAnswers === 10 
                ? surveySeverityLabel(currentSurveySum) 
                : `${completedAnswers} von 10 Fragen beantwortet`}
            </div>

            <button
              type="button"
              onClick={handleSubmitSurvey}
              disabled={completedAnswers < 10}
              className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all ${
                completedAnswers === 10 
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 cursor-pointer' 
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-40'
              }`}
            >
              Auswertung speichern
            </button>
          </div>

          {/* Survey History list */}
          {Object.keys(rlsSurveys).length > 0 && (
            <div className="space-y-2 pt-2">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Historische Fragebögen</h5>
              {Object.keys(rlsSurveys)
                .sort((a, b) => b.localeCompare(a))
                .slice(0, 5)
                .map((dateKey) => {
                  const s = rlsSurveys[dateKey];
                  return (
                    <div key={dateKey} className="flex justify-between items-center p-4.5 bg-slate-900 border border-slate-850 rounded-2xl">
                      <div>
                        <div className="text-xs font-bold text-slate-200">{formatDateShort(dateKey)}</div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                          {s.severity}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-black text-violet-400">{s.sum} / 40</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
