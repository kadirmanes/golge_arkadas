import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getRedirectResult, type User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { auth, getMessagingInstance } from '../firebase/config';
import { upsertUser, saveFcmToken } from '../firebase/firestore';
import { getToken } from 'firebase/messaging';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Web: Google redirect dönüşü kontrol et
    if (!Capacitor.isNativePlatform()) {
      getRedirectResult(auth)
        .then(async (result) => {
          if (result?.user) await upsertUser(result.user);
        })
        .catch(() => { /* sessizce geç */ });
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);

      if (user) {
        await upsertUser(user);
        if (Capacitor.isNativePlatform()) {
          registerNativeFcm(user.uid);
        } else {
          requestWebFcmToken(user.uid);
        }
      }
    });
    return unsubscribe;
  }, []);

  // ─── Native Android/iOS — FCM push notifications ──────────────────────────
  const registerNativeFcm = async (uid: string) => {
    try {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;

      await PushNotifications.register();

      PushNotifications.addListener('registration', async ({ value: token }) => {
        await saveFcmToken(uid, token);
      });

      // Uygulama ön plandayken gelen bildirim
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[FCM] Foreground push:', notification.title);
      });
    } catch {
      // İzin reddedildi veya desteklenmiyor
    }
  };

  // ─── Web FCM (service worker) ─────────────────────────────────────────────
  const requestWebFcmToken = async (uid: string) => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const messaging = await getMessagingInstance();
      if (!messaging) return;

      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });
      if (token) await saveFcmToken(uid, token);
    } catch {
      // FCM desteklenmiyor veya izin reddedildi — sessizce geç
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
