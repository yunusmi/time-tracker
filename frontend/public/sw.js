/* Service worker: показ веб-пушей Хроноса (VAPID). */
self.addEventListener('push', (event) => {
  let payload = { title: 'Хронос', body: '' };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch (err) {
    payload.body = event.data ? event.data.text() : '';
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Хронос', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/dashboard/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
