import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

// Native Android/iOS: GoogleSignInClient'ı başlat
if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: '13928769495-jrv0p05ihkggsqi8vodva99ttv1aikpo.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: false,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
