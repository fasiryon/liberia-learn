# Load Test Results — Sprint 27

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
