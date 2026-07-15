const CACHE_NAME = 'buku-kas-ravina-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Service Worker and cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network First with Cache Fallback for maximum reliability
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Safely bypass Service Worker caching for API proxy syncs to always enforce live network requests
  if (url.pathname.startsWith('/api/')) {
    return; // Let browser fetch directly from express server
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, clone and save in cache for offline fallback
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If request is for a route page, return main index.html for SPA router
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
