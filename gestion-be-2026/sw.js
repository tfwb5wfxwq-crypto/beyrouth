// Service Worker - Beyrouth Express Admin
const CACHE_NAME = 'beyrouth-admin-v1';

self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installé');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activé');
  event.waitUntil(clients.claim());
});

// Notifications Push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🔔 Nouvelle commande !';
  const options = {
    body: data.body || 'Une nouvelle commande vient d\'arriver',
    icon: 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🧆</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🔔</text></svg>',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'new-order',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Voir la commande' }
    ],
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/admin/')
  );
});
