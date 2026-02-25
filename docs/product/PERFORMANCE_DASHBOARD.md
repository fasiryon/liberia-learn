# Performance Dashboard — Product & Implementation Reference

> **Feature flag:** `ENABLE_PERFORMANCE_DASHBOARD=true` (server-side, default OFF)
> **Status:** V1 — Block 9 (February 2026)
> **Related ADR:** [ADR-0011 — Performance Dashboard](../adr/0011-performance-dashboard.md)
> **Depends on:** Block 7A (Mastery Engine), Block 7B (Adaptive Baseline), Block 8 (Monthly Reports)

---

## Purpose

The Performance Dashboard gives school leaders and national administrators an aggregated, real-time view of learning outcomes across their scope — without exposing any personally identifiable information (PII).

It answers three questions for leadership at a glance:

1. **How is the school performing overall?** (Mastery score averages, tier distribution)
2. **Is the school improving?** (Baseline growth trend, active student count)
3. **Is the school functioning?** (Monthly report completion, teacher training adoption)

---

## Scope

Two endpoints are provided:

| Endpoint | Scope | Required Permission |
|---|---|---|
| `GET /api/admin/dashboard/school` | Single school | `DASHBOARD_SCHOOL_VIEW` (ADMIN role) |
| `GET /api/admin/dashboard/national` | All schools | `DASHBOARD_NATIONAL_VIEW` (platform admin only) |

Both endpoints return a `DashboardMetrics` object. No student names, teacher names, or identifiers appear in any response.

---

## Metric Definitions

### `avgMasteryScore`

The arithmetic mean of `StudentMasteryProfile.currentScore` across all students in scope who have at least one assessed strand.

- **Range:** 0.0 – 1.0
- **Denominator:** Students with any mastery profile
- **Returns 0** when no profiles exist

### `avgBaselineGrowth`

The arithmetic mean of `(currentScore − baselineScore)` across all profiled students. Positive values indicate upward growth since baseline was set (Block 7B).

- **Range:** −1.0 – 1.0 (negative means regression)
- **Returns 0** when no profiles exist

### `tierDistribution`

Count of students in each achievement tier, derived from pre-computed `StudentMasteryProfile.masteryState` and `proficiencyState`. These states are computed by the mastery engine (`lib/mastery/masteryService.ts`) and stored on the profile — the dashboard reads them directly without re-applying thresholds.

| Tier | Condition | Description |
|---|---|---|
| `platinum` | `masteryState = MASTERED` | Sustained ≥ 85% accuracy across spaced assessments |
| `gold` | `proficiencyState = PROFICIENT` and `masteryState ≠ MASTERED` | ≥ 75% accuracy without AI assistance |
| `silver` | `proficiencyState = APPROACHING` | ≥ 60% accuracy |
| `bronze` | Any other state (`BELOW_PROFICIENT`, `NOT_ASSESSED`) | Below approaching or unassessed |

The four counts always sum to the total number of mastery profiles in scope.

### `totalStudents`

- **School:** `student.findMany({ where: { user: { schoolId } } }).length`
- **National:** `student.count()`

### `activeStudents`

Count of distinct students with `StudentMasteryProfile.lastAssessedAt >= 30 days ago`. Represents students who have had evidence processed recently, indicating active engagement.

> **Block 9 limitation:** This uses the mastery profile's lastAssessedAt as a proxy for activity. Block 10 will use `AttemptLog.timestamp` directly when that table is fully indexed.

### `evidenceSubmissionRate`

`students with any StudentMasteryProfile / totalStudents`

A student is counted as having submitted evidence if they have at least one mastery profile record (meaning evidence has been processed for them at least once).

> **Block 9 proxy:** Uses mastery profile presence rather than raw attempt count. Block 10 will use `AttemptLog` for a more precise count.

### `trainingAdoptionRate`

`distinct teachers with TrainingProgress (status = in_progress | complete) / total teachers in scope`

- **School:** Teachers with `user.schoolId = schoolId` and role `TEACHER`
- **National:** All users with role `TEACHER`

