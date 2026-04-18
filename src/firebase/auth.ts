import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { auth, googleProvider } from './config';
import { upsertUser } from './firestore';

export const signInWithEmail = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const registerWithEmail = async (email: string, password: string, displayName: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await upsertUser(result.user, displayName);
  // E-posta doğrulama linki gönder
  await sendEmailVerification(result.user).catch(() => {});
  return result.user;
};

export const resendVerificationEmail = async (user: User) => {
  await sendEmailVerification(user);
};

export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    // ─── Native Android/iOS: sistem Google hesap seçici açılır ──────────────
    const googleUser = await GoogleAuth.signIn();
    const credential = GoogleAuthProvider.credential(
      googleUser.authentication.idToken
    );
    const result = await signInWithCredential(auth, credential);
    await upsertUser(result.user);
    return result.user;
  }

  // ─── Web: popup ile ──────────────────────────────────────────────────────
  const result = await signInWithPopup(auth, googleProvider);
  await upsertUser(result.user);
  return result.user;
};

export const signOut = async () => {
  if (Capacitor.isNativePlatform()) {
    try { await GoogleAuth.signOut(); } catch { /* ignore */ }
  }
  return firebaseSignOut(auth);
};

// ─── Yardımcı ────────────────────────────────────────────────────────────────

export const normalizeTurkishPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 11) return '+90' + digits.slice(1);
  if (digits.length === 10) return '+90' + digits;
  return phone.startsWith('+') ? phone : '+' + digits;
};

// Firebase hata kodlarını Türkçeye çevir
export const getAuthErrorMessage = (code: string): string => {
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor.',
    'auth/invalid-email': 'Geçersiz e-posta adresi.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/user-not-found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
    'auth/wrong-password': 'Hatalı şifre.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/too-many-requests': 'Çok fazla deneme. Lütfen bekleyin.',
    'auth/popup-closed-by-user': 'Google girişi iptal edildi.',
    'auth/network-request-failed': 'İnternet bağlantısı hatası.',
  };
  return messages[code] ?? 'Bir hata oluştu. Lütfen tekrar deneyin.';
};
