# P5-E Offline, Low-End Android, and Sync Hardening V1

Status: engineering complete on `feat/offline-sync-hardening-v1` (2026-09-23).
Builds on P5-A (signed content trust), P5-B (sync contract,
`OFFLINE_SYNCHRONIZATION_P5B.md`), P5-C (PWA lifecycle, `PWA_LIFECYCLE_P5C.md`),
and P5-D (storage management, `OFFLINE_STORAGE_P5D.md`). No second offline
authority, queue, or cache was added.

## Offline authority model (unchanged, now enforced at more boundaries)

The server is canonical. The device may hold signed, release-pinned lesson
content, one learner's rendered pages, issued activities, local UI state,
quiz drafts, and pending operations in the P5-B outbox. The device never
scores, updates mastery, changes grade or enrollment, approves evidence,
creates a `LearningDecision`, publishes curriculum, or resolves overrides.

- Offline quiz attempts carry answers only. The server stores them unscored
  (`offline_pending_review`, `score: null`). The quiz panel no longer shows
  "Score 0%" for an offline attempt; it states that the answers are saved and
  not yet scored.
- Answer keys stay server-side: quiz payloads are projected without
  `correctIndex`, and the key lives in the sealed quiz session cookie.
- Mastery events and simulation state remain `NOT_SUPPORTED_OFFLINE`.

## Defects found and fixed

| Area | Defect | Fix |
| --- | --- | --- |
| Shared-device privacy | The service worker cached every `/student/*` page by URL in one shared cache, so learner A's pages could be served offline to learner B. Redirects, including login redirects, were also cached. | Learner pages live only in a cache bound to the active learner partition. Changing learner, logging out, or having no bound learner deletes the other learner page caches. Redirects and error responses are never cached. |
| Silent data loss | Both outbox drains treated any `200` without a per-operation verdict as success and deleted the operation. For example, a forced PIN change redirects `/api/student/sync` to an HTML page. | An operation is removed only for `synced`, `skipped`, or `replay_deduped`. A redirect holds it as `AUTH_REQUIRED`. An unknown reply is kept and retried. |
| Cross-learner replay | Background sync replayed every learner partition under the current cookie, so other learners' work was quarantined as `learner_identity_mismatch`. | The worker replays only the bound learner partition. With no bound learner, it replays nothing. |
| Network flapping | Three network errors on weak 2G/3G moved learner work to `TERMINAL_FAILURE`. | A network error defers the operation. It keeps its ID and retry budget and is immediately ready on the next trigger. Only server verdicts spend retries. |
| Duplicate evidence and retries | A new lesson-progress edit could coalesce into an operation that was in flight or already sent. The server then rejected it as `idempotency_key_payload_mismatch`, and it became terminal. | Edits coalesce only into operations the server can never have seen. |
| Duplicate quiz attempts | A lost online submit followed by an offline save recorded two attempts. | One `clientAttemptId` is persisted with the quiz draft and used by both the online submit and the outbox. The online route replays a recorded attempt before checking its one-shot session. The sync route acknowledges an attempt that is already recorded. |
| Fresh-device outbox | If the service worker opened `keyval-store` first, it created an empty database that `idb-keyval` could never upgrade. | The worker creates the `keyval` store exactly as `idb-keyval` does. |
| Interrupted drain | Unsent items stayed leased for 60 seconds after a mid-queue failure. | Unsent leases are released at once. |
| Unbounded Cache Storage | Runtime, content, and page caches had no cap. | Runtime has 200 entries, content has 150, and learner pages have 60. The shell holds only the fixed install set. |

## Cache strategy

| Cache | Contents | Policy | Bound |
| --- | --- | --- | --- |
| `liberialearn-shell-<v>` | `/`, `/offline`, `/offline.html`, manifest, icons | Network-first. Only exact install URLs are refreshed. | Fixed set |
| `liberialearn-runtime-<v>` | Hashed `/_next/static` | Cache-first | 200 entries |
| `liberialearn-content-<v>` | Lesson images and fonts under `/student/` | Cache-first | 150 entries |
| `liberialearn-learner-<v>-<partition hash>` | One learner's rendered `/student/*` pages | Network-first. If the network gives no answer within 6 s, lesson pages fall back to the cached copy. | 60 entries, one learner at a time |
| IndexedDB (P5-A/P5-D) | Signed lesson packs and the outbox | Unchanged: trust-verified, 25 MiB content budget, and the outbox is never evicted | P5-D |

