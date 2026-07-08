import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, User, Calendar, ShieldCheck, ArrowRight, Play } from 'lucide-react';

interface OnboardingProps {
  onComplete: (name: string, bday: string) => void;
  onSkip: () => void;
}

export default function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [bday, setBday] = useState('');

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete(name, bday);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="w-full max-w-md overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl"
      >
        <div className="relative p-8">
          {/* Step 1 */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center space-y-5"
            >
              <div className="p-4 bg-violet-600/10 border border-violet-500/25 rounded-2xl">
                <Sparkles className="h-10 w-10 text-violet-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                Willkommen bei SymptoChron
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Dein digitales Schmerz- und RLS-Tagebuch mit integriertem MoodPath-Modul, Blutdrucktabelle und Arzt-Report. 
                <br /><br />
                Alles ist vollkommen privat und wird <strong>ausschließlich lokal auf deinem Gerät</strong> gespeichert. Es fließen keinerlei persönliche Daten an Server ab.
              </p>
              
              <div className="flex w-full gap-3 pt-4">
                <button
                  type="button"
                  onClick={onSkip}
                  className="flex-1 py-3 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Überspringen
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/25 transition-all"
                >
                  Los geht's <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
                  <User className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-100">Wer bist du?</h3>
                <p className="text-xs text-slate-400">
                  Dein Name erscheint auf den PDF-Berichten für dein nächstes Arztgespräch.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Vor- und Nachname"
                      className="w-full py-3.5 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Geburtsdatum</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="date"
                      value={bday}
                      onChange={(e) => setBday(e.target.value)}
                      className="w-full py-3.5 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-3 text-sm font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition-all"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/25 transition-all"
                >
                  Weiter
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col items-center text-center space-y-5"
            >
              <div className="p-4 bg-emerald-600/10 border border-emerald-500/25 rounded-2xl">
                <ShieldCheck className="h-10 w-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-100">Alles bereit!</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Deine Privatsphäre ist gesichert. Im Folgenden kannst du Medikamente hinterlegen, tägliche Symptome protokollieren und wertvolle Trends aufdecken. 
                <br /><br />
                Sollte es dir jemals schlechter gehen, findest du im <strong>Krisenbereich</strong> schnelle Hilfe.
              </p>

              <div className="flex w-full gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-3 text-sm font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition-all"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={() => onComplete(name, bday)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/25 transition-all"
                >
                  Starten <Play className="h-4 w-4 fill-current text-white" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Bullet Indicators */}
          <div className="flex justify-center gap-2 mt-6">
            <span className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-5 bg-violet-500' : 'w-1.5 bg-slate-800'}`} />
            <span className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-5 bg-blue-500' : 'w-1.5 bg-slate-800'}`} />
            <span className={`h-1.5 rounded-full transition-all duration-300 ${step === 3 ? 'w-5 bg-emerald-500' : 'w-1.5 bg-slate-800'}`} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
