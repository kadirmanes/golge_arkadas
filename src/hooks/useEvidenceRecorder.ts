import { useState, useRef, useCallback } from 'react';

export const useEvidenceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Stream'i dışarıya ver — WebRTC aynı stream'i kullanabilsin
  const getStream = () => streamRef.current;

  // Android'de kamera/mikrofon iznini önceden iste — stream'i KAPATMA, sakla
  // Böylece acil durumda ikinci getUserMedia gerekmez (WebView permission sıfırlanmaz)
  const preRequestPermissions = async () => {
    console.log('[CAM] preRequestPermissions: mediaDevices=', !!navigator.mediaDevices?.getUserMedia);
    if (!navigator.mediaDevices?.getUserMedia) return false;
    if (streamRef.current) return true; // zaten açık
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[CAM] preRequestPermissions: izin alındı, track sayısı=', stream.getTracks().length);
      streamRef.current = stream; // KAPAT MA — sakla, acil durumda kullanılacak
      return true;
    } catch (err: any) {
      console.error('[CAM] preRequestPermissions hatası:', err?.name, err?.message);
      return false;
    }
  };

  const startRecording = useCallback(async (existingStream?: MediaStream) => {
    console.log('[CAM] startRecording çağrıldı, isRecording=', isRecording);
    if (isRecording) return streamRef.current;
    try {
      // Öncelik: dışarıdan verilen stream → önceden açık olan stream → yeni getUserMedia
      const stream = existingStream
        ?? streamRef.current
        ?? await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[CAM] stream alındı, track sayısı=', stream.getTracks().length);
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('[CAM] kayıt başladı');
      return stream; // stream'i döndür
    } catch (err: any) {
      console.error('[CAM] Kamera/Mikrofon erişim hatası:', err?.name, err?.message, err);
      return null;
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, [isRecording]);

  return { isRecording, videoUrl, getStream, preRequestPermissions, startRecording, stopRecording };
};
