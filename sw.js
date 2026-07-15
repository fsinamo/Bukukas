const CACHE_NAME = "v3";

self.addEventListener("install", event => {
  self.skipWaiting(); // Memaksa SW baru untuk segera aktif tanpa menunggu tab ditutup
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(["/", "/index.html"]);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log("Menghapus cache lama:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Mengambil alih halaman secara langsung
  );
});

self.addEventListener("fetch", event => {
  // Hanya proses request GET dan abaikan API routes agar tidak mengganggu sinkronisasi
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
