# SYSTEM_BEHAVIOR

Son guncelleme: 2026-04-18

## Journey durum makinesi (kanonik)
- `setup` -> `active`
- `active` -> `alert`
- `alert` -> `triggered`
- `active|alert|triggered` -> `ended`

## Trigger kaynaklari
- Sure dolumu
- Keyword detection
- Fall detection
- Gizli panic tetigi

## Hata davranisi
- Kritik akislarda hata loglanir.
- Kullanici etkileyen hatalarda fallback/geri bildirim olur.
- Sessizce yutma sadece dusuk kritik seviyede ve kayitla kabul edilir.

## Retry/Fallback
- Bildirim gonderimi: gecici hatalarda sinirli retry
- Konum senkronizasyonu: periyodik tekrar + hata logu

