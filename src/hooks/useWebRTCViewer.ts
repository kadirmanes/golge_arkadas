/**
 * useWebRTCViewer
 * Watcher tarafı — tehlikedeki kişinin kamera stream'ini alır.
 * Firebase Firestore'daki offer'ı okur, answer yazar, stream'i döner.
 */
import { useEffect, useRef, useState } from 'react';
import {
  doc, onSnapshot, updateDoc, addDoc, collection
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ICE_SERVERS = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
};

export function useWebRTCViewer(journeyId: string | null) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!journeyId) return;

    // Journey dokümanını dinle — offer gelince bağlan
    const unsubJourney = onSnapshot(doc(db, 'journeys', journeyId), async (snap) => {
      const data = snap.data();
      const offer = data?.webrtc?.offer;

      if (!offer || pcRef.current) return; // offer yoksa veya zaten bağlıysa

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Gelen stream'i al
      const stream = new MediaStream();
      setRemoteStream(stream);

      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          if (!stream.getTracks().find(t => t.id === track.id)) {
            stream.addTrack(track);
          }
        });
      };

      pc.onconnectionstatechange = () => {
        setIsConnected(pc.connectionState === 'connected');
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setIsConnected(false);
        }
      };

      // Kendi ICE adaylarını Firestore'a yaz — setLocalDescription öncesinde set et
      const calleeCandidatesRef = collection(db, 'journeys', journeyId, 'calleeCandidates');
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await addDoc(calleeCandidatesRef, event.candidate.toJSON()).catch(() => {});
        }
      };

      // Offer'ı uygula
      await pc.setRemoteDescription(new RTCSessionDescription(offer)).catch(() => {});

      // Answer oluştur ve Firestore'a yaz
      const answer = await pc.createAnswer().catch(() => null);
      if (!answer) return;
      await pc.setLocalDescription(answer).catch(() => {});

      await updateDoc(doc(db, 'journeys', journeyId), {
        'webrtc.answer': { type: answer.type, sdp: answer.sdp },
      }).catch(() => {});

      // Streamer'ın ICE adaylarını dinle
      const unsubCandidates = onSnapshot(
        collection(db, 'journeys', journeyId, 'callerCandidates'),
        (snap) => {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
            }
          });
        }
      );
      unsubsRef.current.push(unsubCandidates);
    });

    unsubsRef.current.push(unsubJourney);

    return () => {
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
      pcRef.current?.close();
      pcRef.current = null;
      setRemoteStream(null);
      setIsConnected(false);
    };
  }, [journeyId]);

  return { remoteStream, isConnected };
}
