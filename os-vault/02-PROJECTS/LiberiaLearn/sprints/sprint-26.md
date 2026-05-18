# Sprint 26 — Load Testing + Infrastructure Hardening

**Status:** Planned
**Priority:** Critical — must pass before national rollout

---

## Goals

1. Validate system handles 5,000 concurrent users without degradation
2. DB connection pool sized correctly for national traffic
3. AI circuit breaker with exponential backoff (no runaway AI spend under load)
4. Redis cache warming strategy to prevent cold-start stampedes
5. Vercel function timeout optimization for all critical paths

---

## Scope

### 1. Load Testing Scripts (`scripts/load-test/`)

**Tool:** `k6` (open source, runs locally, generates HTML reports)

**Test scenarios:**

**Scenario A — Student lesson delivery (primary path):**
```javascript
// 1000 virtual users, ramp over 5 min, hold 10 min
// Each VU: login → GET /api/student/today → load lesson → submit progress
```

**Scenario B — Teacher dashboard under class load:**
```javascript
// 500 teachers each with 40 students
// Each VU: login → GET /api/teacher/dashboard → GET /api/teacher/gradebook
```

**Scenario C — Simultaneous assessment submission:**
```javascript
// 2000 VUs submit quiz answers within 30s (exam scenario)
// Validates no duplicate scoring, no DB write conflicts
```

**Scenario D — MOE aggregate queries under load:**
```javascript
// 50 MOE officials requesting /api/moe/dashboard concurrently
// Validates Redis cache serves under load, no DB hammering
```

**Pass criteria:**
- P95 response time < 2000ms for lesson delivery
- P95 response time < 5000ms for dashboard aggregates
- Error rate < 0.5% for all scenarios
- Zero data integrity failures in scenario C

**Reports saved to:** `scripts/load-test/reports/` (gitignored — large files)

---

### 2. DB Connection Pool Sizing

**Current state:** Supabase Pooler (PgBouncer) in Transaction mode, default 20 connections

**Problem:** 5K concurrent users → potentially hundreds of Prisma connections → pool exhaustion → P2024 errors

**Fix — Prisma connection pool tuning:**
```
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=20"
```

**Vercel-specific:**
- Each serverless function instance gets its own Prisma Client
- With 50 concurrent function instances × 10 connections = 500 total → within Supabase limits

**Supabase configuration:**
- Upgrade to Supabase Pro pooler (100 connection limit)
- Enable prepared statement cache (`pgbouncer_mode=transaction`)

**Monitoring:**
- Add DB connection count to `/api/health` response
- Alert if `connectionCount > 80` via `TeacherAlert` (type: "DB_POOL_HIGH_UTILIZATION")

---

### 3. AI Circuit Breaker (`lib/ai/circuitBreaker.ts`)

**Pattern:** Half-open circuit breaker with exponential backoff

```typescript
class AiCircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount = 0;
  private lastFailureAt: number = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT_MS = 60_000; // 1 min before half-open

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureAt > this.RECOVERY_TIMEOUT_MS) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("AI_CIRCUIT_OPEN"); // caller falls back to cached content
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }
}
```

**Integration points:**
- Wrap `routedCompletion()` calls in all batch scripts
- Wrap AI tutor calls (sprint 19)
- Wrap auto-grader calls (sprint 20)
- On `AI_CIRCUIT_OPEN`: return cached lesson content if available, or queue for retry

**Circuit breaker state stored in Redis** (so all function instances share state):
- Key: `circuit:ai:{provider}` → `{ state, failureCount, lastFailureAt }`
- TTL: 5 minutes (auto-resets if Redis loses state)

---

### 4. Redis Cache Warming Strategy

**Problem:** After deployment or Redis flush, first N requests hit DB directly — "thundering herd"

**Cache warming script (`scripts/warm-cache.ts`):**
- Runs as post-deploy hook (add to Vercel build command or cron on deploy)
- Pre-warms: MOE dashboard aggregate, top 20 most-accessed lessons per school, curriculum coverage stats
- Uses `setex` with TTL matching production cache TTLs
- Logs: keys warmed, time taken, estimated request savings

