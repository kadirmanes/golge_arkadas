import { useState, useEffect, useCallback, useRef } from 'react';

export function useFallDetection(onFallDetected: () => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      setIsSupported(true);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setPermissionGranted(true);
          return true;
        } else {
          setPermissionGranted(false);
          return false;
        }
      } catch (error) {
        console.error('Error requesting device motion permission:', error);
        setPermissionGranted(false);
        return false;
      }
    } else {
      // Non-iOS 13+ devices
      setPermissionGranted(true);
      return true;
    }
  };

  const lastFallTimeRef = useRef<number>(0);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!event.accelerationIncludingGravity) return;

    const { x, y, z } = event.accelerationIncludingGravity;
    if (x === null || y === null || z === null) return;

    const acceleration = Math.sqrt(x * x + y * y + z * z);

    // 25 m/s² eşiği + 5 saniyelik debounce (yanlış alarm önleme)
    if (acceleration > 25) {
      const now = Date.now();
      if (now - lastFallTimeRef.current > 5000) {
        lastFallTimeRef.current = now;
        onFallDetected();
      }
    }
  }, [onFallDetected]);

  const startListening = useCallback(async () => {
    if (!isSupported) return;
    
    let hasPermission = permissionGranted;
    if (hasPermission === null) {
      hasPermission = await requestPermission();
    }

    if (hasPermission) {
      window.addEventListener('devicemotion', handleMotion);
      setIsListening(true);
    }
  }, [isSupported, permissionGranted, handleMotion]);

  const stopListening = useCallback(() => {
    window.removeEventListener('devicemotion', handleMotion);
    setIsListening(false);
  }, [handleMotion]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isSupported,
    isListening,
    permissionGranted,
    requestPermission,
    startListening,
    stopListening
  };
}
