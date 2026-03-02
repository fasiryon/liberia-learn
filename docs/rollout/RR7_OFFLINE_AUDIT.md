# LiberiaLearn — RR-7 Offline Capability Audit

**Version:** 1.0.0
**Date:** 2026-03-02
**Branch:** main

---

## 1. Audit Scope

This document audits LiberiaLearn's offline capability infrastructure against the requirements for
rural Liberian schools with unreliable internet connectivity (2G/3G, frequent disconnects).

The audit covers six components:

1. Service Worker (`public/sw.js`)
2. Offline Queue (`lib/offline-queue.ts`)
3. Offline Cache (`lib/offline-cache.ts`)
4. Session Partitioning (`lib/offline-session.ts`)
5. Conflict Resolution (`lib/offline-sync/policies.ts`)
6. Server-Side Sync Endpoint (`app/api/student/sync/route.ts`)

---

## 2. Component Inventory

### 2.1 Service Worker (`public/sw.js`)

**Status:** Implemented — 183 lines

**Capabilities:**

- **Shell asset caching** — Pre-caches 5 shell assets on install (`/`, `/login`, `/offline`,
  `/icons/icon-192.png`, `/manifest.json`) into the `ll-v1` cache
- **Static asset cache-first** — `/_next/static/`, `/icons/`, and `/manifest.json` are served from
  cache first, then network. Response is cloned back to cache on network hit.
- **API request queuing** — All `/api/*` requests use network-only strategy. On fetch failure, the
  request (URL, method, body, headers) is queued in IndexedDB (`ll-offline` database, `queue`
  object store)
- **Background Sync** — Registers sync event tag `ll-sync` after queuing; `sync` event handler
  drains the queue when connectivity is restored
- **Navigation fallback** — Page navigation is network-first with cache fallback, ultimately serving
  `/offline` if both fail
- **Queue drain logic** — FIFO drain; on 5xx responses the item is left for the next sync; on
  successful response or `<500` status the item is removed
- **Skip paths** — `/api/track` and `/api/healthz` are not queued on failure (fire-and-forget)

**Queue item format (Service Worker):**
```json
{ "url": "...", "method": "POST", "body": "...", "headers": {...}, "timestamp": 1234567890 }
```

> **Important:** The service worker uses its own IndexedDB store (`ll-offline`/`queue`) with
> auto-incremented integer IDs. This is **separate** from the application-level offline queue
> (`lib/offline-queue.ts`) which uses `idb-keyval`. The SW queue handles raw HTTP replays; the app
> queue handles domain-level retry with exponential backoff, conflict detection, and partition
> isolation.

---

### 2.2 Offline Queue (`lib/offline-queue.ts`)

**Status:** Implemented — 213 lines

**Capabilities:**

- **Storage:** `idb-keyval` (IndexedDB wrapper) — browser-only; not available in Node.js
- **Partition isolation:** Queue keyed by session partition
  (`liberialearn_offline_queue::{partition.key}`). Each user/device combination has its own queue
  namespace, preventing cross-user data leakage.
- **Idempotent enqueue:** Re-enqueuing the same `scheduledWorkId` updates the existing entry (no
  duplicate)
- **Exponential backoff:** `BASE_BACKOFF=5s`, `MAX_BACKOFF=5min`, `MAX_ATTEMPTS=5`. Failed items
  are hidden from `getReadyQueue()` until the backoff window expires.
- **FIFO drain:** `getReadyQueue()` returns pending items sorted by `createdAt` ascending
- **Item statuses:** `pending | failed | conflict`
  - `pending` — awaiting sync
  - `failed` — exhausted max attempts (dead-letter); excluded from ready queue but inspectable
  - `conflict` — server state conflict detected; requires manual resolution or discard
- **Conflict handling:** `markSyncConflict()` records server/client states and resolution hint;
  `retryConflicts()` resets to pending; `discardConflicts()` removes
- **Conflict protection:** `markSyncFailure()` never mutates a `conflict`-status item
- **Operations supported (v1.0.0):** `enqueueCompletion(scheduledWorkId, completedAt)` — student
  lesson completion
- **Operations documented as future (ACTION-OFFLINE-1):** `lesson.completed` (wiring),
  `lab.session.update`, `lesson.delivered`

**Key exports:**

