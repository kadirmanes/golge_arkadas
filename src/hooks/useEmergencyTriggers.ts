import { useCallback, useState } from 'react';
import { useFallDetection } from './useFallDetection';
import { useKeywordDetection } from './useKeywordDetection';
import type { AppState } from '../types';

interface UseEmergencyTriggersParams {
  appState: AppState;
  onAlert: (reason: string, countdown?: number) => void;
  triggerEmergency: (reason: string) => void;
}

export const useEmergencyTriggers = ({
  appState,
  onAlert,
  triggerEmergency,
}: UseEmergencyTriggersParams) => {
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [lastSecretTap, setLastSecretTap] = useState(0);

  const handleKeywordDetected = useCallback(() => {
    if (appState === 'active') {
      onAlert('Sesli komut algilandi: "Imdat"', 10);
    }
  }, [appState, onAlert]);

  const handleFallDetected = useCallback(() => {
    if (appState === 'active') {
      onAlert('Sert bir dusus algilandi!', 10);
    }
  }, [appState, onAlert]);

  const handleSecretTap = useCallback(() => {
    const now = Date.now();
    if (now - lastSecretTap > 1000) {
      setSecretTapCount(1);
    } else {
      const newCount = secretTapCount + 1;
      setSecretTapCount(newCount);
      if (newCount >= 5) {
        const reason = 'Kullanici GIZLI PANIK (5 dokunus) alarmini tetikledi!';
        triggerEmergency(reason);
        setSecretTapCount(0);
      }
    }
    setLastSecretTap(now);
  }, [lastSecretTap, secretTapCount, triggerEmergency]);

  useKeywordDetection('imdat', handleKeywordDetected, appState === 'active');
  const { startListening, stopListening, isSupported, requestPermission } = useFallDetection(handleFallDetected);

  return {
    handleSecretTap,
    startListening,
    stopListening,
    isSupported,
    requestPermission,
  };
};
