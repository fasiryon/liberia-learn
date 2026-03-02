# LiberiaLearn v1.0.0 — Release Candidate Verification Checklist

**Date:** 2026-03-01
**Engineer:** Engineering Team
**Target version:** 1.0.0
**Branch:** main

---

## 1. Test Suite

| Check | Command | Result |
|-------|---------|--------|
| Full test suite | `npx vitest run` | **921/921 PASS** ✅ |

**Test breakdown by area:**
- Auth / session management: PASS
- Governance exports: PASS
- AI endpoints (tutor, assist, grading): PASS
- Impact analytics: PASS
- Curriculum factory + delivery profile: PASS
- Classroom toolkit: PASS
- District intelligence: PASS
- Geo intelligence: PASS
- National insights: PASS
- MOE portal (Block 28): 29/29 PASS
- Disaster recovery health check (Block 29): 21/21 PASS
- Integrated delivery engine: PASS

---

## 2. TypeScript Compilation

| Check | Command | Result |
|-------|---------|--------|
| Production code | `npx tsc --noEmit` | **0 errors** ✅ |

**Notes:**
- 4 test files had type errors that were fixed before this checklist was finalised:
  - `__tests__/auth.test.ts` — partial mock objects needed `as any`
  - `__tests__/workflow.gradingAssist.test.ts` — missing `beforeAll`/`afterAll` import
  - `__tests__/curriculum.factory.tone.test.ts` — missing `liberiaContext: true` in 4 calls
  - `__tests__/delivery-profile.test.ts` — missing `liberiaContext: true` in 13 calls
- Scripts in `scripts/**` are excluded from `tsconfig.json` (intentional)
- Zero production code type errors

---

## 3. Prisma Schema

| Check | Command | Result |
|-------|---------|--------|
| Schema validation | `npx prisma validate` | **VALID** ✅ |
| Client generation | `npx prisma generate` | **SUCCESS** ✅ |
| Migration status | `npx prisma migrate status` | 20 local, 2 pending on remote ✅ |

**Migration notes:**
- 20 migration files defined locally
- 2 migrations unapplied to Supabase DB (expected — applied at deploy time):
  - `20260228_block26_perf_indexes` — composite indexes (safe, non-destructive)
  - `20260301_000001_moe_official_role` — `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MOE_OFFICIAL'`
- Both migrations are additive and safe to apply to production

---

## 4. ESLint

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx next lint` | **0 errors, 3 warnings** ✅ |

**Warnings (non-blocking):**
1. `app/admin/school-branding/page.tsx` — `<img>` instead of Next.js `<Image />` (performance, not correctness)
2. `app/login/LoginClient.tsx` — `useMemo` missing dependency (no behavioural impact)
3. `components/toolkit/ToolkitOverlay.tsx` — `useMemo` missing dependency (no behavioural impact)

**Decision:** All 3 are pre-existing warnings and do not affect functionality or security. Deferred to post-v1.0 housekeeping.

---

## 5. Seed Data

| Check | Result |
|-------|--------|
| Seed script builds | ✅ |
| Virtual labs seed (`prisma/seeds/virtual-labs.ts`) | ✅ |
| MOE standard codes (53 total) | ✅ |
| Strand catalog (92 strands) | ✅ |

---

## 6. Feature Flag Defaults

All feature flags default to **OFF** unless the environment explicitly enables them.
Flags requiring explicit opt-in at deployment:

- `ENABLE_MOE_PORTAL=true` — MOE national oversight portal
- `ENABLE_AI_GRADING_ASSIST=true` — AI grading feedback
- `ENABLE_VIRTUAL_LABS=true` — Virtual lab system
- See `docs/rollout/ENV_VARS.md` for the complete list

---

## 7. Security

| Check | Result |
|-------|--------|
| No PII in AI prompts | Verified in tests ✅ |
| Audit logs on all sensitive routes | ✅ |
| MOE routes: no school-scoped data leakage | ✅ |
| Role-based access on all routes | ✅ |
| `teacherFinalAuthority: true` on grading assist | ✅ |
| Session invalidation after password change | ✅ |

---

## 8. Package Version

| Check | Result |
|-------|--------|
| `package.json` version | **1.0.0** ✅ |

---

## 9. Documentation

| Document | Status |
|----------|--------|
| `docs/rollout/ENV_VARS.md` | ✅ Created |
| `docs/rollout/RELEASE_NOTES_v1.0.md` | ✅ Created |
| `docs/rollout/MOE_BRIEFING_PACKAGE.md` | ✅ Created |
| `docs/rollout/VERSION.md` | ✅ Created |
| `docs/rollout/BLOCK28_MOE_PORTAL.md` | ✅ Created |
| `docs/rollout/BLOCK29_DR_PLAN.md` | ✅ Created |
| `docs/rollout/ROLLBACK_RUNBOOK.md` | ✅ Created |

---

## Verdict

**RELEASE CANDIDATE APPROVED** ✅

All gates pass. The platform is ready for production deployment to Supabase + Vercel.

> Pending deploy-time actions:
> 1. Apply 2 pending migrations via `npx prisma migrate deploy`
> 2. Set required env vars in Vercel dashboard (see `ENV_VARS.md`)
> 3. Enable feature flags as per phased rollout plan
