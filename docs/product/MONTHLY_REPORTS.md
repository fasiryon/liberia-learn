# Monthly Reports — Product Reference

**Block 8 — Hybrid Reporting Layer**

---

## Overview

The Monthly Reports system automatically generates per-school and national performance
summaries at the end of each calendar month. Each report aggregates mastery profile data
across all students in scope, computes headline metrics, and classifies academic strands
into internal performance tiers.

Reports are:
- **Evidence-based** — derived from `StudentMasteryProfile` records populated by Blocks 7A–7C.
- **Idempotent** — re-running generation for the same period overwrites the existing record.
- **Role-gated** — only ADMIN users can generate or retrieve reports.
- **Privacy-preserving** — no student-level PII appears in report payloads or telemetry.

Feature flag: `NEXT_PUBLIC_ENABLE_MONTHLY_REPORTS`. When off, the generate endpoint returns
`{ disabled: true }` and makes no DB writes.

---

## Report Contents

### Headline Metrics (student-count-weighted across all strands)

| Metric | Description |
|--------|-------------|
| `proficiencyRate` | Fraction of proficient students (state = PROFICIENT) |
| `masteryRate` | Fraction of mastered students (state = MASTERED) |
| `avgGrowthDelta` | Mean growth since baseline (`currentScore − baselineScore`) |
| `sustainabilityIndex` | Mean sustainability index (independent practice rate) |
| `aiRelianceRate` | Mean AI reliance rate (fraction of AI-assisted attempts) |

### Report Metadata

| Field | Description |
|-------|-------------|
| `totalStudents` | Distinct student count in scope |
| `totalStrands` | Number of unique subject × strandKey combinations |
| `month` | Reporting period in `YYYY-MM` format |
| `scope` | `"school"` or `"national"` |
| `scopeId` | School ID (or `null` for national) |
| `status` | `pending` → `completed` (or `failed` on error) |

### Strand Breakdown (in `payload.strandBreakdown`)

Each strand entry contains the strand-level aggregates and a `tier` classification
(see Internal Performance Tiers below). Available via `GET /api/admin/reports/monthly/[id]`
(not returned in list results for performance).

### Tier Summary (in `payload.tierSummary`)

Counts of strands per tier and tier definitions. **INTERNAL USE ONLY** — see ADR-0009.

---

## Internal Performance Tiers

> **Important:** Tiers are for internal intervention planning only. They must never be
> shown to students, guardians, or public-facing dashboards. See ADR-0009.

Tiers classify each academic strand based on the aggregated performance of all students
within that strand for the reporting period.

| Tier | Criteria | Interpretation |
|------|----------|----------------|
| **A** | Proficiency ≥ 75% AND Avg Growth ≥ 0.10 | High proficiency, strong growth momentum |
| **B** | Avg Growth ≥ 0.10 AND Avg Baseline < 0.50 | Strong growth from a low starting point |
| **C** | Proficiency < 60% AND Avg Growth < 0.05 | Low proficiency, stagnant growth — priority intervention |
| **D** | Avg Baseline ≥ 0.70 AND Avg Growth < 0.05 | High baseline but stagnant — consolidation needed |
| **unclassified** | None of the above criteria met | Mid-range performance, monitor |

Priority order when multiple criteria are met: A → B → C → D → unclassified.

Threshold constants (exported from `lib/reporting/monthly/compute.ts`):
- `TIER_HIGH_PROFICIENCY = 0.75`
- `TIER_LOW_PROFICIENCY = 0.60`
- `TIER_HIGH_GROWTH = 0.10`
- `TIER_STAGNANT_GROWTH = 0.05`
- `TIER_HIGH_BASELINE = 0.70`
- `TIER_LOW_BASELINE = 0.50`

---

## API Reference

### POST /api/admin/reports/monthly/generate

Manually trigger report generation for a given scope and month.

**Auth:** ADMIN role required.

