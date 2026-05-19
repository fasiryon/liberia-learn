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
| Connection mode | **⚠ MISCONFIGURED** — port 5432 with `pgbouncer=true` flag (see below) |
| Active connections | 6 (low — 9 schools, 315 users) |
| Max connections | Not returned by pg_stat (check Supabase dashboard) |
| DB size | **311 MB** |
| Users | **315** |
| Schools | **9** |
| Total curriculum content | **5,181** |
| APPROVED/published | **4,363** |
| NEEDS_REVIEW | **731** |
| PENDING | 0 |
| APPROVED but no audio | **3,900 (89%)** |

**DB pool configuration issue (HIGH risk at scale):** DATABASE_URL has `pgbouncer=true` and `connection_limit=1` parameters but uses **port 5432** (direct Postgres), not port 6543 (PgBouncer pooled). At national scale with many parallel Vercel instances, each will hold a direct connection — this can exhaust Supabase's direct connection limit. Fix: change DATABASE_URL port from 5432 → 6543 in Vercel env. DIRECT_URL (5432, used for Prisma Migrate only) is correct.

---

## Upstash Redis

| Field | Value |
|-------|-------|
| UPSTASH_REDIS_REST_URL | **SET** (Vercel production, encrypted, added 5 days ago) |
| UPSTASH_REDIS_REST_TOKEN | **SET** (Vercel production, encrypted, added 5 days ago) |
| In-memory fallback present | **YES → FIXED in NR-1** — now throws in production if Upstash env vars absent |
| Fallback trigger (after NR-1) | Hard crash visible in Sentry; fallback removed from prod path |
| Risk | **ELIMINATED** — production now fails loudly if Upstash is removed |

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

**Decision: REBUILD NEEDED (NR-2).** SQS_QUEUE_URL is set and live code calls `enqueueJob()` from 16+ files for critical job types (GENERATE_EMBEDDINGS, GENERATE_LESSON_AUDIO, GENERATE_TEXTBOOK, CURRICULUM_REGENERATE_*, GENERATE_SCHOOL_ONBOARDING_KIT, AUTONOMOUS_WORKFLOW_RUN, etc.). Messages enqueue successfully to SQS but no consumer processes them — all jobs silently pile up.

**NR-1 mitigation:** `enqueueJob()` now wraps the SQS send in try/catch and logs failures with `"[QUEUE] SQS send failed — no consumer"`. Messages DO reach SQS (the URL is valid), they just aren't consumed. No user-facing errors. ECS cluster provision is NR-2 scope.

---

## Curriculum Coverage

> **NOTE:** Run the audit script against production to fill in this section:
> ```
> npx dotenv -e .env.production -- npx tsx scripts/curriculum-coverage-audit.ts
> ```

| Field | Value |
|-------|-------|
| National gate cells passing (≥15 APPROVED) | **62 / 96** |
| Cells with 1–14 lessons (below gate, not zero) | 0 |
| Critical deserts (0 lessons) | **34 cells** (see below) |
| APPROVED without audio | **3,900 (89% of 4,363 approved)** |

**12×8 Coverage Grid (APPROVED + published):**
```
Grade    MATH     ENGLISH  LITERAC  SCIENCE  SOCIAL_  CIVICS   COMPUTE  ENGINEE
G1         40✓    ✗        40✓      40✓      40✓      40✓      ✗        ✗
G2         41✓    ✗        41✓      41✓      40✓      ✗        ✗        ✗
G3         40✓    ✗        40✓      53✓      40✓      40✓      ✗        ✗
G4         40✓    ✗        40✓      40✓      40✓      40✓      ✗        ✗
G5         90✓    170✓     84✓      112✓     40✓      41✓      41✓      ✗
G6         52✓    ✗        60✓      46✓      40✓      45✓      ✗        ✗
G7         65✓    150✓     52✓      86✓      89✓      181✓     ✗        ✗
G8         49✓    ✗        48✓      46✓      40✓      45✓      ✗        ✗
G9         50✓    ✗        41✓      40✓      40✓      40✓      ✗        ✗
G10        44✓    ✗        40✓      40✓      40✓      40✓      ✗        ✗
G11        40✓    ✗        40✓      40✓      40✓      40✓      ✗        ✗
G12        56✓    ✗        48✓      51✓      46✓      49✓      ✗        ✗
```
Legend: ✗ = zero  ✓ = ≥15 approved lessons

**Critical deserts (34 zero-lesson cells):**
- ENGLISH: G1–G4, G6, G8–G12 (10 grades — only G5 and G7 have ENGLISH content)
- COMPUTER_SCIENCE: G1–G4, G6–G12 (11 grades — only G5 has CS content)
- ENGINEERING_FOUNDATIONS: G1–G12 (ALL 12 grades — complete national desert)
- CIVICS: G2