A service worker update deletes all caches from older versions. That includes
the P5-C shared page cache, which may hold private pages. The update never
touches IndexedDB.

## Sync queue behavior

The P5-B outbox is unchanged apart from the rules below. It uses stable
operation IDs, idempotency keys, dependency ordering, bounded exponential
backoff for server failures (3 attempts), leases, and conflict retention.

- Single-flight drain. Mount, `online`, visibility, and service worker
  triggers share one drain.
- `online` bursts are debounced by 2 s.
- Only explicit verdicts remove an operation.
- Network loss defers operations and never counts toward terminal failure.
- `AUTH_REQUIRED` holds work until sign-in and never replays under a
  different identity.
- `TERMINAL_FAILURE` is the quarantine state. It stays visible, and the
  learner can retry it with **Try again** (`retryFailedOperations`). The app
  never deletes it.
- Conflicts are retained with the server state and resolution hint. Examples
  are a release that changed while offline (`content_version_changed`) and
  graded work.

## Connectivity transitions

| Transition | Behavior |
| --- | --- |
| Online to offline mid-lesson | The page comes from the learner cache or the offline shell. Progress and quiz drafts persist in IndexedDB, and submits go to the outbox. |
| Offline to online, or flapping | A debounced single drain runs. Deferred operations are ready at once. |
| App killed while pending | The outbox persists. Leased operations recover after the lease expires. Visibility and mount trigger a drain. |
| Expired session or token | `AUTH_REQUIRED` hold. A banner shows "sign in again". |
| Release changed offline | The server returns a conflict. The operation is retained. |
| Student changes device | Server state is canonical. Local-only pending work stays on the old device until it syncs. |
| Shared-device learner switch | The worker deletes the previous learner's page cache. Outbox partitions are keyed by learner and are never drained by another learner. |
| Partial sync success | Only acknowledged operations are removed. |
| Service worker update during pending work | The outbox is untouched, and the update waits for the learner. |

## Low-end Android and data efficiency

- **No background polling while hidden or offline.** `useVisibleInterval`
  now drives the student sidebar unread count (60 s), notification bell
  (60 s), live-session banner (30 s), and open message thread (15 s).
- **Measured request savings.** A student tab left open in the background
  previously made about 242 requests an hour from these timers, or 482 with
  a message thread open. It now makes 0 while hidden or offline.
- **No IndexedDB polling.** The 10 s `SyncManager` IndexedDB poll (360 reads
  an hour) was replaced by queue-change events, delivered through a window
  event and a `BroadcastChannel`.
- **No update timer.** The 30-minute service worker update timer was replaced
  by a check when the tab becomes visible, at most once every 30 minutes.
- **Video watch telemetry.** It is sent only when watch time changed and the
  device is online, plus on pause and end. Before, it was sent every 30 s
  regardless.
- **Slow lesson fallback.** Lesson pages fall back to the learner's cached
  copy after 6 s on a stalled link.

The real-browser suite (`e2e/p5e-offline-hardening.spec.ts`) records a
constrained-device measurement in both the desktop and Pixel 5 projects:

- 4x CPU throttle
- 400 ms latency
- 400 kbit/s
- cold `/offline` transfer bytes and JS bytes
- cached offline launch time

The measurement is written to the CI log as `[p5e-measurement]`. The suite
asserts that the offline launch finishes in under 5 s. The repository had no
client performance budget before this pass. This is the first budget, and it
is deliberately conservative.

## Failure UX

Learners see explicit states for each of these:

- offline, with the number of saved items
- items waiting to sync while online
- syncing
- synced
- sign-in expired, with a sign-in link
- could not sync, with **Try again**
- needs review, linking to `/student/offline-status`
- offline quiz answers saved and not scored

None of these states reports success before the server confirms it.

## Tests

- `__tests__/sw.hardening-v1.test.ts` runs the real `public/sw.js` in a VM
  with fake-indexeddb, 16 cases:
  - shared-device switch and logout
  - no-learner network-only mode
  - redirect and error never cached
  - restart rebinding
  - bounded cache
  - update cleanup
  - slow-network fallback
  - partition-scoped replay
  - unknown 200
  - redirected sync
  - flapping
  - `replay_deduped`
  - fresh-device store creation
  - sign-in page unbinds the learner
