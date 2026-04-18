import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Eye, LogOut, User, X, Pencil, Check, Users } from 'lucide-react';
import { signOut } from '../firebase/auth';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { getUserById, saveDisplayName } from '../firebase/firestore';
import type { AppUser, Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
  friendRequestCount: number;
}

export default function HomeScreen({ onNavigate, friendRequestCount }: Props) {
  const { currentUser } = useAuth();
  const displayName = currentUser?.displayName ?? currentUser?.email?.split('@')[0] ?? 'Kullanıcı';
  const [showProfile, setShowProfile] = useState(false);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    getUserById(currentUser.uid).then(setAppUser);
  }, [currentUser]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !currentUser || trimmed === displayName) { setEditingName(false); return; }
    setNameSaving(true);
    try {
      await updateProfile(currentUser, { displayName: trimmed });
      await saveDisplayName(currentUser.uid, trimmed);
      setAppUser(prev => prev ? { ...prev, displayName: trimmed } : prev);
    } catch { /* ignore */ } finally {
      setNameSaving(false);
      setEditingName(false);
    }
  };

  const initials = (appUser?.displayName ?? displayName)
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-emerald-500" />
          <h1 className="text-xl font-medium tracking-tight">Guardly</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <User className="w-5 h-5" />
          </button>
          <button
            onClick={() => signOut()}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center p-6 gap-8">
        <div>
          <p className="text-zinc-400 text-sm">Hoş geldiniz,</p>
          <h2 className="text-2xl font-semibold mt-1">{appUser?.displayName ?? displayName}</h2>
        </div>

        <div className="flex flex-col gap-4">
          {/* Yolculuğumu Başlat */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('protected')}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-3xl p-6 flex items-center gap-4 transition-colors shadow-[0_0_40px_rgba(16,185,129,0.15)]"
          >
            <div className="w-14 h-14 bg-zinc-950/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">Yolculuğumu Başlat</div>
              <div className="text-sm opacity-70 mt-0.5">Konumunu paylaş, alarm kur</div>
            </div>
          </motion.button>

          {/* Birini İzle */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('watcher')}
            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 rounded-3xl p-6 flex items-center gap-4 transition-colors"
          >
            <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Eye className="w-7 h-7 text-zinc-300" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">Birini İzle</div>
              <div className="text-sm text-zinc-400 mt-0.5">Canlı konum, acil bildirimler</div>
            </div>
          </motion.button>

          {/* Arkadaşlarım */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('friends')}
            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 rounded-3xl p-6 flex items-center gap-4 transition-colors relative"
          >
            <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Users className="w-7 h-7 text-zinc-300" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">Arkadaşlarım</div>
              <div className="text-sm text-zinc-400 mt-0.5">Ekle, yönet, istekleri gör</div>
            </div>
            {friendRequestCount > 0 && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">{friendRequestCount}</span>
              </div>
            )}
          </motion.button>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Yolculuğunuzu başlatarak arkadaşlarınızın sizi izlemesine izin verebilirsiniz.
        </p>
      </main>

      {/* Profil Alt Sheet */}
      <AnimatePresence>
        {showProfile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowProfile(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 flex flex-col gap-5 max-w-md mx-auto"
            >
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1" />

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Profil</h2>
                <button onClick={() => setShowProfile(false)} className="p-1.5 text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Avatar + isim */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-emerald-400">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                        className="flex-1 bg-zinc-800 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                        placeholder="Ad Soyad"
                      />
                      <button onClick={handleSaveName} disabled={nameSaving}
                        className="p-1.5 bg-emerald-500 rounded-lg text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-50">
                        {nameSaving
                          ? <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                          : <Check className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditingName(false)} className="p-1.5 text-zinc-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-lg truncate">{appUser?.displayName ?? displayName}</div>
                      <button onClick={() => { setNameInput(appUser?.displayName ?? displayName); setEditingName(true); }}
                        className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="text-xs text-zinc-500 mt-0.5">{currentUser?.email}</div>
                  {currentUser?.emailVerified && (
                    <div className="text-xs text-emerald-600 mt-0.5">✓ E-posta doğrulandı</div>
                  )}
                </div>
              </div>

              {/* Çıkış */}
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-2xl py-3 transition-colors text-sm font-medium mt-1"
              >
                <LogOut className="w-4 h-4" />
                Çıkış Yap
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
