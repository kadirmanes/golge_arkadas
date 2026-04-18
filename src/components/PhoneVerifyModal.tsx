import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, X, Check, Shield } from 'lucide-react';
import { normalizeTurkishPhone } from '../firebase/auth';
import { savePhoneNumber } from '../firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  required?: boolean; // true → X yok, dışarı tıklayınca kapanmaz
}

export default function PhoneVerifyModal({ isOpen, onClose, required = false }: Props) {
  const { currentUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setPhone('');
      setError('');
    }
  }, [isOpen]);

  const isValid = (p: string) => {
    const d = p.replace(/\D/g, '');
    return d.length === 10 || d.length === 11 || d.length === 12;
  };

  const handleSave = async () => {
    if (!isValid(phone)) {
      setError('Geçersiz telefon numarası.');
      return;
    }
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const normalized = normalizeTurkishPhone(phone.trim());
      await savePhoneNumber(currentUser.uid, normalized);
      onClose();
    } catch {
      setError('Kaydedilemedi. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex ${required ? 'bg-zinc-950 items-center justify-center' : 'bg-black/80 backdrop-blur-sm items-end justify-center p-4'}`}
          onClick={e => { if (!required && e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: required ? 0 : 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: required ? 0 : 60, opacity: 0 }}
            className={`w-full max-w-md bg-zinc-900 border border-zinc-800 flex flex-col gap-5 ${required ? 'rounded-3xl p-8 mx-4' : 'rounded-3xl p-6'}`}
          >
            {/* Başlık */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  {required ? <Shield className="w-5 h-5 text-emerald-500" /> : <Phone className="w-5 h-5 text-emerald-500" />}
                </div>
                <div>
                  <h3 className="font-semibold">{required ? 'Telefon Numarası Gerekli' : 'Telefon Numarası'}</h3>
                  <p className="text-xs text-zinc-500">{required ? 'Devam etmek için telefon numaranı ekle' : 'Arkadaşların seni numarayla bulabilsin'}</p>
                </div>
              </div>
              {!required && (
                <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            {required && (
              <p className="text-sm text-zinc-400 -mt-2">
                Guardly'yi kullanmak için telefon numaranı kaydetmen gerekiyor. Arkadaşların seni numarayla bulabilir, acil durum bildirimi gönderebilirsin.
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Telefon numaranız</label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                placeholder="0532 123 45 67"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-lg"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <p className="text-xs text-zinc-600">
                Numaran sadece uygulamayı kullanan arkadaşlarına görünür
              </p>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleSave}
              disabled={loading || !isValid(phone)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
              ) : (
                <><Check className="w-5 h-5" /> Kaydet</>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
