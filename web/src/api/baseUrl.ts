// The session cookie is SameSite, so the API has to share a site with the
// page. A relative VITE_API_URL (/api behind the same host) is the simplest
// way there in production. In dev a localhost API follows the page host, so
// the same .env works whether the page is opened on localhost or a LAN IP.
export function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;

  if (!configured && !import.meta.env.DEV) {
    throw new Error('VITE_API_URL is required in production');
  }

  const url = new URL(
    configured || 'http://localhost:3000',
    window.location.origin,
  );

  if (
    import.meta.env.DEV &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    url.hostname = window.location.hostname;
  }

  return url.href.replace(/\/$/, '');
}
