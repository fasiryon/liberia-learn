# ADR 0013 — Impact & Workflow Intelligence Loop (Block 12)

**Status:** Accepted
**Date:** 2026-02-25
**Authors:** Platform Engineering (fasiryon)
**Blocks:** 12A (Impact Analytics), 12B (AI Workflow Tools)

---

## Context

LiberiaLearn has accumulated approximately 10 blocks of learning interaction
data (AI tutoring, mastery profiles, attendance, assessments). Block 12 closes
the intelligence loop by:

1. Measuring whether the platform is producing observable educational impact
   (Block 12A — Impact Analytics Engine)
2. Giving teachers AI-powered workflow assistance at the point of instruction
   (Block 12B — Assignment Tutor, Grading Assist, Intervention Alerts)

Key constraints driving design decisions:

- **No Block 11 yet.** `TrendSnapshot` and `MonthlySnapshot` tables do not
  exist. The engine must work with existing `StudentMasteryProfile` data.
- **No probabilistic statistics for administrators.** p-values are easily
  misinterpreted by non-statisticians. Deterministic threshold rules are more
  actionable and less prone to over-interpretation.
- **No student-level exposure.** Privacy regulation and ethical policy require
  that no individual student data is surfaced in dashboards.
- **No ranking.** Comparative teacher or school rankings could create stigma
  and perverse incentives.
- **Low-bandwidth environment.** All API responses are compact; no streaming.
- **Budget-constrained AI.** Shared monthly cap enforced across all AI calls.

---

## Decision: Impact Engine Design

### D1 — Use `StudentMasteryProfile` as primary data source

`StudentMasteryProfile` has `baselineScore`, `currentScore`, `proficiencyState`,
`masteryState`, and `lastAssessedAt` — sufficient to compute all required metrics.

**Alternative:** Wait for Block 11 `TrendSnapshot` / `MonthlySnapshot`.
**Rejected:** Block 11 is not implemented. Delaying Block 12 is not acceptable.
**Forward compatibility:** `computeImpact()` API is designed so that when Block
11 tables exist, the internal query can be swapped without changing the public
signature.

### D2 — Deterministic significance rules, not p-values

Statistical significance is determined by four simultaneous threshold checks:
sample size, mastery delta, growth fraction, and effect size. All thresholds
are named constants in `statRules.ts`.

**Alternative:** Use t-test or Mann-Whitney U for statistical testing.
**Rejected:** These require normal distribution assumptions that may not hold
for classroom-scale samples, and p-values are routinely misinterpreted.
Deterministic rules are transparent, auditable, and explainable to educators.

### D3 — Cohen's d for effect size, return null when insufficient data

Effect size is only computed when both baseline and current distributions have
≥ 2 values and non-zero pooled standard deviation. Returns `null` otherwise.

**Rationale:** Reporting a misleading effect size is worse than reporting none.
The `null` case is handled gracefully in `isStatisticallyMeaningful()`.

### D4 — Append-only `ImpactSnapshot` table

`ImpactSnapshot` rows are always inserted (never upserted). Historical rows are
preserved, enabling trend queries.

**Alternative:** Upsert on `(tenantId, schoolId, classId, period)`.
**Rejected:** The null handling for optional columns in a composite unique key
is fragile in Postgres (NULLs are not equal). Append-only is simpler and keeps
full history by default.

### D5 — Feature-flag-gated snapshot writes

Snapshot writes are controlled separately by `ENABLE_IMPACT_SNAPSHOTS`. This
allows impact computation to go live before snapshot storage is verified stable.

---

## Decision: Teacher Effect Signals

### D6 — One-way hashed teacher IDs, never raw

Teacher IDs are hashed with `SHA-256("${tenantId}:${teacherId}").hex.slice(0, 16)`.
The tenant salt ensures the same teacher in two schools produces different hashes.

**Rationale:** Teacher comparative signals could be misused for performance
management if raw teacher identities are exposed. Hashing prevents reverse
lookup while preserving the ability to track relative effect buckets within a
session (hash is stable within tenant scope).

### D7 — Teacher signals omitted from national endpoint

The national endpoint returns aggregate population metrics only. Teacher
effect signals — even hashed — are not appropriate at national scope because
the bucket sizes would be too small to be meaningful and could enable
re-identification in small schools.

---

## Decision: AI Workflow Tools

### D8 — Separate workflow library from route handler

AI workflow logic (`getAssignmentTutorGuidance`, `getGradingAssistFeedback`)
lives in `lib/workflows/ai/`. Route handlers delegate to these functions.

**Rationale:** Enables testing the workflow logic independently from HTTP
concerns. Consistent with the existing pattern (`lib/ai/teacher/teacherAssist.ts`).

### D9 — Fallback guarantee for all AI workflow calls

Every workflow function returns a valid, safe result even when the AI call fails.
Fallbacks are static, curated, non-punitive responses.

**Rationale:** Teacher-facing tools must not leave teachers with an error screen
mid-lesson. A degraded experience (fallback content + `hadFallback: true`) is
always preferable to a failure.

### D10 — Punitive language guardrail in Grading Assist

Grading Assist checks the AI response against the same `PUNITIVE_KEYWORDS` list
used by the Block 10 teacher AI assist. If punitive language is detected, the
fallback is returned silently.

**Rationale:** AI models can produce harmful feedback framing even with
well-engineered prompts. A second-layer check at the response level provides
defence-in-depth.

### D11 — Submission content not stored in audit log

`submissionContent` is intentionally excluded from the audit log. Even though
the caller is required to anonymize it, the content may contain partial PII
(handwriting descriptions, school context). Excluding it reduces risk surface.

---

## Decision: Intervention Alerts

### D12 — Pure computation layer separate from DB fetch layer

`computeInterventionAlerts(classAggregates)` is a pure function that takes
pre-computed aggregates. `fetchClassAggregatesForSchool()` handles DB access.

**Rationale:** The pure layer is fully testable without DB mocks and can be
used in batch jobs, cron triggers, or other consumers without coupling to the
API layer.

### D13 — No school-level ranking in intervention alerts

Alerts are per-class, never per-school comparisons. Displaying "school X has
more alerts than school Y" would create harmful competitive dynamics between
schools that may have very different student population contexts.

### D14 — Minimum class size of 3 profiles

Classes with fewer than 3 mastery profiles are excluded from alert computation.
Very small groups produce noisy metrics that could trigger false positives.

---

## Consequences

**Positive:**
- School admins can now see actionable impact metrics without waiting for Block 11.
- Teachers have three new AI workflow tools at point-of-instruction.
- All metrics are privacy-preserving at the architecture level (not just policy).
- All features are feature-flagged and default OFF — zero-risk deployment.

**Negative / Trade-offs:**
- Profile-scan queries will be slower than aggregated snapshot reads at scale.
  Mitigated by Block 11 TrendSnapshot adoption and database indices on
  `lastAssessedAt` + `schoolId` join paths.
- Deterministic significance rules may flag small genuine improvements as
  "not meaningful" (conservative). This is intentional — overclaiming harm
  is worse than underclaiming in an educational context.
- Hashed teacher IDs in signals reduce actionability (admin cannot identify
  which teacher). This is a deliberate privacy/ethics trade-off.

---

## Related ADRs

- ADR 0002 — Tenant Isolation (extended by D5)
- ADR 0003 — AI Transparency (extended by D9, D10)
- ADR 0012 — AI Stabilization Policy (D8, D9 consistent with stabilization layer)
