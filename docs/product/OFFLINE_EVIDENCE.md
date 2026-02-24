# Offline Evidence — Product Reference (Block 8A)

## Overview

Block 8A introduces the `AttemptLog` table and the `enqueueEvidence()` client API,
resolving three gaps from Block 7C:

1. **No cumulative attempt tracking** — `processEvidence` previously approximated
   `totalAttempts=1` per call. `AttemptLog` now provides accurate per-student,
   per-strand cumulative counts.
2. **No offline evidence sync** — the sync route had no `entity="evidence"` branch.
3. **No client queue type** — `QueueItem.entity` did not include `"evidence"`.

---

## What is AttemptLog?

`AttemptLog` is an append-only table that records every evidence submission. Each row
captures:

| Column           | Description                                          |
|------------------|------------------------------------------------------|
| `studentId`      | FK → `Student.id` (CASCADE)                          |
| `subject`        | Prisma `Subject` enum                                |
| `strandKey`      | Strand within the subject                            |
| `correct`        | Raw correct answer count                             |
| `total`          | Total questions in the attempt                       |
| `source`         | Evidence source: `practice`, `assessment`, `manual`  |
| `difficulty`     | Optional difficulty level (1–5)                      |
| `wasAiAssisted`  | Whether AI assistance was used                       |
| `timestamp`      | Client-reported time of the attempt                  |
| `idempotencyKey` | Client UUID — enforces deduplication on insert        |

### Why AttemptLog exists

- Replaces the Block 7C approximation where `totalAttempts` was always 1.
- Provides a durable audit trail of every attempt for offline replay.
- Enables cumulative counts via `COUNT(*)` without storing running totals.

---

## Idempotency Key Lifecycle

```
Client                              Server
  │                                    │
  │  enqueueEvidence(payload)          │
  │  → generate UUID → idempotencyKey  │
  │  → push to offline queue           │
  │                                    │
  │  (later, when online)              │
  │  POST /api/student/sync            │
  │  body: { items: [{ entity:         │
  │    "evidence", idempotencyKey,     │
  │    payload }] }                    │ ──► AttemptLog.create({ idempotencyKey })
  │                                    │      ├─ success   → process + synced
  │                                    │      └─ P2002     → idempotent: true → skipped
  │  ◄── { status: "synced"|"skipped" }│
```

1. **Client assigns UUID** at enqueue time — before any network exists.
2. **Server deduplicates** via `UNIQUE` constraint on `idempotencyKey`.
3. A `P2002` Prisma error on duplicate insert sets `idempotent: true`.
4. The sync route marks idempotent evidence items as `"skipped"` (not an error).

---

## Offline → Online Flow

```
[Student completes practice]
       │
       ▼
enqueueEvidence(payload)     ← assigns idempotencyKey UUID
       │
       ▼
IndexedDB offline queue      ← entity="evidence" item persisted
       │
       ▼  (device reconnects)
getReadyQueue()              ← sorted by createdAt (FIFO)
       │
       ▼
POST /api/student/sync       ← batched with other pending items
       │
       ▼
entity="evidence" branch     ← validates required fields
       │
       ▼
processEvidence(...)         ← AttemptLog.create + downstream services
       │
       ├─ new attempt   → synced
       └─ duplicate key → skipped (safe to ignore)
```

---

## API Contract — Sync Evidence Items

Evidence items in the sync request body follow this shape:

```jsonc
{
  "entity": "evidence",
  "id": "<queue-item-id>",          // used as fallback idempotencyKey
  "opId": "<operation-id>",         // optional; same as id when set by enqueueEvidence
  "idempotencyKey": "<uuid>",       // client-assigned; preferred over opId
  "completedAt": "<ISO 8601>",      // timestamp of the attempt
  "payload": {
    "subject": "MATH",              // required
    "strandKey": "algebra_basics",  // required
    "correct": 3,                   // required (number)
    "total": 4,                     // required (number)
    "source": "practice",           // required: "practice"|"assessment"|"manual"
    "difficulty": 3,                // optional (1–5)
    "wasAiAssisted": false,         // optional (boolean)
    "timeSpentSec": 120             // optional (number)
  }
}
```

**Tenant safety**: `studentId` and `schoolId` are always taken from the authenticated
session — never from the payload. Injected values are silently ignored.

**Validation**: missing `subject`, `strandKey`, `correct`, `total`, or `source` results
in `status: "skipped"` without error.

---

## Cumulative totalAttempts / aiAssistedAttempts

After a successful `AttemptLog.create`, the pipeline runs:

```typescript
const [totalAttempts, aiAssistedAttempts] = await Promise.all([
  prisma.attemptLog.count({ where: { studentId, subject, strandKey } }),
  prisma.attemptLog.count({ where: { studentId, subject, strandKey, wasAiAssisted: true } }),
]);
```

Both counts are passed to the mastery service (`totalAttempts`, `aiAssistedAttempts`)
and the baseline service (`attemptCount: totalAttempts`).

---

## Client Usage — enqueueEvidence()

```typescript
import { enqueueEvidence } from "@/lib/offline-queue";

await enqueueEvidence({
  subject: "MATH",
  strandKey: "algebra_basics",
  correct: 3,
  total: 4,
  source: "practice",
  wasAiAssisted: false,
  difficulty: 3,
  timeSpentSec: 90,
});
```

The function:
1. Generates a UUID as the `idempotencyKey`.
2. Sets `entity: "evidence"` and `scheduledWorkId` to the same UUID (type compat).
3. Stores the item in the IndexedDB partition for the current session.

---

## Known Limitations

| Limitation | Block | Details |
|------------|-------|---------|
| `COUNT(*)` per evidence call | 8A | Two `COUNT(*)` queries run on every non-duplicate evidence write. Block 10 will replace these with a counter column on `StudentMasteryProfile` for O(1) reads. |
| No strand existence validation | 8A | `AttemptLog` has no FK to `StrandCatalog` — offline events may reference strands removed after they were queued. This is intentional (see ADR-0010). |

---

## Flag Behaviour Matrix

| Condition                     | AttemptLog created? | Downstream called? |
|-------------------------------|--------------------|--------------------|
| Normal (all flags on)         | Yes                | Yes                |
| ENABLE_MASTERY_ENGINE=false   | Yes                | Baseline only      |
| ENABLE_ADAPTIVE_BASELINE=false| Yes                | Mastery only       |
| Duplicate idempotencyKey      | No (P2002)         | No                 |
| Missing required payload field| No                 | No                 |

`AttemptLog` creation is unconditional — it is not gated by any feature flag.
