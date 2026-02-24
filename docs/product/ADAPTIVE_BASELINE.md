# Adaptive Baseline — Product Reference (Block 7B)

> **Status:** Shipped (Block 7B)
> **Feature flag:** `NEXT_PUBLIC_ENABLE_ADAPTIVE_BASELINE`
> **Depends on:** Block 7A — Mastery Engine Foundation (`NEXT_PUBLIC_ENABLE_MASTERY_ENGINE`)

---

## What Is a Baseline?

A **baseline** is an estimate of a student's starting ability level in a given subject × strand
before sustained instruction begins. It answers the question:

> "Where is this student right now — relative to grade level?"

Without a baseline, the growth signal is meaningless. A student going from 0.2 to 0.6 made
enormous progress. A student going from 0.6 to 0.7 made modest progress. The hybrid score
model (Block 7A) uses the baseline to make growth comparable across different starting points.

---

## Ability Scale

All ability estimates are stored on the **[-2, +2] EMA scale**:

| Value | Meaning |
|-------|---------|
| `-2.0` | Far below grade level |
| `-1.0` | Below grade level |
| `0.0`  | At grade level (default for new students) |
| `+1.0` | Above grade level |
| `+2.0` | Well above grade level |

This scale is normalised to a **[0, 1] score** for use in `StudentMasteryProfile.baselineScore`:

```
score = (ability - (-2)) / (2 - (-2)) = (ability + 2) / 4
```

| Ability | Score | Interpretation |
|---------|-------|----------------|
| -2.0    | 0.00  | Far below grade level |
|  0.0    | 0.50  | At grade level |
| +2.0    | 1.00  | Well above grade level |

---

## The EMA Algorithm

The adaptive baseline uses an **Exponential Moving Average (EMA)** to estimate ability.
This is intentionally simple and explainable — not a full Item Response Theory (IRT) implementation.

### Why EMA, not IRT?

Full IRT requires calibrated item parameters (discrimination, difficulty, guessing) that are
estimated from large samples of student responses. LiberiaLearn does not yet have sufficient
item calibration data. EMA provides a pragmatic, auditable approximation:

- Teachers can understand and explain it.
- MOE auditors can trace any number back to a formula.
- It improves as more evidence arrives (convergent).
- It does not require pre-calibrated items.

IRT is planned for **Block 7C** once item calibration data exists.

### Item Characteristic Curve (ICC)

For each assessment item, the student's expected correctness is:

```
P(correct) = sigmoid(ability − difficultyParam)
```

Where `sigmoid(x) = 1 / (1 + e^{-x})`.

Difficulty levels map to ability parameters:

| Difficulty | Ability Param | Interpretation |
|-----------|---------------|----------------|
| 1 (Very easy) | -1.5 | Grade-level student: ~82% expected correct |
| 2 (Easy)      | -0.75 | Grade-level student: ~68% expected correct |
| 3 (Medium)    | 0.0   | Grade-level student: ~50% expected correct |
| 4 (Hard)      | 0.75  | Grade-level student: ~32% expected correct |
| 5 (Very hard) | 1.5   | Grade-level student: ~18% expected correct |

### Update Rule

When a student completes an assessment item:

```
error     = actualCorrectness − P(correct)
alpha     = BASE_ALPHA × assessmentWeight / √(attemptCount)
rawDelta  = alpha × error
delta     = clamp(rawDelta, −MAX_ABILITY_DELTA, +MAX_ABILITY_DELTA)
newAbility = clamp(prevAbility + delta, ABILITY_MIN, ABILITY_MAX)
```

**Constants:**

| Constant | Value | Purpose |
|----------|-------|---------|
| `BASE_ALPHA` | 0.5 | Base learning rate |
| `MAX_ABILITY_DELTA` | 0.8 | Guardrail: max change per update |
| `ABILITY_MIN` | -2 | Lower bound |
| `ABILITY_MAX` | +2 | Upper bound |

**Assessment weights** scale the learning rate:

| Type | Weight | Effect |
|------|--------|--------|
| Practice | 0.4 | Small updates (formative, low stakes) |
| Quiz | 0.6 | Moderate updates |
| Exam | 1.0 | Full updates (summative, high stakes) |

### Convergence

As a student accumulates more evidence, alpha decreases proportional to `1/√(attemptCount)`.
This is a **stability property**: early assessments produce large updates (high uncertainty),
while later assessments fine-tune an already-well-estimated ability.

---

