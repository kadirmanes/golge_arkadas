import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  enteredPin: string;
  pinError: boolean;
  attemptsLeft: number;
  onPinChange: (pin: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PinModal({ isOpen, enteredPin, pinError, attemptsLeft, onPinChange, onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm flex flex-col items-center gap-4 shadow-2xl"
          >
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
              <Lock className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-white">PIN Kodu Gerekli</h3>
            <p className="text-sm text-zinc-400 text-center mb-2">
              İşlemi onaylamak için 4 haneli güvenlik şifrenizi girin.
            </p>
            <input
              type="password"
              maxLength={4}
              inputMode="numeric"
              autoFocus
              value={enteredPin}
              onChange={e => onPinChange(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter' && enteredPin.length === 4) onConfirm(); }}
              className={`w-full bg-zinc-950 border ${pinError ? 'border-red-500' : 'border-zinc-800'} rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-emerald-500 transition-colors text-center tracking-[1em] font-mono text-3xl`}
            />
            {pinError && (
              <p className="text-red-500 text-sm font-medium">Hatalı PIN. Kalan deneme: {attemptsLeft}</p>
            )}
            <div className="flex gap-3 w-full mt-4">
              <button
                onClick={onCancel}
                className="flex-1 py-4 rounded-2xl font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={onConfirm}
                disabled={enteredPin.length !== 4}
                className="flex-1 py-4 rounded-2xl font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
              >
                Onayla
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
