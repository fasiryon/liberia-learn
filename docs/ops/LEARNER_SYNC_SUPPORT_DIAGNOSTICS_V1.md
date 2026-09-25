# Learner Sync Support Diagnostics V1

Read-only, privacy-minimized diagnosis of one learner's offline sync for
authorized support. Diagnostics first: this surface has no write authority.

## Evidence sources

The device queue lives in the learner's IndexedDB, so the server cannot see it
directly. V1 combines two existing-table evidence streams (no migration):

| Stream | Written by | Stored as | Contents |
| --- | --- | --- | --- |
| Device snapshot | Learner's own client (`SyncManager` via `lib/offline/syncDiagnosticsReporter.ts`) to `POST /api/student/sync/diagnostics` | `MetricEvent` `offline.sync.snapshot` bound to the session user and school | Queue counts by state, categories, allowlisted reason codes, ages, retry counts, client version, app release, highest queued release sequence, up to 25 unconfirmed operation IDs |
| Server verdicts | `POST /api/student/sync` | `outcomes` array added to the existing `sync.result` `MetricEvent` | Per operation: operation ID, category, verdict (`ACCEPTED`, `ALREADY_RECEIVED`, `SKIPPED`, `CONFLICT`, `REJECTED`), reason code |

Snapshots are telemetry. No learning, grading, mastery, placement, or release
path reads them, and they cannot change queue or server learner state. Reports
are bounded (16 KB body, at most one stored per learner per 30 s; unchanged
queues report at most every 10 minutes).

## Support view

`GET /api/admin/support/learners/{userId}/sync-diagnostics`, UI at
`/admin/support/sync-diagnostics/{userId}` (linked from the admin student
page). Window: 30 days. Fields: last successful sync, last server contact,
device report time and staleness, online flag, client version, protocol
version, app release and whether it matches the server release, queued release
sequence, pending counts by state, categories, oldest pending age, max retry
count, next retry, reason-code counts, last reason-coded failure, and each
unconfirmed operation with its server verdict.

States (primary is the first that applies): `OFFLINE`, `AUTH_EXPIRED`,
`WAITING_FOR_ORIGINAL_LEARNER`, `STALE_RELEASE`, `QUARANTINED`,
`SERVER_CONFLICT`, `RETRY_PENDING`, `SERVER_RECEIVED`, `SYNCED`, `UNKNOWN`.

- `SYNCED` requires a device report showing no unconfirmed work. Server
  evidence alone never yields `SYNCED`.
- Missing evidence is `null` / `UNKNOWN`, never zero or success.
- `serverReceived: null` means no server verdict in the window, not proof the
  server never received the operation (verdicts are recorded only from this
  release onward).
- `OFFLINE` is inferred when unconfirmed work exists and neither a device
  report nor a server verdict has arrived for 6 hours.

## Privacy contract

`lib/offline/syncDiagnosticsContract.ts` rebuilds every snapshot and verdict
from allowlists on write and again on read. Free-text errors collapse to
`other`; categories outside the protocol enum collapse to `legacy_unknown`.
Never exposed: operation payloads, quiz answers, answer keys, lesson content,
content hashes, resource IDs, conflict server/client state bodies, messages,
guardian data, mastery internals, email. Tests assert this against hostile
stored payloads.

## Authorization and audit

- Capability `support:sync_diagnostics:read` (`PERMISSIONS.SUPPORT_SYNC_DIAGNOSTICS_READ`):
  school `ADMIN` for learners in their own school; platform admins for any
  school. Teachers, guardians, students, district and MOE roles are denied.
- Fail closed: missing capability or school context is 403. Missing,
  non-learner, malformed, and other-school targets all return the same 404 and
  write a best-effort `support.sync_diagnostics.denied` audit row.
- Evidence is filtered to the learner's user ID and current school.
- Every successful read writes `support.sync_diagnostics.viewed` through
  `logAuditRequired` before data is returned; if the audit write fails the
  response is 503 with no data.

## Not in V1

- No retry, delete, mark-synced, or evidence rewrite on the learner's behalf.
  The learner-side "Try again" and conflict review remain the only actions.
- No search by name or email; lookup is by learner user ID or the student page.
- `MetricEvent` has no `userId` index; reads use the `schoolId, createdAt`
  index. Revisit if snapshot volume grows.
- `MetricEvent` retention for these rows follows existing metric retention.
