// ─── Mevcut tipler (değişmedi) ────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  phone: string;
}

export type AppState = 'setup' | 'active' | 'alert' | 'triggered';

// ─── Kişi sistemi (karma: uygulama + telefon) ─────────────────────────────────

export type ContactType = 'phone' | 'app';

export interface ExtendedContact {
  id: string;
  name: string;
  type: ContactType;
  phone?: string;
  userId?: string;
  fcmToken?: string;
}

// ─── Firebase kullanıcı ───────────────────────────────────────────────────────

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  fcmToken: string | null;
  phoneNumber?: string;
}

// ─── Journey (yolculuk) ───────────────────────────────────────────────────────

export interface JourneyLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  batteryLevel?: number;
  updatedAt?: unknown;
}

export interface Journey {
  id: string;
  userId: string;
  displayName: string;
  status: 'active' | 'ended' | 'alert' | 'triggered';
  startedAt: unknown;
  endedAt: unknown | null;
  durationMinutes: number;
  vehicleInfo: string;
  triggerReason: string | null;
  location: JourneyLocation | null;
  contactUids: string[];
  emergencyAudioUrl?: string;
}

// ─── İzleme sistemi ───────────────────────────────────────────────────────────

export interface WatchRequest {
  id: string;
  fromUserId: string;
  fromEmail: string;
  fromDisplayName: string;
  toUserId: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: unknown;
}

export interface WatchRelationship {
  id: string;
  protectedUserId: string;
  watcherUserId: string;
  createdAt: unknown;
}

export interface WatchedUserStatus {
  relationshipId: string;
  userId: string;
  displayName: string;
  email: string;
  activeJourney: Journey | null;
}

// ─── Ekran navigasyonu ────────────────────────────────────────────────────────

export type Screen = 'home' | 'protected' | 'watcher' | 'livemap' | 'friends';
