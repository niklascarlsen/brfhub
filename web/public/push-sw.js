// Push handlers for the web client. The generated sw.js imports this file,
// so caching stays in workbox and push stays here. Not built by Vite, keep
// it plain JavaScript.
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Boka', {
      body: payload.body ?? '',
      icon: '/icon-192.png',
      data: payload.data ?? {},
    }),
  );
});

// The payload data matches what the app reads from a tapped notification.
// An announcement carries no slot, and opens the booking page where the
// announcements are shown.
function slotUrl(data) {
  if (!data || !data.date || !data.resourceId) {
    return '/book';
  }

  const params = new URLSearchParams({
    date: data.date,
    resource: data.resourceId,
  });

  return `/book?${params}`;
}

// Reuse an open window when there is one, the app then jumps to the slot
// without a reload. Otherwise open a new one with the slot in the query.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = slotUrl(event.notification.data);

  event.waitUntil(
    self.clients
      .matchAll({type: 'window', includeUncontrolled: true})
      .then((windows) => {
        const open = windows[0];

        if (!open) {
          return self.clients.openWindow(url);
        }

        open.postMessage({type: 'notification-open', url});
        return open.focus();
      }),
  );
});

// The browser can rotate the subscription while the app is closed.
self.addEventListener('pushsubscriptionchange', (event) => {
  const applicationServerKey =
    event.oldSubscription?.options.applicationServerKey;

  if (!applicationServerKey) {
    return;
  }

  // The client uploads the new subscription the next time the app is opened.
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }),
  );
});
