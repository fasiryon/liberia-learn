// P5-C lifecycle contract. Cache Storage is split by retention policy so an
// app update can remove re-fetchable bytes without touching signed content or
// the IndexedDB learner outbox.
const SW_VERSION = "p5c-2026-08-27-1";
const SHELL_CACHE = `liberialearn-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `liberialearn-runtime-${SW_VERSION}`;
const CONTENT_CACHE = `liberialearn-content-${SW_VERSION}`;
const CACHE_PREFIX = "liberialearn-";
const APP_SHELL = [
  "/",
  "/offline",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
const SYNC_TAG = "liberialearn-sync";
const ASSIGNMENT_DRAFT_SYNC_TAG = "submit-assignment-drafts";
const DRAFT_PREFIX = "assignment-draft::";
const QUEUE_PREFIX = "liberialearn_offline_queue::";
const IDB_NAME = "keyval-store";
const IDB_STORE = "keyval";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(async () => {
      // First install may activate immediately. An update waits for the
      // registration UI to request activation, preserving the old shell while
      // learner work is pending.
      if (!self.registration.active) await self.skipWaiting();
      else await notifyClients({ type: "pwa-update-available", version: SW_VERSION });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, RUNTIME_CACHE, CONTENT_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

async function notifyClients(message) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((client) => client.postMessage(message));
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type === "GET_PWA_STATE") {
    event.source?.postMessage({
      type: "pwa-state",
      version: SW_VERSION,
      shellCache: SHELL_CACHE,
      contentCache: CONTENT_CACHE,
    });
  }
});

function isProtectedRoute(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/guardian/login" ||
    pathname.startsWith("/guardian/login/") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/platform") ||
    pathname.startsWith("/moe")
  );
}

function isLessonPage(pathname) {
  return (
    pathname.startsWith("/student/lessons/") ||
    pathname.startsWith("/student/lesson/")
  );
}

function isLessonImage(request, pathname) {
  if (!pathname.startsWith("/student/")) return false;
  return request.destination === "image";
}

function isLessonFont(request, pathname) {
  if (!pathname.startsWith("/student/")) return false;
  return request.destination === "font";
}

function computeBackoff(attempts) {
  const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(backoff, MAX_BACKOFF_MS);
}

function retryOrDeadLetter(item, error) {
  const retryCount = (item.retryCount || item.attempts || 0) + 1;
  return {
    ...item,
    retryCount,
    attempts: retryCount,
    status: retryCount >= MAX_ATTEMPTS ? "failed" : "pending",
    syncState: retryCount >= MAX_ATTEMPTS ? "TERMINAL_FAILURE" : "RETRYABLE_FAILURE",
    nextRetryAt: retryCount >= MAX_ATTEMPTS
      ? null
      : new Date(Date.now() + computeBackoff(retryCount)).toISOString(),
    lastError: error,
    leaseExpiresAt: null,
    updatedAt: new Date().toISOString(),
  };
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

function isReady(item, queue) {
  if (!item || item.syncState === "AUTH_REQUIRED" || (item.status !== "pending" && !(item.status === "sending" && item.leaseExpiresAt && Date.parse(item.leaseExpiresAt) <= Date.now()))) return false;
  const dependencies = item.dependencyIds || [];
  const unresolved = queue.some((candidate) =>
    candidate.id !== item.id &&
    candidate.status !== "acknowledged" &&
    (dependencies.includes(candidate.id) || dependencies.includes(candidate.operationId))
  );
  if (unresolved) return false;
  if (!item.nextRetryAt) return true;
  return Date.parse(item.nextRetryAt) <= Date.now();
}

async function flushOfflineQueue() {
  const entries = await readAllQueueEntries();
  let syncedCount = 0;
  let conflictCount = 0;
  for (const entry of entries) {
    const readyItems = entry.queue.filter((item) => isReady(item, entry.queue));
    if (readyItems.length === 0) {
      continue;
    }

    const nextQueue = [...entry.queue];
    for (const item of readyItems) {
      try {
        const operation = {
          protocolVersion: item.protocolVersion || 1,
          operationId: item.operationId || item.opId || item.id,
          learnerId: item.learnerId || null,
          schoolId: item.schoolId || null,
          resourceType: item.resourceType || (item.entity === "studentProgress" ? "lesson_progress" : item.entity === "submission" ? "homework_submission" : null),
          resourceId: item.resourceId || item.scheduledWorkId,
          contentId: item.contentId || null,
          contentVersion: item.contentVersion || null,
          contentHash: item.contentHash || null,
          manifestSequence: item.manifestSequence || null,
          operationType: item.operationType || null,
          payload: item.payload || {},
          clientCreatedAt: item.clientCreatedAt || item.originalTimestamp || item.createdAt,
          baseServerVersion: item.baseServerVersion || null,
          idempotencyKey: item.idempotencyKey || item.opId || item.id,
          dependencyIds: item.dependencyIds || [],
        };
        const response = await fetch("/api/student/sync", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ protocolVersion: 1, items: [operation] }),
        });
        const resultBody = await response.json().catch(() => null);
        const result = resultBody && resultBody.results && resultBody.results[0];
        if (result && result.status === "conflict") {
          const index = nextQueue.findIndex((candidate) => candidate.id === item.id);
          if (index >= 0) {
            nextQueue[index] = {
              ...nextQueue[index],
              status: "conflict",
              syncState: "CONFLICT",
              nextRetryAt: null,
              conflict: {
                entity: result.entity,
                serverState: result.serverState,
                clientState: result.clientState || item.payload,
                resolutionHint: result.resolutionHint,
              },
              updatedAt: new Date().toISOString(),
            };
          }
          conflictCount += 1;
          continue;
        }
        if (result && result.status === "rejected" && result.resolutionHint !== "replay_deduped") {
          const index = nextQueue.findIndex((candidate) => candidate.id === item.id);
          if (index >= 0) {
            const retryable = ["retryable_server_failure", "concurrent_duplicate_retry"].includes(result.resolutionHint);
            nextQueue[index] = retryable
              ? retryOrDeadLetter(nextQueue[index], result.resolutionHint)
              : {
                  ...nextQueue[index],
                  status: "failed",
                  syncState: "TERMINAL_FAILURE",
                  nextRetryAt: null,
                  lastError: result.resolutionHint || "server_rejected_operation",
                  updatedAt: new Date().toISOString(),
                };
          }
          continue;
        }
        if (!response.ok) {
          const index = nextQueue.findIndex((candidate) => candidate.id === item.id);
          if (index >= 0) {
            const retryCount = (nextQueue[index].retryCount || nextQueue[index].attempts || 0) + 1;
            nextQueue[index] = {
              ...nextQueue[index],
              retryCount,
              attempts: retryCount,
              status: response.status === 401 || response.status === 403 || retryCount < MAX_ATTEMPTS ? "pending" : "failed",
              syncState: response.status === 401 || response.status === 403 ? "AUTH_REQUIRED" : retryCount < MAX_ATTEMPTS ? "RETRYABLE_FAILURE" : "TERMINAL_FAILURE",
              nextRetryAt: retryCount >= MAX_ATTEMPTS || response.status === 401 || response.status === 403 ? null : new Date(Date.now() + computeBackoff(retryCount)).toISOString(),
              lastError: resultBody && resultBody.error ? resultBody.error : `Sync request failed with status ${response.status}`,
              updatedAt: new Date().toISOString(),
            };
          }
          continue;
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
              syncState: retryCount >= MAX_ATTEMPTS ? "TERMINAL_FAILURE" : "RETRYABLE_FAILURE",
          nextRetryAt:
            retryCount >= MAX_ATTEMPTS ? null : new Date(Date.now() + computeBackoff(retryCount)).toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }
    await writeQueueEntry(entry.key, nextQueue);
  }

  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: "offline-sync-complete", syncedCount, conflictCount }));
}

async function networkFirst(request, cacheName = RUNTIME_CACHE) {
  try {
    const response = await fetch(request);

    if (request.method === "GET") {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone()).catch(() => null);
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request, { cacheName });
    if (cached) {
      return cached;
    }

    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline", { cacheName: SHELL_CACHE });
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

async function cacheFirst(request, cacheName = RUNTIME_CACHE) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone()).catch(() => null);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName = CONTENT_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => null);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return caches.match("/offline.html", { cacheName: SHELL_CACHE });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (isProtectedRoute(url.pathname) && !isLessonPage(url.pathname)) {
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request, RUNTIME_CACHE));
    return;
  }
  if (
    url.pathname !== "/" &&
    url.pathname !== "/offline" &&
    url.pathname !== "/offline.html" &&
    !url.pathname.startsWith("/student/")
  ) {
    return;
  }

  if (isLessonFont(event.request, url.pathname) || isLessonImage(event.request, url.pathname)) {
    event.respondWith(cacheFirst(event.request, CONTENT_CACHE));
    return;
  }

  if (isLessonPage(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request, CONTENT_CACHE));
    return;
  }

  event.respondWith(
    networkFirst(event.request, SHELL_CACHE).catch(
      async () =>
        (await caches.match("/offline.html")) ||
        new Response("Offline fallback unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        })
    )
  );
});

async function readAllDraftEntries() {
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
            const drafts = [];
            for (let i = 0; i < keys.length; i++) {
              if (typeof keys[i] === "string" && keys[i].startsWith(DRAFT_PREFIX)) {
                drafts.push({ key: keys[i], assignmentId: keys[i].slice(DRAFT_PREFIX.length), ...(values[i] || {}) });
              }
            }
            resolve(drafts);
          };
          transaction.onerror = () => reject(transaction.error || new Error("Unable to read drafts"));
        })
    )
    .catch(() => []);
}

async function deleteDraftEntry(key) {
  return openQueueDatabase()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(IDB_STORE, "readwrite");
          transaction.objectStore(IDB_STORE).delete(key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        })
    )
    .catch(() => null);
}

async function syncAssignmentDrafts() {
  // Assignment submissions are replayed only by the canonical outbox. These
  // entries are editor drafts, not a second submission queue; retaining them
  // prevents a legacy service worker from creating a duplicate submission.
  const drafts = await readAllDraftEntries();
  if (drafts.length && self.clients) {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: "offline-draft-pending", count: drafts.length });
    }
  }
}

// Background sync requires browser to remain open.
// Queue persists in IndexedDB but replay requires
// app to be reopened after connectivity restored.
// Planned: push-triggered sync in v1.1
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushOfflineQueue());
    return;
  }
  if (event.tag === ASSIGNMENT_DRAFT_SYNC_TAG) {
    event.waitUntil(syncAssignmentDrafts());
  }
});

// ===== Push Notifications =====
self.addEventListener("push", (event) => {
  let data = { title: "LiberiaLearn", body: "You have a new notification.", url: "/" };
  try {
    data = Object.assign(data, event.data ? event.data.json() : {});
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    fetch("/api/notifications/open", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urlPath: url }),
    }).catch(() => null).then(() => clients.matchAll({ type: "window", includeUncontrolled: true })).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