- `__tests__/offline-hardening-v1.test.ts` covers the client outbox,
  20 cases:
  - lost-response replay
  - single-flight
  - in-flight and after-send coalescing
  - flapping
  - interrupted drain
  - killed app and lease recovery
  - expired auth
  - redirect
  - tampered record
  - quarantine and retry
  - stale release conflict
  - partial success
  - low storage (outbox and quiz)
  - shared device
  - learner-unbound and cross-learner operations
  - event-driven status
- `__tests__/quiz-attempt.idempotency.test.ts` covers online replay, offline
  pending review, cross-learner ID conflict, malformed ID, and sync dedupe
  (7 cases).
- `__tests__/lesson-release-binding.test.ts` covers missing identity,
  missing version or hash, older release, mismatched bytes, cross-lesson
  replay, unbound learner, and the accepted current release (7 cases).
- `__tests__/offline-cache-session.test.ts` covers confirmed logout that
  keeps pending work isolated, and `__tests__/sprint11.pwa.test.ts` covers
  partitioned assignment drafts.
- `e2e/p5e-offline-hardening.spec.ts` runs in a real browser in CI's PWA job
  on desktop and Pixel 5:
  - a login redirect is not cached
  - offline launch
  - shared-device cache deletion
  - partition-scoped replay held under expired auth
  - outbox survives a worker update
  - constrained-device measurement

## Shared-device logout and learner switch (founder policy, 2026-09-24)

Shared-device privacy wins over keeping an offline learner's session open.

| Step | Behavior |
| --- | --- |
| Logout requested | The app tries a best-effort sync first. |
| Unsynced work remains | The learner is warned how many items are unsynced, that they stay saved under their account only, and that they sync at their next sign-in on this device. They choose **Sign out and keep my work for later** or **Stay signed in**. |
| Confirmed | Logout always completes (`safeLogout({ keepPendingWork: true })`, then `signOut`). The next learner never enters the prior account. |
| Pending work | It is kept, never discarded. It stays in the outbox partition `u:<learner>\|s:<school>\|d:<device>`, and every operation keeps its `learnerId`. |
| Learner-visible projection | Removed. The stored identity is cleared, the learner's lesson packs and route references are purged, and the service worker is unbound. All learner page caches are deleted. |
| Replay | Only after the same learner signs in again on this device. Partition resolution returns the same key, and `SyncManager` drains it. |
| Cross-learner replay | Blocked at three layers. The service worker replays only the bound partition. The client drain refuses operations whose `learnerId` is missing or differs from the partition (`learner_identity_unbound`, retained). The server rejects a missing or mismatched `learnerId`. |
| Session boundary | Any navigation to `/login` or `/signout` unbinds the service worker and deletes learner page caches before the next learner signs in. |

Assignment drafts were previously stored unpartitioned
(`assignment-draft::<assignmentId>`), so the next learner could load the
previous learner's draft for the same assignment. They are now keyed by
learner partition. Legacy unpartitioned drafts are never read. Quiz drafts
and lesson reading progress were already partitioned.

Pending work is isolated by partition key and learner binding. It is **not
encrypted** at rest: anyone with developer tools on the same browser profile
can read IndexedDB. Browser-side encryption would need a key held somewhere
the next learner cannot reach, which this PWA cannot guarantee offline.

## Lesson completion release binding

Lesson completion reuses the existing release authority,
`CurriculumContent.contentId`, `version`, and `hash`. The lesson work API
already returns these as `contentId`, `contentVersion`, and `contentHash`,
and the offline lesson reference preserves them.

- **Client.** An offline completion is queued only when the lesson carries
  `contentId` and `contentVersion`. Otherwise the learner is told it must be
  completed online.
- **Server.** A `lesson_progress` operation without `contentId` and
  `contentVersion`, or without the hash when the published row has one, is
  rejected (`lesson_release_identity_required`). It no longer passes as
  "legacy".
- **Older release.** A completion recorded against an older version is held
  as a `content_version_changed` conflict.
- **Different bytes.** A completion with a mismatched hash is held as a
  `content_hash_mismatch` conflict.
- **Different lesson's content.** It is rejected
  (`scheduled_work_tenant_or_content_mismatch`).
- **In every non-accepted case,** no progress is written.

## External readiness

- **Physical device certification.** Physical Android certification remains
  deferred, per P5-D. Chromium with Pixel 5 emulation and CPU and network
  throttling is automated evidence, not handset proof.
- **Live validation.** Live Supabase and Vercel validation was not performed
  for this pass. It needs:
  - a real student session syncing against staging
  - server-side dedupe on real Postgres unique constraints
  - measured transfer on a real 2G/3G link
  - logout and relogin on one shared handset, with pending work
