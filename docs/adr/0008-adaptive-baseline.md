# ADR-0008 — Adaptive Baseline (Block 7B)

| Field   | Value |
|---------|-------|
| Status  | Accepted |
| Date    | 2026-02-23 |
| Authors | Platform Engineering |
| Ticket  | Block 7B — Adaptive Baseline Computation |

---

## Context

Block 7A (ADR-0007) shipped the Mastery Engine with a first-write baseline: the first score a
student records on a strand becomes their `baselineScore`. This is a meaningful starting point
but statistically imprecise — a single score has high variance.

Block 7B replaces the first-write baseline with an **adaptive placement estimate** that
incorporates multiple evidence items. The estimate must be:

1. **Explainable** — teachers and MOE auditors must be able to trace any number to a formula.
2. **Deployable now** — no pre-calibrated item parameters are available.
3. **Convergent** — the estimate improves as more evidence arrives.
4. **Bounded** — ability must stay within a defined scale.
5. **Tenant-safe** — no cross-student or cross-school data access.

---

## Decision

### 1. EMA (Exponential Moving Average) over IRT

**Chosen:** A simplified EMA update rule using a pseudo-ICC (Item Characteristic Curve):

```
P(correct) = sigmoid(ability − difficultyParam)
error      = actualCorrectness − P(correct)
alpha      = BASE_ALPHA × assessmentWeight / √(attemptCount)
newAbility = clamp(prevAbility + clamp(alpha × error, ±MAX_ABILITY_DELTA), [−2, +2])
```

**Rationale:**
- Full 3-parameter IRT requires calibrated item parameters (discrimination, difficulty, pseudo-guessing), estimated from large response datasets. LiberiaLearn does not yet have this data.
- EMA provides a deterministic, auditable approximation: every ability value can be traced step-by-step from the input history.
- The difficulty → ability parameter mapping (`DIFFICULTY_PARAMS`) is explicitly documented and can be tuned without a schema change.
- IRT is explicitly planned for Block 7C as a future upgrade path. The `[-2, +2]` ability scale is compatible with logistic IRT.

**Rejected:** Full 3-PL IRT (no calibration data), neural embeddings (opaque), raw percent-correct average (ignores item difficulty).

---

### 2. Separate `StudentBaselineAbility` Table vs. Extending `StudentMasteryProfile`

**Chosen:** A new `StudentBaselineAbility` table with its own unique index on
`(schoolId, studentId, subject, strandKey)`.

**Rationale:**
- `StudentMasteryProfile` is a **derived state snapshot** (recomputed on every attempt). The ability estimate is a **time-series accumulator** — it has a different write cadence and semantic.
- Separating the concerns allows Block 7B to be deployed and flag-gated independently of Block 7A. The mastery service never touches the ability table.
- The `StudentMasteryProfile.baselineScore` field (Block 7A) is a [0,1] normalisation of the `[-2, +2]` ability, set once at the end of initial placement and never overwritten. This preserves the growth delta signal across all future attempts.
- `schoolId` is explicitly stored as a first-class column for tenant isolation. Every query must filter by `schoolId`.

**Rejected:** Adding an `ability` column to `StudentMasteryProfile` (conflates two update cycles; prevents independent flag-gating).

---

### 3. Alpha Dampening Strategy

**Chosen:** `alpha = BASE_ALPHA × assessmentWeight / √(attemptCount)`.

**Rationale:**
- `√(n)` dampening is standard for online averaging: it decays like `O(1/√n)`, giving high initial responsiveness and stable convergence at scale.
- `assessmentWeight` encodes assessment stakes: exams (1.0) update ability more than practice (0.4). This matches pedagogical reality — a proctored exam is more informative than a formative practice attempt.
- The guardrail (`MAX_ABILITY_DELTA = 0.8`) prevents any single piece of evidence from causing a wild jump, regardless of assessment weight.

**Rejected:** Constant alpha (no convergence), `1/n` dampening (too aggressive for early estimates when n is small).

---

### 4. `BaselineSource` Enum

**Chosen:** `BaselineSource { initial, practice, assessment, manual }`.

