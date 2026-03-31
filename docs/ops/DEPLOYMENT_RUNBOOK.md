# Deployment Runbook

## Purpose

This runbook is the operator-facing checklist for deploying the current LiberiaLearn application safely. It supplements the broader rollout guides already in:
- [docs/rollout/PRODUCTION_DEPLOY_GUIDE.md](C:\Users\fasir\liberia-learn\docs\rollout\PRODUCTION_DEPLOY_GUIDE.md)
- [docs/rollout/ENV_VARS.md](C:\Users\fasir\liberia-learn\docs\rollout\ENV_VARS.md)
- [docs/rollout/ROLLBACK_RUNBOOK.md](C:\Users\fasir\liberia-learn\docs\rollout\ROLLBACK_RUNBOOK.md)

## 1. Required Environment Variables Checklist

Minimum application/runtime variables evidenced in repo:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `OPENAI_API_KEY` for OpenAI-backed AI paths
- `GROQ_API_KEY` if Groq fast-tier routing is desired
- `AI_BUDGET_MONTHLY_CAP_USD`
- `SQS_QUEUE_URL` if queue-backed background processing is enabled
- `RDS_DATABASE_URL` only if dual-write is intentionally enabled
- mail and SMS provider variables referenced by the relevant routes and helpers

Feature flags required for pilot surfaces requested in the repo:
- `ENABLE_TEACHER_INTELLIGENCE_DASHBOARD=true`
- `ENABLE_GUARDIAN_PROGRESS_VIEW=true`
- `ENABLE_PILOT_READINESS_DASHBOARD=true`
- `ENABLE_INTERVENTION_WORKFLOW=true`

Related source files:
- [lib/serverFlags.ts](C:\Users\fasir\liberia-learn\lib\serverFlags.ts)
- [docs/ops/FEATURE_FLAGS.md](C:\Users\fasir\liberia-learn\docs\ops\FEATURE_FLAGS.md)

## 2. Pre-Deploy Verification

Run before every deploy:

```bash
npx vitest run --reporter=dot
npx tsc --noEmit
npm run build
```

Curriculum quality gate:

```bash
npm run audit:lessons
```

If the lesson audit is below threshold for readiness operations, follow the regen workflow documented later in this runbook.

## 3. Vercel Deployment Steps

1. Ensure the correct branch or commit is selected for deployment.
2. Confirm required env vars and pilot flags in the Vercel project settings.
3. Trigger deployment through the Vercel dashboard or your normal Git-based deployment path.
4. Watch the build log for:
   - `prisma generate`
   - `next build`
   - successful static/page generation
5. Do not promote traffic until health checks pass.

Reference:
- [docs/rollout/PRODUCTION_DEPLOY_GUIDE.md](C:\Users\fasir\liberia-learn\docs\rollout\PRODUCTION_DEPLOY_GUIDE.md)

## 4. Database Migration Steps

Apply migrations before or during release according to your deployment process:

```bash
npx prisma migrate deploy
```

Schema source:
- [prisma/schema.prisma](C:\Users\fasir\liberia-learn\prisma\schema.prisma)

Migration directory:
- [prisma/migrations](C:\Users\fasir\liberia-learn\prisma\migrations)

## 5. Demo Seed Steps

For non-production or demo-safe environments only:

```bash
npm run seed:demo
```

Do not run demo seeding against a live production tenant unless that environment is explicitly meant to host demo data.

## 6. Health Check Verification

Primary health endpoint:
- `/api/healthz`

Verification steps:
1. request `/api/healthz`
2. request `/api/health`
3. verify key authenticated surfaces respond after login
4. verify a teacher intelligence route and a guardian progress route if those flags are enabled

Relevant files:
- [app/api/healthz/route.ts](C:\Users\fasir\liberia-learn\app\api\healthz\route.ts)
- [app/api/health/route.ts](C:\Users\fasir\liberia-learn\app\api\health\route.ts)

## 7. AI / Pilot-Surface Smoke Checks

Recommended post-deploy checks:
- `POST /api/rag/query` for a grounded teacher/admin request
- `GET /api/teacher/performance`
- `GET /api/teacher/confusions`
- `GET /api/teacher/interventions`
- `GET /api/guardian/performance`
- `GET /api/admin/pilot-readiness`
- `GET /api/admin/ai-costs`

These routes map to the new hardening surfaces and should be verified under tenant-scoped accounts only.

## 8. Curriculum Audit And Regeneration

Run:

```bash
npm run audit:lessons
```

If either condition is true:
- ready lessons below target
- average word count below target

Then run:

```bash
npm run regen:lessons
```

Re-run the audit immediately after regeneration and record the final result before declaring curriculum readiness.

## 9. Rollback Procedure

If the release causes failures:
1. disable newly exposed flags first if the issue is isolated to a gated feature
2. promote the previous stable deployment in Vercel
3. if the issue is schema-sensitive, stop further traffic changes until `npx prisma migrate deploy` state is verified
4. re-run health checks after rollback

Supporting docs:
- [docs/rollout/ROLLBACK_RUNBOOK.md](C:\Users\fasir\liberia-learn\docs\rollout\ROLLBACK_RUNBOOK.md)
- [docs/ops/INCIDENT_RESPONSE.md](C:\Users\fasir\liberia-learn\docs\ops\INCIDENT_RESPONSE.md)

## 10. Escalation Procedure

The repo does not store named production contacts, so define the active operator roster before go-live.

Minimum escalation path:
1. on-duty deploy operator
2. application owner / repository maintainer
3. database / infrastructure operator
4. ministry-side operational contact for pilot coordination

If production is down:
- open the incident using the process in [docs/ops/INCIDENT_RESPONSE.md](C:\Users\fasir\liberia-learn\docs\ops\INCIDENT_RESPONSE.md)
- capture failing endpoint, timestamp, recent deployment, and affected tenant scope
- decide whether flag rollback or deployment rollback is faster

## 11. Post-Deploy Record

Record after each production or pilot deployment:
- deployed commit SHA
- migration status
- build status
- health-check status
- pilot flag state
- lesson audit result if curriculum changed
- rollback required: yes/no
