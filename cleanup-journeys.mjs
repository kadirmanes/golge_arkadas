// Eski stuck yolculukları temizle
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB4FuMpdr0acy4eJgrqf4eizglIzbxzVbo',
  authDomain: 'golge-arkadas.firebaseapp.com',
  projectId: 'golge-arkadas',
  storageBucket: 'golge-arkadas.firebasestorage.app',
  messagingSenderId: '13928769495',
  appId: '1:13928769495:web:40bc8c8e9e6a82bdd0cd92',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 17 Mart 2026 saat 00:00 UTC = bu günden önceki yolculuklar
const cutoffDate = new Date('2026-03-17T00:00:00Z');

const q = query(
  collection(db, 'journeys'),
  where('status', 'in', ['triggered', 'active', 'alert'])
);

const snap = await getDocs(q);
console.log(`Toplam aktif/triggered yolculuk: ${snap.size}`);

let cleaned = 0;
for (const d of snap.docs) {
  const data = d.data();
  const startedAt = data.startedAt?.toDate?.() ?? new Date(0);

  if (startedAt < cutoffDate) {
    console.log(`Temizleniyor: ${d.id} | ${data.status} | ${startedAt.toLocaleString('tr-TR')}`);
    await updateDoc(doc(db, 'journeys', d.id), {
      status: 'ended',
      endedAt: new Date()
    });
    cleaned++;
  } else {
    console.log(`Aktif bırakıldı: ${d.id} | ${data.status} | ${startedAt.toLocaleString('tr-TR')}`);
  }
}

console.log(`\n✓ ${cleaned} eski yolculuk temizlendi.`);
process.exit(0);
