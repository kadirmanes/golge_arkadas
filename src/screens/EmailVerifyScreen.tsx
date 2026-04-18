import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import { auth, } from '../firebase/config';
import { resendVerificationEmail, signOut } from '../firebase/auth';

interface Props {
  onVerified: () => void;
}

export default function EmailVerifyScreen({ onVerified }: Props) {
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        onVerified();
      } else {
        setError('E-posta henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.');
      }
    } catch {
      setError('Kontrol sırasında hata oluştu. Tekrar deneyin.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setResending(true);
    setResendSuccess(false);
    setError('');
    try {
      await resendVerificationEmail(auth.currentUser);
      setResendSuccess(true);
    } catch {
      setError('E-posta gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center gap-8 text-center"
      >
        {/* İkon */}
        <div className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/25 rounded-3xl flex items-center justify-center">
          <Mail className="w-10 h-10 text-emerald-400" />
        </div>

        {/* Başlık */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">E-postanı doğrula</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            <span className="text-white font-medium">{auth.currentUser?.email}</span> adresine
            bir doğrulama e-postası gönderdik.{'\n'}
            Linke tıkladıktan sonra aşağıdaki butona bas.
          </p>
        </div>

        {/* Hata / başarı */}
        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
        {resendSuccess && (
          <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            E-posta tekrar gönderildi!
          </div>
        )}

        {/* Ana buton */}
        <button
          onClick={handleCheck}
          disabled={checking}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-4 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {checking ? (
            <><div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" /> Kontrol ediliyor...</>
          ) : (
            <><CheckCircle className="w-5 h-5" /> Doğruladım, devam et</>
          )}
        </button>

        {/* Tekrar gönder */}
        <button
          onClick={handleResend}
          disabled={resending}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Gönderiliyor...' : 'E-postayı tekrar gönder'}
        </button>

        {/* Çıkış */}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          Farklı hesapla giriş yap
        </button>
      </motion.div>
    </div>
  );
}