## Data Model

### `StudentBaselineAbility`

One row per student × school × subject × strand. Stores only the current estimate.

```
id             — Unique row ID (CUID)
schoolId       — Tenant isolation: all queries must filter by schoolId
studentId      — FK → Student (CASCADE on delete)
subject        — Enum: MATH, SCIENCE, etc.
strandKey      — FK → StrandCatalog (RESTRICT on strand delete)
ability        — Current estimate on [-2, +2] scale. Default: 0
source         — How this was last set: initial | practice | assessment | manual
updatedBy      — Optional: teacher userId for manual overrides
lastUpdatedAt  — Timestamp of the last ability change
createdAt      — Row creation timestamp
updatedAt      — Prisma-managed update timestamp
```

Unique constraint: `(schoolId, studentId, subject, strandKey)` — one estimate per tenant × student × strand.

### `StudentMasteryProfile` integration

Block 7B populates `StudentMasteryProfile.baselineConfidence` and
`StudentMasteryProfile.baselineCompletedAt` (both reserved in Block 7A as nullable).

The `baselineScore` field in `StudentMasteryProfile` is set from `normalizeAbilityToScore(ability)`
during the initial placement flow. Once set, `masteryService.ts` never overwrites it.

---

## API Endpoints

### `GET /api/student/baseline`

Returns the authenticated student's ability estimate.

**Query parameters:** `subject`, `strandKey`

**Auth:** Student session (schoolId + studentId derived from session — never from client).

**Response (flag on, record found):**
```json
{ "ability": 0.42, "score": 0.605 }
```

**Response (flag on, no record yet):**
```json
{ "ability": 0, "score": 0.5 }
```

**Response (flag off):**
```json
{ "ability": 0, "score": 0.5, "disabled": true }
```

---

### `POST /api/student/baseline/evidence`

Records a single piece of assessment evidence and applies the EMA update.

**Auth:** Student session.

**Request body:**
```json
{
  "subject": "MATH",
  "strandKey": "number_sense",
  "evidence": {
    "correctness": 0.75,
    "difficulty": 3,
    "attemptCount": 4,
    "assessmentWeight": 1.0,
    "timeSpentSec": 90
  }
}
```

**Response (flag on):**
```json
{
  "ability": 0.18,
  "score": 0.545,
  "expectedCorrectness": 0.5
}
```
`expectedCorrectness` is the ICC prediction *before* this update was applied (useful for auditing).

**Response (flag off):**
```json
{ "disabled": true }
```

---

## Telemetry Events

All events are emitted via `recordMetricEvent()`. No PII is included in any payload — no `studentId`.

| Event | When | Payload (no PII) |
|-------|------|------------------|
| `baseline.updated` | Every successful write | `subject`, `strandKey`, `source`, `ability`, `score` |
| `baseline.placed` | When `source = "initial"` | `subject`, `strandKey`, `ability` |

Scope: `school`, keyed by `schoolId`. `pilotOnly: true`.

---

## Feature Flag Behaviour

When `NEXT_PUBLIC_ENABLE_ADAPTIVE_BASELINE=false`:

- `GET /api/student/baseline` → `{ ability: 0, score: 0.5, disabled: true }` (200)
- `POST /api/student/baseline/evidence` → `{ disabled: true }` (200, no-op)
- No DB reads or writes occur.
- No telemetry is emitted.

The schema and migration are safe to deploy with the flag off. Existing data (from Block 7A)
is not affected.

---

## Future: Block 7C — Full IRT

When sufficient item calibration data exists (estimated: 10,000+ calibrated responses per item),
Block 7C will replace the EMA approximation with a proper 3-parameter logistic IRT model.

The `StudentBaselineAbility` table and the `[-2, +2]` ability scale are designed to be
compatible with a future IRT transition. The `ability` column semantics will not change.

---

## Related

- `lib/mastery/baseline.ts` — Pure computation library (EMA functions)
- `lib/mastery/baselineService.ts` — DB service (get, set, record evidence)
- `app/api/student/baseline/route.ts` — GET endpoint
- `app/api/student/baseline/evidence/route.ts` — POST endpoint
- `prisma/migrations/20260223_120000_adaptive_baseline/migration.sql` — Schema migration
- [ADR-0008 — Adaptive Baseline](../adr/0008-adaptive-baseline.md)
- [PERFORMANCE_ENGINE.md](./PERFORMANCE_ENGINE.md) — Block 7A product reference
