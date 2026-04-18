# BRAIN

Son guncelleme: 2026-04-18

## Aktif is kapsami
- Projeyi MVP seviyesinden daha guvenli ve bakim dostu bir tabana cekmek.
- Ilk fazda kritikler:
  1. Guvenlik kural dosyalari (`firestore.rules`, `storage.rules`)
  2. Bildirim endpoint hardening (`api/send-notification.ts`)
  3. Istemci endpoint cagrisi auth uyumu (`src/screens/ProtectedScreen.tsx`)

## Neden bu kapsam
- Urun insan guvenligi iddiasi tasiyor; kuralsiz veri erisimi ve korumasiz endpoint kabul edilemez.
- Ilk adimda risk azaltimi, ikinci adimda kapsamli refactor (state machine + dosya parcala) planlanacak.

## Plan
1. Firebase kural dosyalarini yaz.
2. `firebase.json` icinde rules referanslarini tamamla.
3. Notification endpointe auth/authorization/validation/rate-limit ekle.
4. Istemci cagrisini idToken + journey context gonderecek sekilde guncelle.
5. Typecheck calistir.
6. Sonuclari ve etkilenen dosyalari bu dosyaya isle.

## Etkilenen dosyalar (beklenen)
- `firestore.rules` (yeni)
- `storage.rules` (yeni)
- `firebase.json`
- `api/send-notification.ts`
- `src/screens/ProtectedScreen.tsx`
- `TRACEABILITY.md`
- `BRAIN.md`

## Siradaki is
- Kod okumasi tamamlayip guvenlik degisikliklerini uygulamak.

## Aktif mini-gorev - TR-20260418-003
- Kapsam: `ProtectedScreen` icindeki fake call state/timer/localStorage/handler mantigini ayri hook'a tasimak.
- Hedef dosyalar:
  - `src/screens/ProtectedScreen.tsx`
  - `src/hooks/useFakeCallController.ts` (yeni)
- Kisit:
  - Alarm, journey, emergency, watcher akislarina dokunma.
  - localStorage anahtari `golgeArkadasFakeCallName` degismeyecek.
  - UI davranisi ayni kalacak.

## Degisiklik kaydi - TR-20260418-003
- Ne yazildi:
  - `src/hooks/useFakeCallController.ts` olusturuldu.
  - Fake call state/timer/audio/localStorage/handler mantigi bu hook'a tasindi.
  - `src/screens/ProtectedScreen.tsx` fake call alanlarini hook'tan tukecek sekilde sadeletildi.
- Neden yazildi:
  - `ProtectedScreen` icindeki tek sorumlulukli fake call mantigini ayristirmak.
  - UI davranisini bozmadan dosya karmasini azaltmak.
- Hangi dosyalar etkilendi:
  - `src/hooks/useFakeCallController.ts`
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Kullanici yeni bir ayristirma gorevi verirse yine tek sorumluluk ve minimal diff ile ilerlemek.

## Degisiklik kaydi - TR-20260418-004
- Ne yazildi:
  - `src/hooks/usePinSecurity.ts` olusturuldu.
  - PIN dogrulama, duress PIN kontrolu, PIN modal state/handler mantigi hook'a tasindi.
  - `src/screens/ProtectedScreen.tsx` PIN tarafinda hook ciktilarini kullanacak sekilde sadeletildi.
- Neden yazildi:
  - PIN ile ilgili daginik mantigi tek yerde toplamak.
  - Alarm tetikleme akisina dokunmadan PIN sorumlulugunu ayristirmak.
- Hangi dosyalar etkilendi:
  - `src/hooks/usePinSecurity.ts`
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Gorev 4: journey lifecycle mantigini ayri hook'a tasimak.

## Degisiklik kaydi - TR-20260418-005
- Ne yazildi:
  - `src/hooks/useJourneyLifecycle.ts` olusturuldu.
  - Journey lifecycle state'leri (`appState`, `journeyId`, `durationMinutes`, `timeLeft`, `alertCountdown`, `triggerReason`, `checkIn*`) ve timeout/check-in effectleri hook'a tasindi.
  - `src/screens/ProtectedScreen.tsx` journey baslatma/bitirme akisinda hook kullanimina gecirildi.
- Neden yazildi:
  - Journey yasam dongusu mantigini ekran dosyasindan ayirip tek yerde toplamak.
  - Davranisi koruyarak `ProtectedScreen` karmasini azaltmak.
