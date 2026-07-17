import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, X } from 'lucide-react';
import {
  clearPinLockState,
  formatRemainingLockTime,
  isPinLocked,
  PinLockState,
  readPinLockState,
  recordFailedPinAttempt,
  remainingLockMs,
  writePinLockState,
} from '../security/pinLockout';

interface PinLockProps {
  mode: 'lock' | 'setup';
  checkPin: string | null;
  verifyPin?: (pin: string) => Promise<boolean>;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}

export default function PinLock({ mode, checkPin, verifyPin, onSuccess, onCancel }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinLockState, setPinLockState] = useState<PinLockState>(() => readPinLockState());
  const [remainingMs, setRemainingMs] = useState(() => remainingLockMs(readPinLockState()));

  const lockedOut = mode === 'lock' && isPinLocked(pinLockState) && remainingMs > 0;

  useEffect(() => {
    if (mode !== 'lock') return;

    const refreshRemaining = () => {
      const stored = readPinLockState();
      setPinLockState(stored);
      setRemainingMs(remainingLockMs(stored));
    };

    refreshRemaining();
    const timer = window.setInterval(refreshRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const handleKeyPress = (num: string) => {
    if (lockedOut || isVerifying) return;
    if (pin.length < 8) {
      setPin(prev => prev + num);
      setErrorMsg('');
    }
  };

  const handleDelete = () => {
    if (lockedOut || isVerifying) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockedOut || isVerifying) return;
    setPin('');
  };

  const handleFailedUnlock = () => {
    const nextState = writePinLockState(recordFailedPinAttempt(pinLockState));
    const nextRemaining = remainingLockMs(nextState);
    setPinLockState(nextState);
    setRemainingMs(nextRemaining);
    setPin('');

    if (nextRemaining > 0) {
      setErrorMsg(`Zu viele Versuche. Bitte warte ${formatRemainingLockTime(nextRemaining)}.`);
    } else {
      setErrorMsg('PIN konnte nicht bestätigt werden.');
    }
  };

  const handleSubmit = async () => {
    if (lockedOut) {
      setErrorMsg(`Bitte warte ${formatRemainingLockTime(remainingMs)}.`);
      return;
    }

    if (pin.length < 4) {
      setErrorMsg('Die PIN muss aus mindestens 4 Ziffern bestehen.');
      return;
    }

    if (mode === 'lock') {
      setIsVerifying(true);
      let isValid = false;
      try {
        isValid = verifyPin ? await verifyPin(pin) : pin === checkPin;
      } finally {
        setIsVerifying(false);
      }

      if (!isValid) {
        handleFailedUnlock();
        return;
      }

      clearPinLockState();
      setPinLockState(readPinLockState());
      setRemainingMs(0);
      onSuccess(pin);
    } else {
      if (!isConfirmStep) {
        setConfirmPin(pin);
        setPin('');
        setIsConfirmStep(true);
      } else if (pin === confirmPin) {
        onSuccess(pin);
      } else {
        setErrorMsg('Die PINs stimmen nicht überein.');
        setPin('');
        setConfirmPin(null);
        setIsConfirmStep(false);
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const actionDisabled = isVerifying || lockedOut;

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center text-center space-y-6"
      >
        <div className="p-3.5 bg-violet-600/10 border border-violet-500/30 rounded-2xl">
          <Lock className="h-7 w-7 text-violet-400" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-100">
            {mode === 'lock'
              ? 'App gesperrt'
              : isConfirmStep
                ? 'PIN bestätigen'
                : 'PIN einrichten'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-[250px]">
            {mode === 'lock'
              ? 'Gib deine PIN ein, um deine verschlüsselten Daten zu öffnen.'
              : isConfirmStep
                ? 'Gib die PIN erneut ein.'
                : 'Schütze deine Tagebuchaufzeichnung mit einer 4- bis 8-stelligen PIN.'}
          </p>
        </div>

        {lockedOut && (
          <div className="w-full rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            Weitere Eingaben sind in {formatRemainingLockTime(remainingMs)} möglich.
          </div>
        )}

        <div className="flex gap-4.5 justify-center py-2 min-h-6">
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <motion.span
              key={i}
              className={`h-3 w-3 rounded-full border transition-all duration-150 ${
                i < pin.length
                  ? 'bg-violet-400 border-violet-400 scale-110 shadow-lg shadow-violet-400/35'
                  : 'bg-transparent border-slate-700'
              }`}
            />
          ))}
        </div>

        <AnimatePresence>
          {errorMsg && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="text-xs font-medium text-rose-400"
            >
              {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {keys.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              disabled={actionDisabled}
              className="h-14 w-14 mx-auto flex items-center justify-center bg-slate-800 hover:bg-slate-750 disabled:opacity-45 active:scale-95 text-slate-100 text-lg font-bold rounded-2xl transition-all"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={mode === 'setup' && !isConfirmStep ? onCancel : handleClear}
            disabled={actionDisabled}
            className="h-14 w-14 mx-auto flex items-center justify-center text-slate-500 hover:text-slate-400 disabled:opacity-45 active:scale-95 text-sm font-semibold rounded-2xl transition-all"
          >
            {mode === 'setup' && !isConfirmStep ? <X className="h-5 w-5" /> : 'C'}
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            disabled={actionDisabled}
            className="h-14 w-14 mx-auto flex items-center justify-center bg-slate-800 hover:bg-slate-750 disabled:opacity-45 active:scale-95 text-lg font-bold rounded-2xl transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={actionDisabled}
            className="h-14 w-14 mx-auto flex items-center justify-center text-slate-500 hover:text-slate-400 disabled:opacity-45 active:scale-95 rounded-2xl transition-all"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={actionDisabled}
          className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-55 disabled:hover:bg-violet-600 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-600/25 transition-all"
        >
          {lockedOut ? `Gesperrt (${formatRemainingLockTime(remainingMs)})` : isVerifying ? 'Prüfe...' : 'Fertig / Bestätigen'}
        </button>
      </motion.div>
    </div>
  );
}
