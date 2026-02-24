# Performance Engine — Product & Implementation Reference

> **Feature flag:** `NEXT_PUBLIC_ENABLE_MASTERY_ENGINE=true`
> **Status:** V1 — Block 7A (February 2026)
> **Related ADR:** [ADR-0007 — Mastery Engine Foundation](../adr/0007-mastery-engine-foundation.md)
> **Block 7B (adaptive baseline) is separate.** This document covers Block 7A only.

---

## Purpose

The Performance Engine provides a data-driven foundation for measuring STEM and English learning outcomes across all Liberian schools on the platform.

It answers two questions for every student × subject × strand:

1. **Where is this student now?** (Proficiency State)
2. **Is this student improving sustainably?** (Mastery State + Growth)

The engine is intentionally designed as **support infrastructure, not surveillance**. Metrics guide teachers and school leaders toward targeted support — they never surface to rank, shame, or compare individual students without context.

---

## Core Definitions

These definitions are encoded as named constants in `lib/mastery/compute.ts` and enforced by unit tests. They cannot be changed without also updating the tests and this document.

### Proficiency

> A student independently applies a concept with **≥ 75% accuracy** across varied question types **without AI assistance**.

- Threshold: `PROFICIENCY_THRESHOLD = 0.75`
- State field: `proficiencyState` on `StudentMasteryProfile`
- States: `NOT_ASSESSED` → `BELOW_PROFICIENT` → `APPROACHING` → `PROFICIENT`

### Mastery

> A student sustains **≥ 85% accuracy** across **spaced assessments** and demonstrates correct application in cumulative or cross-topic problems **over time**.

- Score threshold: `MASTERY_THRESHOLD = 0.85`
- Stability requirement: `MASTERY_SUSTAINABILITY_MIN = 0.65` (sustainability index)
- Evidence requirement: **minimum 3 spaced assessments** before MASTERED can be awarded
- State field: `masteryState` on `StudentMasteryProfile`
- States: `NOT_ASSESSED` → `DEVELOPING` → `APPROACHING` → `MASTERED` / `DECAYING`

The `DECAYING` state is triggered when a student who previously reached MASTERED now shows a per-day score drop exceeding `DECAY_ALERT_THRESHOLD = 0.005`. This surfaces as a `decay.detected` telemetry event and `mastery.at_risk` alert.

### Growth

> Improvement relative to baseline via:
> - **Score delta** — raw improvement from baseline
> - **Retention stability** — sustainability index across assessments
> - **Reduced AI reliance** — declining dependence on guided support

Growth is the primary input for younger grade bands (see Hybrid Score below).

### Statistically Meaningful Improvement

> Gains that exceed normal variation, sustained across multiple assessments, with ≥ 60% of students showing measurable growth.

_Note: The ≥ 60% cohort measurement is a national-level aggregate metric (district/county). Individual student profiles track score delta and sustainability only. Block 7B will add statistical significance testing across cohorts._

---

## Strand Taxonomy

Strands are the atomic unit of curriculum focus — a specific skill cluster within a subject and grade band.

| Field | Description |
|-------|-------------|
| `subject` | One of: `MATH`, `SCIENCE`, `ENGINEERING`, `COMPUTER_SCIENCE`, `LITERACY` |
| `strandKey` | Stable snake_case identifier (e.g., `algebra_basics`, `phonics_decoding`) |
| `name` | Human-readable display name |
| `gradeBand` | `G1_3`, `G4_6`, `G7_9`, or `G10_12` |
| `waecRef` | Optional WAEC/WASSCE alignment code (G10–12 only) |
| `isActive` | Soft-delete flag (set to `false` to retire a strand without migration) |

### Strand Counts by Subject

