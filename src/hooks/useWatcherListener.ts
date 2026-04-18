import { useEffect, useState } from 'react';
import { subscribeToWatchRelationships, subscribeToActiveJourneyForUser } from '../firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { WatchedUserStatus, WatchRelationship } from '../types';

export const useWatcherListener = (watcherUserId: string | undefined) => {
  const [watchedUsers, setWatchedUsers] = useState<WatchedUserStatus[]>([]);

  useEffect(() => {
    if (!watcherUserId) return;

    const journeyUnsubs: (() => void)[] = [];

    const relUnsub = subscribeToWatchRelationships(watcherUserId, async (rels) => {
      // Önceki journey dinleyicilerini temizle
      journeyUnsubs.forEach(u => u());
      journeyUnsubs.length = 0;

      const initialStatuses: WatchedUserStatus[] = await Promise.all(
        rels.map(async (rel) => {
          const userSnap = await getDoc(doc(db, 'users', rel.protectedUserId));
          const userData = userSnap.data();
          return {
            relationshipId: rel.id,
            userId: rel.protectedUserId,
            displayName: userData?.displayName ?? 'Bilinmeyen',
            email: userData?.email ?? '',
            activeJourney: null,
          };
        })
      );

      setWatchedUsers(initialStatuses);

      // Her korunan kişi için journey dinleyicisi kur
      rels.forEach((rel, idx) => {
        const unsub = subscribeToActiveJourneyForUser(rel.protectedUserId, (journey) => {
          setWatchedUsers(prev => {
            const updated = [...prev];
            if (updated[idx]) {
              updated[idx] = { ...updated[idx], activeJourney: journey };
            }
            return updated;
          });
        });
        journeyUnsubs.push(unsub);
      });
    });

    return () => {
      relUnsub();
      journeyUnsubs.forEach(u => u());
    };
  }, [watcherUserId]);

  return { watchedUsers };
};
