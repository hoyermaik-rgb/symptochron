import React, { useState } from 'react';
import { 
  Moon, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Layers,
  HelpCircle,
  Info,
  Award
} from 'lucide-react';
import { DiaryEntry, Medication } from '../types';

interface SleepMedChartProps {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
  rangeDays: number;
}

export default function SleepMedChart({ diary, meds, rangeDays }: SleepMedChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // 1. Get dates in chronological order matching parent range
  const getDatesInRange = () => {
    const dates = Object.keys(diary);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - rangeDays);
    const limitStr = limitDate.toISOString().split('T')[0];

    return dates
      .filter(d => d >= limitStr)
      .sort((a, b) => a.localeCompare(b));
  };

  const activeDates = getDatesInRange();

  // 2. Map data points
  // For each date, calculate:
  // - sleepHours (0-12)
  // - sleepQuality (1-5)
  // - Evening/Night med requirements and actual intake
  const points = activeDates.map((dateStr, idx) => {
    const entry = diary[dateStr];
    const label = dateStr.split('-').slice(1).reverse().join('.'); // DD.MM

    // Determine scheduled evening/night medications
    const eveningNightMeds = meds.filter(m => m.active && ((m.schedule?.evening || 0) > 0 || (m.schedule?.night || 0) > 0));
    
    let totalScheduledSlots = 0;
    let totalTakenSlots = 0;

    eveningNightMeds.forEach(m => {
      if ((m.schedule?.evening || 0) > 0) {
        totalScheduledSlots++;
        const takenId = `${m.id}_evening`;
        if (entry?.medsTaken?.includes(takenId)) {
          totalTakenSlots++;
        }
      }
      if ((m.schedule?.night || 0) > 0) {
        totalScheduledSlots++;
        const takenId = `${m.id}_night`;
        if (entry?.medsTaken?.includes(takenId)) {
          totalTakenSlots++;
        }
      }
    });

    let adherenceState: 'full' | 'partial' | 'missed' | 'none' = 'none';
    if (totalScheduledSlots > 0) {
      if (totalTakenSlots === totalScheduledSlots) {
        adherenceState = 'full';
      } else if (totalTakenSlots > 0) {
        adherenceState = 'partial';
      } else {
        adherenceState = 'missed';
      }
    }

    return {
      date: dateStr,
      label,
      sleepHours: entry?.sleepHours || null,
      sleepQuality: entry?.sleepQuality || null,
      scheduledCount: totalScheduledSlots,
      takenCount: totalTakenSlots,
      adherenceState,
    };
  }).filter(p => p.sleepHours !== null || p.sleepQuality !== null || p.scheduledCount > 0);

  // 3. Compute statistics for correlation overview
  const statsWithMeds = { sleepSum: 0, qualitySum: 0, count: 0 };
  const statsWithoutMeds = { sleepSum: 0, qualitySum: 0, count: 0 };

  points.forEach(p => {
    if (p.scheduledCount > 0) {
      if (p.adherenceState === 'full') {
        if (p.sleepHours !== null && p.sleepHours > 0) {
          statsWithMeds.sleepSum += p.sleepHours;
          statsWithMeds.count++;
        }
        if (p.sleepQuality !== null && p.sleepQuality > 0) {
          statsWithMeds.qualitySum += p.sleepQuality;
        }
      } else if (p.adherenceState === 'missed') {
        if (p.sleepHours !== null && p.sleepHours > 0) {
          statsWithoutMeds.sleepSum += p.sleepHours;
          statsWithoutMeds.count++;
        }
        if (p.sleepQuality !== null && p.sleepQuality > 0) {
          statsWithoutMeds.qualitySum += p.sleepQuality;
        }
      }
    }
  });

  const avgSleepWith = statsWithMeds.count > 0 ? statsWithMeds.sleepSum / statsWithMeds.count : null;
  const avgQualityWith = statsWithMeds.count > 0 ? statsWithMeds.qualitySum / statsWithMeds.count : null;

  const avgSleepWithout = statsWithoutMeds.count > 0 ? statsWithoutMeds.sleepSum / statsWithoutMeds.count : null;
  const avgQualityWithout = statsWithoutMeds.count > 0 ? statsWithoutMeds.qualitySum / statsWithoutMeds.count : null;

  // 4. SVG Layout calculations
  const width = 600;
  const height = 260;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (points.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (points.length - 1)) * chartWidth;
  };

  // Convert sleep hours (0 to 12) to Y coordinate
  const getSleepY = (val: number | null) => {
    if (val === null) return null;
    const clamped = Math.max(0, Math.min(12, val));
    return paddingTop + chartHeight - (clamped / 12) * chartHeight;
  };

  // Convert sleep quality (1 to 5) to Y coordinate
  const getQualityY = (val: number | null) => {
    if (val === null) return null;
    const clamped = Math.max(1, Math.min(5, val));
    // scale 1-5 to fit nice within the height
    return paddingTop + chartHeight - ((clamped - 1) / 4) * chartHeight;
  };

  // Generate SVG lines/areas
  let sleepLinePath = '';
  let sleepAreaPath = '';
  let qualityLinePath = '';

  let isFirstSleep = true;
  let isFirstQuality = true;
  let lastSleepX = paddingLeft;

  points.forEach((pt, i) => {
    const x = getX(i);
    const ySleep = getSleepY(pt.sleepHours);
    const yQuality = getQualityY(pt.sleepQuality);

    if (ySleep !== null) {
      if (isFirstSleep) {
        sleepLinePath = `M ${x} ${ySleep}`;
        sleepAreaPath = `M ${x} ${paddingTop + chartHeight} L ${x} ${ySleep}`;
        isFirstSleep = false;
      } else {
        sleepLinePath += ` L ${x} ${ySleep}`;
        sleepAreaPath += ` L ${x} ${ySleep}`;
      }
      lastSleepX = x;
    }

    if (yQuality !== null) {
      if (isFirstQuality) {
        qualityLinePath = `M ${x} ${yQuality}`;
        isFirstQuality = false;
      } else {
        qualityLinePath += ` L ${x} ${yQuality}`;
      }
    }
  });

  if (!isFirstSleep) {
    sleepAreaPath += ` L ${lastSleepX} ${paddingTop + chartHeight} Z`;
  }

  return (
    <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-3xl space-y-6">
      
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex gap-2.5 items-center">
            <Moon className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-105">Schlaf &amp; Abend-Medikation</h4>
          </div>
          <p className="text-[11px] text-slate-400 max-w-xl">
            Überlagerung der nächtlichen Schlafdauer und Schlafqualität (1–5) mit den tatsächlich eingenommenen Dosen deiner Abend- und Nachtmedikation.
          </p>
        </div>

        {/* Dynamic Interactive Legend */}
        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-500/40 block" />
            <span>Dauer (Std)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block" />
            <span>Qualität (1-5)</span>
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="p-10 text-center space-y-3 rounded-2xl border border-dashed border-slate-800 bg-slate-950/25">
          <Info className="h-8 w-8 text-slate-500 mx-auto" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-300">Zu wenige Logdaten vorhanden</p>
            <p className="text-[10px] text-slate-500">
              Trage Schlafstunden und Abendmedikamente im Tagebuch ein, um die Analyse freizuschalten.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Main Interactive Chart Section */}
          <div className="relative bg-slate-950/30 border border-slate-900 rounded-2xl p-4 overflow-x-auto scrollbar-thin">
            <div className="min-w-[550px] relative">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                
                {/* Left sleep axis helper lines */}
                {[0, 3, 6, 9, 12].map((val) => {
                  const y = getSleepY(val);
                  if (y === null) return null;
                  return (
                    <g key={val}>
                      <line 
                        x1={paddingLeft} 
                        y1={y} 
                        x2={width - paddingRight} 
                        y2={y} 
                        className="stroke-slate-900 stroke-[1]" 
                        strokeDasharray="3 3"
                      />
                      <text 
                        x={paddingLeft - 8} 
                        y={y + 3.5} 
                        className="fill-slate-500 text-[9px] font-mono text-right" 
                        textAnchor="end"
                      >
                        {val}h
                      </text>
                    </g>
                  );
                })}

                {/* Right quality axis helper labels */}
                {[1, 3, 5].map((val) => {
                  const y = getQualityY(val);
                  if (y === null) return null;
                  return (
                    <text 
                      key={val}
                      x={width - paddingRight + 8} 
                      y={y + 3.5} 
                      className="fill-emerald-500/80 text-[9px] font-mono" 
                      textAnchor="start"
                    >
                      {val}★
                    </text>
                  );
                })}

                {/* Sleep duration Area & Line chart */}
                {sleepAreaPath && (
                  <path 
                    d={sleepAreaPath} 
                    className="fill-indigo-500/10" 
                  />
                )}
                {sleepLinePath && (
                  <path 
                    d={sleepLinePath} 
                    className="stroke-indigo-500 stroke-[2.5] fill-none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                )}

                {/* Schlafqualität line path */}
                {qualityLinePath && (
                  <path 
                    d={qualityLinePath} 
                    className="stroke-emerald-400 stroke-[2] fill-none" 
                    strokeDasharray="4 2"
                    strokeLinecap="round"
                  />
                )}

                {/* Data points & Pill adherence indicators */}
                {points.map((pt, i) => {
                  const x = getX(i);
                  const ySleep = getSleepY(pt.sleepHours);
                  const yQuality = getQualityY(pt.sleepQuality);
                  const isHovered = hoveredPoint === i;

                  // Pill colors based on adherence
                  let pillColor = 'stroke-slate-800 fill-slate-900';
                  let pillGlyph = '–';
                  if (pt.adherenceState === 'full') {
                    pillColor = 'stroke-emerald-500/30 fill-emerald-500/10';
                    pillGlyph = '✓';
                  } else if (pt.adherenceState === 'partial') {
                    pillColor = 'stroke-amber-500/30 fill-amber-500/10';
                    pillGlyph = '½';
                  } else if (pt.adherenceState === 'missed') {
                    pillColor = 'stroke-rose-500/30 fill-rose-500/10';
                    pillGlyph = '✗';
                  }

                  return (
                    <g key={i} className="cursor-pointer/hover">
                      {/* Vertical highlight line on hover */}
                      {isHovered && (
                        <line 
                          x1={x} 
                          y1={paddingTop} 
                          x2={x} 
                          y2={paddingTop + chartHeight + 15} 
                          className="stroke-violet-500/30 stroke-[1.5]"
                        />
                      )}

                      {/* Sleep Quality Point circles */}
                      {yQuality !== null && (
                        <circle 
                          cx={x} 
                          cy={yQuality} 
                          r={isHovered ? 5.5 : 4} 
                          className="fill-emerald-400 stroke-slate-950 stroke-[1.5] transition-all"
                        />
                      )}

                      {/* Sleep Duration Point circles */}
                      {ySleep !== null && (
                        <circle 
                          cx={x} 
                          cy={ySleep} 
                          r={isHovered ? 4.5 : 3} 
                          className="fill-indigo-400 stroke-slate-950 stroke-[1.5] transition-all"
                        />
                      )}

                      {/* Interactive click zone column */}
                      <rect 
                        x={x - 12} 
                        y={paddingTop} 
                        width={24} 
                        height={chartHeight + 20} 
                        className="fill-transparent cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(i)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />

                      {/* Bottom Med Capsule indicators */}
                      {pt.scheduledCount > 0 && (
                        <g transform={`translate(${x - 7.5}, ${paddingTop + chartHeight + 5})`}>
                          <rect 
                            width={15} 
                            height={15} 
                            rx={7.5} 
                            className={`${pillColor} stroke-[1]`}
                          />
                          <text 
                            x={7.5} 
                            y={11.5} 
                            className={`text-[9px] font-extrabold font-mono text-center ${
                              pt.adherenceState === 'full' ? 'fill-emerald-400' :
                              pt.adherenceState === 'partial' ? 'fill-amber-400' :
                              pt.adherenceState === 'missed' ? 'fill-rose-400' : 'fill-slate-500'
                            }`}
                            textAnchor="middle"
                          >
                            {pillGlyph}
                          </text>
                        </g>
                      )}

                      {/* Timeline dates along the X axis */}
                      <text 
                        x={x} 
                        y={paddingTop + chartHeight + 34} 
                        className={`text-[8px] font-mono leading-none text-center ${
                          isHovered ? 'fill-slate-200 font-extrabold' : 'fill-slate-600'
                        }`}
                        textAnchor="middle"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip display overlaid */}
              {hoveredPoint !== null && points[hoveredPoint] && (
                <div 
                  className="absolute z-20 bg-slate-900/95 border border-slate-800 p-3.5 rounded-2xl shadow-xl w-52 pointer-events-none animate-fade-in"
                  style={{
                    left: `${Math.max(10, Math.min(width - 220, getX(hoveredPoint) - 100)) / width * 100}%`,
                    top: '15px'
                  }}
                >
                  <p className="text-[10px] font-mono font-bold text-slate-500 block">
                    LOG VOM {points[hoveredPoint].date.split('-').reverse().join('.')}
                  </p>
                  <div className="mt-2 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 block" /> Schlafdauer:
                      </span>
                      <strong className="text-indigo-300 font-mono">
                        {points[hoveredPoint].sleepHours !== null ? `${points[hoveredPoint].sleepHours} Std.` : '–'}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 block" /> Schlafqualität:
                      </span>
                      <strong className="text-emerald-300 font-mono">
                        {points[hoveredPoint].sleepQuality !== null ? `${points[hoveredPoint].sleepQuality}/5 ★` : '–'}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-850">
                      <span className="text-slate-500">Abendmedikation:</span>
                      {points[hoveredPoint].scheduledCount === 0 ? (
                        <span className="text-[10px] text-slate-500 italic">Nicht verordnet</span>
                      ) : (
                        <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded ${
                          points[hoveredPoint].adherenceState === 'full' ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' :
                          points[hoveredPoint].adherenceState === 'partial' ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400' :
                          'bg-rose-500/10 border border-rose-500/25 text-rose-400'
                        }`}>
                          {points[hoveredPoint].takenCount}/{points[hoveredPoint].scheduledCount} eingenommen
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Adherence vs Sleep Score Matrix / Bento Stats Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Adherence Card Column */}
            <div className="p-4 bg-slate-950/40 border border-slate-905 rounded-2xl flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-extrabold text-indigo-400 uppercase tracking-wider block">Effektstärke</span>
                <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest leading-none">Vergleich der Schlafdauer</h5>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" /> Mit Abend-Meds
                  </span>
                  <span className="text-xs text-slate-200 font-bold font-mono">
                    {avgSleepWith !== null ? `${avgSleepWith.toFixed(1)} Std.` : 'Keine Daten'}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all" 
                    style={{ width: avgSleepWith !== null ? `${(avgSleepWith / 12) * 100}%` : '0%' }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block" /> Ohne/Vergessen
                  </span>
                  <span className="text-xs text-slate-300 font-bold font-mono col">
                    {avgSleepWithout !== null ? `${avgSleepWithout.toFixed(1)} Std.` : 'Keine Daten'}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500/45 rounded-full transition-all" 
                    style={{ width: avgSleepWithout !== null ? `${(avgSleepWithout / 12) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>

            {/* Quality Comparison card */}
            <div className="p-4 bg-slate-950/40 border border-slate-905 rounded-2xl flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-extrabold text-emerald-400 uppercase tracking-wider block">Regulative Wirkung</span>
                <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest leading-none">Schlafqualität (1–5)</h5>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Eingenommen</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-emerald-300 font-bold font-mono">
                      {avgQualityWith !== null ? `${avgQualityWith.toFixed(1)}` : '–'}
                    </span>
                    <span className="text-[10px] text-slate-500">/5 ★</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Vergessen</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-305 font-bold font-mono">
                      {avgQualityWithout !== null ? `${avgQualityWithout.toFixed(1)}` : '–'}
                    </span>
                    <span className="text-[10px] text-slate-500">/5 ★</span>
                  </div>
                </div>

                {/* Growth indicator badge */}
                {avgQualityWith !== null && avgQualityWithout !== null && (
                  <div className="pt-2 border-t border-slate-900 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                      avgQualityWith > avgQualityWithout ? 'bg-emerald-500/10 text-emerald-405' : 'bg-rose-500/10 text-rose-405'
                    }`}>
                      {avgQualityWith > avgQualityWithout 
                        ? `✓ +${((avgQualityWith - avgQualityWithout) / avgQualityWithout * 100).toFixed(0)}% bessere Schlafqualität` 
                        : 'Auswirkung neutral'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Scientific explanation on efficacy */}
            <div className="p-4 bg-slate-950/40 border border-slate-905 rounded-2xl flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex gap-1.5 items-center text-indigo-400">
                  <Award className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-400">Wirkkurven-Erkenntnis</span>
                </div>
                <p className="text-[11px] text-slate-450 leading-relaxed font-normal">
                  Dopaminerge Therapeutika (wie L-Dopa oder Pramipexol) haben Halbwertszeiten, die exakt an die Abend- und Einschlafstunden angepasst sind. Lücken in der Einnahmetreue führen nachts zu "Rebound-Effekten", die das Durchschlafen erschweren.
                </p>
              </div>

              {avgSleepWith !== null && avgSleepWithout !== null && avgSleepWith > avgSleepWithout ? (
                <div className="text-[11px] text-indigo-300 font-medium pt-2 border-t border-slate-900 mt-2">
                  ✨ Deine Daten stützen dies: Bei Einnahme schläfst du im Schnitt{(avgSleepWith - avgSleepWithout).toFixed(1)} Std. länger!
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 italic pt-2 border-t border-slate-900 mt-2">
                  Komplettiere dein Tagebuch über mehrere Wochen hinweg, um präzise Rebound-Wirkungen sichtbar zu machen.
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