**Rationale:**
- Distinguishes *how* an estimate was established — required for audit trails and teacher-facing explanations.
- `initial` marks the first adaptive placement result (emits an extra `baseline.placed` telemetry event).
- `manual` enables teacher overrides for documented edge cases (student transferred with prior records, technical assessment failure). `updatedBy` captures the teacher's userId for accountability.
- The enum lives at the DB level (not just TypeScript) to enforce valid values without application-layer validation.

---

### 5. Tenant Isolation via schoolId Column

**Chosen:** `schoolId` stored as an explicit first-class column on `StudentBaselineAbility`.
Every DB read and write is scoped by `(schoolId, studentId)` or the unique composite index.

**Rationale:**
- `studentId` alone is not sufficient for tenant isolation: a student could theoretically appear in multiple schools (transfer). `schoolId` makes the tenant boundary explicit.
- `schoolId` is always derived from the authenticated session — never accepted from client input.
- Consistent with the tenant isolation pattern established in ADR-0002.

---

### 6. Feature Flag

**Chosen:** `NEXT_PUBLIC_ENABLE_ADAPTIVE_BASELINE` (independent of `ENABLE_MASTERY_ENGINE`).

When off:
- `GET /api/student/baseline` returns `{ ability: 0, score: 0.5, disabled: true }` (200).
- `POST /api/student/baseline/evidence` returns `{ disabled: true }` (200, no-op).
- No DB reads or writes.
- No telemetry.

**Rationale:**
- Block 7B can be deployed as an additive migration and enabled independently once the placement UX is ready.
- Returning a safe default (`ability: 0`) rather than an error prevents client code from needing to handle the disabled state as an exception.
- The flag check is runtime (`isFeatureEnabled()` reads `process.env` at call time) to support test environments that mutate env vars between assertions.

---

### 7. Telemetry: No PII

**Chosen:** Same pattern as Block 7A. `baseline.updated` and `baseline.placed` events carry `subject`, `strandKey`, `source`, `ability`, and `score` — no `studentId`.

**Rationale:**
- Complies with ADR-0002 data minimisation.
- School-level event aggregation (count of placements per strand) is sufficient for MOE reporting.
- `studentId` is available for authorised teacher/admin queries via the `StudentBaselineAbility` table but must not be broadcast via telemetry.

---

## Consequences

**Positive:**
- 73 unit + tenant tests: 50 pure function tests (all math verified), 23 service/flag/PII tests. 73/73 passing.
- Fully deterministic: the same evidence history always produces the same ability estimate.
- Additive schema: `StudentBaselineAbility` is a new table; no existing tables or columns are modified.
- Flag-independent deployment: the schema can be migrated without enabling the feature.
- Block 7A's `baselineScore` first-write is preserved as a fallback; Block 7B populates it on initial placement completion.

**Negative / Trade-offs:**
- EMA is a pragmatic approximation, not a statistically optimal estimator. Ability estimates for students with few attempts have high variance.
- `DIFFICULTY_PARAMS` are manually assigned, not empirically calibrated. They approximate expected performance for a grade-level student but may not match actual item statistics.
- Full IRT upgrade (Block 7C) will require a data migration if the `difficulty` mapping changes substantially.

---

## Alternatives Considered and Rejected

| Alternative | Reason Rejected |
|-------------|----------------|
| 3-PL IRT | No item calibration data exists; requires separate calibration pipeline |
| Rasch model | Still requires item difficulty calibration from response data |
| Raw percent-correct average | Ignores item difficulty; doesn't produce an ability scale |
| Bayesian Knowledge Tracing | Designed for skill mastery, not ability estimation; requires per-skill priors |
| Extending `StudentMasteryProfile` | Conflates derived snapshot with accumulator; prevents independent flag-gating |
| Accepting schoolId from client | Security violation: tenant isolation requires server-derived schoolId |

---

## Related

- [ADR-0007 — Mastery Engine Foundation](0007-mastery-engine-foundation.md)
- [ADR-0002 — Tenant Isolation](0002-tenant-isolation.md)
- [docs/product/ADAPTIVE_BASELINE.md](../product/ADAPTIVE_BASELINE.md)
- `lib/mastery/baseline.ts`
- `lib/mastery/baselineService.ts`
- `app/api/student/baseline/route.ts`
- `app/api/student/baseline/evidence/route.ts`
- `prisma/migrations/20260223_120000_adaptive_baseline/migration.sql`
- Block 7C ADR (pending) — Full IRT with item calibration
