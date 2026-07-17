import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Database,
  KeyRound,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
} from 'lucide-react';

export type OnboardingMode = 'real' | 'demo' | 'import';

export interface OnboardingCompletePayload {
  name: string;
  bday: string;
  pin: string;
  mode: OnboardingMode;
}

interface OnboardingProps {
  onComplete: (payload: OnboardingCompletePayload) => Promise<void> | void;
}

const TOTAL_STEPS = 9;
const PIN_PATTERN = /^\d{4,8}$/;

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<OnboardingMode>('real');
  const [name, setName] = useState('');
  const [bday, setBday] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goNext = async () => {
    setErrorMsg('');

    if (step === 5 && !PIN_PATTERN.test(pin)) {
      setErrorMsg('Die PIN muss aus 4 bis 8 Ziffern bestehen.');
      return;
    }

    if (step === 6 && confirmPin !== pin) {
      setErrorMsg('Die PINs stimmen nicht überein. Bitte gib sie erneut ein.');
      setConfirmPin('');
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep(prev => prev + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      await onComplete({
        name: name.trim(),
        bday,
        pin,
        mode,
      });
    } catch {
      setErrorMsg('Die Einrichtung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    setErrorMsg('');
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const selectMode = (nextMode: OnboardingMode) => {
    setMode(nextMode);
    setStep(2);
  };

  const stepColor = mode === 'demo' ? 'emerald' : mode === 'import' ? 'blue' : 'violet';

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="w-full max-w-md overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl"
      >
        <div className="relative p-6 sm:p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
              <span>Einrichtung</span>
              <span>{step}/{TOTAL_STEPS}</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  stepColor === 'emerald' ? 'bg-emerald-500' : stepColor === 'blue' ? 'bg-blue-500' : 'bg-violet-500'
                }`}
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>

          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5 text-center">
              <div className="mx-auto w-fit p-4 bg-violet-600/10 border border-violet-500/25 rounded-2xl">
                <Sparkles className="h-10 w-10 text-violet-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Willkommen bei SymptoChron</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Richte dein geschütztes Tagebuch ein. Die PIN wird vor dem ersten Start festgelegt und bleibt auf deinem Gerät.
                </p>
              </div>
              <div className="grid gap-3 pt-2 text-left">
                <button
                  type="button"
                  onClick={() => selectMode('real')}
                  className="flex items-center justify-between gap-3 p-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/25 transition-all"
                >
                  <span>Leeres Tagebuch starten</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => selectMode('demo')}
                  className="flex items-center justify-between gap-3 p-4 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-sm font-semibold transition-all"
                >
                  <span>Demo ansehen</span>
                  <Database className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => selectMode('import')}
                  className="flex items-center justify-between gap-3 p-4 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-sm font-semibold transition-all"
                >
                  <span>Backup importieren</span>
                  <UploadCloud className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <StepShell icon={<Database className="h-9 w-9 text-blue-400" />} title="Wofür SymptoChron da ist">
              <p>SymptoChron unterstützt dich beim strukturierten Festhalten von Beschwerden, Stimmung, Medikamenten, Blutdruck und Notfallinformationen.</p>
              <p>Die App ersetzt keine ärztliche Beratung. Sie bereitet deine eigenen Beobachtungen übersichtlich für dich und Gespräche mit Fachpersonen auf.</p>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell icon={<ShieldCheck className="h-9 w-9 text-emerald-400" />} title="Datenschutz und Verschlüsselung">
              <p>Gesundheitsdaten werden im Browser verschlüsselt. In der zentralen SQLite-Datenbank liegt nur verschlüsselter Inhalt.</p>
              <p>Die PIN wird nicht im Klartext gespeichert. Ohne korrekte PIN können verschlüsselte Daten nicht geöffnet werden.</p>
            </StepShell>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
                  <User className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-100">Profilgrunddaten</h3>
                <p className="text-xs text-slate-400">Optional. Diese Angaben können später ergänzt oder geändert werden.</p>
              </div>
              <div className="space-y-4">
                <TextInput
                  label="Name"
                  icon={<User className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />}
                  value={name}
                  onChange={setName}
                  placeholder="Vor- und Nachname"
                  type="text"
                />
                <TextInput
                  label="Geburtsdatum"
                  icon={<Calendar className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />}
                  value={bday}
                  onChange={setBday}
                  type="date"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <PinStep
              title="PIN festlegen"
              description="Wähle eine 4- bis 8-stellige PIN. Sie schützt den Zugriff auf deine verschlüsselten Daten auf diesem Gerät."
              value={pin}
              onChange={setPin}
              autoFocus
            />
          )}

          {step === 6 && (
            <PinStep
              title="PIN bestätigen"
              description="Gib dieselbe PIN erneut ein. Erst danach kann die Einrichtung abgeschlossen werden."
              value={confirmPin}
              onChange={setConfirmPin}
              autoFocus
            />
          )}

          {step === 7 && (
            <StepShell icon={<UploadCloud className="h-9 w-9 text-cyan-400" />} title="Backup und Wiederherstellung">
              <p>Bewahre verschlüsselte Backups sorgfältig auf. Ohne passende PIN und wiederherstellbare Daten kann SymptoChron deine Einträge nicht rekonstruieren.</p>
              <p>Importe laufen nach der Einrichtung über den Backup-Bereich der App.</p>
            </StepShell>
          )}

          {step === 8 && (
            <StepShell icon={<Lock className="h-9 w-9 text-violet-400" />} title="Zusammenfassung">
              <p>Modus: {mode === 'demo' ? 'Demo ansehen' : mode === 'import' ? 'Backup importieren' : 'Leeres Tagebuch'}</p>
              <p>Profil: {name.trim() || bday ? 'Grunddaten werden verschlüsselt gespeichert.' : 'Keine Profilgrunddaten angegeben.'}</p>
              <p>PIN: eingerichtet und vor dem Start erforderlich.</p>
            </StepShell>
          )}

          {step === 9 && (
            <StepShell icon={<Play className="h-9 w-9 text-emerald-400 fill-current" />} title="Bereit zum Start">
              <p>Mit dem Start wird die PIN eingerichtet, der verschlüsselte Speicher vorbereitet und das Onboarding abgeschlossen.</p>
              <p>Der Abschlussstatus wird erst danach gespeichert.</p>
            </StepShell>
          )}

          {errorMsg && (
            <p className="mt-5 text-xs font-medium text-rose-400 text-center" role="alert">
              {errorMsg}
            </p>
          )}

          {step > 1 && (
            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={goBack}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-slate-800 hover:bg-slate-750 disabled:opacity-60 text-slate-300 rounded-xl transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/25 transition-all"
              >
                {isSubmitting ? 'Richte ein...' : step === TOTAL_STEPS ? 'App starten' : 'Weiter'}
                {!isSubmitting && (step === TOTAL_STEPS ? <Play className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />)}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StepShell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center text-center space-y-5">
      <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl">{icon}</div>
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-slate-100">{title}</h3>
        <div className="space-y-3 text-sm text-slate-400 leading-relaxed">{children}</div>
      </div>
    </motion.div>
  );
}

function TextInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <div className="relative">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full py-3.5 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>
    </div>
  );
}

function PinStep({
  title,
  description,
  value,
  onChange,
  autoFocus,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="p-3 bg-violet-600/10 border border-violet-500/25 rounded-2xl">
          <KeyRound className="h-8 w-8 text-violet-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-400 max-w-xs">{description}</p>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">PIN</label>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          minLength={4}
          maxLength={8}
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className="w-full py-4 px-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xl tracking-[0.35em] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
          aria-label={title}
        />
        <p className="text-[11px] text-slate-500 text-center">4 bis 8 Ziffern, nicht im Klartext gespeichert.</p>
      </div>
    </div>
  );
}
