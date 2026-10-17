self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let message = { title: 'Olympiade des Manades', body: '', url: '/noter' };
  try { message = { ...message, ...event.data?.json() }; } catch { /* corps vide */ }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    lang: 'fr',
    data: { url: message.url || '/noter' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/noter';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
    const ouverte = fenetres.find((fenetre) => fenetre.url.includes(url));
    if (ouverte) return ouverte.focus();
    return self.clients.openWindow(url);
  }));
});
