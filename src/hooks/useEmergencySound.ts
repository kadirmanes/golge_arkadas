import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

// Uygulama açıkken acil durum alarmı çalar.
// Native: Haptics güçlü titreşim + LocalNotifications alarm kanalı (sessiz modu bypass eder)
// Web: Web Audio API osilatör alarmı
export function useEmergencySound() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Web: AudioContext'i ilk kullanıcı etkileşiminde önceden unlock et
  // Chrome 71+ yeni AudioContext'i suspended başlatır; user gesture olmadan play edilemez.
  // Kullanıcı sayfaya tıkladığında/dokunduğunda unlock ediyoruz.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const unlock = () => {
      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new AudioContext();
        } catch { return; }
      }
      audioCtxRef.current.resume().catch(() => {});
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  const playAlarm = async () => {
    if (Capacitor.isNativePlatform()) {
      // ─── Native: güçlü titreşim döngüsü ──────────────────────────────────
      let count = 0;
      hapticIntervalRef.current = setInterval(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        count++;
        if (count >= 20) stopAlarm(); // ~10 saniye
      }, 500);

      // Alarm kanalı üzerinden ses (sessiz modu bypass eder)
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: 9999,
            title: '🚨 ACİL DURUM',
            body: 'Guardly alarm tetiklendi!',
            channelId: 'emergency-alarm',
            sound: 'alarm.wav',
            ongoing: false,
            autoCancel: true,
            extra: { type: 'emergency' },
          }],
        });
      } catch { /* LocalNotifications izni yoksa sessizce geç */ }

    } else {
      // ─── Web: mevcut (unlock edilmiş) AudioContext ile çal ───────────────
      try {
        // Eğer önceden oluşturulmadıysa şimdi oluştur
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;
        // Suspended ise resume et
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        let time = ctx.currentTime;

        for (let i = 0; i < 10; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.frequency.setValueAtTime(880, time);
          osc.frequency.linearRampToValueAtTime(1320, time + 0.4);
          osc.frequency.linearRampToValueAtTime(880, time + 0.8);

          gain.gain.setValueAtTime(0.8, time);
          gain.gain.linearRampToValueAtTime(0, time + 0.9);

          osc.start(time);
          osc.stop(time + 0.9);
          time += 1.0;
        }
      } catch { /* AudioContext desteklenmiyor */ }
    }
  };

  const stopAlarm = () => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    // AudioContext'i kapatmak yerine suspend et — tekrar kullanılabilsin
    try { audioCtxRef.current?.suspend(); } catch { /* ignore */ }
  };

  useEffect(() => {
    // Native'de FCM push handler (uygulama açıkken)
    if (Capacitor.isNativePlatform()) return;

    // Web: servis worker mesajını dinle
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'EMERGENCY_NOTIFICATION' && event.data?.isEmergency) {
        playAlarm();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handler);
      stopAlarm();
    };
  }, []);

  return { playAlarm, stopAlarm };
}