- Hangi dosyalar etkilendi:
  - `src/hooks/useJourneyLifecycle.ts`
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Gorev 5: watcher secimi ve watcher yonetimini ayri hook'a tasimak.

## Degisiklik kaydi - TR-20260418-006
- Ne yazildi:
  - `src/hooks/useWatcherSelection.ts` olusturuldu.
  - Watcher listesi yukleme, secili watcher yonetimi ve ilgili localStorage akisi hook'a tasindi.
  - `src/screens/ProtectedScreen.tsx` watcher secimi tarafinda hook kullanimina gecirildi.
- Neden yazildi:
  - Watcher secimi ve listeleme sorumlulugunu ekrandan ayirip tek yerde toplamak.
- Hangi dosyalar etkilendi:
  - `src/hooks/useWatcherSelection.ts`
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Gorev 6: emergency trigger wiring mantigini ayri hook'a tasimak.

## Degisiklik kaydi - TR-20260418-007
- Ne yazildi:
  - `src/hooks/useEmergencyTriggers.ts` olusturuldu.
  - Keyword detection, fall detection ve gizli dokunus tetikleyici wiring'i hook'a tasindi.
  - `src/screens/ProtectedScreen.tsx` tetikleyici wiring tarafinda hook kullanimina gecirildi.
- Neden yazildi:
  - Tetikleyici entegrasyonlarini ekran dosyasindan ayirip daha okunur bir orchestration yapisi kurmak.
- Hangi dosyalar etkilendi:
  - `src/hooks/useEmergencyTriggers.ts`
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Gorev 7: ProtectedScreen'i presentation/orchestration seviyesinde sadeletmek.

## Degisiklik kaydi - TR-20260418-008
- Ne yazildi:
  - `src/screens/ProtectedScreen.tsx` icinde hook kullanimina uygun sadelestirme yapildi.
  - Tekrarlayan `requirePin(cancelJourney)` cagrilari ortak `requireJourneyCancel` helper'i ile toplandi.
  - Kullanilmayan watcher degisken daginikligi temizlendi.
  - Dosya satir sayisi belirgin sekilde azaldi.
- Neden yazildi:
  - Ekrani presentation/orchestration seviyesine yaklastirmak ve okunabilirligi artirmak.
- Hangi dosyalar etkilendi:
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Bu fazdaki gorevler tamamlandi.

## Degisiklik kaydi - TR-20260418-009
- Ne yazildi:
  - Hook kontratlari sadeletildi:
    - `useEmergencyTriggers`: setter bagimliliklari yerine tek `onAlert(reason, countdown?)` callback alacak sekilde daraltildi.
    - `usePinSecurity`: `setUserPin`/`setDuressPin` yerine amac odakli `handleUserPinChange`/`handleDuressPinChange` saglandi.
    - `useJourneyLifecycle`: dogrudan setter donusleri azaltildi; `activateAlert`, `markTriggered`, `markActive`, `setSetupState`, `setActiveState` aksiyonlari netlestirildi.
    - `useWatcherSelection`: kullanilmayan `approvedWatchers` contract yuzeyinden cikarildi.
  - `src/screens/ProtectedScreen.tsx` sadece orchestration/presentation seviyesinde hook aksiyonlarini tukecek sekilde temizlendi.
- Neden yazildi:
  - Hook input/output yuzeyini kucultmek.
  - Hook'lar arasi dolayli bagimliliklari azaltmak.
  - Ekran dosyasindaki ara state/ara handler daginikligini azaltmak.
- Hangi dosyalar etkilendi:
  - `src/screens/ProtectedScreen.tsx`
  - `src/hooks/usePinSecurity.ts`
  - `src/hooks/useJourneyLifecycle.ts`
  - `src/hooks/useWatcherSelection.ts`
  - `src/hooks/useEmergencyTriggers.ts`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Kullanici yeni iyilestirme gorevi verirse ayni minimal-contract disipliniyle devam etmek.

## Degisiklik kaydi - TR-20260418-010
- Ne yazildi:
  - `useJourneyLifecycle.ts`: `appStateRef` eklendi; `activateAlert` sadece `appStateRef.current === 'active'` iken calisir, aksi halde `console.warn` ile reject eder.
  - `ProtectedScreen.tsx`: `triggerEmergency` icine 5 sn cooldown ref guard eklendi; bastirilan cagri `console.warn` ile loglanir.
