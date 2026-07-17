import React from 'react';
import { motion } from 'motion/react';
import { 
  HeartPulse, 
  Calendar, 
  Flame, 
  ClipboardList, 
  Pill, 
  Award, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Smile, 
  FileText, 
  Sliders
} from 'lucide-react';
import { DiaryEntry, Medication, MoodEntry, Appointment } from '../types';
import { todayStr, formatLocalDate, dailyAvgPain, dailyAvgRls } from '../utils';
import DailyHealthInsight from './DailyHealthInsight';

interface WelcomeTabProps {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
  mood: Record<string, MoodEntry>;
  patientName: string;
  onSwitchTab: (tab: any) => void;
  onToggleMed: (slotId: string) => void;
  onConfirmAllMeds: () => void;
  appointments: Appointment[];
}

export default function WelcomeTab({
  diary,
  meds,
  mood,
  patientName,
  onSwitchTab,
  onToggleMed,
  onConfirmAllMeds,
  appointments = [],
}: WelcomeTabProps) {
  const current = todayStr();
  const todayEntry = diary[current];
  const todayMood = mood[current];

  const getUpcomingAppointments = () => {
    const todayVal = new Date(current);
    return appointments
      .filter(appt => {
        const apptDate = new Date(appt.date);
        return apptDate >= todayVal;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  };

  const upcomingAppts = getUpcomingAppointments();

  const getWeeklySleepAnalysis = () => {
    const today = new Date();
    
    const getAvgScoreForRange = (startOffset: number, endOffset: number) => {
      let scoreSum = 0;
      let count = 0;
      for (let i = startOffset; i <= endOffset; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const entry = diary[dateStr];
        if (entry && entry.sleepHours !== undefined && entry.sleepQuality !== undefined) {
          const dayScore = ((entry.sleepHours / 8) * 50) + ((entry.sleepQuality / 5) * 50);
          scoreSum += Math.min(100, Math.max(0, dayScore));
          count++;
        }
      }
      return count > 0 ? Math.round(scoreSum / count) : null;
    };

    const currentWeekScore = getAvgScoreForRange(-6, 0);
    const lastWeekScore = getAvgScoreForRange(-13, -7);

    return {
      current: currentWeekScore,
      previous: lastWeekScore,
      diff: currentWeekScore !== null && lastWeekScore !== null ? currentWeekScore - lastWeekScore : null
    };
  };

  const sleepAnalysis = getWeeklySleepAnalysis();

  // Greet based on hour
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 11) return { text: 'Guten Morgen', icon: '☀️' };
    if (hr >= 11 && hr < 17) return { text: 'Guten Tag', icon: '🌤️' };
    if (hr >= 17 && hr < 22) return { text: 'Guten Abend', icon: '🌆' };
    return { text: 'Gute Nacht', icon: '🌙' };
  };

  const greet = getGreeting();
  const firstName = patientName ? patientName.split(' ')[0] : '';

  // Check today's diary completion
  const isDiaryCompleted = !!(
    todayEntry &&
    (todayEntry.morning_pain !== undefined ||
      todayEntry.noon_pain !== undefined ||
      todayEntry.evening_pain !== undefined ||
      todayEntry.night_pain !== undefined)
  );

  // Compute Streak
  const getStreak = () => {
    let streak = 0;
    let checkDate = current;
    const hasLog = (d: string) => {
      const e = diary[d];
      return !!(e && (e.morning_pain !== undefined || e.morning_rls !== undefined || e.notes));
    };

    if (!hasLog(checkDate)) {
      checkDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    }

    while (hasLog(checkDate)) {
      streak++;
      const [y, m, d] = checkDate.split('-').map(Number);
      const prev = new Date(y, m - 1, d);
      prev.setDate(prev.getDate() - 1);
      checkDate = prev.toISOString().split('T')[0];
    }
    return streak;
  };

  const streak = getStreak();

  // Today's scheduled medications
  const getTodayMeds = () => {
    const list: { id: string; med: Medication; label: string; icon: string; checked: boolean }[] = [];
    const slots = [
      { key: 'morning', label: 'Morgens', icon: '☀️' },
      { key: 'noon', label: 'Mittags', icon: '🌤️' },
      { key: 'evening', label: 'Abends', icon: '🌆' },
      { key: 'night', label: 'Nachts', icon: '🌙' },
    ];

    meds.forEach(m => {
      if (!m.active) return;
      let isScheduled = false;
      slots.forEach(s => {
        if (m.schedule[s.key] > 0) {
          isScheduled = true;
          const slotId = `${m.id}_${s.key}`;
          const isTaken = !!(todayEntry && todayEntry.medsTaken && todayEntry.medsTaken.includes(slotId));
          list.push({
            id: slotId,
            med: m,
            label: `${s.icon} ${s.label} · ${m.schedule[s.key]}×`,
            icon: s.icon,
            checked: isTaken,
          });
        }
      });

      if (!isScheduled) {
        // Bedarfsmedikation
        const isTaken = !!(todayEntry && todayEntry.medsTaken && todayEntry.medsTaken.includes(m.id));
        list.push({
          id: m.id,
          med: m,
          label: '📌 Bei Bedarf',
          icon: '📌',
          checked: isTaken,
        });
      }
    });

    return list;
  };

  const todayMeds = getTodayMeds();
  const confirmedMeds = todayMeds.filter(m => m.checked).length;
  const medsProgress = todayMeds.length > 0 ? (confirmedMeds / todayMeds.length) * 100 : 0;

  // Average over range helper to compute weekly contrast
  const avgForRange = (startOffset: number, endOffset: number) => {
    let painSum = 0;
    let painCnt = 0;
    let rlsSum = 0;
    let rlsCnt = 0;
    let daysWithData = 0;

    for (let i = startOffset; i <= endOffset; i++) {
      const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
      const e = diary[date];
      if (!e) continue;
      let hasAny = false;

      const pVal = dailyAvgPain(e);
      if (pVal !== null) {
        painSum += pVal;
        painCnt++;
        hasAny = true;
      }

      const rVal = dailyAvgRls(e);
      if (rVal !== null) {
        rlsSum += rVal;
        rlsCnt++;
        hasAny = true;
      }

      if (hasAny) daysWithData++;
    }

    return {
      pain: painCnt > 0 ? painSum / painCnt : null,
      rls: rlsCnt > 0 ? rlsSum / rlsCnt : null,
      days: daysWithData,
    };
  };

  const thisWeek = avgForRange(-6, 0);
  const lastWeek = avgForRange(-13, -7);

  // Compute average today's mood
  const getTodayMoodAvg = () => {
    if (!todayMood) return null;
    const dims = [
      todayMood.stimmung, todayMood.energie, todayMood.antrieb, 
      todayMood.angst, todayMood.reizbarkeit, todayMood.konzentration, 
      todayMood.hoffnungslosigkeit
    ].filter((v): v is number => v !== undefined && v !== null);
    
    if (dims.length === 0) return null;
    return dims.reduce((a, b) => a + b, 0) / dims.length;
  };

  const moodAvg = getTodayMoodAvg();

  const criticalStockMeds = meds.filter(m => {
    if (m.stock === undefined || m.stock === null) return false;
    const dailyCount = Object.keys(m.schedule).reduce((acc, k) => acc + (m.schedule[k] || 0), 0);
    if (dailyCount > 0) {
      const stockDays = Math.floor(m.stock / dailyCount);
      return stockDays < 3;
    } else {
      return m.stock < 5;
    }
  });

  const warningStockMeds = meds.filter(m => {
    if (m.stock === undefined || m.stock === null) return false;
    const isCritical = criticalStockMeds.some(crit => crit.id === m.id);
    if (isCritical) return false;

    const dailyCount = Object.keys(m.schedule).reduce((acc, k) => acc + (m.schedule[k] || 0), 0);
    if (dailyCount > 0) {
      const stockDays = Math.floor(m.stock / dailyCount);
      return stockDays < 7;
    } else {
      return m.stock < 15;
    }
  });

  return (
    <div className="space-y-6">
      {/* Critical stock alerts */}
      {criticalStockMeds.length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-3 shadow-md shadow-rose-500/5 animate-pulse">
          <Pill className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-rose-455 uppercase tracking-wide">
              🚨 Kritischer Vorrat: Sofort nachbestellen!
            </div>
            <p className="text-[11px] text-slate-350 leading-relaxed font-sans">
              Folgende Präparate sind fast vollständig aufgebraucht:
            </p>
            <ul className="list-disc pl-4 text-[10px] text-slate-400 space-y-0.5 pt-1">
              {criticalStockMeds.map(m => {
                const dailyCount = Object.keys(m.schedule).reduce((acc, k) => acc + (m.schedule[k] || 0), 0);
                const daysLeft = dailyCount > 0 ? Math.floor(m.stock! / dailyCount) : null;
                return (
                  <li key={m.id}>
                    <span className="font-bold text-slate-200">{m.name}</span>: Nur noch {m.stock!.toFixed(0)} Stück {daysLeft !== null && `(reicht für ca. ${daysLeft} Tage)`}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Warning stock alerts */}
      {warningStockMeds.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3 shadow-sm">
          <Pill className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">
              ⚠️ Vorrat neigt sich dem Ende zu
            </div>
            <p className="text-[11px] text-slate-355 leading-relaxed font-sans">
              Rezeptanforderung empfohlen für folgende Medikamente:
            </p>
            <ul className="list-disc pl-4 text-[10px] text-slate-400 space-y-0.5 pt-1">
              {warningStockMeds.map(m => {
                const dailyCount = Object.keys(m.schedule).reduce((acc, k) => acc + (m.schedule[k] || 0), 0);
                const daysLeft = dailyCount > 0 ? Math.floor(m.stock! / dailyCount) : null;
                return (
                  <li key={m.id}>
                    <span className="font-bold text-slate-200">{m.name}</span>: Noch {m.stock!.toFixed(0)} Stück {daysLeft !== null && `(reicht für ca. ${daysLeft} Tage)`}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Stock Disclaimer */}
      {(criticalStockMeds.length > 0 || warningStockMeds.length > 0) && (
        <div className="text-[10px] text-slate-500 italic px-2 -mt-3">
          *Hinweis: Der errechnete Vorrat ist eine Schätzung auf Basis deines Einnahmeplans. Bitte gleiche ihn regelmäßig mit deinem echten Bestand ab, um Abweichungen zu vermeiden.
        </div>
      )}

      {/* Hero Welcome banner */}
      <div className="relative p-6 sm:p-8 overflow-hidden rounded-3xl bg-linear-to-br from-blue-600/10 via-violet-600/5 to-slate-900/40 border border-blue-500/20">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-slate-100 font-serif italic">
              {greet.text}{firstName ? `, ${firstName}` : ''}!
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 font-mono uppercase tracking-wider">
              <Calendar className="h-4 w-4" />
              <span>{formatLocalDate(current)}</span>
            </div>
          </div>

          {streak >= 2 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-full text-xs font-bold self-start sm:self-auto shadow-md shadow-amber-500/5">
              <Flame className="h-4 w-4 animate-pulse fill-current" />
              <span>{streak} Tage in Folge</span>
            </div>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-4 max-w-xl leading-relaxed">
          SymptoChron behütet dich als digitaler Partner bei chronischen Erkrankungen. Hier ist dein aktueller Status von heute.
        </p>
      </div>

      {/* Completion cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Diary completions */}
        <div
          onClick={() => onSwitchTab('diary')}
          className={`group cursor-pointer p-6 rounded-3xl border transition-all duration-200 ${
            isDiaryCompleted
              ? 'bg-emerald-600/5 border-emerald-500/25 hover:border-emerald-500/45'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className={`p-3 rounded-2xl ${isDiaryCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
              <ClipboardList className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Tagebuch</span>
          </div>
          <div className="mt-4">
            <div className="text-lg font-bold text-slate-100">
              {isDiaryCompleted ? '✅ Erfasst' : '⏳ Ausstehend'}
            </div>
            <div className="text-xs text-slate-500 mt-1 group-hover:text-blue-400 flex items-center gap-1 transition-colors">
              {isDiaryCompleted ? 'Eintrag ansehen' : 'Jetzt ausfüllen'} <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Medications progress */}
        <div
          onClick={() => onSwitchTab('diary')}
          className={`group cursor-pointer p-6 rounded-3xl border transition-all duration-200 ${
            medsProgress === 100 && todayMeds.length > 0
              ? 'bg-emerald-600/5 border-emerald-500/25 hover:border-emerald-500/45'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className={`p-3 rounded-2xl ${medsProgress === 100 && todayMeds.length > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
              <Pill className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Medikation</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-lg font-bold text-slate-100">
              {todayMeds.length === 0 
                ? 'Keine geplant' 
                : medsProgress === 100 
                  ? '✅ Alle eingenommen' 
                  : `${confirmedMeds} von ${todayMeds.length} bestätigt`}
            </div>
            {todayMeds.length > 0 && (
              <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${medsProgress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                  style={{ width: `${medsProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Weekly Sleep Score */}
        <div
          onClick={() => onSwitchTab('charts')}
          className="group cursor-pointer p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200"
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-2xl">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Schlaf-Score</span>
          </div>
          <div className="mt-4">
            <div className="text-lg font-bold text-slate-100">
              {sleepAnalysis.current !== null ? `${sleepAnalysis.current} / 100` : '⏳ Ausstehend'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {sleepAnalysis.current !== null ? (
                sleepAnalysis.diff !== null && sleepAnalysis.diff !== 0 ? (
                  <span className={sleepAnalysis.diff > 0 ? 'text-emerald-400 font-bold animate-pulse' : 'text-rose-455 font-bold'}>
                    {sleepAnalysis.diff > 0 ? '↑' : '↓'} {Math.abs(sleepAnalysis.diff)}% vs. Vorwoche
                  </span>
                ) : (
                  <span>Konstant zur Vorwoche</span>
                )
              ) : (
                <span>Keine Daten vorhanden</span>
              )}
            </div>
          </div>
        </div>

        {/* Today's Mood avg */}
        <div
          onClick={() => onSwitchTab('mood')}
          className="group cursor-pointer p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200"
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-violet-600/10 text-violet-400 border border-violet-500/20 rounded-2xl">
              <Smile className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Mental-Befinden</span>
          </div>
          <div className="mt-4">
            <div className="text-lg font-bold text-slate-100">
              {moodAvg !== null ? `${moodAvg.toFixed(1)} / 10` : '⏳ Erfassen'}
            </div>
            <div className="text-xs text-slate-500 mt-1 group-hover:text-blue-400 flex items-center gap-1 transition-colors">
              {moodAvg !== null ? 'Details ansehen' : 'Tägliche Stimmung protokollieren'} <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Health Insight of the Day component powered by Gemini */}
      <DailyHealthInsight diary={diary} />

      {/* Arzttermine Widget */}
      {upcomingAppts.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Anstehende Arzttermine</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Deine nächsten medizinischen Konsultationen</p>
            </div>
            <button
              onClick={() => onSwitchTab('rls')}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold"
            >
              Termine verwalten →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {upcomingAppts.map((appt) => {
              const apptLabel = appt.type === 'pain' ? 'Schmerzspezialist' : 'Neurologe / RLS-Arzt';
              return (
                <div key={appt.id} className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between space-y-2">
                  <div>
                    <div className="text-xs font-bold text-slate-200">{apptLabel}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      📅 {formatLocalDate(appt.date)}
                    </div>
                  </div>
                  <div className="text-[9px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded self-start">
                    {appt.preVisitDays} Tage Dokumentation
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Medication Confirmation Card */}
      {todayMeds.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Schnellbestätigung</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Antippen zum Einnehmen oder Abwählen</p>
            </div>
            <button
              type="button"
              onClick={onConfirmAllMeds}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-xl shadow-md shadow-blue-600/10 transition-all"
            >
              ✓ Alle bestätigen
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {todayMeds.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleMed(item.id)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl text-left border transition-all active:scale-[0.98] ${
                  item.checked
                    ? 'bg-emerald-600/5 border-emerald-500/30'
                    : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg border font-bold text-xs ${
                  item.checked 
                    ? 'bg-emerald-500 border-emerald-550 text-slate-950' 
                    : 'bg-slate-900 border-slate-800 text-transparent'
                }`}>
                  ✓
                </span>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold leading-tight ${item.checked ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {item.med.name}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    {item.label} {item.med.dose && `· ${item.med.dose}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Week Summary comparing current vs previous */}
      {thisWeek.days > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Deine Woche (Letzte 7 Tage)</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Automatischer Vergleich zur vorangegangenen Woche</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950/45 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Log-Tage</span>
              <span className="font-mono text-sm font-bold text-slate-200">{thisWeek.days} / 7</span>
            </div>

            {thisWeek.pain !== null && (
              <div className="bg-slate-950/45 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Ø Schmerz</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-rose-400">{thisWeek.pain.toFixed(1)}</span>
                  {(() => {
                    if (lastWeek.pain === null) return null;
                    const diff = thisWeek.pain - lastWeek.pain;
                    if (Math.abs(diff) < 0.25) return <span className="text-[10px] text-slate-500 font-bold">→</span>;
                    return diff > 0 
                      ? <span className="text-[10px] text-rose-500 flex items-center font-bold"><TrendingUp className="h-3 w-3 mr-0.5" /> +{diff.toFixed(1)}</span>
                      : <span className="text-[10px] text-emerald-500 flex items-center font-bold"><TrendingDown className="h-3 w-3 mr-0.5" /> {diff.toFixed(1)}</span>;
                  })()}
                </div>
              </div>
            )}

            {thisWeek.rls !== null && (
              <div className="bg-slate-950/45 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Ø RLS-Stärke</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-violet-400">{thisWeek.rls.toFixed(1)}</span>
                  {(() => {
                    if (lastWeek.rls === null) return null;
                    const diff = thisWeek.rls - lastWeek.rls;
                    if (Math.abs(diff) < 0.25) return <span className="text-[10px] text-slate-500 font-bold">→</span>;
                    return diff > 0 
                      ? <span className="text-[10px] text-rose-500 flex items-center font-bold"><TrendingUp className="h-3 w-3 mr-0.5" /> +{diff.toFixed(1)}</span>
                      : <span className="text-[10px] text-emerald-500 flex items-center font-bold"><TrendingDown className="h-3 w-3 mr-0.5" /> {diff.toFixed(1)}</span>;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick navigation bento grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Schnellzugriff</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'diary', label: 'Eintrag erfassen', icon: '✏️' },
            { id: 'rls', label: 'RLS-Dokumentation', icon: '🦵' },
            { id: 'charts', label: 'Verläufe & Muster', icon: '📈' },
            { id: 'export', label: 'Arzt-Export / Report', icon: '📤' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSwitchTab(item.id)}
              className="flex flex-col items-center justify-center gap-3 p-5 bg-slate-900/60 border border-slate-850 hover:border-slate-750 active:scale-95 text-slate-300 font-medium rounded-2xl text-xs text-center transition-all cursor-pointer"
            >
              <span className="text-2xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
export type { WelcomeTabProps }; // Exporting interface as well
