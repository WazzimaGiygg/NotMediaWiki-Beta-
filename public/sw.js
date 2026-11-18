// NotMediaWiki Service Worker (sw.js)
// Caches static assets and Google Fonts for fast repeat loads and offline resilience.

const SW_VERSION = 'v1';
const STATIC_CACHE = `notmediawiki-static-${SW_VERSION}`;
const GOOGLE_FONTS_STYLESHEETS_CACHE = `notmediawiki-google-fonts-stylesheets-${SW_VERSION}`;
const GOOGLE_FONTS_WEBFONTS_CACHE = `notmediawiki-google-fonts-webfonts-${SW_VERSION}`;

const ALLOWED_CACHES = new Set([
  STATIC_CACHE,
  GOOGLE_FONTS_STYLESHEETS_CACHE,
  GOOGLE_FONTS_WEBFONTS_CACHE,
]);

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.png',
  '/logo.png',
  '/opensearch.xml',
  '/assets/aistudio/image_370f9ede.png',
];

const STATIC_ASSET_REGEX = /\.(?:js|mjs|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('notmediawiki-') && !ALLOWED_CACHES.has(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n.startsWith('notmediawiki-')).map((n) => caches.delete(n)))
      )
    );
  }
});

function isCacheableResponse(response) {
  if (!response) return false;
  return response.status === 200 || response.type === 'opaque';
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const networkResponse = await fetch(request);
  if (isCacheableResponse(networkResponse)) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (isCacheableResponse(networkResponse)) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (isCacheableResponse(networkResponse)) {
      cache.put('/index.html', networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return (await cache.match('/index.html')) || (await cache.match('/'));
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept API calls, Firestore/Firebase Auth traffic, or Vite dev HMR
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/firebase-messaging-sw.js' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@react-refresh')
  ) {
    return;
  }

  // 1. Google Fonts stylesheets (Stale-While-Revalidate)
  if (url.origin === 'https://fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request, GOOGLE_FONTS_STYLESHEETS_CACHE));
    return;
  }

  // 2. Google Fonts font binaries (Cache-First, immutable webfonts)
  if (url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, GOOGLE_FONTS_WEBFONTS_CACHE));
    return;
  }

  // 3. Same-origin SPA navigation requests (Network-First with offline shell fallback)
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // 4. Same-origin static assets (JS, CSS, images, icons, local fonts)
  if (url.origin === self.location.origin && STATIC_ASSET_REGEX.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
