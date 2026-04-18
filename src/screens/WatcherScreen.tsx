import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Eye, MapPin, AlertTriangle, CheckCircle, Clock, ArrowLeft, History,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToWatchedJourneys } from '../firebase/firestore';
import { useEmergencySound } from '../hooks/useEmergencySound';
import type { Journey, Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen, target?: string) => void;
}

function statusIcon(status: string) {
  if (status === 'triggered') return <AlertTriangle className="w-4 h-4 text-red-500" />;
  if (status === 'alert') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  if (status === 'active') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  return <Clock className="w-4 h-4 text-zinc-600" />;
}
function statusLabel(status: string) {
  if (status === 'triggered') return 'ACİL DURUM';
  if (status === 'alert') return 'Alarm';
  if (status === 'active') return 'Yolculukta';
  if (status === 'ended') return 'Tamamlandı';
  return 'Bilinmiyor';
}
function statusColor(status: string) {
  if (status === 'triggered') return 'text-red-400';
  if (status === 'alert') return 'text-yellow-400';
  if (status === 'active') return 'text-emerald-400';
  return 'text-zinc-500';
}
function formatTimestamp(ts: unknown): string {
  if (!ts) return '';
  const seconds = (ts as any)?.seconds;
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function WatcherScreen({ onNavigate }: Props) {
  const { currentUser } = useAuth();
  const [activeJourneys, setActiveJourneys] = useState<Journey[]>([]);
  const [pastJourneys, setPastJourneys] = useState<Journey[]>([]);
  const prevStatusRef = useRef<Record<string, string>>({});
  const { playAlarm } = useEmergencySound();

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToWatchedJourneys(currentUser.uid, (active, past) => {
      active.forEach(j => {
        const prev = prevStatusRef.current[j.id];
        if (j.status === 'triggered' && (!prev || prev !== 'triggered')) playAlarm();
        prevStatusRef.current[j.id] = j.status;
      });
      setActiveJourneys(active);
      setPastJourneys(past);
    });
    return unsub;
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="p-6 flex items-center gap-3 border-b border-zinc-800/50">
        <button onClick={() => onNavigate('home')} className="p-1 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Eye className="w-5 h-5 text-emerald-500" />
        <h1 className="text-xl font-medium">İzleme Ekranı</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

        {/* Aktif yolculuklar */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Aktif Yolculuklar
          </h2>
          {activeJourneys.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-8 text-center">
              <Eye className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Şu an izlediğin aktif yolculuk yok.</p>
              <p className="text-zinc-600 text-xs mt-1 leading-relaxed">
                Bir arkadaşın seni yolculuğuna acil kişi olarak{'\n'}eklediğinde burada görünür.
              </p>
            </div>
          ) : (
            activeJourneys.map(journey => (
              <motion.div
                key={journey.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-zinc-900 border rounded-2xl p-4 flex flex-col gap-3 ${
                  journey.status === 'triggered' ? 'border-red-500/50 bg-red-950/20' :
                  journey.status === 'alert' ? 'border-yellow-500/30 bg-yellow-950/10' :
                  'border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{journey.displayName}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{formatTimestamp(journey.startedAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon(journey.status)}
                    <span className={`text-xs font-semibold ${statusColor(journey.status)}`}>
                      {statusLabel(journey.status)}
                    </span>
                  </div>
                </div>
                {journey.vehicleInfo && (
                  <div className="text-xs text-zinc-400 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                    Araç: <span className="font-mono text-zinc-300">{journey.vehicleInfo}</span>
                  </div>
                )}
                {journey.status === 'triggered' && journey.triggerReason && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                    {journey.triggerReason}
                  </div>
                )}
                <button
                  onClick={() => onNavigate('livemap', journey.userId)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Haritada Gör
                </button>
              </motion.div>
            ))
          )}
        </section>

        {/* Geçmiş yolculuklar */}
        {pastJourneys.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              Geçmiş İzlemelerim
            </h2>
            {pastJourneys.map(journey => (
              <div key={journey.id} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-300">{journey.displayName}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">{formatTimestamp(journey.startedAt)}</div>
                  {journey.vehicleInfo && (
                    <div className="text-xs text-zinc-600 font-mono mt-0.5">{journey.vehicleInfo}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-xs text-zinc-600">Tamamlandı</span>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
