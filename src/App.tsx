import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { subscribeToPendingRequests } from './firebase/firestore';
import AuthScreen from './screens/AuthScreen';
import EmailVerifyScreen from './screens/EmailVerifyScreen';
import HomeScreen from './screens/HomeScreen';
import ProtectedScreen from './screens/ProtectedScreen';
import WatcherScreen from './screens/WatcherScreen';
import FriendsScreen from './screens/FriendsScreen';
import LiveMapScreen from './screens/LiveMapScreen';
import type { Screen } from './types';

export default function App() {
  const { currentUser, loading } = useAuth();
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [liveMapTarget, setLiveMapTarget] = useState<{ userId: string; displayName?: string } | null>(null);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  // Email doğrulama: Google kullanıcılar zaten verified, email/şifre kullanıcılar değil
  const [emailVerified, setEmailVerified] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUser) { setEmailVerified(true); return; }
    // Google OAuth: emailVerified her zaman true
    setEmailVerified(currentUser.emailVerified);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToPendingRequests(currentUser.uid, (reqs) => {
      setFriendRequestCount(reqs.length);
    });
    return unsub;
  }, [currentUser]);

  const handleNavigate = (screen: Screen, targetUserId?: string, displayName?: string) => {
    if (screen === 'livemap' && targetUserId) {
      setLiveMapTarget({ userId: targetUserId, displayName });
    }
    setActiveScreen(screen);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-10 h-10 text-emerald-500 animate-pulse" />
          <div className="text-zinc-400 text-sm">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <AuthScreen />;

  // E-posta doğrulama bekleniyor (Google kullanıcılar için geçmez)
  if (!emailVerified) {
    return <EmailVerifyScreen onVerified={() => setEmailVerified(true)} />;
  }

  return (
    <>
      {activeScreen === 'home' && (
        <HomeScreen
          onNavigate={handleNavigate}
          friendRequestCount={friendRequestCount}
        />
      )}
      {activeScreen === 'protected' && (
        <ProtectedScreen onNavigate={handleNavigate} />
      )}
      {activeScreen === 'watcher' && (
        <WatcherScreen
          onNavigate={(screen, target) => handleNavigate(screen, target)}
        />
      )}
      {activeScreen === 'friends' && (
        <FriendsScreen onNavigate={handleNavigate} />
      )}
      {activeScreen === 'livemap' && liveMapTarget && (
        <LiveMapScreen
          targetUserId={liveMapTarget.userId}
          targetDisplayName={liveMapTarget.displayName}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}
