import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Clock, Phone, AlertTriangle, CheckCircle, MapPin,
  Plus, X, Activity, Volume2, PhoneCall, Lock, Mic, ArrowLeft,
} from 'lucide-react';
import type { Screen, JourneyLocation } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { useFirestoreJourney } from '../hooks/useFirestoreJourney';
import { useAlarmController } from '../hooks/useAlarmController';
import { useFakeCallController } from '../hooks/useFakeCallController';
import { usePinSecurity } from '../hooks/usePinSecurity';
import { useJourneyLifecycle } from '../hooks/useJourneyLifecycle';
import { useWatcherSelection } from '../hooks/useWatcherSelection';
import { useEmergencyTriggers } from '../hooks/useEmergencyTriggers';
import { useAuth } from '../contexts/AuthContext';
import PinModal from '../components/PinModal';
import FakeCallOverlay from '../components/FakeCallOverlay';
import { App as CapApp } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { uploadEmergencyAudio } from '../firebase/firestore';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export default function ProtectedScreen({ onNavigate }: Props) {
  const { currentUser } = useAuth();
  const {
    contacts,
    contactAddMsg,
    myContacts,
    addContactFromSearch,
    removeContact,
  } = useWatcherSelection({ currentUser });

  const { isSirenPlaying, toggleSiren, stopSiren } = useAlarmController();

  const {
    fakeCallState,
    fakeCallDuration,
    fakeCallName,
    setFakeCallName,
    startFakeCall,
    answerFakeCall,
    endFakeCall,
  } = useFakeCallController();

  const [vehicleInfo, setVehicleInfo] = useState('');
  const [showFakeScreen, setShowFakeScreen] = useState(false);

  const {
    appState,
    journeyId,
    durationMinutes,
    setDurationMinutes,
    timeLeft,
    setTimeLeft,
    alertCountdown,
    triggerReason,
    checkInActive,
    setCheckInActive,
    checkInCountdown,
    setCheckInCountdown,
    startJourney: startJourneyLifecycle,
    cancelJourney: cancelJourneyLifecycle,
    activateAlert,
    markTriggered,
    markActive,
    setSetupState,
    setActiveState,
  } = useJourneyLifecycle({
    currentUser,
    contacts,
    vehicleInfo,
    onEmergency: (reason) => {
      triggerEmergency(reason);
    },
  });

  const {
    userPin,
    handleUserPinChange,
    duressPin,
    handleDuressPinChange,
    showPinModal,
    enteredPin,
    pinError,
    pinAttempts,
    requirePin,
    handlePinConfirm,
    handlePinChange,
    handlePinCancel,
    resetPinAttempts,
  } = usePinSecurity({
    onDuressPin: () => {
      setSetupState();
      triggerEmergency('Kullanici tehdit altinda sahte PIN girdi! Kurtarma alarmi!');
    },
    onMaxAttempts: (reason) => {
      markTriggered(reason);
      triggerEmergency(reason);
    },
  });

  // Periyodik Check-in State'leri
  // Sarj Bildirim State
  const [hasSentLowBatteryAlarm, setHasSentLowBatteryAlarm] = useState(false);

  // Ses Kayıt State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { location, error: locationError, startTracking, stopTracking } = useGeolocation();
  const wakeLockRef = useRef<any>(null);
  const lastEmergencyRef = useRef<number>(0);
  const emergencySessionActiveRef = useRef(false);

  // Firestore konum senkronizasyonu
  useFirestoreJourney(journeyId, location ? { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy } : null);
  // Acil durum → ekranı uyanık tut + geri tuşunu engelle
  useEffect(() => {
    if (appState !== 'triggered') return;

    // WakeLock — ekran kapanmasın
    (navigator as any).wakeLock?.request('screen').then((lock: any) => {
      wakeLockRef.current = lock;
    }).catch(() => {});

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current?.released) {
        (navigator as any).wakeLock?.request('screen').then((lock: any) => {
          wakeLockRef.current = lock;
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Geri tuşunu engelle
    const backHandler = CapApp.addListener('backButton', () => { /* engelle */ });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
      backHandler.then(h => h.remove());
    };
  }, [appState]);

  useEffect(() => {
    if (appState === 'active' || appState === 'setup') {
      emergencySessionActiveRef.current = false;
    }
  }, [appState]);

  // FCM bildirimi gonder
  const sendFcmNotifications = async (reason: string) => {
    const appContacts = contacts.filter(c => c.type === 'app' && c.fcmToken);
    if (appContacts.length === 0 || !currentUser || !journeyId) return;

    const locStr = location ? `https://maps.google.com/?q=${location.latitude},${location.longitude}` : '';
    try {
      const idToken = await currentUser.getIdToken();
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tokens: appContacts.map(c => c.fcmToken as string),
          title: `ACIL: ${currentUser?.displayName ?? 'Bir kisi'} yardim istiyor!`,
          body: `${reason}${locStr ? ` Konum: ${locStr}` : ''}`,
          journeyId,
          data: { reason, location: locStr },
        }),
      });
    } catch (error) {
      console.error('[ProtectedScreen] Notification send failed', error);
    }
  };

  const triggerEmergency = useCallback((reason: string) => {
    if (emergencySessionActiveRef.current) {
      console.warn('[triggerEmergency] session active — ignored:', reason);
      return;
    }
    const now = Date.now();
    if (now - lastEmergencyRef.current < 5000) {
      console.warn('[triggerEmergency] cooldown — ignored:', reason, `(${now - lastEmergencyRef.current}ms ago)`);
      return;
    }
    emergencySessionActiveRef.current = true;
    lastEmergencyRef.current = now;
    sendFcmNotifications(reason);
  }, [contacts, location, currentUser, journeyId]);

  const { handleSecretTap, startListening, stopListening, isSupported, requestPermission } = useEmergencyTriggers({
    appState,
    onAlert: activateAlert,
    triggerEmergency,
  });
  // Düşük Şarj Bildirimi
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (appState === 'active') {
      interval = setInterval(async () => {
        if (hasSentLowBatteryAlarm) return;
        try {
          const info = await Device.getBatteryInfo();
          if (info.batteryLevel && info.batteryLevel <= 0.10) {
            triggerEmergency("Kullanıcının şarjı %10'un altına düştü! (Sistem Uyarısı, bağlantı kopabilir.)");
            setHasSentLowBatteryAlarm(true);
          }
        } catch(e) {}
      }, 60000); // Dakikada bir kontrol
    }
    return () => clearInterval(interval);
  }, [appState, hasSentLowBatteryAlarm, triggerEmergency]);

  // Acil durumda ses kaydı al ve Firebase'e yükle
  useEffect(() => {
    if (appState === 'alert' || appState === 'triggered') {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        const startRecording = async () => {
          try {
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
             mediaRecorderRef.current = mr;
             mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
             mr.onstop = async () => {
                 const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                 audioChunksRef.current = [];
                 if (journeyId) {
                    uploadEmergencyAudio(journeyId, blob).catch(console.error);
                 }
                 stream.getTracks().forEach(t => t.stop());
             };
             mr.start();
             setTimeout(() => {
                if (mr.state === 'recording') mr.stop();
             }, 10000); // 10 saniye kayıt
          } catch(e) { console.error('Mic error', e); }
        };
        startRecording();
      }
    }
  }, [appState, journeyId]);

  // Kulaklık (Bluetooth vb.) kopma algılaması
  useEffect(() => {
    if (appState === 'active') {
      const handleDeviceChange = async () => {
        try {
           setCheckInActive(true);
           setCheckInCountdown(30); // Cihaz koptuğunda daha hızlı yanıt bekler
           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([500,200,500]);
        } catch(e){}
      };
      if (navigator.mediaDevices) {
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      }
      return () => {
        if (navigator.mediaDevices) navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    }
  }, [appState]);


  // Hareketsizlik Algılaması (Route/Movement Anomaly)
  const lastLocationRef = useRef<JourneyLocation | null>(null);
  const lastMovementTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (appState === 'active' && location) {
      if (!lastLocationRef.current) {
        lastLocationRef.current = location;
        lastMovementTimeRef.current = Date.now();
      } else {
        const R = 6371e3;
        const lat1 = lastLocationRef.current.latitude * Math.PI/180;
        const lat2 = location.latitude * Math.PI/180;
        const dLat = (location.latitude - lastLocationRef.current.latitude) * Math.PI/180;
        const dLon = (location.longitude - lastLocationRef.current.longitude) * Math.PI/180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance > 20) { // 20 metre hareket
           lastLocationRef.current = location;
           lastMovementTimeRef.current = Date.now();
        } else {
           // 5 dakika (300.000 ms) boyunca 20 metreden az hareket
           if (Date.now() - lastMovementTimeRef.current > 5 * 60 * 1000) {
              setCheckInActive(true);
              setCheckInCountdown(60);
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([500,200,500]);
              lastMovementTimeRef.current = Date.now(); // Tekrarını önlemek için sıfırla
           }
        }
      }
    }
  }, [appState, location]);
  const startJourney = async () => {
    if (userPin.length !== 4 || duressPin.length !== 4) { alert('Her iki PIN\'i de 4 haneli girin.'); return; }
    if (userPin === duressPin) { alert('Guvenlik PIN\'i ile Tehdit PIN\'i ayni olamaz!'); return; }

    resetPinAttempts();
    if (isSupported && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      await requestPermission();
    }

    const started = await startJourneyLifecycle();
    if (!started) return;
    startTracking();
    startListening();
  };

  const cancelJourney = () => {
    cancelJourneyLifecycle();
    stopTracking();
    stopListening();
    setVehicleInfo('');
    if (isSirenPlaying) stopSiren();
    endFakeCall();
    setHasSentLowBatteryAlarm(false);
  };

  const requireJourneyCancel = () => requirePin(cancelJourney);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* SAHTE EKRAN — Yanlış PIN girilince gösterilir, arka planda alarm devam eder */}
      {showFakeScreen && (
        <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col">
          <header className="p-6 flex items-center gap-3 border-b border-zinc-800/50">
            <Shield className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-medium tracking-tight">Guardly</h1>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="text-sm text-emerald-400 font-medium tracking-widest uppercase">Kalan Süre</div>
              <div className="text-7xl font-mono font-light tracking-tighter text-white">{formatTime(timeLeft)}</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800 mt-4">
              <MapPin className="w-3 h-3 text-emerald-500" /> Konum izleniyor
            </div>
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden">

        <header
          onClick={handleSecretTap}
          className="p-6 flex items-center justify-between gap-3 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md z-10 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            {appState === 'setup' && (
              <button onClick={(e) => { e.stopPropagation(); onNavigate('home'); }} className="p-1 text-zinc-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <Shield className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-medium tracking-tight">Guardly</h1>
          </div>
        </header>

        <main className="flex-1 flex flex-col relative overflow-y-auto">

          <AnimatePresence mode="wait">
            {/* SETUP */}
            {appState === 'setup' && (
              <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-6 flex flex-col gap-8">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">Güvenli Yolculuk</h2>
                  <p className="text-zinc-400 text-sm">Süre dolduğunda veya düşüş algılandığında kişileriniz bilgilendirilir.</p>
                </div>

                {/* Süre */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" /> Tahmini Varış Süresi
                  </label>
                  <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                    <input type="range" min="1" max="120" value={durationMinutes} onChange={e => setDurationMinutes(parseInt(e.target.value))} className="flex-1 accent-emerald-500" />
                    <div className="w-16 text-right font-mono text-xl text-emerald-400">{durationMinutes} <span className="text-xs text-zinc-500">dk</span></div>
                  </div>
                </div>

                {/* Kişiler */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-500" /> Acil Durum Kişileri ({contacts.length}/3)
                  </label>

                  {/* Eklenen kişiler */}
                  {contacts.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
                          {c.name[0].toUpperCase()}
                        </div>
                        <div className="font-medium text-sm truncate">{c.name}</div>
                      </div>
                      <button onClick={() => removeContact(c.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Arkadaşlar listesi */}
                  {contacts.length < 3 && (
                    <>
                      {myContacts.filter(u => !contacts.some(c => c.userId === u.uid)).length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {myContacts
                            .filter(u => !contacts.some(c => c.userId === u.uid))
                            .map(user => (
                              <button
                                key={user.uid}
                                onClick={() => addContactFromSearch(user)}
                                className="flex items-center gap-3 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 border-dashed hover:border-emerald-500/40 rounded-xl px-3 py-2.5 transition-colors text-left"
                              >
                                <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-zinc-300 font-semibold text-sm">
                                  {(user.displayName ?? '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-zinc-200 truncate">{user.displayName}</div>
                                  <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                                </div>
                                <Plus className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              </button>
                            ))}
                        </div>
                      ) : (
                        <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-xl px-4 py-4 text-center">
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            Henüz arkadaşın yok.{'\n'}
                            <span className="text-emerald-600">Arkadaşlarım</span> bölümünden arkadaş ekle.
                          </p>
                        </div>
                      )}
                      {contactAddMsg && <p className="text-xs text-red-400">{contactAddMsg}</p>}
                    </>
                  )}
                </div>

                {/* PIN */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-500" /> Güvenlik PIN</label>
                  <input type="password" maxLength={4} inputMode="numeric" value={userPin} onChange={e => handleUserPinChange(e.target.value)} placeholder="4 haneli şifre"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-center tracking-[1em] font-mono text-xl" />
                  <p className="text-xs text-zinc-500">Yolculuğu iptal etmek için kullanılır.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Tehdit PIN (Sahte)</label>
                  <input type="password" maxLength={4} inputMode="numeric" value={duressPin} onChange={e => handleDuressPinChange(e.target.value)} placeholder="4 haneli sahte şifre"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors text-center tracking-[1em] font-mono text-xl" />
                  <p className="text-xs text-zinc-500">Zorla şifre sorulursa bu PIN'i girin. Uygulama kapanmış gibi görünür, alarm gönderir.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2"><PhoneCall className="w-4 h-4 text-emerald-500" /> Sahte Arama Kişi Adı</label>
                  <input type="text" value={fakeCallName} onChange={e => setFakeCallName(e.target.value)} placeholder="Örn: Annem"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                </div>

                <div className="mt-auto pt-6">
                  <button onClick={startJourney} disabled={contacts.length === 0 || userPin.length !== 4 || duressPin.length !== 4}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-lg shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed">
                    <Shield className="w-5 h-5" /> Yolculuğu Başlat
                  </button>
                </div>
              </motion.div>
            )}

            {/* ACTIVE */}
            {appState === 'active' && (
              <motion.div key="active" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
                className="flex-1 flex flex-col items-center justify-center p-6 gap-10">
                <div className="relative flex items-center justify-center">
                  <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl" />
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="text-sm text-emerald-400 font-medium tracking-widest uppercase mb-2">Kalan Süre</div>
                    <div className="text-7xl font-mono font-light tracking-tighter text-white">{formatTime(timeLeft)}</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                  <div className={`flex items-center gap-2 text-xs px-4 py-2 rounded-full border ${
                    location ? 'text-emerald-400 bg-zinc-900 border-zinc-800' :
                    locationError ? 'text-red-400 bg-red-950/30 border-red-800' :
                    'text-zinc-400 bg-zinc-900 border-zinc-800'
                  }`}>
                    <MapPin className={`w-3 h-3 ${location ? 'text-emerald-500' : locationError ? 'text-red-500' : 'text-zinc-500'}`} />
                    {location ? 'Konum izleniyor ✓' :
                     locationError ? `Konum izni gerekli — Ayarlar > Uygulama > Konum` :
                     'Konum aranıyor...'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                    <Activity className="w-3 h-3 text-emerald-500" /> Düşme sensörü aktif
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                    <Mic className="w-3 h-3 text-emerald-500" /> "İmdat" sesli alarm aktif
                  </div>
                  <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2">
                    <label className="text-xs text-zinc-400 font-medium">Taksi / Araç Plakası</label>
                    <input type="text" value={vehicleInfo} onChange={e => setVehicleInfo(e.target.value.toUpperCase())} placeholder="Örn: 34 ABC 123"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                  </div>
                </div>
                <div className="w-full space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={toggleSiren} className={`py-3 rounded-2xl font-medium flex flex-col items-center justify-center gap-2 transition-colors ${isSirenPlaying ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'}`}>
                      <Volume2 className={`w-6 h-6 ${isSirenPlaying ? 'animate-pulse' : ''}`} />
                      <span className="text-xs">{isSirenPlaying ? 'Sireni Kapat' : 'Siren Çal'}</span>
                    </button>
                    <button onClick={startFakeCall} className="py-3 rounded-2xl font-medium flex flex-col items-center justify-center gap-2 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 transition-colors">
                      <PhoneCall className="w-6 h-6" />
                      <span className="text-xs">Sahte Arama</span>
                    </button>
                  </div>
                  <button onClick={requireJourneyCancel} className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-lg">
                    <CheckCircle className="w-5 h-5" /> Güvenle Vardım
                  </button>
                  <button onClick={() => { activateAlert('Kullanıcı acil durum butonuna bastı.', 5) }}
                    className="w-full bg-transparent border border-red-500/30 text-red-500 hover:bg-red-500/10 font-medium py-3 rounded-2xl transition-colors">
                    Acil Durum (Hemen Bildir)
                  </button>
                </div>
              </motion.div>
            )}

            {/* ALERT */}
            {appState === 'alert' && (
              <motion.div key="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center p-6 bg-red-950/50">
                <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute inset-0 bg-red-600/20" />
                <div className="relative z-10 flex flex-col items-center text-center gap-8">
                  <AlertTriangle className="w-24 h-24 text-red-500 animate-bounce" />
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-red-500">GÜVENDE MİSİNİZ?</h2>
                    <p className="text-zinc-300 text-lg">{triggerReason}</p>
                    <p className="text-zinc-400 text-sm mt-2">İptal etmezseniz acil kişilerinize bildirim gönderilecek:</p>
                  </div>
                  <div className="text-8xl font-mono font-bold text-white">{alertCountdown}</div>
                  <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
                    <button onClick={() => requirePin(
                      () => { setActiveState(10); },
                      () => { setShowFakeScreen(true); }
                    )} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-colors">
                      Yanlışlıkla Bastım
                    </button>
                    <button onClick={requireJourneyCancel} className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-4 rounded-2xl transition-colors">Güvenle Vardım (Bitir)</button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TRIGGERED */}
            {appState === 'triggered' && (
              <motion.div key="triggered" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-6">
                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-red-500 mb-2">ACİL DURUM BİLDİRİLDİ</h2>
                  <p className="text-zinc-300 text-sm">Kişilerinize bildirim gönderildi.</p>
                </div>
                <div className="w-full max-w-xs space-y-3 mt-2">
                  {contacts.length > 0 && (
                    <div className="text-xs text-emerald-400 text-center py-2">
                      ✓ {contacts.length} kişiye bildirim gönderildi
                    </div>
                  )}
                  {/* Güvendeyim — Alarmı geri al */}
                  <button onClick={() => requirePin(() => {
                    markActive();
                    setTimeLeft(t => t > 0 ? t : 5 * 60);
                  })}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Güvendeyim — Alarmı İptal Et
                  </button>
                  <button onClick={requireJourneyCancel}
                    className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-4 rounded-2xl transition-colors">
                    Güvenle Vardım (Bitir)
                  </button>
                  <button onClick={() => requirePin(() => {
                    cancelJourneyLifecycle();
                    stopTracking();
                    stopListening();
                  })}
                    className="w-full bg-transparent border border-zinc-800 text-zinc-400 hover:bg-zinc-900 font-medium py-3 rounded-2xl transition-colors">
                    Başa Dön
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <FakeCallOverlay
            state={fakeCallState}
            name={fakeCallName}
            duration={fakeCallDuration}
            onAnswer={answerFakeCall}
            onEnd={endFakeCall}
          />

          <AnimatePresence>
            {checkInActive && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-6 left-6 right-6 bg-amber-500 rounded-3xl p-6 shadow-2xl z-40 flex flex-col items-center text-center gap-4">
                <AlertTriangle className="w-12 h-12 text-zinc-950 animate-pulse" />
                <div>
                  <h3 className="text-xl font-bold text-zinc-950">İyi misiniz?</h3>
                  <p className="text-zinc-900 text-sm mt-1">Lütfen iyi olduğunuzu doğrulayın.</p>
                </div>
                <div className="text-4xl font-mono font-bold text-zinc-950">
                  {checkInCountdown}
                </div>
                <button onClick={() => setCheckInActive(false)} className="w-full bg-zinc-950 text-white font-bold py-4 rounded-2xl">
                  Evet, İyiyim
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <PinModal
            isOpen={showPinModal}
            enteredPin={enteredPin}
            pinError={pinError}
            attemptsLeft={3 - pinAttempts}
            onPinChange={handlePinChange}
            onConfirm={handlePinConfirm}
            onCancel={handlePinCancel}
          />
        </main>
      </div>
    </div>
  );
}













