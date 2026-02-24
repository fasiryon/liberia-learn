# ADR-0009 — Monthly Reporting (Block 8)

| Field   | Value |
|---------|-------|
| Status  | Accepted |
| Date    | 2026-02-24 |
| Authors | Platform Engineering |
| Ticket  | Block 8 — Hybrid Reporting Layer |

---

## Context

LiberiaLearn needs to prove educational outcomes to the Liberian Ministry of Education (MOE)
and to school administrators. As Blocks 7A–7C ship the mastery engine, adaptive baseline,
and evidence pipeline, the system has sufficient data to aggregate meaningful performance
summaries at the school and national level.

The reporting system must:

1. **Aggregate monthly** — schools need a periodic, not real-time, view of outcomes.
2. **Support both school and national scope** — MOE requires cross-school visibility;
   school admins must be confined to their own data.
3. **Never rank students publicly** — Liberian educational law and MOE guidance prohibit
   public comparative ranking of individual students.
4. **Be idempotent** — cron jobs may re-run; manual triggers may overlap.
5. **Be auditable** — every report must store the inputs, methodology, and generation timestamp.
6. **Support PDF export in the future** — MOE requires printable summaries, but no PDF
   library is available at Block 8 ship time.

---

## Decision

### 1. No Public Ranking — System Averages Only

**Chosen:** Tiers A–D classify *strands* (not students) by aggregate performance metrics.
Tier labels are stored only in `tierCountsJson` (an admin-internal JSON column) and in the
full `payloadJson` strand breakdown. They are never exposed through any public or student-facing
endpoint.

**Rationale:**
- MOE guidance explicitly prohibits publishing comparative student rankings in primary and
  secondary schools. Even school-level comparisons must be handled with care.
- The tier system serves a single purpose: helping ADMIN users identify which *content areas*
  (strands) need intervention resources — not which students are performing poorly relative
  to peers.
- Tiers are an operational tool (resource allocation), not a grading mechanism.
- Surfacing tiers publicly would create perverse incentives (teaching to tier boundaries) and
  risk stigmatising students whose strands fall in Tier C.

**Rejected:** Student-level percentile ranks, school-level league tables, public tier badges.

**Enforcement:**
- The `tierCounts` and `payload.strandBreakdown` fields are only returned by
  `GET /api/admin/reports/monthly` and `GET /api/admin/reports/monthly/[id]`, both of
  which require `ADMIN` role.
- The raw `tierCountsJson` and `payloadJson` column names are stripped from all API
  responses; the client-facing names are `tierCounts` and `payload`.
- Any future public reporting endpoint must explicitly exclude tier data.
- This decision is documented in the API JSDoc comments: "INTERNAL ONLY (see ADR-0009)".

---

### 2. Idempotency via Upsert + Composite Unique Constraint

**Chosen:** Each `MonthlyReport` record is keyed by `(scope, scopeId, month, subject)`.
Generation uses `prisma.monthlyReport.upsert` with this composite key. Re-running for
the same period overwrites the pending/failed record with a fresh generation.

