# ADR-0007 — Mastery Engine Foundation (Block 7A)

| Field   | Value |
|---------|-------|
| Status  | Accepted |
| Date    | 2026-02-23 |
| Authors | Platform Engineering |
| Ticket  | Block 7A — STEM + English Outcomes Foundation |

---

## Context

LiberiaLearn needs a measurable, auditable system for tracking student learning outcomes in STEM and English. National pilot reporting, teacher dashboards, and MOE visibility all require a shared, consistent definition of "proficiency" and "mastery" that can be applied at any scope (student, class, school, county, district).

Before this block, the platform had:
- `MasteryRecord` (skill-level, integer-based mastery level — coarse-grained)
- `ReviewSchedule` (spaced-review scheduling — separate from scoring)
- No strand taxonomy (questions were tagged at skill level only)
- No growth delta or AI reliance tracking

The required outcomes foundation needed to answer four questions deterministically:
1. Is this student **proficient** in this strand?
2. Is this student **mastering** (sustaining) this strand over time?
3. How much has this student **grown** relative to their starting point?
4. Is this student becoming more or less **dependent on AI guidance**?

---

## Decision

### 1. Pure Function Architecture for All Computations

**Chosen:** All mastery derivation logic lives in `lib/mastery/compute.ts` as pure, stateless, deterministic functions. The service layer (`lib/mastery/masteryService.ts`) orchestrates DB reads, calls the pure functions, and writes results.

**Rationale:**
- Pure functions are trivially unit-testable (no mocks, no DB, no state).
- Determinism is required: the same score history must always produce the same state.
- Decouples computation from persistence — callers can compute without writing.
- Enables offline simulation of mastery trajectories without DB access.

**Rejected:** Computed columns or DB triggers (opaque, hard to test, hard to override in tests).

---

### 2. Strand Taxonomy as Data (StrandCatalog) vs. Hardcoded

**Chosen:** `StrandCatalog` table, seeded by `prisma/seeds/strand-catalog.ts`. StrandKeys are stable string identifiers (snake_case) that can be referenced by FK from `StudentMasteryProfile` and `QuestionTag`.

**Rationale:**
- Strands will evolve as Liberia's curriculum develops — a table is easier to extend than an enum.
- Allows `isActive` soft-delete without schema migration.
- Enables WAEC alignment references as optional metadata per strand.
- Seeded idempotently: `upsert` by `(subject, strandKey)` makes redeployment safe.
- FK from `StudentMasteryProfile → StrandCatalog` (composite) enforces referential integrity at the DB level.

**Rejected:** `Subject+StrandKey` as a composite enum (would require schema migration to add strands; Prisma enums cannot carry metadata).

**Rejected:** Hardcoded TypeScript constants (no FK integrity, no WAEC metadata, no runtime visibility).

---

### 3. StudentMasteryProfile: One Row Per Student × Subject × Strand

**Chosen:** Unique constraint `(studentId, subject, strandKey)`. All derived metrics are recalculated and upserted on every `updateMasteryProfile()` call.

**Rationale:**
- Single-row profile is simple to read (one query per student per strand).
- Upsert is idempotent: replaying the same attempt produces the same state.
- Derived fields (`proficiencyState`, `masteryState`, `sustainabilityIndex`, `decayRate`, `aiRelianceRate`) are always consistent with inputs — no stale derived state.
- The computation window (last N scores) is managed by the caller; the profile stores the current computed snapshot.

**Trade-off acknowledged:** This design does not store the full score history in the profile row. The caller must provide `recentScores[]` on each update. A future `MasteryAttemptLog` table (Block 7C) will store the raw history for deep analytics.

**Rejected:** Storing the raw score array in the profile (`recentScores Json?`) — would turn the profile into a log table, making updates non-idempotent and queries more complex.

---

### 4. Baseline Score: First-Write vs. Adaptive

**Chosen (Block 7A):** On the first `updateMasteryProfile()` call, `baselineScore` is set to `newScore`. The profile schema includes nullable `baselineConfidence` and `baselineCompletedAt` for Block 7B.

**Rationale:**
- Block 7B (Adaptive Baseline) will replace the first-write baseline with a standardised adaptive placement interaction. The fields are reserved and preserved.
- Block 7A should be deployable and useful before Block 7B ships; using the first score as the baseline gives a meaningful growth delta immediately.
- The `update` path of `upsert` never overwrites `baselineScore`, ensuring Block 7B's baseline is not clobbered by subsequent attempts.

**Constraint:** Block 7B must not modify the schema without a migration. The two reserved fields (`baselineConfidence`, `baselineCompletedAt`) are already present and nullable.

---

### 5. Hybrid Scoring: Grade-Band Weighted Composite