| Function | Description |
|----------|-------------|
| `enqueueCompletion(scheduledWorkId, completedAt, partition?)` | Queue a lesson completion |
| `getQueue(partition?)` | All items in partition queue |
| `getReadyQueue(partition?)` | Pending items past backoff, FIFO |
| `markSyncSuccess(ids)` | Remove synced items |
| `markSyncFailure(ids, reason)` | Apply backoff; dead-letter at max attempts |
| `markSyncConflict(conflicts)` | Set conflict state |
| `retryConflicts(ids)` | Reset conflicts to pending |
| `discardConflicts(ids)` | Remove conflict items |
| `getQueueStats(partition?)` | `{ queuePending, queueConflicts, queueDeadLetter }` |
| `isOnline()` | `navigator.onLine` check (browser only) |

---

### 2.3 Offline Cache (`lib/offline-cache.ts`)

**Status:** Implemented — 196 lines

**Capabilities:**

- **Storage:** `idb-keyval` (browser-only)
- **TTL:** 7 days (configurable via `configureCacheLifecycle`)
- **Max storage:** 25 MB with LRU eviction when exceeded
- **Partition isolation:** Cache keyed by session partition, matching the offline queue namespace
- **API:** `cachePack(scope, scopeId, version, payload, partition)` /
  `getCachedPack(scope, scopeId, partition)`
- **Scopes:** `scheduledWork`, `curriculumContent` — content packs for offline lesson delivery
- **Versioned cache:** `packVersion` field enables invalidation when content changes
- **Cache stats:** `getCacheStats(partition)` returns `{ cachePacksCount, cacheBytes }`

---

### 2.4 Session Partitioning (`lib/offline-session.ts`)

**Status:** Implemented — 138 lines, `"use client"` directive

**Capabilities:**

- **Identity sources:** `userId` (authenticated), `kioskStudentId` (kiosk mode), `schoolId`,
  `deviceId`
- **Device persistence:** `liberialearn_device_id` stored in `localStorage`; generated on first
  visit using `crypto.randomUUID()`
- **Partition key format:**
  - Authenticated: `u:{userId}|s:{schoolId}|d:{deviceId}`
  - Kiosk: `k:{kioskStudentId}|s:{schoolId}|d:{deviceId}`
  - Anonymous: `anon|s:{schoolId}|d:{deviceId}`
- **Session detection:** `detectAndSetActiveSessionPartition()` calls `/api/auth/session` to set the
  current user's partition
- **Logout safety:** `clearStoredSessionIdentity()` removes user/kiosk/school identity from
  `localStorage`; device ID is preserved for continuity
- **Cross-user isolation:** Different partition keys mean different queue and cache namespaces —
  student A cannot see student B's offline data on a shared device

---

### 2.5 Conflict Resolution (`lib/offline-sync/policies.ts`)

**Status:** Implemented — 72 lines

**Policies:**

| Entity | Resolution Strategy |
|--------|---------------------|
| `attendance` | Last-write-wins by timestamp. If `server.markedAt > client.clientUpdatedAt`: conflict returned (client is stale). Otherwise: client update applied. |
| `submission` | If server has `teacherScore != null` or `aiReviewed = true`: always conflict (`submission_graded_server_wins`). Otherwise: last-write-wins by timestamp. |

**Exports:**

- `resolveAttendance(server, client)` → `{ action: "apply" | "conflict", markedAt, hint }`
- `resolveSubmission(server, client)` → `{ action: "apply" | "conflict", submittedAt, hint }`

---

### 2.6 Server-Side Sync Endpoint (`app/api/student/sync/route.ts`)

**Status:** Implemented — 259 lines

**Capabilities:**

- **Method:** `POST /api/student/sync`
- **Auth:** `requireRole("STUDENT")` — authenticated students only
- **Accepted entities:**

  | Entity | Operation |
  |--------|-----------|
  | `studentProgress` | Upsert lesson completion (last-write-wins by timestamp; conflict if server is newer) |
  | `attendance` | Upsert attendance record (delegates to `resolveAttendance`) |
  | `submission` | Upsert homework submission (delegates to `resolveSubmission`) |

- **Response:** `{ synced: N, skipped: N, results: [...] }` — per-item status
  (`synced | skipped | conflict`)
- **Conflict response format:** `{ status: "conflict", opId, entity, scheduledWorkId, serverState,
  clientState, resolutionHint }`
- **Metrics:** Records `sync.attempt`, `offline.queue.pending/conflicts/dead_letter`, `sync.result`
  metric events
- **Audit:** `logAudit` fired with `action: "offline.sync"` on every completion
- **Error isolation:** Per-item try/catch — one item failing does not abort the batch

---

## 3. Offline-Capable Routes

Five routes are identified as offline-capable queue candidates:

