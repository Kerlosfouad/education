const CACHE_NAME = 'emad-edu-v2';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
];

// Don't cache these paths
const BYPASS_PATHS = [
  '/api/',
  '/auth/',
  '/_next/static/chunks/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass API, auth, and dynamic routes - let them go to network
  const shouldBypass = BYPASS_PATHS.some(path => url.pathname.startsWith(path))
    || event.request.method !== 'GET'
    || url.origin !== self.location.origin;

  if (shouldBypass) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For navigation requests, try network first, fallback to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // For static assets, try cache first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
