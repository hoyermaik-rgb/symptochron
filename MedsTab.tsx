import React, { useState } from 'react';
import { DiaryEntry } from '../types';
import { dailyAvgPain, dailyAvgRls } from '../utils';

interface ChartsProps {
  diary: Record<string, DiaryEntry>;
  selectedDays?: 7 | 30 | 90;
  rangeDays?: number;
  mood?: any;
}

export default function Charts({ diary, selectedDays = 7, rangeDays, mood }: ChartsProps) {
  const [range, setRange] = useState<7 | 30 | 90>((rangeDays as any) || selectedDays);
  const [activeTooltip, setActiveTooltip] = useState<{ x: number; y: number; label: string; painValue: number | null; rlsValue: number | null } | null>(null);

  // Get date series
  const today = new Date();
  const dateList: string[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateList.push(`${y}-${m}-${day}`);
  }

  // Pre-calculate data points
  const points = dateList.map((dateStr) => {
    const entry = diary[dateStr];
    return {
      date: dateStr,
      label: dateStr.split('-').slice(1).reverse().join('.'), // DD.MM
      pain: dailyAvgPain(entry),
      rls: dailyAvgRls(entry),
    };
  });

  // SVG parameters
  const width = 450;
  const height = 180;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (points.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (points.length - 1)) * chartWidth;
  };

  const getY = (val: number | null) => {
    if (val === null) return null;
    return paddingTop + chartHeight - (val / 10) * chartHeight;
  };

  // Generate paths
  let painLinePath = '';
  let painAreaPath = '';
  let rlsLinePath = '';
  let rlsAreaPath = '';

  let isFirstPain = true;
  let isFirstRls = true;

  let lastPainX = paddingLeft;
  let lastRlsX = paddingLeft;

  points.forEach((pt, i) => {
    const x = getX(i);
    const yPain = getY(pt.pain);
    const yRls = getY(pt.rls);

    if (yPain !== null) {
      if (isFirstPain) {
        painLinePath = `M ${x} ${yPain}`;
        painAreaPath = `M ${x} ${paddingTop + chartHeight} L ${x} ${yPain}`;
        isFirstPain = false;
      } else {
        painLinePath += ` L ${x} ${yPain}`;
        painAreaPath += ` L ${x} ${yPain}`;
      }
      lastPainX = x;
    }

    if (yRls !== null) {
      if (isFirstRls) {
        rlsLinePath = `M ${x} ${yRls}`;
        rlsAreaPath = `M ${x} ${paddingTop + chartHeight} L ${x} ${yRls}`;
        isFirstRls = false;
      } else {
        rlsLinePath += ` L ${x} ${yRls}`;
        rlsAreaPath += ` L ${x} ${yRls}`;
      }
      lastRlsX = x;
    }
  });

  if (!isFirstPain) {
    painAreaPath += ` L ${lastPainX} ${paddingTop + chartHeight} Z`;
  }
  if (!isFirstRls) {
    rlsAreaPath += ` L ${lastRlsX} ${paddingTop + chartHeight} Z`;
  }

  // Time of Day bar values (last 7 days average per slot)
  const slots = [
    { key: 'morning', label: 'Morgen' },
    { key: 'noon', label: 'Mittag' },
    { key: 'evening', label: 'Abend' },
    { key: 'night', label: 'Nacht' },
  ];

  const recent7Dates = dateList.slice(-7);
  const todPain: Record<string, { sum: number; count: number }> = { morning: { sum: 0, count: 0 }, noon: { sum: 0, count: 0 }, evening: { sum: 0, count: 0 }, night: { sum: 0, count: 0 } };
  const todRls: Record<string, { sum: number; count: number }> = { morning: { sum: 0, count: 0 }, noon: { sum: 0, count: 0 }, evening: { sum: 0, count: 0 }, night: { sum: 0, count: 0 } };

  recent7Dates.forEach(d => {
    const entry = diary[d];
    if (!entry) return;
    slots.forEach(s => {
      const painVal = entry[`${s.key}_pain` as keyof DiaryEntry];
      const rlsVal = entry[`${s.key}_rls` as keyof DiaryEntry];
      if (typeof painVal === 'number') {
        todPain[s.key].sum += painVal;
        todPain[s.key].count++;
      }
      if (typeof rlsVal === 'number') {
        todRls[s.key].sum += rlsVal;
        todRls[s.key].count++;
      }
    });
  });

  const barWidth = 120;
  const barHeight = 100;
  const barChartHeight = 130;

  const hasLoggedData = Object.keys(diary).length > 0;

  return (
    <div className="space-y-6">
      {/* Chart controls */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">Symptom-Verlauf</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Mittelwert aus Tageszeit-Erfassungen</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRange(days)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                range === days 
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25' 
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {days} Tage
            </button>
          ))}
        </div>
      </div>

      {hasLoggedData ? (
        <div className="relative">
          {/* Main Line SVG Chart */}
          <div className="w-full overflow-x-auto select-none no-scrollbar">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full min-w-[400px] h-auto overflow-visible"
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <defs>
                <linearGradient id="painGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="rlsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 2, 4, 6, 8, 10].map((v) => {
                const y = getY(v)!;
                return (
                  <g key={v}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      className="stroke-slate-850 stroke-[0.8px] stroke-dasharray-[3]"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-600 font-mono text-[9px] font-semibold"
                    >
                      {v}
                    </text>
                  </g>
                );
              })}

              {/* Colored areas */}
              {painAreaPath && <path d={painAreaPath} fill="url(#painGradient)" />}
              {rlsAreaPath && <path d={rlsAreaPath} fill="url(#rlsGradient)" />}

              {/* Line paths */}
              {painLinePath && (
                <path
                  d={painLinePath}
                  fill="none"
                  stroke="#ff6b6b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {rlsLinePath && (
                <path
                  d={rlsLinePath}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interaction Bars */}
              {points.map((pt, i) => {
                const x = getX(i);
                const showXLabel = range === 7 || (range === 30 ? i % 4 === 0 : i % 12 === 0);

                return (
                  <g key={i}>
                    {/* Hover Zone */}
                    <rect
                      x={x - 10}
                      y={paddingTop}
                      width={20}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={(e) => {
                        const bounds = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({
                          x: x,
                          y: Math.min(getY(pt.pain || 5) || 50, getY(pt.rls || 5) || 50),
                          label: pt.date,
                          painValue: pt.pain,
                          rlsValue: pt.rls,
                        });
                      }}
                    />

                    {/* Date label */}
                    {showXLabel && (
                      <text
                        x={x}
                        y={height - 12}
                        textAnchor="middle"
                        className="fill-slate-600 font-mono text-[9px] font-semibold"
                      >
                        {pt.label}
                      </text>
                    )}

                    {/* Node points on hover/active or for range=7 */}
                    {range === 7 && pt.pain !== null && (
                      <circle cx={x} cy={getY(pt.pain)!} r="3" fill="#ff6b6b" />
                    )}
                    {range === 7 && pt.rls !== null && (
                      <circle cx={x} cy={getY(pt.rls)!} r="3" fill="#a78bfa" />
                    )}
                  </g>
                );
              })}

              {/* Active Guide Vertical Line */}
              {activeTooltip && (
                <line
                  x1={activeTooltip.x}
                  y1={paddingTop}
                  x2={activeTooltip.x}
                  y2={paddingTop + chartHeight}
                  className="stroke-slate-500/30 stroke-[1.2px]"
                />
              )}
            </svg>
          </div>

          {/* Interactive Tooltip Card overlay */}
          {activeTooltip && (
            <div
              className="absolute bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-[10px] space-y-1 shadow-xl z-20 pointer-events-none"
              style={{
                left: `${(activeTooltip.x / width) * 100}%`,
                top: `${(activeTooltip.y / height) * 100}%`,
                transform: 'translate(-50%, -110%)',
              }}
            >
              <div className="font-bold text-slate-300">{activeTooltip.label}</div>
              <div className="flex gap-4">
                <span className="text-[#ff6b6b]">
                  Schmerz: <strong>{activeTooltip.painValue !== null ? activeTooltip.painValue.toFixed(1) : '–'}</strong>
                </span>
                <span className="text-[#a78bfa]">
                  RLS: <strong>{activeTooltip.rlsValue !== null ? activeTooltip.rlsValue.toFixed(1) : '–'}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="h-44 flex items-center justify-center border border-dashed border-slate-800 rounded-3xl bg-slate-950/25">
          <span className="text-xs text-slate-500 italic p-4 text-center">
            Es sind noch nicht genug Einträge vorhanden, um den Verlauf zu zeichnen.
          </span>
        </div>
      )}

      {/* Time of Day Patterns */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5">
        <h4 className="text-xs font-bold text-slate-100 uppercase tracking-widest mb-4">
          Tageszeit-Belastung (Ø letzte 7 Tage)
        </h4>

        {hasLoggedData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {slots.map((s) => {
              const pAvg = todPain[s.key].count > 0 ? todPain[s.key].sum / todPain[s.key].count : null;
              const rAvg = todRls[s.key].count > 0 ? todRls[s.key].sum / todRls[s.key].count : null;

              return (
                <div key={s.key} className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex flex-col space-y-3">
                  <div className="text-xs font-semibold text-slate-400">{s.label}</div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-500">Schmerz</span>
                      <span className="font-mono text-sm font-bold text-rose-400">
                        {pAvg !== null ? pAvg.toFixed(1) : '–'}
                      </span>
                    </div>
                    {/* Custom progress line */}
                    <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500" 
                        style={{ width: pAvg !== null ? `${pAvg * 10}%` : '0%' }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-500">RLS</span>
                      <span className="font-mono text-sm font-bold text-violet-400">
                        {rAvg !== null ? rAvg.toFixed(1) : '–'}
                      </span>
                    </div>
                    <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-violet-400" 
                        style={{ width: rAvg !== null ? `${rAvg * 10}%` : '0%' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-28 flex items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/25">
            <span className="text-xs text-slate-550 italic p-4 text-center">
              Trage tageszeitliche Intensitäten ein, um Muster des Tagesverlaufs freizulegen.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
