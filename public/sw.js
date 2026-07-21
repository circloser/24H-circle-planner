/*
 * 24Houring service worker — offline app shell + runtime asset cache.
 * Client-only SPA, so once the shell + hashed assets are cached the whole app
 * works offline (data lives in localStorage). Navigations are network-first
 * (fresh on every online visit); same-origin assets are stale-while-revalidate.
 */
const CACHE = '24h-cache-v5';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Web Push (Pro closed-tab slice alarms): the Worker cron sends
// {title, body}; showing a notification is mandatory for userVisibleOnly subs.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* non-JSON push → generic notification */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '24Houring', {
      body: data.body || '',
      tag: data.tag || 'slice-start', // same-kind pushes replace; ops keep their own lane
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  );
});

// Tap → focus an open app tab, else open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // skip ads / analytics / cross-origin

  // Never intercept the API. /api/* must reach the network directly so the
  // OAuth flow can follow its cross-origin 302 to Google, and so dynamic
  // responses (/api/me, /api/sync) are never cached or served as the SPA shell.
  if (url.pathname.startsWith('/api/')) return;

  // App navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match('/index.html'))),
    );
    return;
  }

  // Same-origin assets: serve cache fast, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
