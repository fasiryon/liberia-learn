// Audited Sprint 1 - single cache registration,
// single fetch handler, offline queue verified.
const CACHE_NAME = "liberialearn-v1";
const APP_SHELL = ["/", "/student/dashboard", "/teacher/dashboard", "/offline"];
const SYNC_TAG = "liberialearn-sync";
const QUEUE_PREFIX = "liberialearn_offline_queue::";
const IDB_NAME = "keyval-store";
const IDB_STORE = "keyval";
const MAX_ATTEMPTS = 5;
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

function applySyncResults(queue, results) {
  const resultById = new Map();
  (results || []).forEach((result) => {
    const key = result.opId || result.id;
    if (key) {
      resultById.set(key, result);
    }
  });

  const nextQueue = [];
  for (const item of queue) {
    const result = resultById.get(item.id) || resultById.get(item.opId);
    if (!result) {
      nextQueue.push(item);
      continue;
    }

    if (result.status === "synced") {
      continue;
    }

    if (result.status === "conflict") {
      nextQueue.push({
        ...item,
        status: "conflict",
        nextRetryAt: null,
        conflict: {
          entity: result.entity,
          serverState: result.serverState,
          clientState: result.clientState,
          resolutionHint: result.resolutionHint,
        },
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    const attempts = (item.attempts || 0) + 1;
    nextQueue.push({
      ...item,
      attempts,
      status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      lastError: "server_error",
      nextRetryAt:
        attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + computeBackoff(attempts)).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return nextQueue;
}

async function flushOfflineQueue() {
  const entries = await readAllQueueEntries();
  for (const entry of entries) {
    const readyItems = entry.queue.filter(isReady);
    if (readyItems.length === 0) {
      continue;
    }

    try {
      const response = await fetch("/api/student/sync", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: readyItems,
          queueStats: {
            pending: entry.queue.filter((item) => item.status === "pending").length,
            conflicts: entry.queue.filter((item) => item.status === "conflict").length,
            deadLetter: entry.queue.filter((item) => item.status === "failed").length,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync request failed with status ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));
      const nextQueue = Array.isArray(payload.results)
        ? applySyncResults(entry.queue, payload.results)
        : entry.queue.filter((item) => !readyItems.some((ready) => ready.id === item.id));
      await writeQueueEntry(entry.key, nextQueue);
    } catch (error) {
      console.warn("[SW] Background sync failed", error);
    }
  }
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
  if (event.tag !== SYNC_TAG) {
    return;
  }

  event.waitUntil(flushOfflineQueue());
});