- Neden yazildi:
  - Ayni anda gelen birden fazla trigger (dusme + ses komutu gibi) alert akisini sifirlamasin veya FCM'i tekrar ateşlemesin.
- Hangi dosyalar etkilendi:
  - `src/hooks/useJourneyLifecycle.ts`
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS

## Degisiklik kaydi - TR-20260418-011
- Ne yazildi:
  - `ProtectedScreen.tsx`: `emergencySessionActiveRef` boolean ref eklendi.
  - `triggerEmergency` icerisinde session aktifken cagri `console.warn` + `return` ile bloke edilir.
  - `appState` `'active'` veya `'setup'`'a donunce ref `false`'a sifirlanir (useEffect).
  - Guard siralamasi: session check → cooldown check → fire.
- Neden yazildi:
  - Cooldown sadece zaman araligini korur; session guard ise aktif emergency akisi boyunca ikinci bir FCM patlamamasini garantiler.
- Hangi dosyalar etkilendi:
  - `src/screens/ProtectedScreen.tsx`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS

## Teknik not — Emergency guard akisi

```
triggerEmergency(reason)
  ├─ emergencySessionActiveRef.current === true?
  │    └─ warn "[session active]" → return          ← aktif emergency varken bloke
  ├─ Date.now() - lastEmergencyRef < 5000?
  │    └─ warn "[cooldown]" → return                ← hizli ardisik cagri bloke
  └─ emergencySessionActiveRef = true
     lastEmergencyRef = now
     sendFcmNotifications(reason)                   ← tek seferlik ates

Reset:
  useEffect [appState] → appState === 'active' | 'setup'
    └─ emergencySessionActiveRef = false            ← journey bitince veya "Güvendeyim" sonrasi

activateAlert(reason, countdown)
  ├─ appStateRef.current !== 'active'?
  │    └─ warn "[activateAlert ignored]" → return   ← alert/triggered iken bloke
  └─ setTriggerReason / setAppState('alert') / setAlertCountdown
```

## Smoke test checklist — Emergency session guard

- [ ] Yolculuk aktifken dusme + ses komutu ayni anda tetiklenirse: ilk `activateAlert` gecer, ikincisi `[activateAlert] ignored — state: alert` logu ile bloke edilir.
- [ ] Alert ekraninda countdown sifirlanir, `triggerEmergency` cagrilir: `emergencySessionActiveRef` `false` oldugu icin gecer, FCM gider.
- [ ] `triggerEmergency` ilk atesin hemen ardindan tekrar cagirilirsa (5 sn icinde): `[cooldown]` logu gorulur, FCM ikinci kez gitmez.
- [ ] `triggerEmergency` ilk ates sonrasi 5+ sn icinde tekrar cagirilirsa: `[session active]` logu gorulur, FCM yine gitmez.
- [ ] Kullanici "Güvendeyim — Alarmı İptal Et" der → `markActive()` → `appState = 'active'` → `emergencySessionActiveRef = false`; sonraki trigger yeni emergency baslatabilir.
- [ ] Yolculuk "Güvenle Vardım" ile biter → `appState = 'setup'` → ref sifirlanir; yeni yolculukta guard engel olusturmaz.

## Degisiklik kaydi - TR-20260418-002
- Ne yazildi:
  - `firestore.rules` olusturuldu.
  - `storage.rules` olusturuldu.
  - `firebase.json` dosyasina Firestore/Storage rule referanslari eklendi.
  - `api/send-notification.ts` auth + authorization + validation + rate-limit ile bastan sertlestirildi.
  - `src/screens/ProtectedScreen.tsx` endpoint cagrisina `Authorization: Bearer <idToken>` ve `journeyId` eklendi.
- Neden yazildi:
  - Yetkisiz bildirim tetikleme riskini azaltmak.
  - Journey sahipligi ve hedef token yetkisini sunucu tarafinda zorunlu kilmak.
  - Firestore/Storage erisimini kural tabanli hale getirmek.
- Hangi dosyalar etkilendi:
  - `firestore.rules`
  - `storage.rules`
  - `firebase.json`
  - `api/send-notification.ts`
  - `src/screens/ProtectedScreen.tsx`
  - `SYSTEM_BLUEPRINT.md`
- Test/dogrulama:
  - `npx tsc --noEmit` => PASS
- Siradaki is:
  - Bir sonraki fazda `ProtectedScreen.tsx` dosyasini lifecycle/trigger/pin alt hooklara parcala.
  - Sessiz `catch {}` bloklarini kritik akislardan temizle.