**Chosen:** `HybridScore = growthWeight × normalizedGrowth + absoluteWeight × currentScore`, with weights derived from the official grade-band model.

| Band | Growth | Absolute |
|------|--------|----------|
| G1–3 | 50% | 50% |
| G4–6 | 45% | 55% |
| G7–9 | 40% | 60% |
| G10–12 | 30% | 70% |

**Rationale:**
- Earlier grades have wider developmental ranges; growth from a low baseline is educationally significant and should be rewarded in the score.
- Senior school (G10–12) is WASSCE-oriented; absolute competency is the primary outcome.
- The model is explicit, auditable, and directly traceable to the spec — no hidden weighting.
- `normalizedGrowth = growthDelta / (1 - baselineScore)` makes growth comparable across different baseline levels (a student going from 0.3 to 0.6 made 43% of maximum possible growth; a student going from 0.7 to 0.8 made 33%).

**Rejected:** Simple average of growth and absolute (ignores grade-appropriate emphasis).
**Rejected:** Pure growth scoring (disadvantages high-baseline students who have less headroom).

---

### 6. Telemetry: School-Scoped, No PII

**Chosen:** All telemetry events are scoped to `schoolId`. StudentId is never included in event payloads. The `mastery.updated` event carries only subject, strandKey, gradeBand, and computed states.

**Rationale:**
- Complies with the platform's data minimisation principle (ADR-0002).
- Prevents inadvertent student tracking in aggregate dashboards.
- School-level event counts are sufficient for MOE reporting (% of students approaching/proficient/mastered per strand per school).
- StudentId is available in the `StudentMasteryProfile` table for authorised teacher/admin queries but is not broadcast via telemetry.

**Events defined:**
- `mastery.updated` — every write (counter for activity volume)
- `mastery.at_risk` — severity: warning (triggers teacher alert workflows in V2)
- `ai.reliance.changed` — threshold-gated (≥ 5% change) to suppress noise
- `decay.detected` — severity: warning (triggers review-schedule creation in V2)

---

### 7. Feature Flag

**Chosen:** `NEXT_PUBLIC_ENABLE_MASTERY_ENGINE` (follows existing `NEXT_PUBLIC_*` pattern from `lib/featureFlags.ts`).

When off:
- No mastery profile writes (service layer is never called from routes).
- Schema and migration are safe to deploy with the flag off.
- Existing routes and offline queue are not affected.

---

## Consequences

**Positive:**
- Full unit test coverage: 63 pure function tests, 17 tenant isolation tests. 80/80 passing.
- Deterministic computation prevents "magic black box" complaints from teachers or MOE auditors.
- Strand taxonomy is immediately queryable (92 strands seeded across 5 subjects and 4 grade bands).
- Schema is additive: no existing tables modified, all new columns have defaults or are nullable.
- Backward-compatible: existing `MasteryRecord` and `ReviewSchedule` tables untouched.
- Offline-first safe: service is server-only; offline queue and sync are not modified.

**Negative / Trade-offs:**
- Score history is not stored in Block 7A (caller manages the window). Full history audit requires Block 7C.
- First-write baseline is imprecise — Block 7B must ship before the growth signal is statistically meaningful.
- 92 strands requires strand data to be present before profiles can be created (FK constraint from `StudentMasteryProfile → StrandCatalog`). The seed must run before the service is called.

---

## Alternatives Considered and Rejected

| Alternative | Reason Rejected |
|-------------|-----------------|
| ML-based mastery inference | Opaque, non-deterministic, requires training data not yet available, violates auditability requirement |
| IRT (Item Response Theory) | Requires calibrated item parameters; no item calibration data exists yet in Block 7A |
| Storing score history in JSON column | Makes updates non-idempotent; history queries become table scans |
| Persisting hybridScore only (no raw metrics) | Loses transparency; auditors/teachers can't verify how the score was derived |
| Single "mastery level" integer (like MasteryRecord) | Too coarse; loses distinction between proficiency state, mastery state, and growth |
| Block 7B adaptive baseline in Block 7A | Increases scope significantly; adaptive assessment flow requires separate UX and AI agent integration |

---

## Related

- [ADR-0002 — Tenant Isolation](0002-tenant-isolation.md)
- [ADR-0001 — Offline Protocol](0001-offline-protocol.md)
- [docs/product/PERFORMANCE_ENGINE.md](../product/PERFORMANCE_ENGINE.md)
- `lib/mastery/compute.ts`
- `lib/mastery/masteryService.ts`
- `prisma/migrations/20260223_000000_mastery_engine_foundation/migration.sql`
- `prisma/seeds/strand-catalog.ts`
- Block 7B ADR (pending) — Adaptive Baseline