**Request body:**
```json
{
  "scope":   "school",
  "scopeId": "school_abc123",
  "month":   "2026-01",
  "subject": "MATH"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | `"school"` or `"national"` |
| `scopeId` | Conditional | Required for `scope="school"` |
| `month` | Yes | `"YYYY-MM"` format, e.g. `"2026-01"`. Year ≥ 2020. |
| `subject` | No | Subject filter. Omit for all-subjects aggregate. |

**Scope access rules:**
- School scope: non-platform admins can only generate for their own school (`schoolId` from session).
- National scope: platform admin only.
- County and district scope: not yet supported (returns 400).

**Response (200) — success:**
```json
{
  "reportId": "clx...",
  "status": "completed",
  "month": "2026-01",
  "scope": "school",
  "scopeId": "school_abc123",
  "totalStudents": 150,
  "totalStrands": 8,
  "proficiencyRate": 0.72,
  "tierCounts": { "A": 2, "B": 2, "C": 1, "D": 1, "unclassified": 2 }
}
```

**Response (200) — feature disabled:**
```json
{ "disabled": true }
```

**Error responses:**
- `400` — missing/invalid month, unsupported scope
- `401` — not authenticated
- `403` — not ADMIN, or cross-school access denied

---

### GET /api/admin/reports/monthly

List monthly report summaries for a given scope. Payload (strand breakdown) is excluded
from list results — use the `[id]` endpoint to retrieve a full report.

**Auth:** ADMIN role required.

**Query parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `scope` | `"school"` | `"school"` or `"national"` |
| `scopeId` | (session) | School ID. Required for `scope="school"` unless inferred from session. |
| `month` | (all) | Optional `YYYY-MM` filter |
| `limit` | `12` | Max records (max 60) |

**Response (200):**
```json
{
  "reports": [
    {
      "id": "clx...",
      "scope": "school",
      "scopeId": "school_abc123",
      "month": "2026-01",
      "subject": "__ALL__",
      "status": "completed",
      "proficiencyRate": 0.72,
      "masteryRate": 0.48,
      "avgGrowthDelta": 0.14,
      "sustainabilityIndex": 0.81,
      "aiRelianceRate": 0.09,
      "totalStudents": 150,
      "totalStrands": 8,
      "tierCounts": { "A": 2, "B": 2, "C": 1, "D": 1, "unclassified": 2 },
      "generatedAt": "2026-02-01T02:00:00.000Z",
      "createdAt": "2026-02-01T02:00:00.000Z"
    }
  ]
}
```

---

### GET /api/admin/reports/monthly/[id]

Retrieve a single monthly report including the full strand breakdown.

**Auth:** ADMIN role required.

**Query parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `format` | `"json"` | `"json"` or `"pdf"` (PDF requires `ENABLE_REPORT_PDF_EXPORT` flag) |

**Tenant safety:** Non-platform admins can only access reports where `schoolId` matches
their own. National scope reports require platform admin.

**Response (200):**
```json
{
  "id": "clx...",
  "scope": "school",
  "scopeId": "school_abc123",
  "month": "2026-01",
  "subject": "__ALL__",
  "status": "completed",
  "proficiencyRate": 0.72,
  "masteryRate": 0.48,
  "avgGrowthDelta": 0.14,
  "sustainabilityIndex": 0.81,
  "aiRelianceRate": 0.09,
  "totalStudents": 150,
  "totalStrands": 8,
  "tierCounts": { "A": 2, "B": 2, "C": 1, "D": 1, "unclassified": 2 },
  "payload": {
    "meta":            { "month": "2026-01", "scope": "school", "scopeId": "..." },
    "headline":        { "proficiencyRate": 0.72, ... },
    "strandBreakdown": [ { "subject": "MATH", "strandKey": "...", "tier": "A", ... } ],
    "tierSummary":     { "counts": {...}, "thresholds": {...} }
  },
  "generatedAt": "2026-02-01T02:00:00.000Z",
  "createdAt": "2026-02-01T02:00:00.000Z"
}
```

**Error responses:**
- `400` — invalid format parameter
- `401` — not authenticated
- `403` — not ADMIN, or cross-school/national access denied
- `404` — report not found
- `501` — PDF export not implemented / flag off

---

## Scheduled Generation (Cron Hook)

### GET /api/cron/monthly-reports

Generates reports for all active schools. Called automatically on the 1st of each month.

**Authentication:** `Authorization: Bearer <CRON_SECRET>` header.
If `CRON_SECRET` is not configured in the deployment environment, all requests are
rejected (fail-secure). Set `CRON_SECRET` in your deployment environment variables.

**Query parameters:**

| Parameter | Description |
|-----------|-------------|
| `month` | Override target month (default: previous calendar month). `YYYY-MM` format. |
| `dry_run=true` | Skip DB writes; returns the count of schools that would be processed. |

**Vercel Cron configuration** (`vercel.json`):
```json
{
  "crons": [{ "path": "/api/cron/monthly-reports", "schedule": "0 2 1 * *" }]
}
```

**Response (200):**
```json
{
  "month": "2026-01",
  "processed": 45,
  "succeeded": 43,
  "failed": 2,
  "errors": [
    { "schoolId": "school_xyz", "error": "Aggregation timeout" }
  ]
}
```

**Idempotency:** Safe to re-run for the same month. Each school's report is upserted
(not inserted). Failed schools can be re-processed by re-running the job.

---

## Data Flow

```
[Evidence submitted]
        │
        ▼
POST /api/student/evidence  (Block 7C)
        │
        ▼
