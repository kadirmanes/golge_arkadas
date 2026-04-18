import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Users } from 'lucide-react';

type FakeCallState = 'idle' | 'ringing' | 'active';

interface Props {
  state: FakeCallState;
  name: string;
  duration: number;
  onAnswer: () => void;
  onEnd: () => void;
}

export default function FakeCallOverlay({ state, name, duration, onAnswer, onEnd }: Props) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {state !== 'idle' && (
        <motion.div
          key="fakeCall"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          className="absolute inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-between py-16 px-6"
        >
          <div className="flex flex-col items-center gap-4 mt-12">
            <div className="text-zinc-400 text-xl">
              {state === 'ringing' ? 'Gelen Arama...' : 'Görüşme sürüyor'}
            </div>
            <div className="text-4xl font-light text-white">{name || 'Bilinmeyen'}</div>
            <div className="text-zinc-500 font-mono text-lg">
              {state === 'ringing' ? 'Çalıyor...' : formatTime(duration)}
            </div>
          </div>

          <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center">
            <Users className="w-16 h-16 text-zinc-600" />
          </div>

          <div className="flex w-full justify-around mb-8">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onEnd}
                className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center"
              >
                <Phone className="w-8 h-8 text-white rotate-[135deg]" />
              </button>
              <span className="text-xs text-zinc-500">Kapat</span>
            </div>
            {state === 'ringing' && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={onAnswer}
                  className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse"
                >
                  <Phone className="w-8 h-8 text-white" />
                </button>
                <span className="text-xs text-zinc-500">Cevapla</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
