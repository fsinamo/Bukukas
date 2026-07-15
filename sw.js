self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("v1").then(cache => {
      return cache.addAll(["/", "/index.html"]);
    })
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