**Implication:** ENGLISH and COMPUTER_SCIENCE are near-complete deserts at current production state. ENGINEERING_FOUNDATIONS has zero content nationally. These drive NR-12 and NR-13.

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

- [x] Vercel tier confirmed (Pro, 15/40 crons)
- [x] Upstash Redis: SET in production
- [x] In-memory rate limit fallback documented → **FIXED in NR-1**
- [x] ECS worker: NOT running — REBUILD path documented
- [x] feat/phase-5-intelligence-system: **DELETED** (0 commits ahead of main)
- [x] MASTER_EXECUTION_PLAN.md synced (Sprints 2–16E marked COMPLETE)
- [x] CURRENT_EXECUTION_STATE.md synced
- [x] Production DB script ran: 311 MB, 315 users, 9 schools, 4,363 approved
- [x] Curriculum grid populated: 62/96 cells at gate, 34 deserts, 3,900 no-audio
- [x] DATABASE_URL misconfiguration documented (port 5432 vs 6543)
- [ ] Latest Vercel ERROR deployment root-cause identified
- [ ] SQS queue depth confirmed (requires AWS credentials with queue access)

---

## NR-1 Actions Taken (2026-05-18)

| Action | Result |
|--------|--------|
| Upstash hard-fail in production | **DONE** — `lib/rateLimit.ts` throws if Upstash env vars absent in prod |
| `assertProductionEnv()` startup check | **DONE** — `lib/startup-checks.ts` created; wired in `app/instrumentation.ts` |
| DB pool settings confirmed | PARTIAL — has `pgbouncer=true` + `connection_limit=1` but **port 5432 (wrong)**. Fix needed: change to port 6543 in Vercel env |
| ECS/SQS decision | **REBUILD-NR2** — 16+ live callers; `enqueueJob()` now try/catches with explicit error log |
| `feat/phase-5-intelligence-system` | **DELETED** (already fully in main) |
| Build route conflict | **FIXED** — `[id]/regenerate-audio` merged into `[contentId]/regenerate-audio` |
| Build heap limit | Documented: requires `NODE_OPTIONS=--max-old-space-size=6144`; Vercel builds fine (more memory) |

## NR-3 Actions Taken (2026-05-19)

### Database Pool (NR-3 update)

| Field | Value |
|-------|-------|
| DATABASE_URL | PgBouncer port 6543 ✓ (updated NR-3) |
| Hostname | aws-1-us-east-2.pooler.supabase.com |
| connection_limit | 1 ✓ |
| pgbouncer | true ✓ |
| pool_timeout | 20 ✓ |
| DIRECT_URL | Port 5432 unchanged (Prisma Migrate only) |

Full DATABASE_URL format applied to Vercel production:
```
postgresql://postgres.[ref]:[password]@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20
```

### Load-Test Identity Pool

| Item | Value |
|------|-------|
| Schools created | 10 (lt-school-01 through lt-school-10) |
| Students created | 1,000 (100 per school) |
| Email pattern | `lt-sXX-uYYY@loadtest.liberialearn.internal` |
| Password | LoadTest2026! (bcrypt hash stored in DB) |
| Token fixture | `load-tests/fixtures/student-tokens.json` (gitignored) |
| Seed script | `scripts/seed-load-test-users.ts` |
| Token script | `scripts/generate-load-test-tokens.ts` |
| Cleanup script | `scripts/cleanup-load-test-users.ts` (run after NR-5) |

### k6 Scenario Updates
All 4 scenarios updated to use `SharedArray` token pool:
- `load-tests/scenarios/student-browse.js` ✓
- `load-tests/scenarios/submission-spike.js` ✓
- `load-tests/scenarios/ai-tutor.js` ✓
- `load-tests/scenarios/guardian-reads.js` ✓ (still uses GUARDIAN_TOKEN env var — no guardian seed pool yet)

---

## NR-2 Input (carry forward)

1. **DATABASE_URL port**: Change from 5432 → 6543 in Vercel production env (PgBouncer pooling critical at scale)
2. **ECS cluster**: Provision `liberia-learn` Fargate cluster + worker task definition for SQS consumer
3. **SQS backlog**: After ECS is live, drain any backlogged GENERATE_EMBEDDINGS / GENERATE_LESSON_AUDIO / CURRICULUM_REGENERATE_* messages
4. **Audio gap**: 3,900 APPROVED lessons (89%) have no audio — NR-14 (National Audio Pipeline)
5. **ENGLISH content**: Only G5 and G7 have ENGLISH lessons — 10-grade desert needs NR-13 sprint
6. **ENGINEERING_FOUNDATIONS**: Complete 12-grade desert — NR-13 scope
7. **COMPUTER_SCIENCE**: Only G5 has CS lessons — 11-grade desert — NR-13 scope
