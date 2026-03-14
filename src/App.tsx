import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Clock, Phone, AlertTriangle, CheckCircle, MapPin, Plus, X, Activity, Users, Volume2, PhoneCall, Lock, Camera, Download } from 'lucide-react';
import { Contact, AppState } from './types';
import { useGeolocation } from './hooks/useGeolocation';
import { useEvidenceRecorder } from './hooks/useEvidenceRecorder';

// Fall detection hook inline for simplicity or imported. We'll import it.
import { useFallDetection } from './hooks/useFallDetection';

export default function App() {
  const [appState, setAppState] = useState<AppState>('setup');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [alertCountdown, setAlertCountdown] = useState<number>(10);
  const [triggerReason, setTriggerReason] = useState<string>('');

  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [isContactPickerSupported, setIsContactPickerSupported] = useState(false);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [isFakeCallActive, setIsFakeCallActive] = useState(false);
  
  const [userPin, setUserPin] = useState('');
  const [duressPin, setDuressPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [lastSecretTap, setLastSecretTap] = useState(0);
  
  const [vehicleInfo, setVehicleInfo] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for siren
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg');
    audioRef.current.loop = true;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle Alert State Vibration (No automatic sound)
  useEffect(() => {
    if (appState === 'alert') {
      if ('vibrate' in navigator) {
        // Vibrate pattern to silently notify the user
        navigator.vibrate([500, 500, 500, 500, 500, 500]);
      }
    } else {
      if ('vibrate' in navigator) {
        navigator.vibrate(0); // Stop vibration
      }
    }
  }, [appState]);

  const toggleSiren = () => {
    if (isSirenPlaying) {
      audioRef.current?.pause();
      setIsSirenPlaying(false);
    } else {
      audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
      setIsSirenPlaying(true);
    }
  };

  const startFakeCall = () => {
    setIsFakeCallActive(true);
    // Simulate phone ringing then answering
    setTimeout(() => {
      // Could play a ringtone here
    }, 1000);
  };

  const endFakeCall = () => {
    setIsFakeCallActive(false);
  };

  const requirePin = (action: () => void) => {
    setPendingAction(() => action);
    setEnteredPin('');
    setPinError(false);
    setShowPinModal(true);
  };

  const handleSecretTap = () => {
    const now = Date.now();
    if (now - lastSecretTap > 1000) {
      // Reset if more than 1 second between taps
      setSecretTapCount(1);
    } else {
      const newCount = secretTapCount + 1;
      setSecretTapCount(newCount);
      if (newCount >= 5) {
        // Trigger silent alarm
        startRecording();
        window.location.href = getSmsLink("Kullanıcı GİZLİ PANİK (5 dokunuş) alarmını tetikledi!");
        setSecretTapCount(0);
      }
    }
    setLastSecretTap(now);
  };

  const { location, startTracking, stopTracking } = useGeolocation();
  const { isRecording, videoUrl, startRecording, stopRecording } = useEvidenceRecorder();

  useEffect(() => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      setIsContactPickerSupported(true);
    }
  }, []);

  const handleSelectContact = async () => {
    if (isContactPickerSupported) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        const selectedContacts = await (navigator as any).contacts.select(props, opts);
        if (selectedContacts && selectedContacts.length > 0) {
          const contact = selectedContacts[0];
          const name = contact.name ? contact.name[0] : '';
          const phone = contact.tel ? contact.tel[0] : '';
          setNewContactName(name);
          setNewContactPhone(phone);
        }
      } catch (ex) {
        console.error('Contact selection failed:', ex);
      }
    } else {
      alert('Tarayıcınız rehberden kişi seçme özelliğini desteklemiyor. Lütfen manuel olarak girin.');
    }
  };

  const handleFallDetected = () => {
    if (appState === 'active') {
      setTriggerReason('Sert bir düşüş algılandı!');
      setAppState('alert');
      setAlertCountdown(10);
    }
  };

  const { startListening, stopListening, isSupported, requestPermission } = useFallDetection(handleFallDetected);

  // Load contacts from local storage
  useEffect(() => {
    const savedContacts = localStorage.getItem('golgeArkadasContacts');
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts));
      } catch (e) {
        console.error('Failed to parse contacts');
      }
    }
  }, []);

  // Save contacts to local storage
  useEffect(() => {
    localStorage.setItem('golgeArkadasContacts', JSON.stringify(contacts));
  }, [contacts]);

  // Main timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (appState === 'active' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTriggerReason('Belirlenen süre doldu!');
            setAppState('alert');
            setAlertCountdown(10);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, timeLeft]);

  // Alert countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (appState === 'alert' && alertCountdown > 0) {
      interval = setInterval(() => {
        setAlertCountdown((prev) => {
          if (prev <= 1) {
            setAppState('triggered');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, alertCountdown]);

  // Handle Recording
  useEffect(() => {
    if (appState === 'triggered' && !isRecording) {
      startRecording();
    } else if (appState !== 'triggered' && appState !== 'setup' && isRecording) {
      // Stop recording if we go back to active/alert (e.g. false alarm cancelled)
      stopRecording();
    }
  }, [appState, isRecording, startRecording, stopRecording]);

  const addContact = () => {
    if (newContactName && newContactPhone && contacts.length < 3) {
      setContacts([...contacts, { id: Date.now().toString(), name: newContactName, phone: newContactPhone }]);
      setNewContactName('');
      setNewContactPhone('');
    }
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
  };

  const startJourney = async () => {
    if (contacts.length === 0) {
      alert('Lütfen en az bir acil durum kişisi ekleyin.');
      return;
    }
    if (userPin.length !== 4 || duressPin.length !== 4) {
      alert('Lütfen her iki 4 haneli PIN kodunu da belirleyin.');
      return;
    }
    if (userPin === duressPin) {
      alert('Güvenlik PIN kodu ile Tehdit PIN kodu aynı olamaz!');
      return;
    }
    
    setPinAttempts(0);

    // Request motion permission if needed (iOS 13+)
    if (isSupported && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      await requestPermission();
    }

    setTimeLeft(durationMinutes * 60);
    setAppState('active');
    startTracking();
    startListening();
  };

  const cancelJourney = () => {
    setAppState('setup');
    stopTracking();
    stopListening();
    setVehicleInfo('');
    if (isRecording) stopRecording();
  };

  const cancelAlert = () => {
    setAppState('active');
    // Reset timer to 5 minutes to give them time to finish or cancel
    setTimeLeft(5 * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getSmsLink = (customReason?: string) => {
    const phones = contacts.map(c => c.phone).join(',');
    const locStr = location 
      ? `Konumum: https://maps.google.com/?q=${location.latitude},${location.longitude}` 
      : 'Konum alınamadı.';
    const reason = customReason || triggerReason;
    const vehicleStr = vehicleInfo ? ` Araç/Taksi: ${vehicleInfo}` : '';
    const message = encodeURIComponent(`ACİL DURUM! Gölge Arkadaş uygulaması uyarı verdi. Neden: ${reason} ${locStr}${vehicleStr}`);
    
    // iOS and Android handle multiple SMS recipients differently, but we'll use a standard format
    // Some devices prefer ?body=, some prefer &body=
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    
    return `sms:${phones}${separator}body=${message}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <header 
          onClick={handleSecretTap}
          className="p-6 flex items-center justify-between gap-3 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md z-10 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-medium tracking-tight">Gölge Arkadaş</h1>
          </div>
          {isRecording && appState === 'setup' && (
            <div className="flex items-center gap-2 text-xs font-medium text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              Gizli Kayıt
            </div>
          )}
        </header>

        <main className="flex-1 flex flex-col relative overflow-y-auto">
          {/* Download Video Banner if available */}
          {videoUrl && appState === 'setup' && !isRecording && (
            <div className="m-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-emerald-400">Kanıt Kaydedildi</span>
                <span className="text-xs text-zinc-400">Acil durum kaydınızı indirebilirsiniz.</span>
              </div>
              <a 
                href={videoUrl} 
                download={`kanit_kaydi_${new Date().getTime()}.webm`}
                className="p-3 bg-emerald-500 text-zinc-950 rounded-xl hover:bg-emerald-400 transition-colors"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
          )}

          <AnimatePresence mode="wait">
            
            {/* SETUP STATE */}
            {appState === 'setup' && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 flex flex-col gap-8"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">Güvenli Yürüyüş</h2>
                  <p className="text-zinc-400 text-sm">
                    Yolculuk sürenizi belirleyin. Süre dolduğunda veya ani bir düşüş algılandığında belirlediğiniz kişilere konumunuz SMS olarak gönderilir.
                  </p>
                </div>

                {/* Duration Picker */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    Tahmini Varış Süresi
                  </label>
                  <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                    <input 
                      type="range" 
                      min="1" 
                      max="120" 
                      value={durationMinutes} 
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                      className="flex-1 accent-emerald-500"
                    />
                    <div className="w-16 text-right font-mono text-xl text-emerald-400">
                      {durationMinutes} <span className="text-xs text-zinc-500">dk</span>
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      Acil Durum Kişileri ({contacts.length}/3)
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    {contacts.map(contact => (
                      <div key={contact.id} className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                        <div>
                          <div className="font-medium text-sm">{contact.name}</div>
                          <div className="text-xs text-zinc-500 font-mono">{contact.phone}</div>
                        </div>
                        <button onClick={() => removeContact(contact.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {contacts.length < 3 && (
                      <div className="flex flex-col gap-2 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 border-dashed">
                        {isContactPickerSupported && (
                          <button
                            onClick={handleSelectContact}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mb-1"
                          >
                            <Users className="w-4 h-4" />
                            Rehberden Seç
                          </button>
                        )}
                        <input 
                          type="text" 
                          placeholder="İsim" 
                          value={newContactName}
                          onChange={e => setNewContactName(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        <div className="flex gap-2">
                          <input 
                            type="tel" 
                            placeholder="Telefon (Örn: 0555...)" 
                            value={newContactPhone}
                            onChange={e => setNewContactPhone(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          <button 
                            onClick={addContact}
                            disabled={!newContactName || !newContactPhone}
                            className="bg-zinc-800 text-zinc-100 px-4 rounded-lg disabled:opacity-50 hover:bg-zinc-700 transition-colors flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PIN Input */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-500" />
                    Güvenlik PIN Kodu (4 Haneli)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d*"
                    value={userPin}
                    onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Örn: 1234"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-center tracking-[1em] font-mono text-xl"
                  />
                  <p className="text-xs text-zinc-500">Yolculuğu iptal etmek veya uygulamayı kapatmak için gereklidir.</p>
                </div>

                {/* Duress PIN Input */}
                <div className="space-y-3 mt-4">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Tehdit PIN Kodu (Sahte PIN)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d*"
                    value={duressPin}
                    onChange={(e) => setDuressPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Örn: 9999"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors text-center tracking-[1em] font-mono text-xl"
                  />
                  <p className="text-xs text-zinc-500">Zorla şifre sorulursa bunu girin. Uygulama kapanmış gibi görünür ama acil durum SMS'i atar.</p>
                </div>

                <div className="mt-auto pt-6">
                  <button 
                    onClick={startJourney}
                    disabled={contacts.length === 0 || userPin.length !== 4 || duressPin.length !== 4}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-lg shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shield className="w-5 h-5" />
                    Yolculuğu Başlat
                  </button>
                </div>
              </motion.div>
            )}

            {/* ACTIVE STATE */}
            {appState === 'active' && (
              <motion.div 
                key="active"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex-1 flex flex-col items-center justify-center p-6 gap-12"
              >
                <div className="relative flex items-center justify-center">
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }} 
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl"
                  />
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="text-sm text-emerald-400 font-medium tracking-widest uppercase mb-2">Kalan Süre</div>
                    <div className="text-7xl font-mono font-light tracking-tighter text-white">
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    {location ? 'Konum izleniyor' : 'Konum aranıyor...'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    Düşme sensörü aktif
                  </div>
                  
                  <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2 mt-2">
                    <label className="text-xs text-zinc-400 font-medium">Taksi / Araç Plakası (Opsiyonel)</label>
                    <input 
                      type="text" 
                      value={vehicleInfo}
                      onChange={(e) => setVehicleInfo(e.target.value.toUpperCase())}
                      placeholder="Örn: 34 ABC 123"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div className="w-full space-y-4 mt-8">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <button 
                      onClick={toggleSiren}
                      className={`py-3 rounded-2xl font-medium flex flex-col items-center justify-center gap-2 transition-colors ${isSirenPlaying ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'}`}
                    >
                      <Volume2 className={`w-6 h-6 ${isSirenPlaying ? 'animate-pulse' : ''}`} />
                      <span className="text-xs">{isSirenPlaying ? 'Sireni Kapat' : 'Siren Çal'}</span>
                    </button>
                    <button 
                      onClick={startFakeCall}
                      className="py-3 rounded-2xl font-medium flex flex-col items-center justify-center gap-2 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 transition-colors"
                    >
                      <PhoneCall className="w-6 h-6" />
                      <span className="text-xs">Sahte Arama</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => requirePin(cancelJourney)}
                    className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-lg"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Güvenle Vardım
                  </button>
                  <button 
                    onClick={() => {
                      setTriggerReason('Kullanıcı acil durum butonuna bastı.');
                      setAppState('alert');
                      setAlertCountdown(3); // Shorter countdown for manual trigger
                    }}
                    className="w-full bg-transparent border border-red-500/30 text-red-500 hover:bg-red-500/10 font-medium py-3 rounded-2xl transition-colors"
                  >
                    Acil Durum (Hemen Bildir)
                  </button>
                </div>
              </motion.div>
            )}

            {/* ALERT STATE (COUNTDOWN) */}
            {appState === 'alert' && (
              <motion.div 
                key="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-6 bg-red-950/50"
              >
                <motion.div 
                  animate={{ opacity: [1, 0.5, 1] }} 
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute inset-0 bg-red-600/20"
                />
                
                <div className="relative z-10 flex flex-col items-center text-center gap-8">
                  <AlertTriangle className="w-24 h-24 text-red-500 animate-bounce" />
                  
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-red-500">GÜVENDE MİSİNİZ?</h2>
                    <p className="text-zinc-300 text-lg">
                      {triggerReason}
                    </p>
                    <p className="text-zinc-400 text-sm mt-2">
                      Eğer iptal etmezseniz acil durum kişilerinize haber verilecek:
                    </p>
                  </div>

                  <div className="text-8xl font-mono font-bold text-white">
                    {alertCountdown}
                  </div>

                  <div className="flex flex-col gap-3 w-full max-w-xs mt-8">
                    <button 
                      onClick={() => requirePin(() => {
                        setAppState('active');
                        setTimeLeft(5 * 60); // Add 5 minutes
                        setAlertCountdown(10); // Reset alert countdown for next time
                      })}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-colors"
                    >
                      +5 Dakika Ek Süre
                    </button>
                    <button 
                      onClick={() => requirePin(cancelJourney)}
                      className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-4 rounded-2xl transition-colors"
                    >
                      Güvenle Vardım (Bitir)
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TRIGGERED STATE */}
            {appState === 'triggered' && (
              <motion.div 
                key="triggered"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-6"
              >
                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                
                <div>
                  <h2 className="text-3xl font-bold text-red-500 mb-2">ACİL DURUM BİLDİRİLDİ</h2>
                  <p className="text-zinc-300">
                    Konumunuz ve mesajınız seçtiğiniz kişilere iletildi.
                  </p>
                </div>

                {isRecording && (
                  <div className="w-full max-w-xs bg-zinc-900 border border-red-500/50 rounded-2xl p-4 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-red-500 font-medium">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      Ses ve Görüntü Kaydediliyor
                    </div>
                    <p className="text-xs text-zinc-400">
                      Cihazınız şu an kanıt amaçlı ortam kaydı alıyor.
                    </p>
                    <Camera className="w-8 h-8 text-zinc-500" />
                  </div>
                )}

                <div className="w-full max-w-xs space-y-4 mt-4">
                  <a 
                    href={getSmsLink()}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone className="w-5 h-5" />
                    SMS Gönderimini Doğrula
                  </a>
                  
                  <button 
                    onClick={() => requirePin(() => {
                      setAppState('setup');
                      stopTracking();
                      stopListening();
                      stopRecording();
                    })}
                    className="w-full bg-transparent border border-zinc-800 text-zinc-400 hover:bg-zinc-900 font-medium py-3 rounded-2xl transition-colors"
                  >
                    Başa Dön
                  </button>
                </div>
              </motion.div>
            )}

            {/* FAKE CALL STATE */}
            {isFakeCallActive && (
              <motion.div 
                key="fakeCall"
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                className="absolute inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-between py-16 px-6"
              >
                <div className="flex flex-col items-center gap-4 mt-12">
                  <div className="text-zinc-400 text-xl">Gelen Arama</div>
                  <div className="text-4xl font-light text-white">Babam</div>
                  <div className="text-zinc-500">Mobil</div>
                </div>

                <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center mb-12">
                  <Users className="w-16 h-16 text-zinc-600" />
                </div>

                <div className="flex w-full justify-around mb-8">
                  <button 
                    onClick={endFakeCall}
                    className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center animate-pulse"
                  >
                    <Phone className="w-8 h-8 text-white rotate-[135deg]" />
                  </button>
                  <button 
                    onClick={() => {
                      // Just keep the screen but maybe change text to "00:01"
                    }}
                    className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse"
                  >
                    <Phone className="w-8 h-8 text-white" />
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* PIN MODAL */}
          <AnimatePresence>
            {showPinModal && (
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
                    İşlemi onaylamak için belirlediğiniz 4 haneli güvenlik şifresini girin.
                  </p>
                  
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d*"
                    autoFocus
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value.replace(/\D/g, ''));
                      setPinError(false);
                    }}
                    className={`w-full bg-zinc-950 border ${pinError ? 'border-red-500' : 'border-zinc-800'} rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-emerald-500 transition-colors text-center tracking-[1em] font-mono text-3xl`}
                  />
                  {pinError && <p className="text-red-500 text-sm font-medium">Hatalı PIN. Kalan deneme: {3 - pinAttempts}</p>}
                  
                  <div className="flex gap-3 w-full mt-4">
                    <button
                      onClick={() => {
                        setShowPinModal(false);
                        setEnteredPin('');
                        setPinError(false);
                      }}
                      className="flex-1 py-4 rounded-2xl font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => {
                        if (enteredPin === userPin) {
                          setShowPinModal(false);
                          setEnteredPin('');
                          setPinAttempts(0);
                          if (pendingAction) pendingAction();
                        } else if (enteredPin === duressPin && duressPin.length === 4) {
                          // DURESS PIN ENTERED (Tehdit PIN'i)
                          setShowPinModal(false);
                          setEnteredPin('');
                          setPinAttempts(0);
                          
                          // Fake close the app (return to setup screen)
                          setAppState('setup');
                          // DO NOT stop tracking or listening, keep them running secretly
                          // Start recording secretly if not already
                          startRecording();
                          
                          // Trigger SMS with special reason
                          window.location.href = getSmsLink("Kullanıcı tehdit altında sahte PIN (Kurtarma PIN'i) girdi!");
                        } else {
                          const newAttempts = pinAttempts + 1;
                          setPinAttempts(newAttempts);
                          setEnteredPin('');
                          
                          if (newAttempts >= 3) {
                            setShowPinModal(false);
                            setTriggerReason('Şifre 3 kez hatalı girildi! Telefon zorla alınmış olabilir.');
                            setAppState('triggered');
                            setAlertCountdown(0);
                          } else {
                            setPinError(true);
                          }
                        }
                      }}
                      className="flex-1 py-4 rounded-2xl font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors"
                    >
                      Onayla
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
