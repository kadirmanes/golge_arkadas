# Guardly

Kişisel güvenlik yardımcısı. Yolculuk süresince sizi izler, acil durumda güvendiğiniz kişileri anında bilgilendirir.

## Özellikler

- Zamanlayıcılı güvenli yolculuk takibi
- Düşme algılama sensörü
- Sesli komut ("İmdat") ile alarm
- Acil durum kişilerine anlık konum + FCM bildirimi
- Sahte arama özelliği
- Tehdit PIN ile gizli alarm
- Periyodik "İyi misin?" kontrolleri
- Ses kanıtı kaydı ve Firebase'e yükleme

## Teknoloji

- React + TypeScript + Vite
- Capacitor (Android)
- Firebase (Auth, Firestore, Storage, FCM)
- Vercel (bildirim API)

## Kurulum

```bash
npm install
npm run build
npx cap sync android
```

Android build:
```bash
cd android
./gradlew bundleRelease
```

## Gizlilik Politikası

https://kadirmanes.github.io/golge_arkadas/privacy-policy.html

## Lisans

MIT
