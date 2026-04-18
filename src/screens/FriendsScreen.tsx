import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, UserPlus, Search, X, Check, Users, Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToWatchRelationships,
  subscribeToPendingRequests,
  subscribeToPendingSentRequests,
  sendWatchRequest,
  respondToWatchRequest,
  getUserByEmail,
  getUsersByIds,
} from '../firebase/firestore';
import type { WatchRequest, WatchRelationship, AppUser, Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export default function FriendsScreen({ onNavigate }: Props) {
  const { currentUser } = useAuth();

  // Arkadaş listesi (watchRelationships where watcherUserId == me → protectedUserId = arkadaş)
  const [relationships, setRelationships] = useState<WatchRelationship[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, AppUser>>({});

  // Gelen istekler (beni izlemek istiyor)
  const [incomingRequests, setIncomingRequests] = useState<WatchRequest[]>([]);
  // Giden istekler (benim gönderdiğim, cevap bekleyen)
  const [sentRequests, setSentRequests] = useState<WatchRequest[]>([]);

  // Arama paneli
  const [showSearch, setShowSearch] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [searchResult, setSearchResult] = useState<AppUser | null | 'not_found'>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  // Arkadaşlık ilişkileri
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToWatchRelationships(currentUser.uid, (rels) => {
      setRelationships(rels);
      const uids = rels.map(r => r.protectedUserId).filter(uid => uid !== currentUser.uid);
      if (uids.length > 0) {
        getUsersByIds(uids).then(users => {
          const map: Record<string, AppUser> = {};
          users.forEach(u => { map[u.uid] = u; });
          setFriendProfiles(map);
        });
      } else {
        setFriendProfiles({});
      }
    });
    return unsub;
  }, [currentUser]);

  // Gelen istekler
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToPendingRequests(currentUser.uid, setIncomingRequests);
    return unsub;
  }, [currentUser]);

  // Giden istekler
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToPendingSentRequests(currentUser.uid, setSentRequests);
    return unsub;
  }, [currentUser]);

  // E-posta ile kullanıcı ara (tam eşleşme)
  const handleEmailSearch = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const user = await getUserByEmail(email);
      if (!user || user.uid === currentUser?.uid) {
        setSearchResult('not_found');
      } else {
        const friendUids = new Set(relationships.map(r => r.protectedUserId));
        const sentUids = new Set(sentRequests.map(r => r.toUserId));
        if (friendUids.has(user.uid) || sentUids.has(user.uid)) {
          setSearchResult('not_found'); // zaten arkadaş veya istek gönderilmiş
        } else {
          setSearchResult(user);
        }
      }
    } catch {
      setSearchResult('not_found');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (user: AppUser) => {
    if (!currentUser) return;
    setSendingTo(user.uid);
    try {
      await sendWatchRequest(
        currentUser.uid,
        currentUser.email ?? '',
        currentUser.displayName ?? currentUser.email ?? 'Kullanıcı',
        user.email ?? ''
      );
      setSearchResult(null);
      setEmailInput('');
      setShowSearch(false);
    } catch { /* ignore */ } finally {
      setSendingTo(null);
    }
  };

  const handleRespond = async (req: WatchRequest, accept: boolean) => {
    setRespondingTo(req.id);
    try {
      await respondToWatchRequest(req.id, accept, req.fromUserId, currentUser!.uid);
    } catch { /* ignore */ } finally {
      setRespondingTo(null);
    }
  };

  // Tekrarsız arkadaş listesi — protectedUserId'e göre (benim izleyebileceğim kişiler = arkadaşlarım)
  const uniqueFriends = relationships.filter(
    (rel, idx, arr) =>
      rel.protectedUserId !== currentUser?.uid &&
      arr.findIndex(r => r.protectedUserId === rel.protectedUserId) === idx
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-5 h-5 text-emerald-500" />
          <h1 className="text-xl font-medium">Arkadaşlarım</h1>
        </div>
        <button
          onClick={() => { setShowSearch(v => !v); setEmailInput(''); setSearchResult(null); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
            showSearch
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Arkadaş Ekle
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

        {/* Arama paneli */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3"
            >
              <p className="text-sm text-zinc-400">
                Arkadaşının e-posta adresini gir.
              </p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="email"
                  placeholder="ornek@mail.com"
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); setSearchResult(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleEmailSearch(); }}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  onClick={handleEmailSearch}
                  disabled={searchLoading || !emailInput.includes('@')}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                >
                  {searchLoading
                    ? <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    : <Search className="w-4 h-4" />}
                </button>
              </div>

              {/* Sonuç */}
              {searchResult && searchResult !== 'not_found' && (
                <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center text-sm font-bold text-emerald-400 flex-shrink-0">
                      {(searchResult.displayName ?? '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{searchResult.displayName}</div>
                      <div className="text-xs text-zinc-500 truncate">{searchResult.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendRequest(searchResult as AppUser)}
                    disabled={sendingTo === (searchResult as AppUser).uid}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
                  >
                    {sendingTo === (searchResult as AppUser).uid ? (
                      <div className="w-3 h-3 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    ) : (
                      <><UserPlus className="w-3 h-3" /> İstek Gönder</>
                    )}
                  </button>
                </div>
              )}

              {searchResult === 'not_found' && (
                <p className="text-xs text-zinc-600 text-center py-1">
                  Bu e-posta ile kayıtlı kullanıcı bulunamadı.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gelen istekler */}
        {incomingRequests.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Gelen İstekler ({incomingRequests.length})
            </h2>
            {incomingRequests.map(req => (
              <div
                key={req.id}
                className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
                    {(req.fromDisplayName ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{req.fromDisplayName}</div>
                    <div className="text-xs text-zinc-500 truncate">{req.fromEmail}</div>
                    <div className="text-xs text-amber-600 mt-0.5">arkadaş olmak istiyor</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRespond(req, false)}
                    disabled={respondingTo === req.id}
                    className="p-2 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRespond(req, true)}
                    disabled={respondingTo === req.id}
                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-colors"
                  >
                    {respondingTo === req.id
                      ? <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                      : <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Giden — cevap bekleyen istekler */}
        {sentRequests.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Cevap Bekleniyor ({sentRequests.length})
            </h2>
            {sentRequests.map(req => (
              <div
                key={req.id}
                className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 text-sm font-bold flex-shrink-0">
                  {(req.toEmail ?? '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-300 truncate">{req.toEmail}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">İstek gönderildi</div>
                </div>
                <div className="w-2 h-2 bg-amber-500/60 rounded-full animate-pulse flex-shrink-0" />
              </div>
            ))}
          </section>
        )}

        {/* Arkadaş listesi */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Arkadaşlarım ({uniqueFriends.length})
          </h2>

          {uniqueFriends.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
              <Users className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Henüz arkadaşın yok.</p>
              <p className="text-zinc-600 text-xs mt-1 leading-relaxed">
                "Arkadaş Ekle" ile arama yap,{'\n'}istek gönder.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {uniqueFriends.map(rel => {
                const u = friendProfiles[rel.protectedUserId];
                const name = u?.displayName ?? u?.email?.split('@')[0] ?? 'Kullanıcı';
                const initial = name[0].toUpperCase();
                return (
                  <motion.div
                    key={rel.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-zinc-800/80 rounded-2xl px-4 py-3.5 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 text-sm font-bold flex-shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{name}</div>
                      {u?.email && (
                        <div className="text-xs text-zinc-500 truncate mt-0.5">{u.email}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-xs text-emerald-600 font-medium">Arkadaş</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
