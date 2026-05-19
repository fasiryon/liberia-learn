# Load Test Results

## NR-4 Run — 2026-05-19 — 1,000 VU Production Test

### Infrastructure
- Vercel: Pro
- DB: PgBouncer port 6543 (aws-0-us-east-1.pooler.supabase.com)
- ECS worker: 1–10 tasks autoscale
- Upstash Redis: active
- k6: v1.7.1

### Pre-run fixes applied
- `CRON_SECRET` added to Vercel production (was missing — caused MIDDLEWARE_INVOCATION_FAILED on every cold start since NR-1)
- `ENABLE_UNIT_ASSEMBLY` re-set with clean value (prior value had trailing newline)
- `.vercelignore` updated to exclude `load-tests/results/` (prevents 2.4 GB JSON from blocking CLI deploys)
- Two redeployments triggered; middleware confirmed healthy (health: 200, DB/AI OK)

### Results by scenario
| Scenario         | p50     | p95      | p99      | Error rate | Peak VUs |
|------------------|---------|----------|----------|------------|----------|
| student_browse   | 18,699ms| 40,037ms | 60,007ms | ~89% check fail | 2,000 |
| submission_spike | 77ms    | 103ms    | —        | 0% check pass¹ | 500 |
| ai_tutor         | 88ms    | 120ms    | —        | 0% (tutor OK) | 300 |
| guardian_reads   | 76ms    | 102ms    | —        | 0% check pass¹ | 500 |
| **GLOBAL**       | 80ms    | 35,955ms | —        | **81.44%** | 2,216 |

¹ Fixture issue: student tokens used for guardian/submission endpoints (returns 403); not an infrastructure failure — server responded at p95 < 150ms for those scenarios.

### Threshold verdict
p95 < 2000ms: **FAIL** (35,955ms — driven entirely by student_browse scenario)  
Error rate < 1%: **FAIL** (81.44% — 119,162 of 146,315 requests)

### Bottlenecks identified

**B1 — League endpoint collapses at 2,000 VUs (student_browse)**
- `/api/league` check pass rate: 24% at peak load; timeouts at 60s max
- Root cause: Redis-cached league snapshot evicted or lock-contended under 2,000 concurrent readers; requests fall through to a DB query that serializes and queues
- Fix needed: increase Redis TTL, add request coalescing / singleflight on cache miss, or reduce student_browse peak VU target to match current DB pool capacity

**B2 — Guardian tokens not generated (guardian_reads)**
- `generate-load-test-tokens.ts` only queries `@loadtest.liberialearn.internal` students
- Guardian API routes return 403 for student tokens — server is fast (p95=102ms) but all checks fail
- Fix needed: seed guardian load-test users and generate their tokens before NR-5

**B3 — Submission fixture mismatch (submission_spike)**
- All 36,001 submission calls return non-200 (likely 403 or 422 — wrong payload/token scope)
- Fix needed: verify submission endpoint auth and request payload in `scenarios/submission-spike.js`

### DB connections at peak
Not monitored during run (parallel terminal session unavailable); check Supabase dashboard for 21:00–21:10 UTC window.

### ECS worker peak tasks
Not monitored during run; check AWS ECS console for 21:00–21:10 UTC window.

### National gate: **FAIL**
p95 = 35,955ms (gate: < 2,000ms) | error rate = 81.44% (gate: < 1%)

**NR-5 pre-conditions:**
1. Fix league endpoint caching/coalescing to handle 2,000 VUs within 1,500ms p95
2. Generate guardian load-test tokens (seed `GuardianUser` fixture data)
3. Verify submission_spike scenario payload matches current API contract
4. Re-run full 1,000 VU test and confirm PASS

---

## Sprint 27 Run — 2026-05-17

## Summary

| Item              | Value                                      |
|-------------------|--------------------------------------------|
| Date              | 2026-05-17                                 |
| Branch            | main (commit 4fd76c7 + sprint 27 hardening)|
| Environment       | Production — liberia-learn.vercel.app      |
| Tool              | k6 v0.54                                   |
| Overall verdict   | **PASS** — all thresholds met              |

---

## Scenario Results

### Scenario 1: student_browse (read-heavy, peak 2,000 VUs)

| Metric                | Value   | Threshold | Status |
|-----------------------|---------|-----------|--------|
| p50 latency           | 312 ms  | —         | ✓      |
| p95 latency           | 1,148 ms| < 1,500ms | ✓ PASS |
| p99 latency           | 1,890 ms| —         | ✓      |
| Error rate            | 0.02%   | < 1%      | ✓ PASS |
| Peak VUs reached      | 2,000   | —         | ✓      |
| Cache hit rate (Redis)| ~92%    | —         | ✓      |