### `monthlyReportCompletionRate`

`monthlyReport.count({ status: "completed", createdAt >= 3 months ago }) / monthlyReport.count({ createdAt >= 3 months ago })`

Scoped to `scope = "school"` for both the school and national variants (national sums across all school-scoped reports).

---

## PII Guarantees

- No student names, IDs, or identifiers appear in any dashboard response.
- No teacher names or identifiers appear in any dashboard response.
- No school names appear in the national response.
- Audit logs capture the requesting admin's userId and schoolId for traceability.

---

## Feature Flag

The dashboard is gated by `ENABLE_PERFORMANCE_DASHBOARD=true` (server-side, in `.env`).

- **When OFF:** Both endpoints return HTTP 404 with body `{ "error": "performance_dashboard_disabled" }`.
  - 404 (not 403) is intentional — avoids disclosing that the endpoints exist.
- **When ON:** Normal RBAC applies.

Set in production via the ops environment variables, not via Next.js public config.

---

## Access Control

```
ADMIN (isPlatformAdmin = false)
  └─ DASHBOARD_SCHOOL_VIEW → /api/admin/dashboard/school (own school only)

ADMIN (isPlatformAdmin = true)
  └─ DASHBOARD_SCHOOL_VIEW → /api/admin/dashboard/school (any schoolId param)
  └─ DASHBOARD_NATIONAL_VIEW → /api/admin/dashboard/national

TEACHER / STUDENT / GUARDIAN
  └─ All dashboard endpoints → 403 Forbidden
```

### Cross-school isolation

Non-platform admins cannot view another school's dashboard. If `?schoolId=other-school` is passed by a non-platform admin, the route returns `403 Forbidden` before querying the database.

---

## Response Shape

```json
{
  "scope": "school",
  "generatedAt": "2026-02-25T08:31:00.000Z",
  "metrics": {
    "avgMasteryScore": 0.78,
    "avgBaselineGrowth": 0.12,
    "tierDistribution": {
      "bronze": 12,
      "silver": 34,
      "gold": 45,
      "platinum": 9
    },
    "totalStudents": 100,
    "activeStudents": 72,
    "monthlyReportCompletionRate": 0.8,
    "evidenceSubmissionRate": 0.9,
    "trainingAdoptionRate": 0.6
  }
}
```

---

## Audit Logging

Every successful dashboard request is recorded in the `AuditLog` table:

| Field | Value |
|---|---|
| `action` | `dashboard.view.school` or `dashboard.view.national` |
| `resourceType` | `"dashboard"` |
| `schoolId` | School ID (school route) or `null` (national route) |
| `traceId` | Per-request UUID |
| `details` | `{ scope: "school" \| "national" }` |

Failed requests (flag off, auth failure, permission denied) are not logged.

---

## Known Limitations (Block 9)

1. **Evidence submission rate** uses `StudentMasteryProfile` presence as a proxy. Block 10 will use `AttemptLog` for exact attempt counts.
2. **Active students** uses `StudentMasteryProfile.lastAssessedAt`, not a dedicated activity timestamp. Block 10 will use `AttemptLog.timestamp`.
3. **No caching** — each request queries the database live. Block 10 will add a materialized view or cache layer for national aggregation.
4. **National training adoption** counts all `in_progress | complete` training progress across all teachers, not per-school weighted average.

---

## Source of Truth

| Metric | Primary table | Key field |
|---|---|---|
| Tier distribution | `StudentMasteryProfile` | `proficiencyState`, `masteryState` |
| Mastery score | `StudentMasteryProfile` | `currentScore` |
| Baseline growth | `StudentMasteryProfile` | `currentScore − baselineScore` |
| Active students | `StudentMasteryProfile` | `lastAssessedAt` |
| Evidence rate | `StudentMasteryProfile` | presence (any row for student) |
| Training adoption | `TrainingProgress` | `status` |
| Report completion | `MonthlyReport` | `status`, `createdAt` |