| Subject | G1–3 | G4–6 | G7–9 | G10–12 | Total |
|---------|------|------|------|--------|-------|
| Math | 5 | 5 | 5 | 5 | 20 |
| Science | 5 | 5 | 5 | 5 | 20 |
| Engineering | 4 | 4 | 4 | 4 | 16 |
| Computer Science | 4 | 4 | 4 | 4 | 16 |
| Literacy (English) | 5 | 5 | 5 | 5 | 20 |
| **Total** | **23** | **23** | **23** | **23** | **92** |

G10–12 strands carry WAEC/WASSCE alignment references for Math, Science, and Literacy to support exam preparation.

---

## Hybrid Scoring Model

The Hybrid Score combines **growth** (relative improvement) and **absolute proficiency** using grade-band-specific weights.

```
HybridScore = (growthWeight × normalizedGrowth) + (absoluteWeight × currentScore)
```

Where:
- `normalizedGrowth = growthDelta / (1 - baselineScore)` — growth relative to remaining headroom
- `growthDelta = currentScore - baselineScore`

### Grade-Band Weights

| Grade Band | Growth Weight | Absolute Weight | Rationale |
|------------|:-------------:|:---------------:|-----------|
| G1–3 | **50%** | **50%** | Early learners: effort and progress matter equally to absolute level. Wide developmental range is normal. |
| G4–6 | **45%** | **55%** | Transition band: absolute skills become more predictive of future success. |
| G7–9 | **40%** | **60%** | Middle school: competency matters for subject progression and national exams. |
| G10–12 | **30%** | **70%** | Senior school: WASSCE readiness is primarily absolute. Growth is a secondary signal. |

**Design rationale:** This weighting model ensures that a student who starts far below grade level and makes large, consistent gains is recognised as growing — even if their absolute score is still below the national proficiency bar. This is critical for early-intervention programmes in communities with historically under-resourced schools.

---

## Sustainability Index

The Sustainability Index (SI) measures **score stability** across recent assessments.

```
SI = 1 − (stdDev / 0.5)    clamped to [0, 1]
```

Where `0.5` is the maximum possible standard deviation for values in `[0, 1]`.

| SI Range | Interpretation |
|----------|----------------|
| 0.90–1.00 | Highly stable — consistent, reliable performance |
| 0.70–0.89 | Stable — minor fluctuation (expected) |
| 0.50–0.69 | Moderate volatility — needs monitoring |
| < 0.50 | High volatility — inconsistent performance, investigate support needs |

SI ≥ `MASTERY_SUSTAINABILITY_MIN` (0.65) is required before a student can be awarded MASTERED state.

---

## AI Reliance Rate

```
aiRelianceRate = aiAssistedAttempts / totalAttempts    clamped to [0, 1]
```

Tracks the fraction of attempts where a student invoked AI guidance. A declining AI reliance rate — combined with maintained or improved scores — is a positive growth signal (reduced dependence on guided support, as per the Growth definition).

The `ai.reliance.changed` event is emitted only when the rate shifts by ≥ 5 percentage points to suppress noise.

---

## Telemetry Events

All events flow through `recordMetricEvent()` → `MetricEvent` table. **No PII is included in any payload.** StudentIds are never written to payloads; the tenant scope is always `schoolId`.

| Event | Trigger | Payload fields |
|-------|---------|----------------|
| `mastery.updated` | Every `updateMasteryProfile()` call | `subject`, `strandKey`, `gradeBand`, `proficiencyState`, `masteryState`, `hybridScore` |
| `mastery.at_risk` | `proficiencyState = BELOW_PROFICIENT` OR `masteryState = DECAYING` | `subject`, `strandKey`, `gradeBand`, `proficiencyState`, `masteryState` |
| `ai.reliance.changed` | Reliance rate shifts ≥ 5% | `subject`, `strandKey`, `aiRelianceRate`, `delta` |
| `decay.detected` | `decayRate > 0.005` | `subject`, `strandKey`, `decayRate` |

---

## Data Model

### StudentMasteryProfile

One row per student × subject × strand. Created on first attempt; updated on every subsequent attempt.

