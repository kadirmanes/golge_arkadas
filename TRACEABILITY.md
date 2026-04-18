# TRACEABILITY

Son guncelleme: 2026-04-18

## Kimlik kurallari
- `trace_id`: bir degisiklik akisini temsil eder.
- `artifact_id`: uretilen dosya/artifact kimligi.
- `decision_id`: alinan teknik karar kimligi.

## Kayit zinciri
| trace_id | artifact_id | decision_id | ozet | dosyalar |
|---|---|---|---|---|
| TR-20260418-001 | ART-20260418-MD-BASELINE | DEC-20260418-001 | md-first zorunlu omurga dosyalari olusturuldu | SYSTEM_BLUEPRINT.md, RULES.md, ROLES.md, SYSTEM_BEHAVIOR.md, HANDOFFS.md, VALIDATION.md, TRACEABILITY.md, BRAIN.md |
| TR-20260418-002 | ART-20260418-SEC-HARDENING | DEC-20260418-002 | Firebase rules ve notification endpoint guvenlik sertlestirmesi uygulandi | firestore.rules, storage.rules, firebase.json, api/send-notification.ts, src/screens/ProtectedScreen.tsx, SYSTEM_BLUEPRINT.md, BRAIN.md |
| TR-20260418-003 | ART-20260418-FAKECALL-HOOK | DEC-20260418-003 | Fake call sorumlulugu `ProtectedScreen` icinden ayri hook'a tasindi | src/hooks/useFakeCallController.ts, src/screens/ProtectedScreen.tsx, BRAIN.md |
| TR-20260418-004 | ART-20260418-PIN-HOOK | DEC-20260418-004 | PIN dogrulama ve duress PIN mantigi ayri hook'a tasindi | src/hooks/usePinSecurity.ts, src/screens/ProtectedScreen.tsx, BRAIN.md |
| TR-20260418-005 | ART-20260418-LIFECYCLE-HOOK | DEC-20260418-005 | Journey lifecycle mantigi ayri hook'a tasindi | src/hooks/useJourneyLifecycle.ts, src/screens/ProtectedScreen.tsx, BRAIN.md |
| TR-20260418-006 | ART-20260418-WATCHER-HOOK | DEC-20260418-006 | Watcher secimi/listeleme mantigi ayri hook'a tasindi | src/hooks/useWatcherSelection.ts, src/screens/ProtectedScreen.tsx, BRAIN.md |
| TR-20260418-007 | ART-20260418-TRIGGERS-HOOK | DEC-20260418-007 | Emergency trigger wiring mantigi ayri hook'a tasindi | src/hooks/useEmergencyTriggers.ts, src/screens/ProtectedScreen.tsx, BRAIN.md |
| TR-20260418-008 | ART-20260418-SCREEN-SIMPLIFY | DEC-20260418-008 | ProtectedScreen orchestration odakli sadeletildi | src/screens/ProtectedScreen.tsx, BRAIN.md |
| TR-20260418-009 | ART-20260418-CONTRACT-CLEANUP | DEC-20260418-009 | ProtectedScreen ve ilgili hook'lar arasinda kontrat yuzeyi sadeletildi | src/screens/ProtectedScreen.tsx, src/hooks/usePinSecurity.ts, src/hooks/useJourneyLifecycle.ts, src/hooks/useWatcherSelection.ts, src/hooks/useEmergencyTriggers.ts, BRAIN.md |
| TR-20260418-010 | ART-20260418-DOUBLETRIGGER-GUARD | DEC-20260418-010 | activateAlert ve triggerEmergency icin cooldown + appStateRef double-trigger korumasi eklendi | src/hooks/useJourneyLifecycle.ts, src/screens/ProtectedScreen.tsx, BRAIN.md |
| TR-20260418-011 | ART-20260418-SESSION-GUARD | DEC-20260418-011 | triggerEmergency icin session-based guard (emergencySessionActiveRef) eklendi; appState donusunde otomatik sifirlanir | src/screens/ProtectedScreen.tsx, BRAIN.md, TRACEABILITY.md |