| Route | Method | Purpose | Queue Status |
|-------|--------|---------|--------------|
| `app/api/teacher/schedule/[id]/deliver/route.ts` | POST | Teacher marks lesson delivered | ACTION-OFFLINE-1: `lesson.delivered` not yet wired |
| `app/api/student/labs/[labId]/session/route.ts` | POST | Create lab session | Not queued |
| `app/api/student/labs/sessions/[sessionId]/route.ts` | PUT | Update lab session progress | ACTION-OFFLINE-1: `lab.session.update` not yet wired |
| `app/api/student/work/[scheduledWorkId]/route.ts` | GET | Load scheduled work for offline | Cache-only (read); not queued |
| `app/api/student/work/[scheduledWorkId]/complete/route.ts` | POST | Mark work complete | ACTION-OFFLINE-1: `lesson.completed` wiring pending |

The sync endpoint `/api/student/sync` accepts `studentProgress` items (lesson completions) that
were queued offline and is the primary path for draining the app-level queue.

---

## 4. Gap Analysis

### 4.1 ACTION-OFFLINE-1 (Documented Future Work)

The following queue operations are documented in the platform roadmap but not yet wired to
`lib/offline-queue.ts`:

| Op Type | Route | Gap Description |
|---------|-------|-----------------|
| `lesson.completed` | `/api/student/work/[id]/complete` | Route exists; not wired to enqueue on failure |
| `lab.session.update` | `/api/student/labs/sessions/[sessionId]` | Route exists; not wired to enqueue on failure |
| `lesson.delivered` | `/api/teacher/schedule/[id]/deliver` | Route exists; not wired to enqueue on failure |

**Current behaviour:** The service worker queues the raw HTTP request for replay on reconnect. This
covers basic connectivity resilience for all three routes.

**Mitigation:** Service worker HTTP-replay covers all `/api/*` routes. For v1.0.0 deployment, this
is acceptable for initial rollout. Full domain-queue integration (partition isolation, backoff,
conflict detection) is planned for v1.1.

### 4.2 Dual Queue Architecture

The platform maintains two separate queue systems:

| System | Storage | Purpose | Scope |
|--------|---------|---------|-------|
| Service Worker queue (`ll-offline/queue`) | Raw IndexedDB | HTTP replay for all failed API requests | All `/api/*` routes |
| App queue (`lib/offline-queue.ts`) | idb-keyval | Domain-level retry with partition isolation, backoff, conflict detection | `studentProgress` (v1.0.0) |

These two systems operate independently. For v1.0.0, only `studentProgress` uses the app queue.
Other operations fall back to SW-level HTTP replay only.

### 4.3 Node.js Test Environment Constraint

`lib/offline-queue.ts` and `lib/offline-cache.ts` use `idb-keyval`, which wraps IndexedDB — a
browser-only API. Existing tests mock `idb-keyval` with a `Map`-backed implementation:

```typescript
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: any) => { store.set(key, value); }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));
```

The acceptance harness (`lib/offline/offlineQueue.ts`) uses a native `Map` directly — no browser
mocking required, no async complexity.

---

## 5. PWA Registration

- **Service worker registration:** `components/ServiceWorkerRegistration.tsx` — registers
  `public/sw.js` with `scope: "/"` on `DOMContentLoaded` in production builds
- **PWA manifest:** `public/manifest.json` — enables Add-to-Home-Screen on Android/Chrome for
  offline-first app experience on low-cost Android devices common in Liberian schools

---

## 6. Summary Findings

| Capability | Status | Notes |
|-----------|--------|-------|
| Service worker (cache-first static, queue API fails) | ✅ Implemented | 183 lines, deployed |
| PWA manifest + SW registration | ✅ Implemented | |
| Offline queue (partition-isolated, backoff, conflict) | ✅ Implemented | idb-keyval; browser-only |
| Offline content cache (TTL, LRU, partitioned) | ✅ Implemented | 7-day TTL, 25 MB max |
| Session partition isolation (cross-user safety) | ✅ Implemented | |
| Conflict resolution policies (attendance, submission) | ✅ Implemented | |
| Server-side sync endpoint (3 entity types) | ✅ Implemented | |
| Sync metrics + audit logging | ✅ Implemented | |
| `lesson.completed` queue wiring | ⚠️ Gap (ACTION-OFFLINE-1) | SW fallback active |
| `lab.session.update` queue wiring | ⚠️ Gap (ACTION-OFFLINE-1) | SW fallback active |
| `lesson.delivered` queue wiring | ⚠️ Gap (ACTION-OFFLINE-1) | SW fallback active |
| In-memory queue for acceptance tests | ✅ Implemented | `lib/offline/offlineQueue.ts` |

**Verdict:** Offline infrastructure is production-ready for v1.0.0. The three ACTION-OFFLINE-1 gaps
have service-worker-level fallback coverage. Full domain-queue integration is planned for v1.1.
