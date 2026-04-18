importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB4FuMpdr0acy4eJgrqf4eizglIzbxzVbo',
  authDomain: 'golge-arkadas.firebaseapp.com',
  projectId: 'golge-arkadas',
  storageBucket: 'golge-arkadas.firebasestorage.app',
  messagingSenderId: '13928769495',
  appId: '1:13928769495:web:40bc8c8e9e6a82bdd0cd92',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  const isEmergency = payload.data?.type === 'emergency' || payload.data?.type === 'triggered';

  // Bildirim göster
  self.registration.showNotification(title ?? 'Guardly', {
    body: body ?? 'Acil durum bildirimi.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: isEmergency ? 'emergency' : 'guardly',
    renotify: true,             // Aynı tag olsa bile tekrar titret/ses çal
    requireInteraction: isEmergency, // Acil bildirim kullanıcı kapatana kadar ekranda kalır
    vibrate: isEmergency
      ? [500, 200, 500, 200, 500, 200, 1000] // Uzun SOS titreşim
      : [200, 100, 200],
    data: { ...payload.data, url: '/' },
    actions: isEmergency ? [
      { action: 'open', title: '🗺️ Konuma Git' },
    ] : [],
  });

  // Açık sayfa varsa ses çalması için mesaj gönder
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'EMERGENCY_NOTIFICATION',
        isEmergency,
        payload,
      });
    });
  });
});

// Bildirime tıklanınca uygulamayı aç
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Zaten açık sekme varsa öne getir
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Yoksa yeni sekme aç
      return self.clients.openWindow('/');
    })
  );
});