| Field | Type | Description |
|-------|------|-------------|
| `studentId` | FK → Student | Tenant-scoped: Student → User → School |
| `subject` | Subject enum | Subject for this profile |
| `strandKey` | String | Must exist in StrandCatalog |
| `baselineScore` | Float | Initial score (set on first write; Block 7B may refine via adaptive baseline) |
| `currentScore` | Float | Most recent attempt score (0–1) |
| `proficiencyState` | ProficiencyState enum | Derived from currentScore |
| `masteryState` | MasteryState enum | Derived from score + SI + decay + assessmentCount |
| `sustainabilityIndex` | Float | Score stability (0–1) |
| `decayRate` | Float | Per-day score drop during declining periods |
| `aiRelianceRate` | Float | Fraction of AI-assisted attempts |
| `lastAssessedAt` | DateTime? | Timestamp of most recent attempt |
| `baselineConfidence` | Float? | **Reserved for Block 7B** adaptive baseline |
| `baselineCompletedAt` | DateTime? | **Reserved for Block 7B** adaptive baseline |

### StrandCatalog

Reference table. Seeded at deploy time. Edits require a new seed run or manual upsert — no schema change.

### QuestionTag

Links question/item IDs to strand + difficulty + item-type metadata. Enables strand-level accuracy calculation and question difficulty analysis. FK to PracticeItem (nullable — tags can exist before items are assigned).

---

## Support vs. Surveillance Philosophy

The Performance Engine is built on the principle that **measurement should serve learners, not sort them**.

Concretely:

1. **No public ranking.** Mastery states are private to students, teachers, and school admins. No inter-school student comparison at this layer.
2. **No punitive thresholds.** BELOW_PROFICIENT and DECAYING trigger support interventions — not administrative actions.
3. **Growth recognised at all levels.** The hybrid score explicitly rewards students who improve significantly from a low baseline, even if they haven't crossed the absolute proficiency line yet.
4. **AI reliance is a support signal.** High AI reliance is not penalised — it surfaces a coaching opportunity for teachers and a richer learning path for the adaptive engine.
5. **No PII in aggregate telemetry.** All emitted events carry schoolId (for tenant attribution) but never studentId, name, or contact information.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/mastery/compute.ts` | Pure, deterministic computation functions (no DB, no side effects) |
| `lib/mastery/masteryService.ts` | DB upsert + telemetry orchestration |
| `prisma/schema.prisma` | `StrandCatalog`, `QuestionTag`, `StudentMasteryProfile` models + new enums |
| `prisma/migrations/20260223_000000_mastery_engine_foundation/migration.sql` | Schema migration |
| `prisma/seeds/strand-catalog.ts` | 92 strand entries for Math, Science, Engineering, CS, Literacy |
| `__tests__/mastery.compute.test.ts` | 63 unit tests for all pure functions |
| `__tests__/mastery.tenant.test.ts` | 17 tenant isolation and telemetry PII tests |
| `lib/featureFlags.ts` | `ENABLE_MASTERY_ENGINE` flag |

---

## What Block 7B Adds

Block 7B (Adaptive Baseline) will extend this foundation to:

- Set `baselineScore` from a **standardised placement interaction** rather than first-attempt data.
- Populate `baselineConfidence` (confidence interval on the baseline estimate).
- Set `baselineCompletedAt` (timestamp of adaptive baseline completion).
- Compute statistically meaningful improvement at the **cohort level** (≥ 60% threshold).
- Drive adaptive question selection based on current mastery state.

The `StudentMasteryProfile` fields for baseline are already nullable and preserved through Block 7A updates — no migration required for Block 7B's baseline writes.

---

## V2 Roadmap

- Teacher-facing mastery dashboard per class × strand.
- National strand heat-map (district/county aggregate — no individual student data).
- Spaced-review scheduling based on `decayRate` (feeds `ReviewSchedule`).
- WAEC strand alignment gap analysis for G10–12 cohorts.
- Export: strand mastery CSV for MOE reporting.
