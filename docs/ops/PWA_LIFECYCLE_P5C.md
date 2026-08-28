# PWA Lifecycle and Browser Offline Contract

Status: P5-C engineering complete on the dedicated lifecycle branch (2026-08-28).
P5-D storage-management hardening is documented in
`docs/ops/OFFLINE_STORAGE_P5D.md`.

This document records the browser lifecycle behavior layered on the P5-A
signed-content trust contract and the P5-B synchronization contract.

## Supported browser coverage

The automated proof runs in Chromium on desktop dimensions and a Pixel 5
mobile emulation profile. The test uses the real service worker, IndexedDB,
Cache Storage, browser online/offline controls, page reloads, and a persistent
browser profile reopened in a second browser process. It is device-like
coverage, not proof on a physical Android handset.

## Installability and application shell

`public/manifest.json` supplies the application identity, root scope and
start URL, standalone display, theme and background colors, 192x192 and
512x512 icons, language direction, and install screenshots. Middleware leaves
the manifest, service worker, offline document, icons, and other shell assets
public so an unauthenticated browser can install and start the shell. The
service worker is registered with `updateViaCache: "none"`.

The first successful service-worker install caches the root shell, `/offline`,
`/offline.html`, the manifest, and the required icons. A real-browser test
reloads with network disabled and verifies the offline shell instead of a
blank page or an authentication redirect.

## Cache lifecycle

The service worker separates re-fetchable application/runtime bytes from
trusted lesson bytes:

- `liberialearn-shell-<version>` contains the install shell and offline page.
- `liberialearn-runtime-<version>` contains Next static runtime assets.
- `liberialearn-content-<version>` contains lesson routes and media selected
  by the trusted lesson cache.

On activation, only obsolete LiberiaLearn cache names are removed. IndexedDB
is never removed by service-worker activation. Downloaded content can be
evicted and fetched again; learner-created outbox records have stronger
retention and are not a cache-eviction target.

## Update and compatibility semantics

An update is installed beside the active worker and waits for the lifecycle
status UI to activate it. The learner sees an explicit update-available state;
activation is requested only after the learner chooses Update. The client
reloads after controller change, and the P5-B outbox remains in IndexedDB
through the entire transition.

The signed P5-A `minClientVersion` policy remains authoritative. A client below
the signed minimum must enter an update-required state before continuing an
unsafe trusted-content flow. Pending learner work is preserved while waiting
for the update. Incompatible protocol or malformed cached records fail closed
and remain visible for recovery rather than being silently deleted.

## Offline content and activities

Only content accepted by P5-A signature, ordering, expiry, revocation, and
hash policy may be opened as trusted offline content. Supported offline writes
are the P5-B lesson progress/completion, assessment attempts, assignment and
homework submissions, lab sessions, and learner attendance marks. The durable
outbox retains their identity, dependencies, content provenance, and retry
state across refresh, tab close, PWA restart, and browser-context recreation.

Revoked content is not served as newly trusted content after authoritative
refresh. Expired manifests block new trusted serving according to P5-A policy.
Evidence already created by the learner remains available to synchronization
and review; trust failure never destroys learner work.

## User-visible lifecycle states

The shell exposes explicit status UI for offline mode, pending sync, syncing,
conflict, authentication required, storage failure, update available, update
required, expired content, and revoked content. Storage errors are reported as
aggregate operation failures without answer content or other sensitive payload
logging.

## Storage and account safety

IndexedDB transaction failures, quota errors, unavailable storage, malformed
records, and partial content-cache failures do not produce a false queued-success
message. Re-fetchable shell/content bytes are lower priority than unsynced
learner work. Outbox and content partitions include learner, school, tenant,
and device/session context. Account switching cannot expose one learner's
pending work to another, and logout does not blindly purge unsynced work.

## CI proof and limitations

CI runs the P5-C Playwright suite after the production build in both desktop
Chromium and the Pixel 5 emulation project. The suite proves service-worker
activation, manifest and shell assets, offline reload, real IndexedDB and Cache
Storage persistence, reconnect-safe browser primitives, and browser-context
restart behavior.

This goal does not claim physical-device proof, OS background-sync guarantees,
native store packaging, push notifications, or complete OfflinePack
distribution. Those are separate goals.

Recommended next goal: the next product roadmap sprint selected in
`docs/roadmaps/CURRENT_EXECUTION_STATE.md`. Physical Android and iOS
certification remains deferred by founder decision until the mobile
application-shell phase.
