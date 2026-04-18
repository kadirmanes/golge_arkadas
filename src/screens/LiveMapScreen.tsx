import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, MapPin, ExternalLink, Battery, BatteryWarning } from 'lucide-react';
import { subscribeToActiveJourneyForUser } from '../firebase/firestore';
import type { Journey, Screen } from '../types';

interface Props {
  targetUserId: string;
  targetDisplayName?: string;
  onNavigate: (screen: Screen) => void;
}

export default function LiveMapScreen({ targetUserId, targetDisplayName, onNavigate }: Props) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [emergencyAcknowledged, setEmergencyAcknowledged] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const alarmCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isEmergency = journey?.status === 'triggered';
  const showFullscreenAlert = isEmergency && !emergencyAcknowledged;

  // Journey dinle
  useEffect(() => {
    const unsub = subscribeToActiveJourneyForUser(targetUserId, setJourney);
    return unsub;
  }, [targetUserId]);

  // Acil durum başladığında alarm çal + bildirim gönder
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = journey?.status ?? null;
    prevStatusRef.current = curr;

    if (curr === 'triggered' && prev !== 'triggered') {
      // Onay sıfırla — yeni acil durum
      setEmergencyAcknowledged(false);

      // Alarm sesi
      startAlarm();

      // Browser bildirimi
      if (Notification.permission === 'granted') {
        new Notification('🚨 ACİL DURUM!', {
          body: journey?.triggerReason ?? 'Acil durum bildirildi!',
          requireInteraction: true,
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            new Notification('🚨 ACİL DURUM!', {
              body: journey?.triggerReason ?? 'Acil durum bildirildi!',
              requireInteraction: true,
            });
          }
        });
      }
    }

    // Acil durum bittiyse alarmı durdur
    if (curr !== 'triggered') {
      stopAlarm();
    }
  }, [journey?.status]);

  // Bileşen kapanınca alarmı durdur
  useEffect(() => () => stopAlarm(), []);

  const startAlarm = () => {
    stopAlarm(); // önceki varsa durdur
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    alarmCtxRef.current = ctx;

    const playBeep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    };

    playBeep();
    alarmIntervalRef.current = setInterval(playBeep, 800);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    alarmCtxRef.current?.close();
    alarmCtxRef.current = null;
  };

  const acknowledgeEmergency = () => {
    stopAlarm();
    setEmergencyAcknowledged(true);
  };

  const loc = journey?.location;

  const mapsEmbedUrl = loc
    ? `https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=17&output=embed&hl=tr`
    : null;

  const coordKey = loc
    ? `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`
    : 'none';

  const statusColor = isEmergency
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : journey?.status === 'alert'
    ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  return (
    <div style={{ height: '100dvh' }} className="bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">

      {/* TAM EKRAN ACİL DURUM OVERLAY */}
      {showFullscreenAlert && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-950"
          style={{ animation: 'emergencyPulse 1s ease-in-out infinite' }}>
          <style>{`
            @keyframes emergencyPulse {
              0%, 100% { background-color: rgb(69,10,10); }
              50% { background-color: rgb(127,29,29); }
            }
          `}</style>

          {/* Yanıp sönen uyarı ikonu */}
          <div className="mb-8 animate-bounce">
            <AlertTriangle className="w-32 h-32 text-red-400" />
          </div>

          <h1 className="text-5xl font-black text-white tracking-tight mb-4 text-center">
            🚨 ACİL DURUM!
          </h1>

          <p className="text-xl text-red-200 text-center px-8 mb-2 font-semibold">
            {targetDisplayName ?? 'Kullanıcı'} yardım istiyor!
          </p>

          {journey?.triggerReason && (
            <p className="text-red-300 text-center px-10 mb-8 text-sm">
              {journey.triggerReason}
            </p>
          )}

          {journey?.emergencyAudioUrl && (
            <div className="mb-6 flex flex-col items-center w-full max-w-sm px-6">
              <p className="text-red-200 text-sm mb-2 font-semibold">🚨 Acil Durum Ses Kaydı (Kanıt)</p>
              <audio controls src={journey.emergencyAudioUrl} className="w-full outline-none h-10" />
            </div>
          )}

          {loc && (
            <a
              href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white text-red-900 font-bold px-6 py-3 rounded-2xl text-lg mb-4 hover:bg-red-50 transition-colors"
            >
              <MapPin className="w-5 h-5" />
              Konumu Haritada Gör
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={acknowledgeEmergency}
            className="mt-4 bg-red-700 hover:bg-red-600 text-white font-semibold px-8 py-3 rounded-2xl transition-colors border border-red-500"
          >
            Anladım — Haritayı Göster
          </button>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 px-4 py-3 flex items-center gap-3 border-b border-zinc-800/50 bg-zinc-950">
        <button onClick={() => onNavigate('watcher')}
          className="p-1 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-medium truncate">{targetDisplayName ?? 'Canlı Konum'}</h1>
        </div>
        {journey && (
          <div className="shrink-0 flex items-center gap-2">
            {loc?.batteryLevel !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${loc.batteryLevel <= 15 ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-zinc-400 border-zinc-700 bg-zinc-800'}`}>
                {loc.batteryLevel <= 15 ? <BatteryWarning className="w-3 h-3" /> : <Battery className="w-3 h-3" />}
                {loc.batteryLevel}%
              </div>
            )}
            <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColor}`}>
              {isEmergency ? <AlertTriangle className="w-3 h-3 animate-pulse" /> : <CheckCircle className="w-3 h-3" />}
              {isEmergency ? 'ACİL' : journey.status === 'alert' ? 'Alarm' : 'Aktif'}
            </div>
          </div>
        )}
      </header>

      {/* Acil durum onaylandıktan sonra küçük banner */}
      {isEmergency && emergencyAcknowledged && (
        <div className="shrink-0 bg-red-900/80 border-b border-red-500/40 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
            <p className="text-red-200 text-sm font-semibold truncate">
              {journey?.triggerReason ?? 'Acil durum bildirildi!'}
            </p>
          </div>
          {loc && (
            <a
              href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs text-red-300 underline hover:text-red-100"
            >
              Haritaya Git →
            </a>
          )}
        </div>
      )}

      {/* Harita */}
      <div className="flex-1 min-h-0 relative">
        {!mapsEmbedUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Clock className="w-12 h-12 text-zinc-700" />
            <p className="text-sm">Konum bekleniyor...</p>
            {!journey && <p className="text-xs text-zinc-600">Bu kişinin aktif yolculuğu yok.</p>}
          </div>
        ) : (
          <iframe
            key={coordKey}
            src={mapsEmbedUrl}
            title="Canlı Konum - Google Maps"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      {/* Alt bilgi */}
      {loc && (
        <div className="shrink-0 px-4 py-2 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">
            {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
          </span>
          <a
            href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            Google Maps'te Aç <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
