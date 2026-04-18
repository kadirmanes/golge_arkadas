import { useCallback, useEffect, useRef, useState } from 'react';

export const useAlarmController = () => {
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const sirenCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    sirenCtxRef.current?.close();
    sirenCtxRef.current = null;
    setIsSirenPlaying(false);
  }, []);

  const startSiren = useCallback(() => {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtor();
    sirenCtxRef.current = ctx;
    let isHigh = false;

    const playTone = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.value = isHigh ? 960 : 440;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.42);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
      isHigh = !isHigh;
    };

    playTone();
    sirenIntervalRef.current = setInterval(playTone, 450);
    setIsSirenPlaying(true);
  }, []);

  const toggleSiren = useCallback(() => {
    if (isSirenPlaying) {
      stopSiren();
      return;
    }
    startSiren();
  }, [isSirenPlaying, startSiren, stopSiren]);

  useEffect(() => stopSiren, [stopSiren]);

  return {
    isSirenPlaying,
    toggleSiren,
    stopSiren,
  };
};
