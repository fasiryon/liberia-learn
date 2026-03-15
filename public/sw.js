// Audited Sprint 1 - single cache registration,
// single fetch handler, offline queue verified.
const CACHE_NAME = "liberialearn-v1";
const APP_SHELL = ["/", "/student/dashboard", "/teacher/dashboard", "/offline"];
const SYNC_TAG = "liberialearn-sync";
const QUEUE_PREFIX = "liberialearn_offline_queue::";
const IDB_NAME = "keyval-store";
const IDB_STORE = "keyval";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

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

function computeBackoff(attempts) {
  const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(backoff, MAX_BACKOFF_MS);
}

function openQueueDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME);
    request.onerror = () => reject(request.error || new Error("Unable to open offline queue database"));
    request.onsuccess = () => resolve(request.result);
  });
}

function readAllQueueEntries() {
  return openQueueDatabase()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(IDB_STORE, "readonly");
          const store = transaction.objectStore(IDB_STORE);
          const keysRequest = store.getAllKeys();
          const valuesRequest = store.getAll();

          transaction.oncomplete = () => {
            const keys = keysRequest.result || [];
            const values = valuesRequest.result || [];
            const entries = [];
            for (let index = 0; index < keys.length; index += 1) {
              const key = keys[index];
              const value = values[index];
              if (typeof key === "string" && key.startsWith(QUEUE_PREFIX) && Array.isArray(value)) {
                entries.push({ key, queue: value });
              }
            }
            resolve(entries);
          };

          transaction.onerror = () =>
            reject(transaction.error || new Error("Unable to read offline queue entries"));
        })
    )
    .catch((error) => {
      if (error && error.name === "NotFoundError") {
        return [];
      }
      throw error;
    });
}

function writeQueueEntry(key, queue) {
  return openQueueDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, "readwrite");
        const store = transaction.objectStore(IDB_STORE);
        if (queue.length === 0) {
          store.delete(key);
        } else {
          store.put(queue, key);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error || new Error("Unable to update offline queue entry"));
      })
  );
}

function isReady(item) {
  if (!item || item.status !== "pending") return false;
  if (!item.nextRetryAt) return true;
  return Date.parse(item.nextRetryAt) <= Date.now();
}

async function flushOfflineQueue() {
  const entries = await readAllQueueEntries();
  let syncedCount = 0;
  for (const entry of entries) {
    const readyItems = entry.queue.filter(isReady);
    if (readyItems.length === 0) {
      continue;
    }

    const nextQueue = [...entry.queue];
    for (const item of readyItems) {
      try {
        const response = await fetch(item.endpoint || "/api/student/sync", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload || {}),
        });
        if (!response.ok) {
          throw new Error(`Sync request failed with status ${response.status}`);
        }
        syncedCount += 1;
        const index = nextQueue.findIndex((candidate) => candidate.id === item.id);
        if (index >= 0) nextQueue.splice(index, 1);
      } catch (error) {
        console.warn("[SW] Background sync failed", error);
        const index = nextQueue.findIndex((candidate) => candidate.id === item.id);
        if (index < 0) continue;
        const retryCount = (nextQueue[index].retryCount || nextQueue[index].attempts || 0) + 1;
        nextQueue[index] = {
          ...nextQueue[index],
          retryCount,
          attempts: retryCount,
          status: retryCount >= MAX_ATTEMPTS ? "failed" : "pending",
          nextRetryAt:
            retryCount >= MAX_ATTEMPTS ? null : new Date(Date.now() + computeBackoff(retryCount)).toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }
    await writeQueueEntry(entry.key, nextQueue);
  }

  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: "offline-sync-complete", syncedCount }));
}

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
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/moe/") || url.pathname.startsWith("/api/auth")) return;

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
  if (event.tag !== SYNC_TAG) {
    return;
  }

  event.waitUntil(flushOfflineQueue());
});
