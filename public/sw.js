// P5-C lifecycle contract, hardened by the offline/low-end V1 pass (P5-E).
// Cache Storage is split by retention policy so an app update can remove
// re-fetchable bytes without touching signed content or the IndexedDB learner
// outbox. Learner-rendered pages are private: they live only in a cache bound
// to the active learner partition and are deleted when that learner changes.
const SW_VERSION = "p5e-2026-09-24-1";
const SHELL_CACHE = `liberialearn-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `liberialearn-runtime-${SW_VERSION}`;
const CONTENT_CACHE = `liberialearn-content-${SW_VERSION}`;
const LEARNER_CACHE_PREFIX = `liberialearn-learner-${SW_VERSION}-`;
const CACHE_PREFIX = "liberialearn-";
const APP_SHELL = [
  "/",
  "/offline",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
// Entry caps keep Cache Storage bounded on low-storage devices. Lesson bytes
// with trust metadata live in IndexedDB under their own byte budget.
const CACHE_LIMITS = {
  [RUNTIME_CACHE]: 200,
  [CONTENT_CACHE]: 150,
  learner: 60,
};
// On weak 2G/3G a navigation can take many seconds. When a cached copy of the
// learner's own page exists, serve it after this delay and let the network
// response refresh the cache in the background.
const SLOW_NETWORK_FALLBACK_MS = 6000;
const SYNC_TAG = "liberialearn-sync";
const ASSIGNMENT_DRAFT_SYNC_TAG = "submit-assignment-drafts";
const DRAFT_PREFIX = "assignment-draft::";
const QUEUE_PREFIX = "liberialearn_offline_queue::";
const ACTIVE_PARTITION_KEY = "liberialearn_active_partition";
const IDB_NAME = "keyval-store";
const IDB_STORE = "keyval";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const ACKNOWLEDGED_STATUSES = ["synced", "skipped"];
const RETRYABLE_HINTS = ["retryable_server_failure", "concurrent_duplicate_retry"];

// undefined = not loaded since this worker started; null = no learner.
let activePartitionKey;

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
          .filter((key) =>
            key.startsWith(CACHE_PREFIX) &&
            ![SHELL_CACHE, RUNTIME_CACHE, CONTENT_CACHE].includes(key) &&
            !key.startsWith(LEARNER_CACHE_PREFIX))
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
  const type = event.data?.type;
  if (type === "ACTIVATE_UPDATE") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (type === "GET_PWA_STATE") {
    event.source?.postMessage({
      type: "pwa-state",
      version: SW_VERSION,
      shellCache: SHELL_CACHE,
      contentCache: CONTENT_CACHE,
    });
    return;
  }
  if (type === "SET_ACTIVE_PARTITION") {
    const key = typeof event.data.key === "string" && event.data.key ? event.data.key : null;
    event.waitUntil(setActivePartition(key));
    return;
  }
  if (type === "CLEAR_LEARNER_CACHES") {
    event.waitUntil(setActivePartition(null).then(() => deleteKey(ACTIVE_PARTITION_KEY)).catch(() => null));
    return;
  }
  if (type === "SYNC_NOW") {
    event.waitUntil(flushOfflineQueue());
  }
});

// ---------- Active learner partition ----------

async function hashPartition(key) {
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function learnerCacheName(key) {
  return `${LEARNER_CACHE_PREFIX}${await hashPartition(key)}`;
}

/** Only one learner's private page cache may exist at a time. Changing or
 * clearing the learner deletes every other learner cache (shared devices). */
async function setActivePartition(key) {
  activePartitionKey = key;
  const keep = key ? await learnerCacheName(key) : null;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((name) => name.startsWith(`${CACHE_PREFIX}learner-`) && name !== keep)
      .map((name) => caches.delete(name)),
  );
}

async function getActivePartitionKey() {
  if (activePartitionKey !== undefined) return activePartitionKey;
  try {
    const record = await readKey(ACTIVE_PARTITION_KEY);
    activePartitionKey = record && typeof record.key === "string" && record.key ? record.key : null;
  } catch {
    activePartitionKey = null;
  }
  return activePartitionKey;
}

// ---------- Routing ----------

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

/** Reaching sign-in or sign-out means the bound learner may be changing on
 * a shared device: drop learner page caches before anyone else signs in. */
function isSessionBoundary(pathname) {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signout" || pathname.startsWith("/signout/");
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

/** A response may be stored only if it is the page that was asked for. A
 * redirect (login, PIN change) or error must never be replayed offline. */
function isCacheableResponse(response) {
  return Boolean(response) && response.ok && !response.redirected && (response.type === "basic" || response.type === "default");
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function putBounded(cacheName, request, response, maxEntries) {
  if (!isCacheableResponse(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone()).catch(() => null);
  await trimCache(cacheName, maxEntries).catch(() => null);
}

async function offlineFallback(request) {
  if (request.mode === "navigate") {
    const offlinePage = (await caches.match("/offline", { cacheName: SHELL_CACHE })) ||
      (await caches.match("/offline.html", { cacheName: SHELL_CACHE }));
    if (offlinePage) return offlinePage;
  }
  return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
}

/** Public shell documents: refresh the exact install-time URL only, so the
 * shell cache stays the fixed APP_SHELL set. */
async function networkFirstShell(request) {
  const cacheName = SHELL_CACHE;
  try {
    const response = await fetch(request);
    if (!new URL(request.url).search && isCacheableResponse(response)) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone()).catch(() => null);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { cacheName });
    if (cached) return cached;
    return offlineFallback(request);
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  const response = await fetch(request);
  await putBounded(cacheName, request, response, maxEntries);
  return response;
}

/** Learner-private pages: network first, cached copy only from the active
 * learner's own cache, never shared between learners. With no known learner
 * the page is network-only with the offline shell as fallback. */
async function learnerPage(request, { slowFallback }) {
  const key = await getActivePartitionKey();
  if (!key) {
    try {
      return await fetch(request);
    } catch {
      return offlineFallback(request);
    }
  }
  const cacheName = await learnerCacheName(key);
  const network = fetch(request).then(async (response) => {
    // The learner may have changed while the request was in flight.
    if ((await getActivePartitionKey()) === key) {
      await putBounded(cacheName, request, response, CACHE_LIMITS.learner);
    }
    return response;
  });
  const cachedLookup = caches.match(request, { cacheName });
  if (slowFallback) {
    const cached = await cachedLookup;
    if (cached) {
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), SLOW_NETWORK_FALLBACK_MS));
      const winner = await Promise.race([network.catch(() => null), timeout]);
      if (winner) return winner;
      network.catch(() => null);
      return cached;
    }
  }
  try {
    return await network;
  } catch {
    const cached = await cachedLookup;
    return cached || offlineFallback(request);
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && isSessionBoundary(url.pathname)) {
    event.waitUntil(setActivePartition(null).then(() => deleteKey(ACTIVE_PARTITION_KEY)).catch(() => null));
  }
  if (isProtectedRoute(url.pathname) && !isLessonPage(url.pathname)) {
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request, RUNTIME_CACHE, CACHE_LIMITS[RUNTIME_CACHE]));
    return;
  }
  if (url.pathname === "/" || url.pathname === "/offline" || url.pathname === "/offline.html") {
    event.respondWith(networkFirstShell(event.request));
    return;
  }
  if (!url.pathname.startsWith("/student/")) return;

  if (isLessonFont(event.request, url.pathname) || isLessonImage(event.request, url.pathname)) {
    event.respondWith(cacheFirst(event.request, CONTENT_CACHE, CACHE_LIMITS[CONTENT_CACHE]));
    return;
  }

  event.respondWith(learnerPage(event.request, { slowFallback: isLessonPage(url.pathname) }));
});

// ---------- IndexedDB (idb-keyval compatible) ----------

function openQueueDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME);
    // Create the store exactly as idb-keyval does. Opening without an
    // upgrade handler would create an empty database that idb-keyval can
    // never upgrade, permanently breaking the outbox on a fresh device.
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) request.result.createObjectStore(IDB_STORE);
    };
    request.onerror = () => reject(request.error || new Error("Unable to open offline queue database"));
    request.onsuccess = () => resolve(request.result);
  });
}

function readKey(key) {
  return openQueueDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, "readonly");
        const read = transaction.objectStore(IDB_STORE).get(key);
        transaction.oncomplete = () => resolve(read.result);
        transaction.onerror = () => reject(transaction.error || new Error("Unable to read offline key"));
      }),
  );
}

function deleteKey(key) {
  return openQueueDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, "readwrite");
        transaction.objectStore(IDB_STORE).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Unable to delete offline key"));
      }),
  );
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

// ---------- Outbox replay ----------

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

/** Connectivity loss is not a server verdict: keep the operation pending
 * without spending its retry budget so network flapping cannot quarantine
 * learner work. */
function deferForNetwork(item) {
  return {
    ...item,
    status: "pending",
    syncState: "RETRYABLE_FAILURE",
    networkDeferrals: (item.networkDeferrals || 0) + 1,
    nextRetryAt: null,
    leaseExpiresAt: null,
    lastError: "network_unavailable",
    updatedAt: new Date().toISOString(),
  };
}

function holdForAuth(item, error) {
  return {
    ...item,
    status: "pending",
    syncState: "AUTH_REQUIRED",
    nextRetryAt: null,
    leaseExpiresAt: null,
    lastError: error,
    updatedAt: new Date().toISOString(),
  };
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

function toOperation(item) {
  return {
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
}

async function flushOfflineQueue() {
  // Replay only the signed-in learner's partition. Other partitions on a
  // shared device would be sent under the wrong session and quarantined.
  const partitionKey = await getActivePartitionKey();
  if (!partitionKey) return;
  const queueKey = `${QUEUE_PREFIX}${partitionKey}`;
  const queue = await readKey(queueKey).catch(() => null);
  if (!Array.isArray(queue)) return;
  const readyItems = queue.filter((item) => isReady(item, queue));
  if (readyItems.length === 0) return;

  let syncedCount = 0;
  let conflictCount = 0;
  const nextQueue = [...queue];
  const replace = (item, next) => {
    const index = nextQueue.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) nextQueue[index] = next(nextQueue[index]);
  };

  for (const item of readyItems) {
    let response;
    try {
      response = await fetch("/api/student/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolVersion: 1, items: [toOperation(item)] }),
      });
    } catch (error) {
      console.warn("[SW] Background sync deferred: network unavailable");
      replace(item, deferForNetwork);
      break;
    }
    const resultBody = await response.json().catch(() => null);
    const result = resultBody && Array.isArray(resultBody.results) ? resultBody.results[0] : null;

    if (response.redirected || response.status === 401 || response.status === 403) {
      replace(item, (current) => holdForAuth(current, response.redirected ? "auth_redirected" : `auth_required_${response.status}`));
      continue;
    }
    if (!response.ok) {
      replace(item, (current) => retryOrDeadLetter(current, (resultBody && resultBody.error) || `HTTP ${response.status}`));
      continue;
    }
    if (result && result.status === "conflict") {
      replace(item, (current) => ({
        ...current,
        status: "conflict",
        syncState: "CONFLICT",
        nextRetryAt: null,
        leaseExpiresAt: null,
        conflict: {
          entity: result.entity,
          serverState: result.serverState,
          clientState: result.clientState || item.payload,
          resolutionHint: result.resolutionHint,
        },
        updatedAt: new Date().toISOString(),
      }));
      conflictCount += 1;
      continue;
    }
    const acknowledged = result && (ACKNOWLEDGED_STATUSES.includes(result.status) ||
      (result.status === "rejected" && result.resolutionHint === "replay_deduped"));
    if (acknowledged) {
      syncedCount += 1;
      const index = nextQueue.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) nextQueue.splice(index, 1);
      continue;
    }
    if (result && result.status === "rejected") {
      replace(item, (current) => RETRYABLE_HINTS.includes(result.resolutionHint)
        ? retryOrDeadLetter(current, result.resolutionHint)
        : {
            ...current,
            status: "failed",
            syncState: "TERMINAL_FAILURE",
            nextRetryAt: null,
            leaseExpiresAt: null,
            lastError: result.resolutionHint || "server_rejected_operation",
            updatedAt: new Date().toISOString(),
          });
      continue;
    }
    // A 200 without a per-operation verdict is not proof of storage. Keep
    // the operation and retry; never delete learner work on an unknown reply.
    replace(item, (current) => retryOrDeadLetter(current, "sync_response_unrecognized"));
  }

  await writeQueueEntry(queueKey, nextQueue);
  await notifyClients({ type: "offline-sync-complete", syncedCount, conflictCount });
}

// ---------- Assignment drafts (editor state only) ----------

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
