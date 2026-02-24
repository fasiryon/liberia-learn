# Evidence Pipeline — Product Reference (Block 7C)

> **Status:** Shipped (Block 7C)
> **Feature flags:**
>   - `NEXT_PUBLIC_ENABLE_ADAPTIVE_BASELINE` — gates the baseline update half
>   - `NEXT_PUBLIC_ENABLE_MASTERY_ENGINE` — gates the mastery profile update half
> **Depends on:** Block 7A (Mastery Engine) · Block 7B (Adaptive Baseline)

---

## What Is the Evidence Pipeline?

The Evidence Pipeline is the single integration point between student work events and
the two learning-intelligence systems introduced in Blocks 7A and 7B.

Before Block 7C, the mastery engine (`updateMasteryProfile`) and the adaptive baseline
(`recordEvidenceAndUpdateBaseline`) existed but were never called from student-facing routes.
No evidence from practice or assessments reached either system.

Block 7C wires them together through a **shared pipeline function** (`processEvidence`) and
a **unified API endpoint** (`POST /api/student/evidence`). A single call from any evidence
source updates the adaptive baseline estimate **and** the mastery profile **atomically**,
with correct flag-gating and tenant isolation.

---

## Why a New Endpoint?

Existing submission routes could not be used:

| Route | Why it cannot carry evidence |
|-------|------------------------------|
| `POST /api/student/homework/submit` | No score at submit time; AI grading is separate and teacher-triggered. `Homework` has no `subject`/`strandKey` fields. |
| `POST /api/student/work/:id/complete` | Completion-only; carries no score data. |
| `POST /api/student/sync` | Offline queue flush; carries timestamps and entity IDs, not scored evidence. |

The client (practice/quiz UI) knows the subject, strandKey, difficulty, and score
(client-side MCQ scoring is deterministic). The correct integration point is a new
server-side endpoint that accepts structured evidence and fans it out to both systems.

---

## API Contract

### `POST /api/student/evidence`

**Auth:** Student session required (`STUDENT` role). `schoolId` and `studentId` are derived
from the authenticated session — never accepted from the client body.

**Request body:**

```json
{
  "subject":       "MATH",
  "strandKey":     "algebra_basics",
  "correct":       3,
  "total":         4,
  "difficulty":    3,
  "source":        "practice",
  "wasAiAssisted": false,
  "attemptCount":  1,
  "timeSpentSec":  45
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `subject` | string (Subject enum) | Yes | e.g. `"MATH"`, `"SCIENCE"` |
| `strandKey` | string | Yes | Must exist in StrandCatalog |
| `correct` | number ≥ 0 | Yes | Raw count of correct answers |
| `total` | number ≥ 1 | Yes | Total questions in this attempt |
| `source` | `"practice"` \| `"assessment"` \| `"manual"` | Yes | Determines `assessmentWeight` |
| `difficulty` | 1–5 | No | Defaults to 3 (medium) |
| `wasAiAssisted` | boolean | No | Default: `false` |
| `attemptCount` | number ≥ 1 | No | Default: 1. See Known Limitations. |
| `timeSpentSec` | number | No | Stored for future analytics; unused in calculations |

**Validation:**
- `correct >= 0`, `total >= 1`, `correct <= total`
- `source` must be one of `"practice"`, `"assessment"`, `"manual"`
- `difficulty` must be 1, 2, 3, 4, or 5 when provided

**Response (200 — both flags on):**

```json
{
  "baseline": {
    "ability": 0.18,
    "score": 0.545,
    "expectedCorrectness": 0.5
  },
  "mastery": {
    "profileId": "cuid...",
    "studentId": "cuid...",
    "subject": "MATH",
    "strandKey": "algebra_basics",
    "currentScore": 0.75,
    "proficiencyState": "PROFICIENT",
    "masteryState": "DEVELOPING",
    "sustainabilityIndex": 0.80,
    "decayRate": 0.02,
    "aiRelianceRate": 0.0,
    "hybridScore": 0.78,
    "growthDelta": 0.05,
    "isAtRisk": false
  }
}
```

**Response (200 — one or both flags off):**

```json
{
  "baseline": { "disabled": true },
  "mastery":  { "disabled": true }
}
```

Each half can be disabled independently. See [Flag Behaviour](#flag-behaviour).

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing required fields, invalid ranges, or `correct > total` |
| 401 | Not authenticated |
| 403 | Authenticated user is not a STUDENT |

---

## Input → Output Data Flow

```
Client (practice/quiz UI)
        │
        │  POST /api/student/evidence
        │  { subject, strandKey, correct, total, source, ... }
        ▼
app/api/student/evidence/route.ts
  • Auth: requireRole("STUDENT")
  • Validate: correct, total, source, difficulty
  • Derive: schoolId = session.schoolId, studentId = session.id
        │
        │  processEvidence(input)
        ▼
