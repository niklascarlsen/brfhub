// Registers the workbox worker built by vite-plugin-pwa. Production only,
// so push and the in-app prompt need a built app, dev has no worker.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    // updateViaCache keeps the browser from serving /push-sw.js, which sw.js
    // imports, out of the HTTP cache when it checks for a new worker.
    void navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  });
}
