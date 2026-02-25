# Impact Analytics Engine — Block 12A

## Overview

The Impact Analytics Engine measures the educational effect of LiberiaLearn's
AI-assisted learning on student mastery outcomes. It produces defensible,
statistically-informed metrics for school administrators and the Ministry of
Education, while preserving full privacy (no student-level rows returned to UI).

Feature flag: `ENABLE_IMPACT_ANALYTICS` (default OFF).

---

## Data Source

Primary: `StudentMasteryProfile` — one row per student per subject strand,
carrying `baselineScore`, `currentScore`, `proficiencyState`, `masteryState`,
and `lastAssessedAt`.

When Block 11 `TrendSnapshot` / `MonthlySnapshot` tables are added they can
replace the profile scan without changing the public API of `computeImpact()`.

---

## Metric Definitions

### Proficiency Rate
```
proficiencyRate = count(profiles where proficiencyState == "PROFICIENT") / totalProfiles
```
Range: 0–1. Denominator is the sample size for the period.

### Average Mastery Score
```
avgMasteryScore = mean(currentScore) across all profiles in period
```
`currentScore` is normalised 0–1 by the mastery engine.

### Mastery Delta
```
masteryDelta = mean(currentScore) − mean(baselineScore)
```
Positive = improvement. Negative = regression.

### Growth Delta
```
growthDelta = mean(currentScore − baselineScore) for each profile
```
Distinct from `masteryDelta` when the distribution of changes is skewed.

### Effect Size (Cohen's d)
```
d = (mean(current) − mean(baseline)) / pooledSD
```
`pooledSD = sqrt((var(current) + var(baseline)) / 2)`.

Returns `null` when either distribution has fewer than 2 values or when
pooled SD is zero (all scores identical).

Interpretation bands (Cohen 1988):
- |d| < 0.2 — negligible
- 0.2 ≤ |d| < 0.5 — small
- 0.5 ≤ |d| < 0.8 — medium
- |d| ≥ 0.8 — large

### Statistical Significance (Deterministic Rules)

LiberiaLearn uses **deterministic threshold rules** instead of p-values to
avoid misinterpretation in low-numeracy administrative contexts. A result is
`statisticallyMeaningful = true` when **all** of:

| Condition | Threshold |
|-----------|-----------|
| `sampleSize` | ≥ `MIN_SAMPLE_SIZE` (5) |
| `masteryDelta` | ≥ `MEANINGFUL_DELTA_THRESHOLD` (5pp) |
| `growthFraction` (fraction of profiles with positive delta) | ≥ `MEANINGFUL_GROWTH_FRACTION` (60%) |
| `effectSize` | ≥ `MEANINGFUL_EFFECT_SIZE_MIN` (0.20) |

**Special case:** when `effectSize` is `null` and `sampleSize ≥ HIGH_CONFIDENCE_THRESHOLD`
(30) and `masteryDelta > 2 × MEANINGFUL_DELTA_THRESHOLD`, result is still
considered meaningful (sufficient scale compensates for inability to compute d).

### Confidence Label

| Sample size | Label |
|-------------|-------|
| < 10 (`MEDIUM_CONFIDENCE_THRESHOLD`) | `"low"` |
| 10–29 | `"medium"` |
| ≥ 30 (`HIGH_CONFIDENCE_THRESHOLD`) | `"high"` |

---

## Tenant Isolation

All queries are hard-scoped by `tenantId` (= `schoolId`). The engine never
returns cross-school data. When a platform admin queries a specific school via
`?schoolId=`, that value is used as the tenant scope.

Class-scoped queries (`?scope=class&classId=`) additionally validate that the
class belongs to the requesting tenant's school, preventing cross-tenant
class enumeration.

---

## Teacher Effect Signals

Teacher signals are computed only at school scope (never class scope). Raw
`teacherId` values are **never** stored in signals. Each teacher ID is hashed:

```
hash = SHA-256("${tenantId}:${teacherId}").hex.slice(0, 16)
```

The salt includes `tenantId` so the same teacher in two tenants gets different
hashes (tenant-scoped one-way hash). Results are sorted by delta descending but
since IDs are opaque hashes this is not a meaningful public ranking.

Teacher signals are **omitted** from the national impact endpoint.

---

## ImpactSnapshot Persistence

When `ENABLE_IMPACT_SNAPSHOTS=true`, each successful impact computation writes
an `ImpactSnapshot` row (append-only — no upsert). Consumers query
`ORDER BY generatedAt DESC LIMIT 1` for the latest snapshot.

Snapshots enable trend-over-time views without re-scanning all mastery profiles
on every request.

---

## API Routes

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/admin/dashboard/school/impact` | ADMIN + `dashboard:school:impact` permission |
| GET | `/api/admin/dashboard/national/impact` | Platform admin only |

### Query Parameters (school endpoint)

| Param | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Start month `YYYY-MM` |
| `to` | Yes | End month `YYYY-MM` |
| `scope` | No | `school` (default) or `class` |
| `classId` | Conditional | Required when `scope=class` |
| `schoolId` | No | Platform admin only — query any school |

### Response Shape (school)

```jsonc
{
  "proficiencyRate": 0.65,
  "avgMasteryScore": 0.72,
  "masteryDelta": 0.08,
  "growthDelta": 0.08,
  "effectSize": 0.45,
  "statisticallyMeaningful": true,
  "confidenceLabel": "high",
  "sampleSize": 35,
  "teacherEffectSignals": [ /* hashed IDs only */ ],
  "period": { "from": "2026-01", "to": "2026-03" }
}
```

### Response Shape (national)

Same fields, plus `"scope": "national"`. `teacherEffectSignals` is **omitted**.

---

## Privacy Guarantees

- No student-level rows are returned to the UI.
- No student IDs appear in audit logs or telemetry.
- Teacher IDs are one-way hashed before any storage or transmission.
- All queries are tenant-isolated at the Prisma where-clause level.