lib/mastery/evidencePipeline.ts
  • Compute: correctness = correct / total (clamped to [0, 1])
  • Compute: assessmentWeight from source
  •         practice → 0.4 | manual → 0.6 | assessment → 1.0
  │
  ├─► recordEvidenceAndUpdateBaseline(...)    [Block 7B]
  │     Checks: ENABLE_ADAPTIVE_BASELINE
  │     If on:  EMA update to StudentBaselineAbility
  │     If off: returns { disabled: true }
  │
  ├─► prisma.student.findUnique(studentId)
  │     → currentGrade → gradeBand
  │         null / 1–3  → G1_3
  │         4–6         → G4_6
  │         7–9         → G7_9
  │         10–12       → G10_12
  │
  ├─► updateMasteryProfile(...)               [Block 7A]
  │     Checks: ENABLE_MASTERY_ENGINE
  │     If on:  upsert StudentMasteryProfile
  │     If off: returns { disabled: true }
  │
  └─► recordMetricEvent("evidence.processed") [no PII]
        │
        ▼
    { baseline: {...}, mastery: {...} }
        │
        ▼
Client receives combined result
```

---

## Flag Behaviour

The two flags are independent. Each controls one half of the pipeline.

| `ENABLE_ADAPTIVE_BASELINE` | `ENABLE_MASTERY_ENGINE` | Result |
|---------------------------|------------------------|--------|
| on | on | Both updates applied |
| off | on | `baseline: { disabled: true }`, mastery updated |
| on | off | Baseline updated, `mastery: { disabled: true }` |
| off | off | Both return `{ disabled: true }`, no DB writes |

**Important:** When baseline is off, the baseline service is still called — it returns
`{ disabled: true }` internally. The pipeline passes this through as-is.

When mastery is off, the pipeline skips the `prisma.student.findUnique` query and the
`updateMasteryProfile` call entirely.

---

## Tenant Isolation Guarantees

- `schoolId` is derived from the authenticated session only — never from the request body.
- `studentId` is derived from the authenticated session only — never from the request body.
- `schoolId` is used for telemetry scoping only; it is never the sole predicate for
  student data DB queries.
- `StudentMasteryProfile` writes are scoped by `studentId` (which FK-chains through
  `Student → User → School` for tenant isolation).
- `StudentBaselineAbility` writes are scoped by both `schoolId` and `studentId`.
- No telemetry payload ever contains `studentId`, email, or other PII.
  The `evidence.processed` event carries only `{ subject, strandKey, source }`.

---

## Offline / Queue Behaviour

**Current state (Block 7C):** Evidence submitted via `POST /api/student/evidence` is
**not queued** for offline replay. If the student is offline, the request fails with a
network error on the client side. No data is persisted locally for later sync.

**Roadmap (Block 7D):** Block 7D will add `entity: "evidence"` to the offline sync queue
shape in the `StudentSync` route. Evidence events recorded offline will be replayed when
the device reconnects. The `timestamp` field on `EvidenceInput` is reserved for this: it
will carry the client-side timestamp of the original event to preserve chronological order
during replay.

---

## Known Limitations

### `totalAttempts` approximation (Block 7D)

The mastery service requires a cumulative `totalAttempts` count for AI reliance rate
calculation. In Block 7C, this is approximated as `attemptCount` (default: 1) per call.

**Effect:** The AI reliance rate (`aiRelianceRate`) in `StudentMasteryProfile` is computed
from per-call counts, not true cumulative totals. This means a student who has completed
50 attempts will still have `totalAttempts = 1` if `attemptCount` is not provided.

**Fix (Block 7D):** Block 7D will introduce an `AttemptLog` table that records every
evidence call. The pipeline will query the cumulative count from `AttemptLog` before
calling `updateMasteryProfile`, replacing the current approximation.

---

## Telemetry Events

| Event | When | Payload (no PII) | Scope |
|-------|------|------------------|-------|
| `evidence.processed` | Every successful pipeline call | `subject`, `strandKey`, `source` | `school` / `schoolId` |
| `baseline.updated` | Baseline write succeeded | `subject`, `strandKey`, `source`, `ability`, `score` | `school` / `schoolId` |
| `mastery.updated` | Mastery profile written | `subject`, `strandKey`, `gradeBand`, `proficiencyState`, `masteryState`, `hybridScore` | `school` / `schoolId` |
| `mastery.at_risk` | Student is BELOW_PROFICIENT or DECAYING | `subject`, `strandKey`, `gradeBand`, `proficiencyState`, `masteryState` | `school` / `schoolId` |

All events: `pilotOnly: true`, no `studentId` in any payload.

---

## Related

- `lib/mastery/evidencePipeline.ts` — Pipeline orchestration service (this block)
- `app/api/student/evidence/route.ts` — POST endpoint (this block)
- `lib/mastery/masteryService.ts` — Mastery profile update service (Block 7A)
- `lib/mastery/baselineService.ts` — Adaptive baseline service (Block 7B)
- `lib/mastery/baseline.ts` — Pure EMA computation library (Block 7B)
- [PERFORMANCE_ENGINE.md](./PERFORMANCE_ENGINE.md) — Block 7A product reference
- [ADAPTIVE_BASELINE.md](./ADAPTIVE_BASELINE.md) — Block 7B product reference
