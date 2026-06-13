// Service Worker - Safe caching strategy
// Version bump -> old caches purged on activate
const APP_VERSION = '3.3';
const CACHE_VERSION = `csca-moli-v${APP_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Pre-cache: offline page + app shell essentials
const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest?v=3.3',
  '/icons/app-icon-v3-192x192.png',
  '/icons/app-icon-v3-512x512.png',
  '/icons/apple-touch-icon-v3.png',
  '/images/logo.svg',
];

// NEVER cache these API paths (auth, exam submissions, payments)
const API_BLACKLIST = [
  '/api/auth/',
  '/api/users/',
  '/api/exam',
  '/api/payment',
  '/api/admin',
  '/api/ai/',
];

// ─── Install: pre-cache offline page + icons ───
// Do NOT skipWaiting here — let the app control when to activate
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  // New SW waits until all tabs close OR app sends SKIP_WAITING
});

// ─── Activate: purge old caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Message: controlled skip-waiting + version query.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: APP_VERSION, cacheVersion: CACHE_VERSION });
  }
});

// ─── Push notification handler ───
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'CSCA Moly';
    const options = {
      body: data.body || '',
      icon: '/icons/app-icon-v3-192x192.png',
      badge: '/icons/app-icon-v3-192x192.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'csca-notification',
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Fallback for plain text
    event.waitUntil(
      self.registration.showNotification('CSCA Moly', {
        body: event.data.text(),
        icon: '/icons/app-icon-v3-192x192.png',
      })
    );
  }
});

// ─── Notification click: open URL ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ─── Fetch ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip non-http (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Skip cross-origin requests (analytics, CDNs handle own caching)
  if (url.origin !== self.location.origin) return;

  // ── NEVER cache sensitive API routes ──
  if (API_BLACKLIST.some((path) => url.pathname.startsWith(path))) return;

  // ── Navigation requests: network-first → offline page ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // ── Static assets (JS, CSS, fonts): stale-while-revalidate ──
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── Images: cache-first, cap cache size ──
  if (
    request.destination === 'image' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, clone);
              // Cap image cache at 100 entries
              trimCache(IMAGE_CACHE, 100);
            });
          }
          return response;
        }).catch(() => {
          // Could return a placeholder, but just fail gracefully
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // ── Manifest: network-first so installed app names update faster ──
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // All other requests: network only (don't cache random stuff)
});

// ─── Helper: trim cache to max entries ───
function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => trimCache(cacheName, maxItems));
      }
    });
  });
}
