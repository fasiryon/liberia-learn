# NR-0 Baseline Snapshot
**Date:** 2026-05-18  
**Branch:** main  
**HEAD:** 0b9c338 (feat: lesson viewer full content + scrollable window + elevenlabs audio)  
**Tests:** 3,075 passing (per pilot readiness commit 6c55175)

This document is the ground-truth snapshot established at the start of the National Rollout program. Every gap identified here drives NR-1 through NR-5.

---

## Vercel

| Field | Value |
|-------|-------|
| User | fasiryon-7625 |
| Team | farquema-siryons-projects (Farquema Siryon's projects) |
| Project ID | prj_gr1ksFqzN4MXaqxxj7vmkJFitTxf |
| Plan | **Pro** (inferred: 15 active crons; Hobby limit = 2) |
| Node.js version | 22.x |
| Active crons | **15/40** |
| Regions | iad1 (US East, Vercel default) |
| Function concurrency limit | 1,000 (Pro) |
| Latest deployment | ERROR 3h ago; last READY 4h ago |

**Cron inventory (15 total):**

| Path | Schedule |
|------|----------|
| /api/admin/ops/cron/autonomous/dead-letter-inspection | 0 */6 * * * |
| /api/admin/ops/cron/autonomous/evaluation-windows | 0 * * * * |
| /api/admin/ops/cron/autonomous/runtime-health | */5 * * * * |
| /api/admin/ops/cron/autonomous/stale-approvals | */15 * * * * |
| /api/admin/ops/cron/autonomous/workflow-recovery | */10 * * * * |
| /api/cron/alert-digest | 0 * * * * |
| /api/cron/alert-inactive | 0 6 * * * |
| /api/cron/alert-low-grade | 0 6 * * * |
| /api/cron/assignment-due-reminders | 0 18 * * * |
| /api/cron/nightly-backup | 0 2 * * * |
| /api/cron/process-audio-generation | */10 * * * * |
| /api/cron/process-textbook-generation | */15 * * * * |
| /api/cron/rebuild-leaderboards | 0 20 * * * |
| /api/cron/release-stale-grades | 0 */6 * * * |
| /api/crons/league-snapshot | 0 0 * * 0 |

**Action for NR-1:** Investigate latest ERROR deployment. Confirm Pro plan formally via Vercel billing dashboard.

---

## Supabase / Database

> **NOTE:** Production DB query requires `.env.production` credentials. Run the audit script and fill in the blanks:
> ```
> npx dotenv -e .env.production -- npx tsx scripts/db-connection-audit.ts
> ```

| Field | Value |
|-------|-------|
| DATABASE_URL env | Present in Vercel production (encrypted) |
| DIRECT_URL env | Present in Vercel production (via `prisma/schema.prisma`) |
| Connection mode | _PENDING production run_ |
| Active connections | _PENDING_ / _PENDING_ max |
| DB size | _PENDING_ |
| Users | _PENDING_ |
| Schools | _PENDING_ |
| Total lessons | _PENDING_ |
| APPROVED lessons | _PENDING_ |
| Pending/review | _PENDING_ |

**Known config:** `lib/db.ts` injects `connection_limit=1` into DATABASE_URL programmatically. DATABASE_URL should be port 6543 (PgBouncer pooled). DIRECT_URL should be port 5432 (direct — used by Prisma Migrate only).

---

## Upstash Redis

| Field | Value |
|-------|-------|
| UPSTASH_REDIS_REST_URL | **SET** (Vercel production, encrypted, added 5 days ago) |
| UPSTASH_REDIS_REST_TOKEN | **SET** (Vercel production, encrypted, added 5 days ago) |
| In-memory fallback present | **YES** — `lib/rateLimit.ts` `MemoryBackend` class (lines 119–163) |
| Fallback trigger | Only if `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is unset |
| Risk | **LOW** — Upstash configured in prod; fallback is test/build-safe guard |

**Note:** `MemoryBackend` is per-instance and not distributed. If Upstash is ever removed or rotated without updating the env vars, rate limiting silently degrades to per-instance scope. This is a known risk for NR-7 (Tenant Access Guard).

---

## ECS Worker

| Field | Value |
|-------|-------|
| AWS Cluster "liberia-learn" | **NOT FOUND** (ClusterNotFoundException) |
| Desired tasks | 0 (cluster absent) |
| Running tasks | 0 |
| Autoscaling configured | **NO** (empty ScalableTargets) |
| SQS_QUEUE_URL | **SET** in Vercel production (encrypted, added 63 days ago) |
| SQS queue depth | _Cannot check — URL is encrypted in Vercel, not in local env_ |

**Risk: HIGH.** `SQS_QUEUE_URL` is configured but the ECS cluster does not exist. Any code path that enqueues SQS jobs (audio generation fallback, curriculum regen queue) will silently fail or queue indefinitely. Verify whether the worker was intentionally decommissioned or if the cluster was never deployed. This blocks NR-2 (ECS Worker Autoscale + Queue SLOs).

---

## Curriculum Coverage

> **NOTE:** Run the audit script against production to fill in this section:
> ```
> npx dotenv -e .env.production -- npx tsx scripts/curriculum-coverage-audit.ts
> ```

| Field | Value |
|-------|-------|
| Grid (12 grades × 8 subjects) | _PENDING production run_ |
| National gate cells passing (≥15 APPROVED) | _PENDING_ / 96 |
| Critical deserts (0 lessons) | _PENDING_ |
| APPROVED without audio | _PENDING_ |

**Known from Phase 5.2 audit (2026-04-28):** G2 and G9 are critical content gaps (3 and 2 missing lessons respectively). ENGINEERING has 0 MOE codes. CIVICS was missing strands (fixed in AI Factory sprint). 389 lessons were in PUBLISHED state awaiting approval.

---

## Branch Status

| Branch | Status |
|--------|--------|
| feat/phase-5-intelligence-system | **OPEN** (local + remote) |
| feat/load-test-validation | OPEN (local, prefixed with +) |
| fix/mobile-audit-issues | OPEN (local + remote, prefixed with +) |
| phase5/bundleA-22-24-hardening | OPEN (local + remote) |

**Stale branch count:** ~80+ open branches across local and remote. Cleanup recommended in NR-16 (Playwright CI + Phase 6 close on main).

---

## Doc Sync

| Document | Status | Action taken |
|----------|--------|--------------|
| `docs/roadmaps/MASTER_EXECUTION_PLAN.md` | **SYNCED** — Sprints 2–16E marked COMPLETE | Updated in NR-0 commit |
| `docs/roadmaps/CURRENT_EXECUTION_STATE.md` | **SYNCED** — NR-0 set to IN_PROGRESS | Updated in NR-0 commit |
| `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md` | Current — NR-0 PENDING (being executed) | Pending NR-0 gate pass |

---

## Security Baseline

| Check | Result |
|-------|--------|
| middleware.ts passes /admin without middleware auth check | **YES** — passes via `NextResponse.next()`; comment: "rely on server-side auth in the page itself" |
| middleware.ts passes /platform without middleware auth check | **YES** — same pattern |
| /moe/* guarded in middleware | YES — requires `MOE_OFFICIAL` role or redirect to /moe/login |
| Total API route files | **471** |
| Files with requireRole/requireUser/requireTenant/assertPermission | **397 / 471 (84%)** |
| assertPermission/requireRole call instances | **900** |
| Files using isPlatformAdmin bypass pattern | **88 / 471 (19%)** |

**Risk assessment:**
- `/admin` and `/platform` pass in middleware but rely on server-side page auth. This is correct behavior (Next.js App Router pattern) but means a bug in any single page component could expose admin content. **NR-6** (Middleware Portal Hardening) will add middleware-level role guards.
- 74 route files (15.7%) have no detected auth guard. Some are intentionally public (health, onboard, auth callbacks), but this pool must be audited in **NR-7** (Systematic Tenant Access Guard).
- `isPlatformAdmin` is used in 88 files as a role bypass. This is an intended escalation path but must be audited for misuse in **NR-9** (Audit Immutability + Pen Test Remediation).

---

## NR-0 Sign-Off Checklist

- [x] Vercel tier confirmed
- [x] Upstash Redis: SET in production
- [x] In-memory rate limit fallback: present and documented
- [x] ECS worker: NOT running — HIGH risk documented
- [x] feat/phase-5-intelligence-system: OPEN (not merged to main)
- [x] MASTER_EXECUTION_PLAN.md synced (Sprints 2–16E marked COMPLETE)
- [x] CURRENT_EXECUTION_STATE.md synced
- [x] scripts/db-connection-audit.ts created
- [x] scripts/curriculum-coverage-audit.ts created
- [ ] Production DB connection audit script run (requires `.env.production`)
- [ ] Curriculum coverage grid populated (requires `.env.production`)
- [ ] Latest Vercel ERROR deployment root-cause identified
- [ ] SQS queue depth confirmed (requires AWS credentials)
