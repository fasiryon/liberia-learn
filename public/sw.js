// public/sw.js — LiberiaLearn Service Worker
// Designed for 2G/3G Liberian networks with frequent disconnects.

const CACHE_NAME = "ll-v1";
const SHELL_ASSETS = ["/", "/login", "/offline", "/icons/icon-192.png", "/manifest.json"];
const DB_NAME = "ll-offline";
const STORE_NAME = "queue";

// ─── IndexedDB helpers ──────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToQueue(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Install: pre-cache shell ───────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ─────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch strategies ───────────────────────────────────────────────
const SKIP_QUEUE_PATHS = ["/api/track", "/api/healthz"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // 2) API requests: network-only, queue on failure
  if (url.pathname.startsWith("/api/")) {
    if (SKIP_QUEUE_PATHS.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(fetch(request).catch(() => new Response("{}", { status: 503 })));
      return;
    }

    event.respondWith(
      fetch(request).catch(async () => {
        // Queue the failed request for background sync
        try {
          let body = null;
          if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
            body = await request.clone().text();
          }
          await addToQueue({
            url: request.url,
            method: request.method,
            body,
            headers: { "Content-Type": request.headers.get("Content-Type") || "application/json" },
            timestamp: Date.now(),
          });

          // Request background sync
          if (self.registration && self.registration.sync) {
            await self.registration.sync.register("ll-sync");
          }
        } catch (e) {
          // Best-effort queuing
        }
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // 3) Navigation requests: network-first, cache fallback, /offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline"))
        )
    );
    return;
  }

  // 4) Everything else: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ─── Background Sync: drain the queue ───────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "ll-sync") {
    event.waitUntil(drainQueue());
  }
});

async function drainQueue() {
  const items = await getQueue();
  for (const item of items) {
    try {
      const opts = {
        method: item.method,
        headers: item.headers,
      };
      if (item.body) opts.body = item.body;
      const res = await fetch(item.url, opts);
      if (res.ok || res.status < 500) {
        await removeFromQueue(item.id);
      }
      // 5xx: leave in queue for next sync attempt
    } catch {
      // Still offline — leave in queue
      break;
    }
  }
}
