import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, Shield, Check, X } from 'lucide-react';

interface PinLockProps {
  mode: 'lock' | 'setup';
  checkPin: string | null; // Null if no PIN setup yet
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}

export default function PinLock({ mode, checkPin, onSuccess, onCancel }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isConfirmStep, setIsConfirmStep] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) {
      setPin(prev => prev + num);
      setErrorMsg('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = () => {
    if (pin.length < 4) {
      setErrorMsg('Die PIN muss aus mindestens 4 Ziffern bestehen.');
      return;
    }

    if (mode === 'lock') {
      if (pin === checkPin) {
        onSuccess(pin);
      } else {
        setErrorMsg('Falsche PIN. Bitte versuche es erneut.');
        setPin('');
      }
    } else {
      // Setup Mode
      if (!isConfirmStep) {
        setConfirmPin(pin);
        setPin('');
        setIsConfirmStep(true);
      } else {
        if (pin === confirmPin) {
          onSuccess(pin);
        } else {
          setErrorMsg('Die PINs stimmen nicht überein.');
          setPin('');
          setConfirmPin(null);
          setIsConfirmStep(false);
        }
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

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
              ? 'Gib deinen Passcode ein, um auf deine Gesundheitsdaten zuzugreifen.' 
              : isConfirmStep 
                ? 'Gib den Passcode erneut ein, um ihn zu verifizieren.' 
                : 'Schütze deine Tagebuchaufzeichnung mit einer 4- bis 8-stelligen PIN.'}
          </p>
        </div>

        {/* Dots representing typed values */}
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

        {/* Numerical Grid */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {keys.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="h-14 w-14 mx-auto flex items-center justify-center bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-100 text-lg font-bold rounded-2xl transition-all"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={mode === 'setup' && !isConfirmStep ? onCancel : handleClear}
            className="h-14 w-14 mx-auto flex items-center justify-center text-slate-500 hover:text-slate-400 active:scale-95 text-sm font-semibold rounded-2xl transition-all"
          >
            {mode === 'setup' && !isConfirmStep ? <X className="h-5 w-5" /> : 'C'}
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-14 w-14 mx-auto flex items-center justify-center bg-slate-800 hover:bg-slate-750 active:scale-95 text-lg font-bold rounded-2xl transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 w-14 mx-auto flex items-center justify-center text-slate-500 hover:text-slate-400 active:scale-95 rounded-2xl transition-all"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3 bg-violet-600 hover:bg-violet-500 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-600/25 transition-all"
        >
          Fertig / Bestätigen
        </button>
      </motion.div>
    </div>
  );
}
