# Offline Storage Management Contract

Status: P5-D non-physical engineering complete after the storage hardening
gate. Physical Android certification is deferred by founder decision to the
later Android and iOS application-shell phase.

## Inventory and ownership

| Local data | Classification | Owner and deletion rule |
| --- | --- | --- |
| P5-B outbox operations, quiz drafts, and pending learner evidence | `CRITICAL_UNSYNCED` | The active learner partition owns it. Application cleanup never evicts it. It remains until acknowledged, explicitly resolved, or handled by the safe logout flow. |
| Locally reflected acknowledged learner state | `DURABLE_SYNCED` | IndexedDB/session-scoped state may be retained for offline UX and can be rebuilt from the server. |
| Signed lesson availability manifests and trust cursors | `TRUST_METADATA` | P5-A owns acceptance, ordering, expiry, revocation, and compatibility. Ordinary content removal retains the trust baseline. |
| Lesson JSON and lesson audio | `RE_DOWNLOADABLE` | The content cache owns it. It may be removed by explicit learner action or deterministic safe eviction. |
| Lesson session and derived runtime data | `REGENERABLE` | It can be rebuilt from trusted content or the server and is lower priority than learner work. |
| App shell, runtime, and API cache bytes | `EPHEMERAL` or `REGENERABLE` | The service worker may replace obsolete versioned caches after an update. It never purges IndexedDB. |

The outbox and content caches use the existing session partition, including
learner, school, and device context. A different account receives a different
partition and cannot read another learner's pending work.

## Priority and safe eviction

Application-controlled cleanup follows this order:

1. protected unsynced learner work
2. durable learner state and trust metadata
3. re-downloadable lesson and audio content
4. regenerable and ephemeral cache data

Protected work is never an eviction candidate. Downloaded lesson eviction is
deterministic: revoked content first, then expired content, then corrupt or
incomplete content, then update-required content, with least-recently-used
content breaking ties. Current trusted lessons are last. A deletion is
reported only after the IndexedDB operation succeeds.

The offline storage page shows downloaded lessons, approximate browser usage,
trust/content status, expiry, and the number of protected unsynced items. It
allows removal of lesson bytes while preserving the P5-B outbox. A low-storage
state directs the learner to remove downloaded lessons. If no safe candidate
can be removed, the download fails explicitly and can be retried after the
learner frees space or reconnects.

## Accounting and browser limits

Where supported, `navigator.storage.estimate()` supplies approximate browser
usage and quota. The UI also reports the measured IndexedDB lesson bytes and
download count. Browser estimates are optional and may be unavailable or
intentionally coarse; learning and synchronization do not depend on them.

Cache metadata is validated before use. Malformed records are ignored rather
than treated as trusted content. A lesson is not listed as trusted until its
content pack is complete, its signed manifest is accepted, its pack version
matches, and its content hash verifies.

## Partial downloads and corruption

The signed trust cursor advances before a replacement body is written, so a
delayed older response is rejected before it can overwrite newer lesson
bytes. If the content write, metadata write, hash check, or trust acceptance
fails, the lesson is not trusted or served offline. Orphaned, incomplete,
corrupt, expired, revoked, and update-required entries remain identifiable and
repairable by removing and downloading again. None of these paths touches
learner-created outbox records.

## Logout, account switching, and data clearing

Safe logout attempts a best-effort sync. If pending, conflicted, or failed
learner work remains, logout is held and local work is retained. Once all work
is acknowledged, that account's queue and removable content partition may be
cleared. Switching accounts does not merge partitions or expose the previous
learner's state.

The application cannot guarantee data preservation when a learner, browser,
operating system, or device manually clears site data, resets browser storage,
uninstalls a PWA with data removal, or evicts storage outside the application's
control. This platform boundary is different from application-controlled
cleanup, which protects unsynced work.

## Service worker boundary

Service-worker activation removes only obsolete versioned Cache Storage names
for the app shell, runtime, and content caches. It does not open or delete the
IndexedDB databases used by P5-A trust metadata or the P5-B outbox. An app
update therefore cannot silently delete learner work.

## Validation boundary

P5-A trust, P5-B synchronization, and P5-C real-browser lifecycle coverage
remain regression gates. Desktop Chromium and Pixel 5 browser emulation are
automated evidence, not physical Android proof. Physical Android and iOS
install, offline, restart, update, reconnect, and storage-pressure testing is
recorded as a future mobile certification gate for the application-shell
phase.
