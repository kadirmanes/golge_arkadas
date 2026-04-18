import { useEffect, useRef } from 'react';
import { updateJourneyLocation } from '../firebase/firestore';
import type { JourneyLocation } from '../types';
import { Device } from '@capacitor/device';

export const useFirestoreJourney = (
  journeyId: string | null,
  location: JourneyLocation | null
) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!journeyId || !location) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // İlk güncelleme hemen
    const syncLocationDb = async () => {
      let batteryLevel;
      try {
        const info = await Device.getBatteryInfo();
        batteryLevel = info.batteryLevel ? Math.round(info.batteryLevel * 100) : undefined;
      } catch (e) {
        // Platform desteklemiyor olabilir
      }
      updateJourneyLocation(journeyId, { ...location, batteryLevel }).catch(console.error);
    };

    syncLocationDb();

    intervalRef.current = setInterval(() => {
      syncLocationDb();
    }, 10_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [journeyId, location]);
};
