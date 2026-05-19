# NR-5 — k6 Peak (5K VU) + AI Burst Gate

**Sprint:** NR-5 | **Branch:** `feat/nr-5-k6-peak`  
**Prerequisite:** NR-4 moderate (1K VU) **PASS** on production  
**Window:** Outside Liberian school hours (before 07:30 GMT or after 15:30 GMT) per `docs/DEPLOYMENT_DISCIPLINE.md`

## Targets

| Scenario | Script | VUs | Duration | p95 | Error rate |
|----------|--------|-----|----------|-----|------------|
| Peak | `load-tests/peak.js` | 5000 | 5m ramp + hold | &lt; 5000ms | &lt; 5% |
| AI burst | `load-tests/ai-burst.js` | 200 | 5m ramp + hold | &lt; 5000ms (tutor) | &lt; 5% |

AI burst also tracks `tutor_budget_guard_fallbacks` — budget guard must engage under load (no unbounded provider spend).

## One-time pool setup (production)

```bash
npx dotenv -e .env.production -- npx tsx scripts/seed-load-test-users.ts
npx dotenv -e .env.production -- npx tsx scripts/generate-load-test-tokens.ts
npx dotenv -e .env.production -- npx tsx scripts/export-load-test-credentials.ts
```

- Pool: 1,000 students (`lt-sXX-uYYY@loadtest.liberialearn.internal`), password `LoadTest2026!`
- Each user has a `Student` row (required for tutor + quiz APIs)
- Tokens: `load-tests/fixtures/student-tokens.json` (gitignored)

## Run peak (token pool — recommended)

Avoids login rate-limit storm at 5K VU:

```powershell
$env:BASE_URL = "https://liberia-learn.vercel.app"
$env:LOAD_TEST_LESSON_ID = "math-g10-5-geometry-and-spatial-thinking-independent-practice"
$env:LOAD_TEST_USE_TOKEN_POOL = "true"
$date = Get-Date -Format "yyyyMMdd"
k6 run load-tests/peak.js --out "json=load-tests/results/peak-$date.json"
```

## Run AI burst (200 VU)

```powershell
$env:BASE_URL = "https://liberia-learn.vercel.app"
$date = Get-Date -Format "yyyyMMdd"
k6 run load-tests/ai-burst.js --out "json=load-tests/results/ai-burst-$date.json"
```

## Post-run

1. Record PASS/FAIL in `docs/LOAD_TEST_RESULTS.md` (NR-5 section)
2. Update `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md` sprint table
3. Update `docs/roadmaps/CURRENT_EXECUTION_STATE.md`
4. If both PASS: **freeze** non-essential features until NR-21 (per rollout plan)
5. After NR-21 sign-off: `npx dotenv -e .env.production -- npx tsx scripts/cleanup-load-test-users.ts`

## Gate (before merge)

```bash
npx prisma generate
npx tsc --noEmit
npx vitest run
npm run build
```

Commit message: `feat: NR-5 complete — k6 peak + AI burst gate`
