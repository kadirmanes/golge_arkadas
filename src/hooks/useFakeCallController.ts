import { useCallback, useEffect, useRef, useState } from 'react';

export type FakeCallState = 'idle' | 'ringing' | 'active';

const FAKE_CALL_NAME_KEY = 'golgeArkadasFakeCallName';

export const useFakeCallController = () => {
  const [fakeCallState, setFakeCallState] = useState<FakeCallState>('idle');
  const [fakeCallDuration, setFakeCallDuration] = useState(0);
  const [fakeCallName, setFakeCallName] = useState('Babam');

  const fakeCallCtxRef = useRef<AudioContext | null>(null);
  const fakeCallRingtoneRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeCallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRingtone = useCallback(() => {
    if (fakeCallRingtoneRef.current) {
      clearInterval(fakeCallRingtoneRef.current);
      fakeCallRingtoneRef.current = null;
    }
    fakeCallCtxRef.current?.close();
    fakeCallCtxRef.current = null;
  }, []);

  const startFakeCallRingtone = useCallback(() => {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtor();
    fakeCallCtxRef.current = ctx;

    const playRing = () => {
      const playBeep = (time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.35);
        osc.start(time);
        osc.stop(time + 0.35);
      };

      const now = ctx.currentTime;
      playBeep(now);
      playBeep(now + 0.5);
    };

    playRing();
    fakeCallRingtoneRef.current = setInterval(playRing, 3000);
  }, []);

  const startFakeCall = useCallback(() => {
    setFakeCallState('ringing');
    setFakeCallDuration(0);
    startFakeCallRingtone();
  }, [startFakeCallRingtone]);

  const answerFakeCall = useCallback(() => {
    stopRingtone();
    setFakeCallState('active');
    fakeCallTimerRef.current = setInterval(() => setFakeCallDuration((prev) => prev + 1), 1000);
  }, [stopRingtone]);

  const endFakeCall = useCallback(() => {
    stopRingtone();
    if (fakeCallTimerRef.current) {
      clearInterval(fakeCallTimerRef.current);
      fakeCallTimerRef.current = null;
    }
    setFakeCallState('idle');
    setFakeCallDuration(0);
  }, [stopRingtone]);

  useEffect(() => {
    const savedName = localStorage.getItem(FAKE_CALL_NAME_KEY);
    if (savedName) setFakeCallName(savedName);
  }, []);

  useEffect(() => {
    localStorage.setItem(FAKE_CALL_NAME_KEY, fakeCallName);
  }, [fakeCallName]);

  useEffect(() => endFakeCall, [endFakeCall]);

  return {
    fakeCallState,
    fakeCallDuration,
    fakeCallName,
    setFakeCallName,
    startFakeCall,
    answerFakeCall,
    endFakeCall,
  };
};

