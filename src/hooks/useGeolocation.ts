import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export function useGeolocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<string | number | null>(null);

  const startTracking = useCallback(async () => {
    setIsTracking(true);
    setError(null);

    if (Capacitor.isNativePlatform()) {
      // ─── Native Android / iOS ────────────────────────────────────────────
      try {
        await Geolocation.requestPermissions();
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000 },
          (pos, err) => {
            if (err) {
              setError(err.message);
              setIsTracking(false);
              return;
            }
            if (pos) {
              setLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp,
              });
            }
          }
        );
        watchIdRef.current = id;
      } catch (e: any) {
        setError(e?.message ?? 'Konum izni alınamadı');
        setIsTracking(false);
      }
    } else {
      // ─── Web ─────────────────────────────────────────────────────────────
      if (!navigator.geolocation) {
        setError('Tarayıcınız konum servisini desteklemiyor');
        setIsTracking(false);
        return;
      }
      const id = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (err) => {
          setError(err.message);
          setIsTracking(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      watchIdRef.current = id;
    }
  }, []);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: watchIdRef.current as string });
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current as number);
      }
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return { location, error, isTracking, startTracking, stopTracking };
}
