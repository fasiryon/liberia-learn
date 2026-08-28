# P5-B Offline Synchronization Contract

Status: engineering complete on `feat/p5-b-offline-sync` (2026-08-27).

This document is the operational contract for learner work created while a
device is offline. The P5-A signed manifest policy remains the authority for
content trust; this document governs learner evidence and synchronization.

## Supported offline writes

The canonical operation types are defined in `lib/offline/syncProtocol.ts` and
are stored in the existing partitioned IndexedDB outbox:

| Learner state | Operation | Policy |
| --- | --- | --- |
| Lesson completion/progress | `progress.complete` | mergeable; a newer server completion is never regressed |
| Quiz/assessment attempt | `assessment_attempt.append` | append-only; each attempt is preserved and is marked pending review when necessary |
| Assignment submission | `assignment.submit` | conflict review when the server has graded or newer work |
| Homework submission | `homework.submit` | conflict review; graded work is never overwritten |
| Lab session state | `lab_session.merge` | owner- and tenant-checked merge; completed server sessions require review |
| Attendance | `attendance.mark` | timestamp policy; newer server marks win as an explicit conflict |

Assignment drafts are local editor state only (`assignment-draft::`); they are
not a second submission queue. Mastery events, simulation state uploads, and AI
tutor requests are not supported offline yet and are rejected or held rather
than uploaded as a different operation.

## Local outbox and protocol

Each operation carries protocol version, operation ID, learner and school
partition, resource identity, operation type, content ID/version/hash,
manifest cursor, client timestamp, base server version, idempotency key,
payload, dependencies, retry state, and sync state. Payloads are validated at
the sync boundary, capped at 256 KiB, and malformed records remain visible as
terminal failures.

The state machine is:

`LOCAL_PENDING -> SENDING -> ACKNOWLEDGED`

with `RETRYABLE_FAILURE`, `CONFLICT`, and `TERMINAL_FAILURE` retaining the
operation and its diagnostic state. Retries use bounded exponential backoff
(three attempts, capped at five minutes). A lease makes an interrupted send
eligible for recovery. Dependency IDs prevent a dependent operation from
dispatching before its prerequisite is acknowledged.

## Server idempotency and concurrency

The client sends one operation at a time to `/api/student/sync`. The server
binds accepted sync events to the exact operation ID/client event ID and stores
the semantic operation fingerprint in the append-only `LearningEvent` stream.
The event primary key and existing resource uniqueness constraints make replay
safe without a learner-data migration. The same key and same fingerprint
returns a replay-deduplicated result; the same key with a different semantic
payload is rejected. A lost response can therefore be retried safely.

Mutable resources use their resource-specific policy rather than generic
last-write-wins. Lesson progress and attendance compare timestamps. Graded or
completed submissions are explicit conflicts. Assessment attempts coexist as
append-only evidence. Conflicts are retained locally for learner/teacher
review and are never silently discarded.

## Trust, authentication, and isolation

Operations record content provenance when available. On reconnect, the server
checks content identity, version, and hash against current content. Revoked
content preserves learner evidence but is recorded as revoked-at-sync and is
not treated as currently trusted content. Expired manifests block new trust;
they do not delete existing learner work. Invalid hashes, missing content, and
incompatible protocol versions fail closed.

The outbox and content/session references are partitioned by learner, school,
and device. The server derives the learner from the authenticated session,
checks learner ownership, school scope, and enrollment for progress,
attendance, assignment, homework, and lab operations. Logout flushes best
effort; if any unsynced or conflicted operation remains, logout is held and
local work is retained for retry. Auth expiry holds the queue until the learner
reauthenticates; it never replays under a different identity.

## Offline reopen and reconnect behavior

Lesson progress and quiz drafts use durable IndexedDB records. The lesson route
stores only a route-to-content reference; lesson bytes are reopened only from
the P5-A signed lesson cache and are revalidated before display. Supported
activities can therefore be resumed after refresh, tab close, PWA restart, and
multi-day disconnection without relying on `sessionStorage`.

Reconnect triggers are safe to repeat: mount, browser `online`, service-worker
sync, and multiple tabs all converge on the same operation identity. A network
failure keeps the operation; a server commit followed by a lost response is a
normal idempotent replay. Independent operations continue when one operation
is conflicted or terminally failed.

## Storage failure and observability

Quota, unavailable IndexedDB, transaction, corrupt-record, and unsupported
schema failures do not report success. Learner-created operations receive
stronger retention than evictable trusted-content cache entries. Queue depth,
oldest pending age, sync attempts/results, retries, conflicts, terminal
failures, and storage errors are emitted as aggregate metrics; answer content
is not logged as telemetry.

## Known unsupported offline actions

AI tutor calls, teacher/AI grading, attendance changes by non-learners,
mastery/simulation uploads, background OS sync guarantees, and full OfflinePack
distribution are outside P5-B. They remain online-only or are held explicitly.

