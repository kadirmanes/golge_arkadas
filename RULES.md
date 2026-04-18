# RULES

Son guncelleme: 2026-04-18

## Calisma modu
- `md-first` zorunlu.
- Kod/karar degisikliklerinden once ilgili `*.md` kayitlari yapilir.
- Her degisiklikten sonra `BRAIN.md` ve gerekirse `TRACEABILITY.md` guncellenir.

## Yetki ve sinirlar
- Bu repo icinde calisilir.
- `allowed_files`: repo koku altindaki dosyalar.
- Harici dizinlere yazma yasak.
- Mevcut kullanici degisiklikleri geri alinmaz.

## Guvenlik kurallari
- Sessiz hata yutma (`catch {}`) kritik akislarda kabul edilmez.
- Endpointlerde zorunlu: auth, authorization, input validation, rate limit.
- Firestore/Storage erisimleri kuralsiz birakilamaz.

## Tamamlandi kriteri
- `VALIDATION.md` icindeki acceptance kriterleri saglanmadan is tamamlandi sayilmaz.

