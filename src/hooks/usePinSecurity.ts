import { useState } from 'react';

type PendingAction = (() => void) | null;

interface UsePinSecurityParams {
  onDuressPin: () => void;
  onMaxAttempts: (reason: string) => void;
}

export const usePinSecurity = ({ onDuressPin, onMaxAttempts }: UsePinSecurityParams) => {
  const [userPin, setUserPin] = useState('');
  const [duressPin, setDuressPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingWrongAction, setPendingWrongAction] = useState<PendingAction>(null);

  const requirePin = (action: () => void, onWrong?: () => void) => {
    setPendingAction(() => action);
    setPendingWrongAction(onWrong ? () => onWrong : null);
    setEnteredPin('');
    setPinError(false);
    setShowPinModal(true);
  };

  const handlePinConfirm = () => {
    if (enteredPin === userPin) {
      setShowPinModal(false);
      setEnteredPin('');
      setPinAttempts(0);
      if (pendingAction) pendingAction();
      return;
    }

    if (enteredPin === duressPin && duressPin.length === 4) {
      setShowPinModal(false);
      setEnteredPin('');
      setPinAttempts(0);
      onDuressPin();
      return;
    }

    if (pendingWrongAction) {
      setShowPinModal(false);
      setEnteredPin('');
      pendingWrongAction();
      setPendingWrongAction(null);
      setPendingAction(null);
      return;
    }

    const attempts = pinAttempts + 1;
    setPinAttempts(attempts);
    setEnteredPin('');
    if (attempts >= 3) {
      const reason = 'Sifre 3 kez hatali girildi!';
      setShowPinModal(false);
      onMaxAttempts(reason);
    } else {
      setPinError(true);
    }
  };

  const handlePinChange = (pin: string) => {
    setEnteredPin(pin);
    setPinError(false);
  };

  const handlePinCancel = () => {
    setShowPinModal(false);
    setEnteredPin('');
    setPinError(false);
  };

  const resetPinAttempts = () => setPinAttempts(0);
  const handleUserPinChange = (value: string) => setUserPin(value.replace(/\D/g, ''));
  const handleDuressPinChange = (value: string) => setDuressPin(value.replace(/\D/g, ''));

  return {
    userPin,
    handleUserPinChange,
    duressPin,
    handleDuressPinChange,
    showPinModal,
    enteredPin,
    pinError,
    pinAttempts,
    requirePin,
    handlePinConfirm,
    handlePinChange,
    handlePinCancel,
    resetPinAttempts,
  };
};
