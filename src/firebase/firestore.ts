import {
  doc, setDoc, getDoc, updateDoc, addDoc,
  collection, query, where, getDocs, onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User } from 'firebase/auth';
import { db, storage } from './config';
import type { AppUser, Journey, JourneyLocation, WatchRequest, WatchRelationship } from '../types';

// ─── Kullanıcı ───────────────────────────────────────────────────────────────

export const upsertUser = async (user: User, displayName?: string) => {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: displayName ?? user.displayName ?? user.email?.split('@')[0],
      fcmToken: null,
      createdAt: serverTimestamp(),
    });
  }
};

export const saveFcmToken = async (uid: string, token: string) => {
  await updateDoc(doc(db, 'users', uid), { fcmToken: token });
};

export const savePhoneNumber = async (uid: string, phoneNumber: string) => {
  await updateDoc(doc(db, 'users', uid), { phoneNumber });
};

export const saveDisplayName = async (uid: string, displayName: string) => {
  await updateDoc(doc(db, 'users', uid), { displayName });
};

export const getUserById = async (uid: string): Promise<AppUser | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as AppUser;
};

export const getUserByEmail = async (email: string): Promise<AppUser | null> => {
  const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as AppUser;
};

// Telefon numarasını uluslararası formata normalize et (Türkiye)
const normalizePhone = (p: string): string => {
  const d = p.replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) return '+' + d;
  if (d.startsWith('0') && d.length === 11) return '+90' + d.slice(1);
  if (d.length === 10) return '+90' + d;
  return p.startsWith('+') ? p : '+' + d;
};

export const searchUsers = async (term: string, excludeUid: string): Promise<AppUser[]> => {
  if (term.length < 2) return [];
  const termLower = term.toLowerCase().trim();
  const isPhone = /^[\d\s\+\-\(\)]{7,}$/.test(term.trim());

  // Email ile ara (tam eşleşme)
  const byEmail = query(collection(db, 'users'), where('email', '==', termLower));
  // İsim ile ara (prefix)
  const byName = query(
    collection(db, 'users'),
    where('displayName', '>=', term),
    where('displayName', '<=', term + '\uf8ff')
  );

  const queries: Promise<any>[] = [getDocs(byEmail), getDocs(byName)];

  // Telefon numarasıyla da ara
  if (isPhone) {
    const normalized = normalizePhone(term.trim());
    queries.push(getDocs(query(collection(db, 'users'), where('phoneNumber', '==', normalized))));
  }

  const snaps = await Promise.all(queries);
  const seen = new Set<string>();
  const results: AppUser[] = [];

  snaps.flatMap(s => s.docs).forEach((d: any) => {
    const user = d.data() as AppUser;
    if (!seen.has(user.uid) && user.uid !== excludeUid) {
      seen.add(user.uid);
      results.push(user);
    }
  });

  return results.slice(0, 5);
};

// ─── Journey ─────────────────────────────────────────────────────────────────

export const createJourney = async (
  userId: string,
  displayName: string,
  durationMinutes: number,
  vehicleInfo: string,
  contactUids: string[] = []
): Promise<string> => {
  // Önceki aktif/tetiklenmiş yolculukları temizle
  const oldQ = query(
    collection(db, 'journeys'),
    where('userId', '==', userId),
    where('status', 'in', ['active', 'alert', 'triggered'])
  );
  const oldSnap = await getDocs(oldQ);
  await Promise.all(
    oldSnap.docs.map(d =>
      updateDoc(d.ref, { status: 'ended', endedAt: serverTimestamp() })
    )
  );

  const ref = await addDoc(collection(db, 'journeys'), {
    userId,
    displayName,
    status: 'active',
    startedAt: serverTimestamp(),
    endedAt: null,
    durationMinutes,
    vehicleInfo,
    triggerReason: null,
    location: null,
    contactUids,
  });
  return ref.id;
};

export const updateJourneyLocation = async (journeyId: string, loc: JourneyLocation) => {
  await updateDoc(doc(db, 'journeys', journeyId), {
    location: { ...loc, updatedAt: serverTimestamp() },
  });
};

export const updateJourneyStatus = async (
  journeyId: string,
  status: Journey['status'],
  triggerReason?: string
) => {
  const data: Record<string, unknown> = { status };
  if (triggerReason) data.triggerReason = triggerReason;
  if (status === 'ended') data.endedAt = serverTimestamp();
  await updateDoc(doc(db, 'journeys', journeyId), data);
};

export const uploadEmergencyAudio = async (journeyId: string, audioBlob: Blob) => {
  const fileRef = ref(storage, `emergencies/${journeyId}/audio_${Date.now()}.webm`);
  await uploadBytes(fileRef, audioBlob);
  const url = await getDownloadURL(fileRef);
  await updateDoc(doc(db, 'journeys', journeyId), { emergencyAudioUrl: url });
  return url;
};

export const subscribeToJourney = (
  journeyId: string,
  callback: (journey: Journey | null) => void
) => {
  return onSnapshot(doc(db, 'journeys', journeyId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    callback({ id: snap.id, ...snap.data() } as Journey);
  });
};

