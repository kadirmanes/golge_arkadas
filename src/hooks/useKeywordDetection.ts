import { useRef, useEffect, useCallback } from 'react';

/**
 * Sürekli ses dinleyerek belirli bir kelimeyi arka arkaya 2 kez duyunca callback tetikler.
 * Android WebView'de webkitSpeechRecognition kullanır, Türkçe dil desteği var.
 */
export function useKeywordDetection(
  keyword: string,
  onDetected: () => void,
  active: boolean
) {
  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(active);
  const onDetectedRef = useRef(onDetected);
  const lastKeywordTimeRef = useRef(0);
  const keywordCountRef = useRef(0);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  const startRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript: string = event.results[i][0].transcript.toLowerCase();
        if (transcript.includes(keyword.toLowerCase())) {
          const now = Date.now();
          // 5 saniye içinde 2. tespit → acil durum
          if (now - lastKeywordTimeRef.current > 5000) {
            keywordCountRef.current = 1;
          } else {
            keywordCountRef.current++;
          }
          lastKeywordTimeRef.current = now;

          if (keywordCountRef.current >= 2) {
            keywordCountRef.current = 0;
            onDetectedRef.current();
          }
          break;
        }
      }
    };

    recognition.onend = () => {
      // Android'de tanıma sessizlik sonrası durur; aktifse yeniden başlat
      if (activeRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try { recognition.start(); } catch { /* zaten çalışıyor */ }
        }, 300);
      }
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' hatası normaldir, yeniden başlatmayı onend halleder
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // Mikrofon izni yok — sessizce dur
        activeRef.current = false;
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch { /* ignore */ }
  }, [keyword]);

  const stopRecognition = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (active) {
      startRecognition();
    } else {
      stopRecognition();
    }
    return () => stopRecognition();
  }, [active, startRecognition, stopRecognition]);

  const isSupported = !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );

  return { isSupported };
}