**Stale-while-revalidate pattern for MOE dashboard:**
- Current: Redis TTL expires → DB query → wait
- New: Background revalidation — serve stale cache, trigger async refresh in background
- Implementation: store `{data, expiresAt}` in Redis; if `expiresAt < now + 30s`, trigger background fetch while returning stale data

---

### 5. Vercel Function Timeout Optimization

**Critical paths and their timeout budgets:**

| Route | Current timeout | Target | Strategy |
|-------|----------------|--------|----------|
| `/api/student/today` | 30s | < 2s | Pre-compute + cache (already in Redis) |
| `/api/teacher/dashboard` | 30s | < 3s | Parallel queries (already done) |
| `/api/moe/dashboard` | 30s | < 5s | Redis cache (already done) |
| `/api/curriculum/regenerate` | 30s | 240s | vercel.json maxDuration |
| `/api/student/tutor/message` | 30s | < 10s | Claude Haiku — fast |
| Batch scripts | N/A | N/A | Run as CLI, not Vercel functions |

**`vercel.json` additions:**
```json
{
  "functions": {
    "app/api/curriculum/**": { "maxDuration": 240 },
    "app/api/student/tutor/**": { "maxDuration": 30 },
    "app/api/cron/**": { "maxDuration": 60 }
  }
}
```

**Slow query audit:**
- Run `EXPLAIN ANALYZE` on top 10 most-called queries (identified from Supabase dashboard)
- Add missing indexes found during load test
- Target: no query > 200ms at P95 under 5K load

---

### 6. Load Test Execution Plan

**Pre-test checklist:**
- [ ] Staging environment provisioned (Supabase branch or separate project)
- [ ] Seed 10,000 test students, 500 teachers, 50 schools
- [ ] GROQ_API_KEY and OPENAI_API_KEY stubbed (no real AI spend during load test)
- [ ] AI circuit breaker configured to OPEN after 1 failure (so AI calls short-circuit instantly)
- [ ] Redis provisioned at load-test capacity

**Execution sequence:**
1. Warm cache (run `warm-cache.ts`)
2. Run scenario A (student delivery) — 20 min
3. Analyze results → fix bottlenecks
4. Run scenario B+C simultaneously — 15 min
5. Run scenario D — 10 min
6. Run all 4 scenarios together — 10 min (peak load simulation)

**Post-test:**
- Archive HTML reports to `scripts/load-test/reports/YYYY-MM-DD/`
- Update `docs/rollout/LOAD_TEST_REPORT.md` with pass/fail results
- If any scenario fails: fix + re-run that scenario before national rollout sign-off

---

## Files Touched

- `scripts/load-test/scenario-a-student-delivery.js` — NEW (k6)
- `scripts/load-test/scenario-b-teacher-dashboard.js` — NEW (k6)
- `scripts/load-test/scenario-c-exam-submit.js` — NEW (k6)
- `scripts/load-test/scenario-d-moe-aggregate.js` — NEW (k6)
- `scripts/warm-cache.ts` — NEW
- `lib/ai/circuitBreaker.ts` — NEW
- `lib/ai/routedCompletion.ts` — wrap in circuit breaker
- `app/api/health/route.ts` — add DB connection count
- `vercel.json` — add function maxDuration config
- `docs/rollout/LOAD_TEST_REPORT.md` — NEW (filled after test runs)
- `.env.example` — add `DATABASE_URL` pool params, VAPID keys from sprint 23

## Tests Required

- `__tests__/sprint26.circuitBreaker.test.ts` — state transitions, Redis sync, half-open recovery
- `__tests__/sprint26.cacheWarming.test.ts` — keys warmed, TTL correctness, stale-while-revalidate
- Load test scripts are not unit tests — they run against a staging environment

## Success Criteria for National Rollout Sign-Off

- [ ] All 4 load test scenarios PASS
- [ ] P95 lesson delivery < 2s at 5K concurrent
- [ ] Error rate < 0.5% under peak load
- [ ] AI circuit breaker verified functional
- [ ] Cache warming confirmed working after simulated Redis flush
- [ ] `docs/rollout/LOAD_TEST_REPORT.md` signed off
