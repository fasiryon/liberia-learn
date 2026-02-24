# ADR-0010 — Offline Evidence & AttemptLog Infrastructure

**Status:** Accepted
**Block:** 8A
**Date:** 2026-02-24
**Authors:** Engineering

---

## Context

Block 7C shipped the evidence pipeline (`processEvidence`) with a documented
approximation: `totalAttempts` and `aiAssistedAttempts` were both set to `1` per
call. There was no `AttemptLog` table, no offline evidence queue type, and no
`entity="evidence"` branch in the sync route. This ADR records the decisions made
in Block 8A to resolve all three gaps.

---

## Decisions

### 1. Idempotency: unique constraint + P2002 catch vs. SELECT-before-INSERT

**Decision:** Use a `UNIQUE` constraint on `AttemptLog.idempotencyKey` and catch
Prisma error `P2002` on duplicate insert.

**Rationale:**
- SELECT-before-INSERT creates a race condition: two concurrent replays of the same
  offline event could both pass the SELECT check and both attempt INSERT.
- The database-level unique constraint is atomic. The `P2002` path is already proven
  in `SMSDeliveryLog` (same project, Block 6).
- One round-trip instead of two for the common (new) case.

**Trade-off:** Prisma error codes are provider-specific. If the ORM layer changes,
the `P2002` catch must be updated. Documented as a known dependency.

---

### 2. No FK to StrandCatalog

**Decision:** `AttemptLog` has no foreign key to `StrandCatalog`.

**Rationale:**
- Offline events may be queued before a strand is removed and replayed after.
- A FK would cause the insert to fail for orphaned strands, losing evidence that
  was legitimately collected by a student.
- The evidence pipeline already accepts any `strandKey` string — this is consistent.
- Audit integrity is preserved; the `strandKey` value is still stored.

**Trade-off:** Stale strand keys in `AttemptLog` cannot be validated at query time.
Reports that join against `StrandCatalog` must handle missing strands gracefully
(LEFT JOIN or filter).

---

### 3. No new feature flag — AttemptLog is unconditional

**Decision:** `AttemptLog.create` runs before any feature flag check in
`processEvidence`. No flag gates it.

**Rationale:**
- `AttemptLog` is an audit record, not a feature. Gating audit records behind flags
  creates gaps in the evidence trail.
- Downstream services (baseline, mastery) remain independently flaggable.
- Idempotency (P2002 catch) is independent of flags — duplicate detection must work
  even when the mastery engine is disabled.

---

### 4. COUNT(*) for cumulative counts — correct for Block 8A; Block 10 optimization

**Decision:** After each successful `AttemptLog.create`, run two `COUNT(*)` queries
to compute `totalAttempts` and `aiAssistedAttempts`.

```sql
SELECT COUNT(*) FROM "AttemptLog"
WHERE "studentId" = $1 AND "subject" = $2 AND "strandKey" = $3;

SELECT COUNT(*) FROM "AttemptLog"
WHERE "studentId" = $1 AND "subject" = $2 AND "strandKey" = $3
  AND "wasAiAssisted" = true;
```

**Rationale:**
- Correct and simple. The index on `(studentId, subject, strandKey)` makes this O(n)
  where n is the number of attempts for one student × strand — typically small.
- No denormalisation risk: counts are always consistent with the log table.

**Block 10 optimization path:**
- Add `attemptCount` and `aiAssistedAttemptCount` integer columns to
  `StudentMasteryProfile` (or a new counter table).
- Increment atomically via `UPDATE … SET count = count + 1` on each evidence write.
- This reduces two COUNT queries to zero per write.

---

### 5. studentId always from session in sync route — tenant safety

**Decision:** In `app/api/student/sync/route.ts`, the `studentId` passed to
`processEvidence` is always `user.id` from the authenticated session. Any
`studentId` in the request payload is silently ignored.

**Rationale:**
- Matches the existing pattern for `studentProgress` and `submission` entities.
- Prevents a student from submitting evidence on behalf of another student by
  injecting a different `studentId` in the payload.
- `schoolId` follows the same rule: always `user.schoolId`.

---

### 6. Client-side ordering: getReadyQueue() sorts by createdAt

**Decision:** `getReadyQueue()` returns items sorted by `createdAt` ascending (FIFO).
The sync route processes items in array order. Evidence items submitted earlier are
therefore processed and logged before later ones.

**Rationale:**
- Ensures `totalAttempts` counts are monotonically increasing in the order
  attempts were made, even after a long offline period.
- No server-side reordering is needed — the array order from the client is trusted
  for chronological correctness within a single sync batch.

**Trade-off:** If a client has a corrupted `createdAt` (e.g. clock skew), the order
may be wrong. This is acceptable: `AttemptLog.timestamp` stores the client-reported
time; cumulative counts are used for statistical confidence, not for strict ordering.

---

## Consequences

- `AttemptLog` table deployed via migration `20260224_200000_attempt_log`.
- `processEvidence` no longer accepts `attemptCount` as a meaningful input
  (field retained for backwards compatibility but ignored).
- `EvidencePipelineResult` gains `idempotent?: true` field.
- `QueueItem.entity` union gains `"evidence"`.
- `enqueueEvidence()` is the canonical client API for queuing evidence offline.
- ~45 new tests covering AttemptLog creation, idempotency, cumulative counts,
  flag behaviour, tenant isolation, and the sync route evidence branch.
