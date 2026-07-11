const CACHE_NAME = 'emad-edu-v2';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
];

const NETWORK_ONLY_PATHS = [
  '/api/auth',
  '/auth',
  '/dashboard',
  '/student',
  '/doctor',
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

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (
    event.request.method !== 'GET' ||
    NETWORK_ONLY_PATHS.some((path) => url.pathname.startsWith(path))
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
