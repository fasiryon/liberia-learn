const CACHE_NAME = "liberialearn-v1";
const APP_SHELL = ["/", "/student/dashboard", "/teacher/dashboard", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (request.method === "GET") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline");
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    networkFirst(event.request).catch(
      () =>
        new Response("Offline fallback unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        })
    )
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "offline-queue-sync") {
    return;
  }

  event.waitUntil(fetch("/api/student/sync", { method: "POST" }).catch(() => undefined));
});
