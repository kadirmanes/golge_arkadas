import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { createJourney, updateJourneyStatus } from '../firebase/firestore';
import type { AppState, ExtendedContact } from '../types';

interface UseJourneyLifecycleParams {
  currentUser: User | null;
  contacts: ExtendedContact[];
  vehicleInfo: string;
  onEmergency: (reason: string) => void;
}

export const useJourneyLifecycle = ({
  currentUser,
  contacts,
  vehicleInfo,
  onEmergency,
}: UseJourneyLifecycleParams) => {
  const [appState, setAppState] = useState<AppState>('setup');
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [timeLeft, setTimeLeft] = useState(0);
  const [alertCountdown, setAlertCountdown] = useState(10);
  const [triggerReason, setTriggerReason] = useState('');
  const [checkInActive, setCheckInActive] = useState(false);
  const [checkInCountdown, setCheckInCountdown] = useState(60);

  const checkInIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkInTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppState>('setup');

  useEffect(() => { appStateRef.current = appState; }, [appState]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (appState === 'active' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            const reason = 'Belirlenen sure doldu!';
            setTriggerReason(reason);
            setAppState('alert');
            setAlertCountdown(10);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, timeLeft]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (appState === 'alert' && alertCountdown > 0) {
      interval = setInterval(() => {
        setAlertCountdown((prev) => {
          if (prev <= 1) {
            setAppState('triggered');
            if (journeyId) updateJourneyStatus(journeyId, 'triggered', triggerReason);
            onEmergency(triggerReason);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, alertCountdown, journeyId, triggerReason, onEmergency]);

  useEffect(() => {
    if (appState === 'active') {
      checkInIntervalRef.current = setInterval(() => {
        setCheckInActive(true);
        setCheckInCountdown(60);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([500, 200, 500]);
        }
      }, 15 * 60 * 1000);
    } else {
      setCheckInActive(false);
      if (checkInIntervalRef.current) clearInterval(checkInIntervalRef.current);
    }
    return () => {
      if (checkInIntervalRef.current) clearInterval(checkInIntervalRef.current);
    };
  }, [appState]);

  useEffect(() => {
    if (checkInActive && checkInCountdown > 0) {
      checkInTimerRef.current = setInterval(() => {
        setCheckInCountdown((prev) => {
          if (prev <= 1) {
            setCheckInActive(false);
            setTriggerReason('Periyodik "Iyi misin?" kontrolune yanit verilmedi!');
            setAppState('alert');
            setAlertCountdown(10);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (checkInTimerRef.current) {
      clearInterval(checkInTimerRef.current);
    }

    return () => {
      if (checkInTimerRef.current) clearInterval(checkInTimerRef.current);
    };
  }, [checkInActive, checkInCountdown]);

  const startJourney = async () => {
    if (contacts.length === 0) {
      alert('En az bir acil durum kisisi ekleyin.');
      return false;
    }

    const id = await createJourney(
      currentUser!.uid,
      currentUser!.displayName ?? currentUser!.email ?? 'Kullanici',
      durationMinutes,
      vehicleInfo,
      contacts.map((c) => c.userId).filter(Boolean) as string[]
    );

    setJourneyId(id);
    setTimeLeft(durationMinutes * 60);
    setAppState('active');
    return true;
  };

  const cancelJourney = () => {
    if (journeyId) updateJourneyStatus(journeyId, 'ended');
    setJourneyId(null);
    setAppState('setup');
    setCheckInActive(false);
  };

  const activateAlert = (reason: string, countdown = 10) => {
    if (appStateRef.current !== 'active') {
      console.warn('[activateAlert] ignored — state:', appStateRef.current, '| reason:', reason);
      return;
    }
    setTriggerReason(reason);
    setAppState('alert');
    setAlertCountdown(countdown);
  };

  const markTriggered = (reason: string) => {
    setTriggerReason(reason);
    setAppState('triggered');
    if (journeyId) updateJourneyStatus(journeyId, 'triggered', reason);
  };

  const setSetupState = () => {
    setJourneyId(null);
    setAppState('setup');
    setCheckInActive(false);
  };

  const setActiveState = (countdown = 10) => {
    setAppState('active');
    setAlertCountdown(countdown);
  };

  const markActive = () => {
    setActiveState(10);
    if (journeyId) updateJourneyStatus(journeyId, 'active', undefined);
  };

  return {
    appState,
    journeyId,
    durationMinutes,
    setDurationMinutes,
    timeLeft,
    setTimeLeft,
    alertCountdown,
    triggerReason,
    checkInActive,
    setCheckInActive,
    checkInCountdown,
    setCheckInCountdown,
    startJourney,
    cancelJourney,
    activateAlert,
    markTriggered,
    markActive,
    setSetupState,
    setActiveState,
  };
};
