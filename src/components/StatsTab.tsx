import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  Sliders,
  ChevronDown,
  Info,
  Coffee,
  HelpCircle,
  Clock,
  Zap
} from 'lucide-react';
import { DiaryEntry, MoodEntry, RLSSurvey, Medication } from '../types';
import { dailyAvgPain, dailyAvgRls, averageForKeys, computeCorrelation } from '../utils';
import Charts from './Charts';
import AiTrendAnalysis from './AiTrendAnalysis';
import SleepMedChart from './SleepMedChart';

interface StatsTabProps {
  diary: Record<string, DiaryEntry>;
  mood: Record<string, MoodEntry>;
  rlsSurveys: Record<string, RLSSurvey>;
  meds: Medication[];
}

export default function StatsTab({ diary, mood, rlsSurveys, meds }: StatsTabProps) {
  const [rangeDays, setRangeDays] = useState(14); // 7, 14, 30

  // Filter keys in range sorted chronologically
  const getSortedDatesInRange = () => {
    const dates = Object.keys(diary);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - rangeDays);
    const limitStr = limitDate.toISOString().split('T')[0];

    return dates
      .filter(d => d >= limitStr)
      .sort((a, b) => a.localeCompare(b));
  };

  const activeDates = getSortedDatesInRange();

  // Compute stats indicators
  const getOverviewMetrics = () => {
    let painSum = 0;
    let painCount = 0;
    let rlsSum = 0;
    let rlsCount = 0;
    let sleepSum = 0;
    let sleepCount = 0;

    activeDates.forEach(date => {
      const e = diary[date];
      if (!e) return;

      const p = dailyAvgPain(e);
      if (p !== null) {
        painSum += p;
        painCount++;
      }

      const r = dailyAvgRls(e);
      if (r !== null) {
        rlsSum += r;
        rlsCount++;
      }

      if (e.sleepHours !== undefined && e.sleepHours > 0) {
        sleepSum += e.sleepHours;
        sleepCount++;
      }
    });

    return {
      avgPain: painCount > 0 ? painSum / painCount : null,
      avgRls: rlsCount > 0 ? rlsSum / rlsCount : null,
      avgSleep: sleepCount > 0 ? sleepSum / sleepCount : null,
      logCount: activeDates.length,
    };
  };

  const metrics = getOverviewMetrics();

  // Tageszeit Muster (Morning vs Noon vs Evening vs Night)
  const getTimesOfDayPeaks = () => {
    const slots = ['morning', 'noon', 'evening', 'night'];
    const sumsPain = [0, 0, 0, 0];
    const cntsPain = [0, 0, 0, 0];
    const sumsRls = [0, 0, 0, 0];
    const cntsRls = [0, 0, 0, 0];

    activeDates.forEach(d => {
      const e = diary[d];
      if (!e) return;

      slots.forEach((slot, idx) => {
        const pVal = e[`${slot}_pain` as keyof DiaryEntry];
        if (typeof pVal === 'number') {
          sumsPain[idx] += pVal;
          cntsPain[idx]++;
        }

        const rVal = e[`${slot}_rls` as keyof DiaryEntry];
        if (typeof rVal === 'number') {
          sumsRls[idx] += rVal;
          cntsRls[idx]++;
        }
      });
    });

    const slotsGerman = ['Morgen', 'Mittag', 'Abend', 'Nacht'];

    return slots.map((_, idx) => ({
      label: slotsGerman[idx],
      avgPain: cntsPain[idx] > 0 ? sumsPain[idx] / cntsPain[idx] : null,
      avgRls: cntsRls[idx] > 0 ? sumsRls[idx] / cntsRls[idx] : null,
    }));
  };

  const timePatterns = getTimesOfDayPeaks();

  // Advanced correlation calculator between factors and RLS/Pain
  const getTriggerCorrelations = () => {
    // We compute correlation over activeDates between boolean factors & daily avg RLS/Pain
    const factorLabels: Record<string, string> = {
      coffee: '☕ Koffeinkonsum',
      alcohol: '🍷 Alkoholkonsum',
      stress: '⚠️ Stressphasen',
      sport: '🏋️ Körperliches Training',
      poorSleep: '🛌 Schlafmangel',
    };

    const triggers: { factor: string; label: string; corrRls: number | null; corrPain: number | null; count: number }[] = [];

    Object.keys(factorLabels).forEach(fKey => {
      const xFactor: number[] = [];
      const yRls: number[] = [];
      const yPain: number[] = [];
      let activeCount = 0;

      activeDates.forEach(date => {
        const e = diary[date];
        if (!e) return;

        const isFactorTrue = !!(e.factors && e.factors[fKey]);
        const rVal = dailyAvgRls(e);
        const pVal = dailyAvgPain(e);

        if (rVal !== null || pVal !== null) {
          xFactor.push(isFactorTrue ? 1 : 0);
          if (isFactorTrue) activeCount++;

          if (rVal !== null) yRls.push(rVal);
          if (pVal !== null) yPain.push(pVal);
        }
      });

      // Calculate Pearson correlation
      let corrRls: number | null = null;
      let corrPain: number | null = null;

      if (xFactor.length >= 3) {
        if (yRls.length === xFactor.length) {
          corrRls = computeCorrelation(xFactor, yRls);
        }
        if (yPain.length === xFactor.length) {
          corrPain = computeCorrelation(xFactor, yPain);
        }
      }

      triggers.push({
        factor: fKey,
        label: factorLabels[fKey],
        corrRls,
        corrPain,
        count: activeCount,
      });
    });

    return triggers;
  };

  const triggerCorrelations = getTriggerCorrelations();

  // Highlight highest correlation for automatically discovered insights
  const getDiscoveredSmartInsights = () => {
    const list: string[] = [];

    // Check coffee vs RLS
    const coffeeRel = triggerCorrelations.find(t => t.factor === 'coffee');
    if (coffeeRel && coffeeRel.corrRls !== null && coffeeRel.corrRls > 0.3) {
      list.push(`⚠️ <strong>Starker Zusammenhang mit Kaffee:</strong> Dein nächtliches RLS kribbelte an Tagen mit Koffeinkonsum spürbar ausgeprägter (Korrelation: +${coffeeRel.corrRls.toFixed(2)}).`);
    }

    // Check stress vs Pain
    const stressRel = triggerCorrelations.find(t => t.factor === 'stress');
    if (stressRel && stressRel.corrPain !== null && stressRel.corrPain > 0.3) {
      list.push(`⚠️ <strong>Stress als Schmerzverstärker:</strong> Stressphasen wirken sich laut logistischer Trendanalyse negativ auf dein Schmerz-Level aus (+${stressRel.corrPain.toFixed(2)}).`);
    }

    // Check sport vs RLS
    const sportRel = triggerCorrelations.find(t => t.factor === 'sport');
    if (sportRel && sportRel.corrRls !== null && sportRel.corrRls < -0.2) {
      list.push(`🍀 <strong>Positive Wirkung durch Bewegung:</strong> An Trainingstagen war dein RLS abends im Schnitt milder (Korrelation: ${sportRel.corrRls.toFixed(2)}).`);
    }

    // General insights on sleep
    if (metrics.avgSleep !== null && metrics.avgSleep < 6.0) {
      list.push(`🛌 <strong>Schlafdefizit:</strong> Mit durchschnittlich ${metrics.avgSleep.toFixed(1)} Stunden liegt dein Schlaf unter dem empfohlenen erholsamen Referenzbereich von 7 Std.`);
    }

    if (list.length === 0) {
      list.push('💡 <strong>Mehr Daten benötigt:</strong> Sobald du weitere Tage buchst, ermittelt der Algorithmus hier automatisch verborgene Trigger-Werte für dich!');
    }

    return list;
  };

  const insights = getDiscoveredSmartInsights();

  // Custom helper for coloring correlation badges
  const getCorrelationColor = (val: number | null) => {
    if (val === null) return 'text-slate-500 bg-slate-950 border-slate-900';
    if (Math.abs(val) < 0.15) return 'text-slate-300 bg-slate-950 border-slate-850';
    if (val > 0.3) return 'text-rose-400 bg-rose-500/10 border-rose-500/25 font-bold';
    if (val > 0) return 'text-amber-400 bg-amber-500/15 border-amber-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  const getCorrelationLabel = (val: number | null) => {
    if (val === null) return 'Keine Daten';
    const abs = Math.abs(val);
    const direction = val > 0 ? 'verstärkend' : 'lindernd';
    const valueStr = `(${val > 0 ? '+' : ''}${val.toFixed(2)})`;
    if (abs < 0.15) return `Neutral ${valueStr}`;
    if (abs > 0.45) return `Stark ${direction} ${valueStr}`;
    return `${direction} ${valueStr}`;
  };

  return (
    <div className="space-y-6">
      {/* Range controls in bar */}
      <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
        <span className="text-xs text-slate-400 font-medium">Analysierter Zeitraum:</span>
        <div className="flex gap-1 bg-slate-950 p-1 border border-slate-850 rounded-xl">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                rangeDays === days
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {days} Tage
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Summary Rows */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/40 border border-slate-850 p-4.5 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Log-Einträge</span>
          <span className="font-mono text-xl font-black text-slate-200">{metrics.logCount}</span>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4.5 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Ø Schmerzen</span>
          <span className="font-mono text-xl font-black text-rose-400">
            {metrics.avgPain !== null ? metrics.avgPain.toFixed(1) : '–'}
          </span>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4.5 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Ø RLS-Stärke</span>
          <span className="font-mono text-xl font-black text-violet-400">
            {metrics.avgRls !== null ? metrics.avgRls.toFixed(1) : '–'}
          </span>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4.5 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Ø Schlafdauer</span>
          <span className="font-mono text-xl font-black text-blue-400">
            {metrics.avgSleep !== null ? `${metrics.avgSleep.toFixed(1)} Std` : '–'}
          </span>
        </div>
      </div>

      {/* Charts Section containing interactive SVG plots */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-3">
        <div className="flex justify-between items-baseline flex-wrap gap-2">
          <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-blue-500" /> Symptomverlauf &amp; Trends
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">Letzte {rangeDays} ausgewertete Tage</span>
        </div>
        <Charts diary={diary} mood={mood} rangeDays={rangeDays} meds={meds} />
      </div>

      {/* Sleep & Evening/Night Medication Correlation Chart Section */}
      <SleepMedChart diary={diary} meds={meds} rangeDays={rangeDays} />

      {/* Tageszeit-Muster block */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-2.5 items-center">
          <Clock className="h-4.5 w-4.5 text-slate-400" />
          <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Tageszeit-Symptom-Muster</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {timePatterns.map((pt, idx) => (
            <div key={idx} className="bg-slate-950/45 border border-slate-850/65 p-4 rounded-2xl flex flex-col justify-between space-y-3">
              <span className="text-xs font-bold text-slate-350">{pt.label}</span>
              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Pain:</span>
                  <span className="text-rose-450 font-bold">{pt.avgPain !== null ? pt.avgPain.toFixed(1) : '–'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">RLS:</span>
                  <span className="text-violet-400 font-bold">{pt.avgRls !== null ? pt.avgRls.toFixed(1) : '–'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced trigger Pearson correlations correlations tables */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-2.5 items-center">
          <Sliders className="h-4.5 w-4.5 text-slate-400" />
          <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Statistische Trigger-Analyse</h4>
        </div>
        <p className="text-[11px] text-slate-500 mt-1 leading-normal">
          Diese Tabelle zeigt die mathematische Abhängigkeit (Pearson-Korrelation) zwischen deinen eingepflegten Begleitfaktoren und Symptomen.
          Wert nahe <strong>+1.0</strong>: Starke Schmerz-/Kribbelverstärkung. Nahe <strong>-1.0</strong>: Lindernde Tendenz.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-350 border-collapse">
            <thead>
              <tr className="border-b border-slate-850 uppercase tracking-wider text-[10px] text-slate-550 font-bold">
                <th className="py-2.5 pl-2">Begleitfaktor</th>
                <th className="py-2.5 text-center">Häufigkeit</th>
                <th className="py-2.5 text-center">RLS-Einfluss</th>
                <th className="py-2.5 pr-2 text-center">Schmerz-Einfluss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {triggerCorrelations.map(tc => (
                <tr key={tc.factor} className="hover:bg-slate-950/20 transition-all font-sans">
                  <td className="py-3 px-2 font-semibold text-slate-200">{tc.label}</td>
                  <td className="py-3 text-center text-[10px] font-mono font-bold text-slate-450">{tc.count} Tage</td>
                  <td className="py-3 text-center">
                    <span className={`inline-block py-1 px-2.5 min-w-[110px] text-center border text-[9px] font-black font-mono rounded-lg ${getCorrelationColor(tc.corrRls)}`}>
                      {getCorrelationLabel(tc.corrRls)}
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-center">
                    <span className={`inline-block py-1 px-2.5 min-w-[110px] text-center border text-[9px] font-black font-mono rounded-lg ${getCorrelationColor(tc.corrPain)}`}>
                      {getCorrelationLabel(tc.corrPain)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Trend Analysis of RLS scores & Medication compliance */}
      <AiTrendAnalysis diary={diary} meds={meds} />

      {/* Automated smart text insights generated dynamically! */}
      <div className="bg-linear-to-br from-violet-600/10 via-blue-600/5 to-slate-900 border border-violet-500/15 p-6 rounded-3xl space-y-4">
        <div className="flex gap-2.5 items-center text-violet-400">
          <Sparkles className="h-4.5 w-4.5 animate-pulse" />
          <h4 className="text-sm font-bold uppercase tracking-wider">Errechnete Verlaufserkenntnisse</h4>
        </div>

        <ul className="space-y-3">
          {insights.map((ins, idx) => (
            <li
              key={idx}
              className="text-xs text-slate-300 leading-normal font-sans border-l-2 border-violet-500/40 pl-3.5"
              dangerouslySetInnerHTML={{ __html: ins }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
