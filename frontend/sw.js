const OFFLINE_CACHE = "personal-os-offline-v1";
const OFFLINE_URL = "/offline.html";
const SERVER_TIMEOUT_MS = 6000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
      try {
        return await fetch(event.request, { signal: controller.signal });
      } catch (_) {
        const cache = await caches.open(OFFLINE_CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      } finally {
        clearTimeout(timer);
      }
    })()
  );
});