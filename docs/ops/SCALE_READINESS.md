# Scale Readiness

## What Has Been Tested

LiberiaLearn has synthetic national-scale coverage in [`__tests__/load/nationalScaleSmoke.test.ts`](C:\Users\fasir\liberia-learn\__tests__\load\nationalScaleSmoke.test.ts). The harness exercises teacher scheduling, student work, lab completion, and cross-school isolation using the shared load harness in [`__tests__/load/loadHarness.ts`](C:\Users\fasir\liberia-learn\__tests__\load\loadHarness.ts).

Key facts already validated in-repo:
- Tier 1 and Tier 2 enforce hard pass thresholds: teacher p95 `<= 800ms`, student p95 `<= 500ms`, error rate `<= 0.1%`
- Tier 3 through Tier 6 record measured stretch and stress results
- A separate 10-school end-to-end isolation test verifies no school data crosses tenant boundaries under concurrent load

## Current Architecture Limits

- Database: direct Supabase runtime with practical concurrency pressure around `~60` concurrent database connections before pooling becomes mandatory
- Mitigation path: pooled runtime URL via PgBouncer for `500+` concurrent users, direct URL retained for migrations only
- Rate limiting: Upstash Redis is already integrated for production-facing throttles
- AI: all model traffic routes through the centralized router with a `30s` timeout envelope and budget guardrails
- Worker: ECS Fargate worker is sized at `256 CPU / 512 MB` and processes SQS-backed async jobs outside the request path
- Web runtime: Next.js app on Vercel with feature-flagged operational surfaces and documented rollback paths

## Assumptions At 1K / 10K / 100K Users

### 1K users
- Assumes a pilot-style distribution where only a fraction are active concurrently
- Current Supabase + Vercel footprint is acceptable if AI spikes and export bursts are limited
- Existing worker size is sufficient if queue depth is monitored

### 10K users
- Requires PgBouncer-backed runtime pooling, not direct database connections
- Requires stronger queue monitoring and autoscaling criteria for the worker
- Requires operational discipline around heavy MOE exports, AI generation bursts, and school-day sync spikes

### 100K users
- Assumes staged rollout, not a single-step launch
- Requires pooled DB connections, worker horizontal scaling, stronger observability, and formal incident rotation
- Direct single-database operation becomes a material risk without read/write separation or migration to a higher-capacity database tier

## Likely Bottlenecks

1. Database connection saturation on direct Supabase connections
2. Long-running MOE export queries and national report generation
3. AI cost and latency spikes under simultaneous classroom usage
4. Worker backlog growth if SMS, embeddings, and analytics jobs spike together
5. Offline sync replay bursts after network restoration
6. Cross-service operational visibility gaps if queue, DB, and deployment signals are not monitored together

## Next Infrastructure Steps

1. Enable PgBouncer-style pooled runtime connections for all production traffic
2. Define worker autoscaling triggers on queue depth, message age, and failure rate
3. Add queue backlog and DB saturation panels to the ops surface
4. Separate heavy export workloads from interactive admin traffic where practical
5. Define an explicit rollout gate for `100+` active schools before expanding pilot scope
6. Prepare RDS migration planning and dual-write validation before national rollout

## Load Test Results Table

| Tier | Schools | Teacher Sessions | Student Sessions | Teacher p95 | Student p95 | Error Rate | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Tier 1 | 100 | 500 | 1,000 | `<= 800ms` gate | `<= 500ms` gate | `<= 0.100%` gate | PASS |
| Tier 2 | 500 | 2,500 | 5,000 | `<= 800ms` gate | `<= 500ms` gate | `<= 0.100%` gate | PASS |
| Tier 3 | 1,000 | 5,000 | 10,000 | `149ms` | `214ms` | `0.000%` | PASS |
| Tier 4 | 2,500 | 12,500 | 25,000 | `163ms` | `206ms` | `0.000%` | PASS |
| Tier 5 | 5,000 | 25,000 | 50,000 | `123ms` | `164ms` | `0.000%` | PASS |
| Tier 6 | 10,000 | 50,000 | 100,000 | `124ms` p95 / `130ms` p99 | informational | `0.000%` | PASS |

## Readiness Summary

The current codebase is credible for continued pilot expansion, but not for unconstrained national concurrency on direct database connections. The critical dependency for the next scale step is database pooling plus clearer worker and export operational thresholds.