**Rationale:**
- Cron jobs run on the 1st of each month. If a job fails partway through (partial school
  list), the operator re-runs the job. Idempotent upsert means only failed/missing
  school reports are regenerated; already-completed reports are overwritten with fresh data
  (acceptable since the source data doesn't change after month-end).
- Insert-then-update semantics would create duplicate records if the job is re-run,
  requiring deduplication logic. Upsert is simpler and deterministic.
- The composite unique constraint is enforced at the DB level (not just application),
  preventing duplicates even under concurrent generation requests.

**The NULL constraint problem:**
PostgreSQL does not treat two `NULL` values as equal in a unique constraint. A national
report has `schoolId = NULL` and a sentinel is needed for the composite key.

**Sentinel values chosen:**
- `scopeId = "__NATIONAL__"` for national scope reports.
- `subject = "__ALL__"` for all-subjects aggregates.

Both sentinels are remapped to `null` (for scopeId) in API responses. The `__ALL__`
subject sentinel is not remapped — it is an opaque identifier that clients should treat
as "all subjects".

**Rejected:** Using a separate `national_reports` table (schema duplication), or a nullable
composite index with application-layer deduplication (race conditions).

---

### 3. Aggregation Scope: School and National Only at Block 8

**Chosen:** The aggregation service supports `"school"` and `"national"` scope. County
and district scope return 400 ("not yet supported").

**Rationale:**
- Block 8 deadline requires shipping a working reporting system. County and district
  aggregation would require either: (a) a `countyId` field on `School`, or (b) a join
  table — neither exists in the current schema.
- National and school scope cover the two primary consumer groups (MOE and school admins)
  and deliver the majority of the feature value.
- County/district support is explicitly planned for a future block and will require a
  schema change.

---

### 4. Phased Report Status: pending → completed / failed

**Chosen:** Generation begins by upserting a `pending` record, runs aggregation, then
updates to `completed`. On error, updates to `failed` with `errorMessage`.

**Rationale:**
- Long-running aggregation for large schools (1000+ students × many strands) may take
  several seconds. The `pending` record marks that generation is in progress, allowing
  the operator to detect stalled jobs in monitoring dashboards.
- `failed` status + `errorMessage` enables targeted re-running: only failed school
  reports need to be regenerated, not the entire school list.
- Re-running generation for a `completed` report is allowed (idempotent upsert) — useful
  when source data is corrected retroactively.

---

### 5. PDF Export Stub

**Chosen:** `GET /api/admin/reports/monthly/[id]?format=pdf` returns 501 ("Not
Implemented") at Block 8 ship time. A second feature flag (`ENABLE_REPORT_PDF_EXPORT`)
gates the stub: when off, the 501 includes a message explaining which env var to set.

**Rationale:**
- MOE requires printable PDF summaries. The API contract and route structure are
  established now so that the PDF implementation can be dropped in without a breaking
  change.
- No PDF library has been evaluated for size, licensing, and offline-rendering
  compatibility with the project's Next.js environment. Block 8 ships the stub; a
  follow-on block evaluates libraries.
- The `ENABLE_REPORT_PDF_EXPORT` flag allows the PDF implementation to be enabled
  in staging before production without a code deployment.

**Candidate libraries for the follow-on block:**
`@react-pdf/renderer` (React-based, no headless browser), `puppeteer` (full fidelity,
larger footprint), `jspdf` (lightweight, limited layout).

---

### 6. Cron Scaffold — Scheduler-Agnostic

**Chosen:** The cron hook is a plain `GET /api/cron/monthly-reports` endpoint protected
by a `CRON_SECRET` bearer token. The scheduler (Vercel Cron, BullMQ, pg-boss, or any
HTTP cron service) calls the endpoint. No scheduler library is bundled.

**Rationale:**
- LiberiaLearn is deployed on Vercel (primary) but may be self-hosted in future
  iterations for MOE's on-premise requirements. Coupling to a specific scheduler
  library would complicate the self-hosted path.
- Vercel Cron is the simplest option for the cloud deployment path and requires only
  a `vercel.json` entry — no additional infrastructure.
- The `dry_run=true` parameter allows testing the job count without writing to the DB.
- Fail-secure: if `CRON_SECRET` is not set, all cron requests are rejected with 401.

---

### 7. Report Payload Schema

**Chosen:** `payloadJson` stores a `MonthlyReportPayload` object with four sections:
`meta`, `headline`, `strandBreakdown`, and `tierSummary`.

```typescript
type MonthlyReportPayload = {
  meta: { month: string; scope: string; scopeId: string | null; generatedAt: string; };
  headline: ReportHeadlineMetrics;
  strandBreakdown: StrandAggregate[];   // includes tier label — INTERNAL ONLY
  tierSummary: { counts: TierCounts; thresholds: Record<string, number>; };
};
```

**Rationale:**
- Storing the full payload as JSON allows the report to be self-contained: it can be
  exported, archived, or compared without re-running the aggregation.
- Headline metrics are also stored as first-class columns (`proficiencyRate`,
  `masteryRate`, etc.) for fast filtering/sorting in list queries without parsing JSON.
- `strandBreakdown` in the payload includes tier labels; the `tierSummary` counts tiers.
  Both are INTERNAL ONLY and excluded from public/student endpoints.

---

### 8. Telemetry: No PII

**Chosen:** Same pattern as Blocks 7A–7C. `report.generated` and `report.failed`
events carry operational metrics only (month, scope, counts, duration).

**Rationale:**
- Complies with ADR-0002 data minimisation.
- `schoolId` is included in the telemetry scope (third argument to `recordMetricEvent`)
  for aggregation, but is not embedded in the event payload.
- No `studentId`, `email`, or student name fields are included in any telemetry event
  emitted by the reporting system.

---

## Consequences

**Positive:**
- 118 tests across 3 test files (compute: ~50, generator: ~30, access: 38). 118/118 passing.
- Idempotent: safe to re-run the cron job or manual trigger for any month.
- Additive schema: `MonthlyReport` is a new table; no existing tables modified.
- Tenant-safe: school admins are confined to their own school's reports at the route level.
- Future-proof: PDF stub and county/district scope gaps are explicitly documented.

**Negative / Trade-offs:**
- County and district scope not yet supported — MOE county-level reports require a
  follow-on schema change.
- No real-time aggregation — reports are point-in-time snapshots. Updates to source data
  after generation require re-running the report.
- Sentinel values (`__NATIONAL__`, `__ALL__`) add a small mapping step in all API
  responses. This is a minor complexity trade-off for a reliable unique constraint.

---

## Alternatives Considered and Rejected

| Alternative | Reason Rejected |
|-------------|----------------|
| Real-time aggregation (no snapshot) | Too slow for large schools; no audit trail of past values |
| Student percentile rankings | Prohibited by MOE guidance; ADR supersedes any future request |
| School league tables | Same prohibition; creates perverse incentives |
| Nullable composite unique (PostgreSQL) | NULL ≠ NULL in PG unique indexes; would allow duplicate national reports |
| Separate `national_reports` table | Schema duplication; identical query patterns; harder to extend |
| Bundling a PDF library at Block 8 | No evaluated option; library evaluation is a separate workstream |
| County/district scope at Block 8 | Requires `countyId` FK on `School` model — out of scope for this block |

---

## Related

- [ADR-0007 — Mastery Engine Foundation](0007-mastery-engine-foundation.md)
- [ADR-0008 — Adaptive Baseline](0008-adaptive-baseline.md)
- [ADR-0002 — Tenant Isolation](0002-tenant-isolation.md)
- [docs/product/MONTHLY_REPORTS.md](../product/MONTHLY_REPORTS.md)
- `lib/reporting/monthly/compute.ts`
- `lib/reporting/monthly/aggregationService.ts`
- `lib/reporting/monthly/reportGenerator.ts`
- `lib/reporting/monthly/scheduler.ts`
- `app/api/admin/reports/monthly/generate/route.ts`
- `app/api/admin/reports/monthly/route.ts`
- `app/api/admin/reports/monthly/[id]/route.ts`
- `app/api/cron/monthly-reports/route.ts`
- `prisma/migrations/20260224_130000_monthly_reports/migration.sql`
- Block 9 (pending) — County/district scope + PDF implementation
