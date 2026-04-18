# SYSTEM_BLUEPRINT

Son guncelleme: 2026-04-18

## Kanonik mimari
- `src/`: React + TypeScript istemci uygulamasi
- `api/`: Vercel serverless endpointleri
- `functions/`: Firebase Functions (ayri paket)
- `android/`: Capacitor Android proje ciktisi
- `public/`: statik varliklar
- `patches/`: `patch-package` patch dosyalari

## Moduller
- `src/contexts/AuthContext.tsx`: kimlik + FCM token kaydi
- `src/firebase/config.ts`: Firebase app/auth/db/storage kurulumu
- `src/firebase/firestore.ts`: kullanici, journey, watch iliskileri, dinleyiciler
- `src/screens/ProtectedScreen.tsx`: protected kullanici deneyimi (kritik, buyuk dosya)
- `src/screens/WatcherScreen.tsx`: izleyici deneyimi
- `src/hooks/*`: konum, dusme algi, keyword, WebRTC vb. hooklar
- `api/send-notification.ts`: FCM v1 bildirim gonderimi

## Guvenlik kritik varliklar
- Firestore koleksiyonlari: `users`, `journeys`, `watchRequests`, `watchRelationships`
- Storage yolu: `emergencies/{journeyId}/...`
- Endpoint: `POST /api/send-notification`
- Kural dosyalari: `firestore.rules`, `storage.rules`

## Bilinen mimari borclar
- `ProtectedScreen.tsx` tek dosyada coklu sorumluluk
- `src/firebase/firestore.ts` domain ayrimi yetersiz
- Formal state machine yok
- Kural dosyalari yeni eklenecek (bu is kapsaminda)
