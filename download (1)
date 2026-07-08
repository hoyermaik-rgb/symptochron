import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Brain, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  ShieldAlert, 
  RefreshCw,
  Heart,
  Calendar,
  Layers,
  HelpCircle
} from 'lucide-react';
import { DiaryEntry, Medication } from '../types';

interface AiTrendAnalysisProps {
  diary: Record<string, DiaryEntry>;
  meds: Medication[];
}

interface CorrelationItem {
  title: string;
  observation: string;
  impact: string;
}

interface AnalysisResult {
  summary: string;
  adherenceRate: string;
  correlations: CorrelationItem[];
  patterns: string[];
  recommendations: string[];
}

export default function AiTrendAnalysis({ diary, meds }: AiTrendAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Load cached analysis from localstorage if available
  useEffect(() => {
    const cached = localStorage.getItem('symptochron_ai_analysis');
    if (cached) {
      try {
        setResult(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached analysis:', e);
      }
    }
  }, []);

  // Format 30 day records
  const generateDataPayload = () => {
    const dataPoints = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const entry = diary[dateStr];
      if (entry) {
        // Compute daily average RLS severity
        const rlsParts = [
          entry.morning_rls,
          entry.noon_rls,
          entry.evening_rls,
          entry.night_rls
        ].filter((v): v is number => typeof v === 'number');
        const avgRls = rlsParts.length > 0 
          ? parseFloat((rlsParts.reduce((a, b) => a + b, 0) / rlsParts.length).toFixed(1))
          : null;

        dataPoints.push({
          date: dateStr,
          avgRls,
          sleepHours: entry.sleepHours,
          sleepQuality: entry.sleepQuality,
          medsTaken: entry.medsTaken || []
        });
      }
    }

    const medConfig = meds.map(m => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      schedule: m.schedule,
      active: m.active
    }));

    return { dataPoints, medications: medConfig };
  };

  const handleRunAnalysis = async () => {
    const payload = generateDataPayload();
    
    if (payload.dataPoints.length === 0) {
      setError('⚠️ Keine Logbuch-Einträge aus den letzten 30 Tagen gefunden. Bitte erfasse zuerst Daten im Tagebuch!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-trends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server antwortete mit Status ${response.status}`);
      }

      const parsed: AnalysisResult = await response.json();
      setResult(parsed);
      localStorage.setItem('symptochron_ai_analysis', JSON.stringify(parsed));
    } catch (err: any) {
      console.error('Error running AI analysis:', err);
      setError(err?.message || 'Fehler bei der Verbindung mit dem Analyse-Server. Bitte versuche es später noch einmal.');
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    const clean = impact.toLowerCase();
    if (clean.includes('stark positiv') || clean.includes('sehr gut') || clean.includes('positiv') || clean.includes('lindernd')) {
      return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    }
    if (clean.includes('negativ') || clean.includes('schlimmer') || clean.includes('verstärkend') || clean.includes('stark negativ')) {
      return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    }
    return 'bg-slate-900 border-slate-800 text-slate-400';
  };

  const loggedDaysCount = generateDataPayload().dataPoints.length;

  return (
    <div className="bg-linear-to-br from-violet-600/10 via-blue-600/5 to-slate-900 border border-violet-500/15 p-6 rounded-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex gap-2.5 items-center">
            <Brain className="h-5 w-5 text-violet-400 animate-pulse" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-100">AI-Verlaufs- &amp; Therapietreue-Analyse</h4>
          </div>
          <p className="text-[11px] text-slate-400 max-w-xl">
            Ein fortschrittliches Analysemodul, das deine RLS-Symptomstärken und die Medikamenteneinnahme der letzten 30 Tage auf verdeckte Zusammenhänge untersucht.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleRunAnalysis}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all cursor-pointer select-none ${
            loading 
              ? 'bg-violet-600/10 border-violet-500/30 text-violet-300' 
              : 'bg-violet-600 hover:bg-violet-500 border-violet-500 text-white shadow-lg shadow-violet-500/10 active:scale-97'
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Daten werden analysiert...
            </>
          ) : result ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Neu analysieren
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Analyse starten
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 flex-none mt-0.5" />
          <div className="text-xs text-rose-300 leading-relaxed font-medium">
            {error}
          </div>
        </div>
      )}

      {/* Loading Placeholder */}
      {loading && !result && (
        <div className="p-10 text-center space-y-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/20">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl animate-pulse"></div>
            <Brain className="h-10 w-10 text-violet-400 mx-auto animate-bounce" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-300">Korrelationen werden mathematisch berechnet...</p>
            <p className="text-[10px] text-slate-500">
              Analysiere {loggedDaysCount} aktive Tage und Medikamentenschemata mit Gemini
            </p>
          </div>
        </div>
      )}

      {/* No results yet standard explanation block */}
      {!result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
          <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-2">
            <Calendar className="h-4.5 w-4.5 text-blue-400" />
            <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">30-Tage Rhythmus</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Erfasst Trends und Schwankungen im Monatszyklus, um chronobiologische Trigger genauer zu validieren.
            </p>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-2">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
            <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Medizinische Adhärenz</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Setzt die Einnah metreue deiner L-Dopa, Dopaminagonisten oder Reservepräparate in direkten Bezug zu RLS-Peaks.
            </p>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-2">
            <Sparkles className="h-4.5 w-4.5 text-violet-400" />
            <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Individuelle Marker</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Erkennt nicht-lineare Muster, die statistischen Standardtests (z.B. Pearson) entgehen.
            </p>
          </div>
        </div>
      )}

      {/* Analysis Output Layout */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Adherence Rate & Synopsis Hero */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/40 border border-slate-850 p-5 rounded-2xl">
            <div className="md:col-span-1 flex flex-col items-center justify-center p-4 border-b md:border-b-0 md:border-r border-slate-850 space-y-2.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">Einnahmetreue</span>
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-md"></div>
                <div className="text-3xl font-mono font-black text-emerald-400 bg-emerald-500/5 border border-emerald-500/25 px-4 py-2 rounded-2xl">
                  {result.adherenceRate || 'N/A'}
                </div>
              </div>
              <span className="text-[9px] font-medium text-slate-400 text-center">letzte 30 Tage</span>
            </div>

            <div className="md:col-span-3 flex flex-col justify-center space-y-2 p-1 pl-0 md:pl-3">
              <div className="text-[10px] font-bold font-mono text-violet-400 uppercase tracking-widest">
                Klinische Zusammenfassung
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {result.summary}
              </p>
            </div>
          </div>

          {/* Correlations & Bento findings */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">
              Statistische Korrelations-Erkenntnisse
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {result.correlations && result.correlations.map((c, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-2xl bg-slate-950/20 border border-slate-850/70 flex flex-col justify-between space-y-3.5"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h6 className="text-xs font-bold text-slate-200">{c.title}</h6>
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded border ${getImpactColor(c.impact)}`}>
                        {c.impact}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {c.observation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Patterns & Recommendations Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            {/* Patterns Card */}
            <div className="p-5 bg-slate-950/15 border border-slate-850 rounded-2xl space-y-3.5">
              <div className="flex items-center gap-2 text-blue-400">
                <Clock className="h-4.5 w-4.5" />
                <h6 className="text-xs font-bold uppercase tracking-wider">Erkannte Tagesverlaufsmuster</h6>
              </div>
              <ul className="space-y-2">
                {result.patterns && result.patterns.map((pt, idx) => (
                  <li key={idx} className="flex gap-2.5 items-start text-[11px] text-slate-300 leading-normal">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 flex-none" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Recommendations Card */}
            <div className="p-5 bg-slate-950/15 border border-slate-850 rounded-2xl space-y-3.5">
              <div className="flex items-center gap-2 text-emerald-400">
                <Heart className="h-4.5 w-4.5" />
                <h6 className="text-xs font-bold uppercase tracking-wider">Konstruktive Handlungsempfehlungen</h6>
              </div>
              <ul className="space-y-2">
                {result.recommendations && result.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex gap-2.5 items-start text-[11px] text-slate-300 leading-normal">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 flex-none" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
