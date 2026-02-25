# ADR-0011 — National + School Performance Dashboard

**Status:** Accepted
**Date:** 2026-02-25
**Block:** 9
**Authors:** Engineering (LiberiaLearn)
**Supersedes:** —
**Related:** ADR-0002 (Tenant Isolation), ADR-0008 (MOE Governance Controls), ADR-0009 (Monthly Report)

---

## Context

Leadership at the school and national level needs an aggregated view of student performance, teacher training progress, and reporting compliance. This data exists in the system — in `StudentMasteryProfile`, `TrainingProgress`, and `MonthlyReport` — but was previously available only via raw database queries or one-off exports.

Block 9 introduces two new API endpoints and a shared aggregation layer (`dashboardAggregator.ts`) to expose this data in a structured, access-controlled, PII-safe format.

---

## Decisions

### 1. Tier labels derived from pre-computed profile states, not independent thresholds

**Decision:** `classifyProfileTier()` maps `masteryState` and `proficiencyState` from `StudentMasteryProfile` to bronze/silver/gold/platinum. It does not apply raw numeric thresholds (e.g., score ≥ 0.75).

**Rationale:** The thresholds are already encoded in `lib/mastery/compute.ts` and enforced by the mastery engine. Re-applying them in the dashboard would create a second source of truth that could drift. The pre-computed states are the canonical output of the engine.

**Consequence:** Tier distribution is consistent with what individual student reports show, because both read from the same stored state.

---

### 2. National dashboard is a separate endpoint from school dashboard

**Decision:** `GET /api/admin/dashboard/national` is a distinct route from `GET /api/admin/dashboard/school`, not a parameterised variant.

**Rationale:**
- National access requires a different permission (`DASHBOARD_NATIONAL_VIEW` vs `DASHBOARD_SCHOOL_VIEW`).
- National queries omit school filters and use `student.count()` instead of `student.findMany(where: schoolId)`.
- Separating the routes makes the auth checks and query paths explicit and independently testable.

**Consequence:** Slight code duplication in the routes, but each is short (~50 lines) and fully legible in isolation.

---

### 3. Feature flag returns 404, not 403

**Decision:** When `ENABLE_PERFORMANCE_DASHBOARD=false`, both routes return HTTP 404 with `{ error: "performance_dashboard_disabled" }`, not 403.

**Rationale:** A 403 would disclose that the endpoint exists and that the caller lacks access. A 404 avoids revealing anything about the endpoint's existence to unauthorised callers. This pattern matches the governance export circuit breaker (ADR-0008).

**Consequence:** Operators must check env config rather than HTTP errors when debugging why the dashboard is unavailable.

---

### 4. Non-platform ADMIN cannot access national dashboard

**Decision:** `DASHBOARD_NATIONAL_VIEW` is not included in the ADMIN role's permission set. Only users with `isPlatformAdmin = true` can call the national endpoint.

**Rationale:** National aggregation crosses school boundaries. Even if a school admin is legitimately interested in national averages, cross-school data access requires platform-level authorisation under Liberia's education governance model. The permission set deliberately follows least-privilege — the ADMIN role is scoped to a single school.

**Consequence:** School admins who need national comparisons must request a report from a platform admin, or a future read-only national summary report can be introduced separately.

---

### 5. Non-platform ADMIN is tenant-isolated to their own school

**Decision:** If a non-platform ADMIN passes `?schoolId=other-school`, the school route returns 403 before any database query.

**Rationale:** Tenant isolation is a hard invariant (ADR-0002). All school-scoped data must be filtered by the requesting admin's `schoolId`. Allowing a query parameter to override this would be a tenant-isolation breach.

**Consequence:** The schoolId parameter is only honoured for platform admins. For regular admins it is ignored if absent (defaults to their own school) or rejected if it differs from their school.

---

### 6. Empty dataset returns zero-filled metrics, not errors

**Decision:** When `totalStudents = 0` (or no profiles exist), all metrics return `0` with a valid `tierDistribution = { bronze: 0, silver: 0, gold: 0, platinum: 0 }`.

**Rationale:** A new school with no students yet should render a valid (if empty) dashboard, not an error page. Division by zero is guarded by `safeRate()` and `safeAvg()` helpers. This prevents the dashboard from failing during onboarding.

**Consequence:** Consumers must interpret `0` as "no data" rather than "the school has zero mastery". The `totalStudents` field disambiguates this.

---

### 7. Live queries, no caching in Block 9

**Decision:** Both endpoints query the database on every request. No caching layer, materialized view, or summary table is used.

**Rationale:**
- For Block 9, query volume is low (school-level requests from a handful of admins).
- Adding caching prematurely would require a cache invalidation strategy before the query patterns are understood.
- National aggregation may be slow at scale — this is an accepted known limitation documented for Block 10.

**Consequence:** National dashboard may have elevated query latency at 10k+ students. Block 10 will introduce a counter column or materialized view if p99 latency exceeds acceptable thresholds.

---

### 8. No PII in any dashboard response

**Decision:** No student names, teacher names, student IDs, or school names appear in dashboard API responses.

**Rationale:** The dashboard is a leadership tool, not a surveillance tool. The governance model (ADR-0008) explicitly prohibits student-level PII in aggregate exports. The same principle applies here.

**Consequence:** If leadership needs to investigate a specific student's performance, they use the individual student report routes (which have their own PII controls), not the dashboard.

---

### 9. Audit log written on every successful request

**Decision:** Every successful dashboard view is recorded in `AuditLog` with `action = "dashboard.view.school"` or `"dashboard.view.national"`.

**Rationale:** Audit trails are a hard requirement for the governance model. Even read-only operations on aggregate data must be traceable so that data access can be reviewed in compliance audits.

**Consequence:** The audit log will grow proportionally with dashboard usage. The existing log rotation and compliance export mechanisms (Block 6) apply.

---

## Rejected Alternatives

| Alternative | Reason rejected |
|---|---|
| Single `/api/admin/dashboard` endpoint with `scope` param | Auth checks differ by scope; a single endpoint conflates two different permission boundaries |
| Re-apply score thresholds in dashboard | Creates second source of truth; tier definitions must remain in mastery engine only |
| Cache national metrics in a summary table | Premature optimisation; adds invalidation complexity before query patterns are established |
| Return 403 when flag is off | Discloses endpoint existence to unauthorised callers |
| Suppress audit log for read-only operations | Contradicts governance audit requirements |

---

## Consequences

- Leadership dashboards are now a first-class product surface with stable API contracts.
- Tier labels from the dashboard match individual student reports exactly (shared state source).
- Future Block 10 work should profile national aggregation query latency and introduce a caching strategy if needed.
- Adding new metrics to the dashboard requires updating `DashboardMetrics` (type), `dashboardAggregator.ts` (computation), and `dashboard.aggregation.test.ts` (tests) in lockstep.