export const subscribeToActiveJourneyForUser = (
  userId: string,
  callback: (journey: Journey | null) => void
) => {
  const q = query(
    collection(db, 'journeys'),
    where('userId', '==', userId),
    where('status', 'in', ['active', 'alert', 'triggered'])
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) { callback(null); return; }
    // En son başlayan yolculuğu seç
    const sorted = snap.docs.sort((a, b) => {
      const aT = (a.data().startedAt as any)?.seconds ?? 0;
      const bT = (b.data().startedAt as any)?.seconds ?? 0;
      return bT - aT;
    });
    const latest = sorted[0];
    callback({ id: latest.id, ...latest.data() } as Journey);
  });
};

// ─── Watch Requests ───────────────────────────────────────────────────────────

export const sendWatchRequest = async (
  fromUserId: string,
  fromEmail: string,
  fromDisplayName: string,
  toEmail: string
): Promise<'sent' | 'not_found' | 'already_exists'> => {
  const toUser = await getUserByEmail(toEmail);
  if (!toUser) return 'not_found';

  // Zaten var mı?
  const existing = query(
    collection(db, 'watchRequests'),
    where('fromUserId', '==', fromUserId),
    where('toUserId', '==', toUser.uid),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(existing);
  if (!snap.empty) return 'already_exists';

  await addDoc(collection(db, 'watchRequests'), {
    fromUserId,
    fromEmail,
    fromDisplayName,
    toUserId: toUser.uid,
    toEmail: toUser.email,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return 'sent';
};

export const respondToWatchRequest = async (
  requestId: string,
  accept: boolean,
  fromUserId: string,
  toUserId: string
) => {
  await updateDoc(doc(db, 'watchRequests', requestId), {
    status: accept ? 'accepted' : 'rejected',
  });
  if (accept) {
    // Çift yönlü: ikisi de birbirini izleyebilir
    await Promise.all([
      addDoc(collection(db, 'watchRelationships'), {
        protectedUserId: fromUserId,
        watcherUserId: toUserId,
        createdAt: serverTimestamp(),
      }),
      addDoc(collection(db, 'watchRelationships'), {
        protectedUserId: toUserId,
        watcherUserId: fromUserId,
        createdAt: serverTimestamp(),
      }),
    ]);
  }
};

/** Benim gönderdiğim bekleyen istekler */
export const subscribeToPendingSentRequests = (
  fromUserId: string,
  callback: (requests: WatchRequest[]) => void
) => {
  const q = query(
    collection(db, 'watchRequests'),
    where('fromUserId', '==', fromUserId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as WatchRequest)));
  });
};

export const subscribeToPendingRequests = (
  toUserId: string,
  callback: (requests: WatchRequest[]) => void
) => {
  const q = query(
    collection(db, 'watchRequests'),
    where('toUserId', '==', toUserId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as WatchRequest)));
  });
};

/** Beni izlemeyi kabul etmiş kullanıcıların UID listesini döner */
export const getMyWatchers = async (protectedUserId: string): Promise<string[]> => {
  const q = query(
    collection(db, 'watchRelationships'),
    where('protectedUserId', '==', protectedUserId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().watcherUserId as string);
};

/** Birden fazla kullanıcının profilini UID listesiyle çeker */
export const getUsersByIds = async (uids: string[]): Promise<AppUser[]> => {
  if (uids.length === 0) return [];
  // Firestore 'in' sorgusu maks 30 eleman destekler
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
  const results: AppUser[] = [];
  for (const chunk of chunks) {
    const q = query(collection(db, 'users'), where('uid', 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push(d.data() as AppUser));
  }
  return results;
};

export const subscribeToWatchRelationships = (
  watcherUserId: string,
  callback: (rels: WatchRelationship[]) => void
) => {
  const q = query(
    collection(db, 'watchRelationships'),
    where('watcherUserId', '==', watcherUserId)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as WatchRelationship)));
  });
};

// ─── Watcher: izlenen yolculuklar ────────────────────────────────────────────

export const subscribeToWatchedJourneys = (
  watcherUid: string,
  callback: (active: import('../types').Journey[], past: import('../types').Journey[]) => void
) => {
  const q = query(
    collection(db, 'journeys'),
    where('contactUids', 'array-contains', watcherUid)
  );
  return onSnapshot(q, (snap) => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('../types').Journey));
    const active = all
      .filter(j => j.status === 'active' || j.status === 'alert' || j.status === 'triggered')
      .sort((a, b) => {
        const aT = (a.startedAt as any)?.seconds ?? 0;
        const bT = (b.startedAt as any)?.seconds ?? 0;
        return bT - aT;
      });
    const past = all
      .filter(j => j.status === 'ended')
      .sort((a, b) => {
        const aT = (a.startedAt as any)?.seconds ?? 0;
        const bT = (b.startedAt as any)?.seconds ?? 0;
        return bT - aT;
      })
      .slice(0, 20);
    callback(active, past);
  });
};
