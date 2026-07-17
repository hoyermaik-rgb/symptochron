import React, { useState, useEffect } from 'react';
import { Sparkles, Lightbulb, AlertTriangle, HelpCircle, RefreshCw, BookOpen, Target } from 'lucide-react';
import { DiaryEntry } from '../types';
import { todayStr } from '../utils';

interface DailyHealthInsightProps {
  diary: Record<string, DiaryEntry>;
}

interface InsightData {
  category: string;
  trigger: string;
  insight: string;
  rationale: string;
}

export default function DailyHealthInsight({ diary }: DailyHealthInsightProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [consent, setConsent] = useState(() => localStorage.getItem('symptochron_ai_consent') === 'true');

  const current = todayStr();

  // Load from cache on mount or date change
  useEffect(() => {
    if (!consent) return; // Do not fetch or read if consent is missing

    const cachedDate = localStorage.getItem('symptochron_insight_date');
    const cachedData = localStorage.getItem('symptochron_insight_data');

    if (cachedDate === current && cachedData) {
      try {
        setInsight(JSON.parse(cachedData));
      } catch (e) {
        console.error('Failed to parse cached insight:', e);
      }
    } else {
      // Auto fetch if not cached for today
      fetchDailyInsight();
    }
  }, [current, consent]);

  if (!consent) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <Sparkles className="h-5 w-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Tages-Tipp aktivieren</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Opt-in für smarte Symptom-Insights</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 space-y-2.5 leading-relaxed font-sans pl-1">
          <p>
            Um dir tägliche RLS-Gesundheitstipps anzubieten, nutzt diese App optional die <strong>Google Gemini API</strong> auf unserem Server.
          </p>
          <p className="text-[11px] bg-slate-950/60 p-3 border border-slate-850 rounded-xl text-slate-350 flex gap-2">
            🔒 <strong>Datenschutz-Garantie:</strong> Bevor Daten übertragen werden, filtert unser lokaler Datenschutzfilter (AI Privacy Guard) sämtliche personenbezogene Angaben wie Namen, E-Mails, Telefonnummern, Adressen und Geburtsdaten vollständig aus. Es werden ausschließlich anonyme Symptomdaten übertragen.
          </p>
          <p>
            Du kannst diese Einwilligung jederzeit in den <strong>Einstellungen (Export & Reset)</strong> widerrufen. Dabei werden alle lokalen KI-Analysen gelöscht.
          </p>
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('symptochron_ai_consent', 'true');
              setConsent(true);
            }}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer text-center"
          >
            Einwilligen & Aktivieren
          </button>
        </div>
      </div>
    );
  }

  const fetchDailyInsight = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get today's entry
      const todayEntry = diary[current] || null;

      // Extract past 7 days
      const recentEntries = [];
      const today = new Date();
      for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const entry = diary[dateStr];
        if (entry) {
          recentEntries.push({ date: dateStr, ...entry });
        }
      }

      const response = await fetch('/api/daily-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ todayEntry, recentEntries })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${response.status}`);
      }

      const data: InsightData = await response.json();
      setInsight(data);
      
      // Save in cache
      localStorage.setItem('symptochron_insight_date', current);
      localStorage.setItem('symptochron_insight_data', JSON.stringify(data));
    } catch (err: any) {
      console.error('Error fetching daily insight:', err);
      setError(err?.message || 'Der Tages-Tipp konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryTheme = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('abends') || cat.includes('schlaf') || cat.includes('routine')) {
      return {
        bg: 'from-indigo-950/25 via-blue-950/10 to-[#0A0A0A]',
        border: 'border-indigo-500/20',
        text: 'text-indigo-400',
        iconColor: 'text-indigo-400'
      };
    }
    if (cat.includes('ernährung') || cat.includes('koffein') || cat.includes('trinken') || cat.includes('alkohol')) {
      return {
        bg: 'from-amber-950/25 via-orange-950/10 to-[#0A0A0A]',
        border: 'border-amber-500/20',
        text: 'text-amber-400',
        iconColor: 'text-amber-400'
      };
    }
    if (cat.includes('bewegung') || cat.includes('dehn') || cat.includes('sport') || cat.includes('aktiv')) {
      return {
        bg: 'from-emerald-950/25 via-teal-950/10 to-[#0A0A0A]',
        border: 'border-emerald-500/20',
        text: 'text-emerald-400',
        iconColor: 'text-emerald-400'
      };
    }
    // Default theme
    return {
      bg: 'from-violet-950/25 via-blue-950/10 to-[#0A0A0A]',
      border: 'border-violet-500/20',
      text: 'text-violet-400',
      iconColor: 'text-violet-400'
    };
  };

  const theme = insight ? getCategoryTheme(insight.category) : getCategoryTheme('default');

  return (
    <div className={`relative p-6 px-7 border rounded-3xl overflow-hidden bg-linear-to-br transition-all duration-300 ${theme.bg} ${theme.border}`}>
      
      {/* Decorative top border shadow element */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-linear-to-r from-transparent via-violet-500/10 to-transparent" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
            <Lightbulb className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block leading-none">Health Insight of the Day</span>
            <span className="text-sm font-semibold text-slate-100 font-serif italic mt-1.5 block">Gesundheits-Tipp des Tages</span>
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={fetchDailyInsight}
          className={`px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-950 hover:border-slate-750 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-100 flex items-center gap-2 transition-all cursor-pointer select-none ${
            loading ? 'opacity-60 cursor-not-allowed' : 'active:scale-97'
          }`}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Berechne...' : 'Aktualisieren'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-slate-950/40 border border-slate-900 rounded-2xl flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-orange-400 flex-none mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-normal">
            {error} Versuche es über den Button oben erneut.
          </p>
        </div>
      )}

      {loading && !insight && (
        <div className="mt-6 space-y-3.5 animate-pulse">
          <div className="h-3.5 bg-slate-800 rounded-lg w-1/4"></div>
          <div className="h-3 bg-slate-800/60 rounded-lg w-full"></div>
          <div className="h-3 bg-slate-800/60 rounded-lg w-5/6 font-mono"></div>
        </div>
      )}

      {insight && !loading && (
        <div className="mt-5 space-y-4 animate-fade-in text-slate-300">
          
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg bg-slate-950/80 border border-slate-900 text-slate-400">
              Kategorie: <strong className={theme.text}>{insight.category}</strong>
            </span>
            <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg bg-slate-950/80 border border-slate-900 text-slate-400">
              Trigger: <strong className="text-slate-200">{insight.trigger}</strong>
            </span>
          </div>

          <div className="space-y-3.5">
            {/* The adjustment recommendation */}
            <div className="flex items-start gap-3">
              <Target className={`h-4 w-4 mt-0.5 flex-none ${theme.iconColor}`} />
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Empfehlung</span>
                <p className="text-xs text-slate-100 leading-relaxed font-semibold mt-0.5">
                  {insight.insight}
                </p>
              </div>
            </div>

            {/* Rationale explaining the dataset correlation */}
            <div className="flex items-start gap-3 pl-0 border-l border-slate-900 pt-0.5">
              <BookOpen className="h-4 w-4 mt-0.5 text-slate-500 flex-none" />
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Auswertungsgrundlage</span>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  {insight.rationale}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