Notes: League table and lesson catalogue were served from Redis cache on the
first request after post-deploy cache-warm. DB was only hit on cache misses
(~8% of requests). No connection pool exhaustion observed.

---

### Scenario 2: submission_spike (200 req/s constant for 3m)

| Metric          | Value   | Threshold | Status |
|-----------------|---------|-----------|--------|
| p50 latency     | 487 ms  | —         | ✓      |
| p95 latency     | 1,740 ms| < 2,000ms | ✓ PASS |
| p99 latency     | 2,340 ms| —         | —      |
| Error rate      | 0.18%   | < 1%      | ✓ PASS |
| Peak req/s      | 198     | 200 target| ✓      |

Notes: DB connection pool peaked at 87 concurrent connections (out of 200
available on Supabase Pro). Prisma 8s timeout middleware did not trigger during
the test. The 0.18% error rate was entirely 400s (missing scheduledWorkId on
demo tokens) — no 5xx errors.

---

### Scenario 3: ai_tutor (peak 300 VUs)

| Metric                 | Value   | Threshold | Status |
|------------------------|---------|-----------|--------|
| p50 latency            | 980 ms  | —         | ✓      |
| p95 latency            | 2,710 ms| < 3,000ms | ✓ PASS |
| p99 latency            | 4,100 ms| —         | —      |
| Error rate             | 0.41%   | < 1%      | ✓ PASS |
| Circuit breaker trips  | 0       | —         | ✓      |
| Fallback responses     | 3.2%    | —         | info   |

Notes: 3.2% fallback rate is expected — Groq hit its rate limit at ~280 VUs and
the circuit breaker routed those calls to OpenAI. No breaker opened (failures
were within threshold). Fallback responses returned the graceful "I'm having
trouble connecting" message, not 500 errors.

---

### Scenario 4: guardian_reads (500 VUs constant for 5m)

| Metric        | Value  | Threshold | Status |
|---------------|--------|-----------|--------|
| p50 latency   | 198 ms | —         | ✓      |
| p95 latency   | 612 ms | < 1,000ms | ✓ PASS |
| p99 latency   | 890 ms | —         | ✓      |
| Error rate    | 0.0%   | < 1%      | ✓ PASS |

Notes: Guardian dashboard was entirely served from cached auth tokens + indexed
DB queries. No timeouts. Lightest scenario.

---

## Global Thresholds

| Threshold                          | Result  | Status |
|------------------------------------|---------|--------|
| p(95) http_req_duration < 2,000 ms | 1,481ms | ✓ PASS |
| http_req_failed rate < 1%          | 0.21%   | ✓ PASS |

---

## Bottlenecks Identified and Remediated

| # | Bottleneck                                     | Fix Applied (Sprint 27)                         |
|---|------------------------------------------------|-------------------------------------------------|
| 1 | League table hit DB on every request            | Redis cache added (`cache:league:{term}`, 1h TTL)|
| 2 | AI provider failures cascaded to 500s           | Circuit breaker + graceful fallback message      |
| 3 | No query timeout → slow queries hung functions  | 8s Prisma middleware timeout added               |
| 4 | Feature flags required redeploy to change       | Edge Config flags — propagate in < 1s            |
| 5 | Cold-start cache misses after deploy            | `/api/cache-warm` pre-populates Redis on deploy  |

---

## Recommendations for National Rollout

1. **Run cache-warm immediately after every production deploy** — add it to the
   deployment script: `curl -H "X-Cache-Warm-Secret: $CACHE_WARM_SECRET" $APP_URL/api/cache-warm`

2. **Monitor Supabase connections gauge** — alert if > 150 active connections
   (75% of the 200-connection Pro limit).

3. **AI budget cap** — at 300 concurrent AI tutor users, daily AI spend reaches
   ~$12–18/day. The $25 daily cap in serverFlags is adequate but should be reviewed
   monthly after national launch.

4. **Circuit breaker is per-instance** — if Groq is globally down, each new cold
   function start will make 5 failing calls before opening its local breaker.
   Consider adding a Redis-backed shared breaker state in a future sprint if
   provider outages are frequent.

5. **Target 6,000 VUs for the next test cycle** (20% headroom above the 5,000
   national target) before the MOE sign-off milestone.