StudentMasteryProfile  ──────────────────────────────────────┐
StudentBaselineAbility                                        │
                                                              ▼
                                          Cron: GET /api/cron/monthly-reports
                                          Manual: POST /api/admin/reports/monthly/generate
                                                              │
                                                              ▼
                                          aggregationService.aggregateProfilesForScope()
                                            ↳ Queries StudentMasteryProfile by scope + month
                                            ↳ Returns rows with growthDelta, proficiencyState...
                                                              │
                                                              ▼
                                          compute.aggregateByStrand()
                                            ↳ Groups by subject × strandKey
                                            ↳ Computes rates, means, counts
                                                              │
                                                              ▼
                                          compute.classifyStrandTier()
                                            ↳ Assigns A/B/C/D/unclassified per strand
                                                              │
                                                              ▼
                                          compute.computeHeadlineMetrics()
                                            ↳ Student-count-weighted averages
                                                              │
                                                              ▼
                                          prisma.monthlyReport.upsert()
                                            ↳ Stores completed report in DB
                                                              │
                                                              ▼
                                          GET /api/admin/reports/monthly/[id]
                                            ↳ ADMIN retrieves full report + payload
```

---

## Feature Flag Behaviour

| Flag | Off Behaviour |
|------|---------------|
| `ENABLE_MONTHLY_REPORTS` | `generateMonthlyReport()` returns `{ disabled: true }`. No DB writes. No telemetry. |
| `ENABLE_REPORT_PDF_EXPORT` | `GET /api/admin/reports/monthly/[id]?format=pdf` returns 501. |

Flags are runtime-evaluated (`isFeatureEnabled()` reads `process.env` at call time).

---

## Telemetry Events

| Event | When | Payload Fields | Scope Fields |
|-------|------|----------------|--------------|
| `report.generated` | Successful completion | `month`, `scope`, `totalStudents`, `totalStrands`, `durationMs` | `schoolId` |
| `report.failed` | Aggregation or DB error | `month`, `scope`, `phase`, `errorMessage` | `schoolId` |
| `report.exported` | PDF export (future) | `month`, `scope`, `format` | `schoolId` |

All telemetry payloads are PII-free. No `studentId`, `email`, or `name` fields.

---

## Tenant Isolation Guarantees

1. **Report generation** — scope is derived from `resolveScopeParams()` which validates
   that non-platform admins can only access their own `schoolId`.
2. **Report retrieval** — `GET /api/admin/reports/monthly/[id]` checks `row.schoolId === user.schoolId`
   for non-platform admins. National scope reports require `isPlatformAdmin`.
3. **Aggregation** — school-scope queries filter `student.user.schoolId = scopeId` at the
   Prisma level; national queries aggregate across all schools.
4. **Sentinels** — national `scopeId` is stored as `"__NATIONAL__"` in the DB
   (to satisfy PostgreSQL UNIQUE constraints on non-nullable composite keys) but is
   remapped to `null` in all API responses. `subject` is stored as `"__ALL__"` for
   all-subjects aggregates and is not remapped.

---

## Known Limitations

1. **No county/district scope** — County and district report aggregation is not yet
   implemented. The API returns 400 for these scope values.

2. **PDF export not implemented** — The PDF endpoint stub returns 501. Install a PDF
   generation library (e.g. `@react-pdf/renderer`, `puppeteer`) and set
   `NEXT_PUBLIC_ENABLE_REPORT_PDF_EXPORT=true` when ready.

3. **Subject filter not fully aggregated** — The `subject` parameter filters the
   aggregation to a single subject. The `__ALL__` sentinel stores the all-subjects
   aggregate. Subject-level reports can be generated separately but are not automatically
   created by the cron job (which only generates all-subjects reports).

4. **No historical trend chart** — The current report schema stores one snapshot per
   `(scope, scopeId, month, subject)`. Multi-month trend computation must be done by
   querying multiple monthly reports and computing differences client-side.

---

## Related

- [ADR-0009 — Monthly Reporting](../adr/0009-monthly-reporting.md)
- [docs/product/EVIDENCE_PIPELINE.md](EVIDENCE_PIPELINE.md) — How evidence flows to StudentMasteryProfile
- [docs/product/PERFORMANCE_ENGINE.md](PERFORMANCE_ENGINE.md) — Block 7A mastery engine
- `lib/reporting/monthly/compute.ts` — Pure computation functions
- `lib/reporting/monthly/aggregationService.ts` — DB aggregation
- `lib/reporting/monthly/reportGenerator.ts` — Orchestration
- `lib/reporting/monthly/scheduler.ts` — Batch job runner
- `prisma/migrations/20260224_130000_monthly_reports/migration.sql`
