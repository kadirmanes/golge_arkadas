/**
 * useWebRTCStreamer
 * Tehlikedeki kişinin kamera stream'ini WebRTC ile izleyene iletir.
 * Kamerayı kendin açmaz — dışarıdan hazır stream alır (useEvidenceRecorder ile paylaşım).
 */
import { useRef, useState } from 'react';
import {
  doc, updateDoc, addDoc, collection, onSnapshot, deleteDoc, getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ICE_SERVERS = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
};

export function useWebRTCStreamer() {
  const [isStreaming, setIsStreaming] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);

  /**
   * stream: useEvidenceRecorder'dan gelen hazır kamera stream'i
   * journeyId: Firestore'a offer yazılacak journey ID'si
   */
  const startStream = async (journeyId: string, stream: MediaStream) => {
    console.log('[RTC] startStream çağrıldı, journeyId=', journeyId, 'tracks=', stream.getTracks().length);
    if (pcRef.current) { console.log('[RTC] zaten bağlı, çıkılıyor'); return; }
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Track'leri ekle
      stream.getTracks().forEach(track => {
        console.log('[RTC] track ekleniyor:', track.kind, track.readyState);
        pc.addTrack(track, stream);
      });

      // ICE adaylarını Firestore'a yaz
      const callerCandidatesRef = collection(db, 'journeys', journeyId, 'callerCandidates');
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('[RTC] ICE aday yazılıyor:', event.candidate.type);
          await addDoc(callerCandidatesRef, event.candidate.toJSON()).catch(() => {});
        }
      };
      pc.oniceconnectionstatechange = () => console.log('[RTC] ICE state:', pc.iceConnectionState);
      pc.onconnectionstatechange = () => console.log('[RTC] connection state:', pc.connectionState);

      // Offer oluştur ve Firestore'a yaz
      const offer = await pc.createOffer();
      console.log('[RTC] offer oluşturuldu');
      await pc.setLocalDescription(offer);
      console.log('[RTC] localDescription set edildi');

      await updateDoc(doc(db, 'journeys', journeyId), {
        'webrtc.offer': { type: offer.type, sdp: offer.sdp },
        'webrtc.answer': null,
      }).then(() => console.log('[RTC] offer Firestore\'a yazıldı')).catch(e => console.error('[RTC] offer yazma hatası:', e));

      // Watcher'ın answer'ını bekle
      const unsubAnswer = onSnapshot(doc(db, 'journeys', journeyId), async (snap) => {
        const answer = snap.data()?.webrtc?.answer;
        if (answer && !pc.currentRemoteDescription) {
          console.log('[RTC] answer alındı, remoteDescription set ediliyor');
          await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(e => console.error('[RTC] setRemoteDescription hatası:', e));
        }
      });
      unsubsRef.current.push(unsubAnswer);

      // Watcher'ın ICE adaylarını dinle
      const unsubCandidates = onSnapshot(
        collection(db, 'journeys', journeyId, 'calleeCandidates'),
        (snap) => {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
            }
          });
        }
      );
      unsubsRef.current.push(unsubCandidates);

      setIsStreaming(true);
    } catch (err) {
      console.warn('WebRTC streamer başlatılamadı:', err);
    }
  };

  const stopStream = async (journeyId?: string) => {
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    pcRef.current?.close();
    pcRef.current = null;
    setIsStreaming(false);

    if (journeyId) {
      await updateDoc(doc(db, 'journeys', journeyId), {
        'webrtc.offer': null,
        'webrtc.answer': null,
      }).catch(() => {});
      for (const col of ['callerCandidates', 'calleeCandidates']) {
        const snap = await getDocs(collection(db, 'journeys', journeyId, col)).catch(() => null);
        snap?.docs.forEach(d => deleteDoc(d.ref).catch(() => {}));
      }
    }
  };

  return { isStreaming, startStream, stopStream };
}
