# CURRENT EXECUTION STATE

## Purpose
Live execution tracking for the final closeout program.

## Current workstream
22-sprint final platform closeout

## Current sprint or phase
Sprint 7 — (not yet started)

## Current branch
feat/moe-dashboard-passport (Sprint 6 committed, not yet merged to main)

## Worktree status
Clean (Sprint 6 committed at 1f0e6ee on feat/moe-dashboard-passport)

## Worktree detail
Sprint 5 merged to main at 6f93bae. Sprint 6 complete on feat/moe-dashboard-passport at 1f0e6ee. Ready to merge or continue on next feature branch.

## Overall status
Sprint 6 complete and fully validated. Awaiting Sprint 7 instructions.

## Last completed phase
Sprint 6 — MOE National Dashboard + Student Learning Passport

## Last successful validation (Sprint 6)
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS
- `npm test`: PASS (1671 tests)
- `npm run build`: PASS
- CI (PR Triage): green on feat/moe-dashboard-passport

## Sprint history (all on main unless noted)

| Sprint | Deliverable | Commit | Branch |
|--------|-------------|--------|--------|
| 1–3 | Platform foundation, AI factory, mastery/interventions | pre-2bf49f6 | main |
| 4 | AI Telemetry + Versioning + Offline Sync Integrity | 2bf49f6 | main |
| 5 | Offline lesson caching · Teacher weekly report · SMS dry-run gate | 6f93bae | main |
| 6 | MOE National Dashboard + Student Learning Passport | 1f0e6ee | feat/moe-dashboard-passport |

## Sprint 6 files committed (commit 1f0e6ee)
- `app/api/moe/dashboard/route.ts` (enhanced — county breakdown, AI usage, Redis cache, requireMoeActor)
- `app/api/moe/counties/route.ts` (new — all-15-county endpoint with date range + cohort suppression)
- `app/api/moe/curriculum/publish/route.ts` (new)
- `app/api/moe/curriculum/version/route.ts` (new)
- `app/api/moe/districts/route.ts` (new)
- `app/api/moe/override/route.ts` (new)
- `app/api/moe/policies/route.ts` (new)
- `app/api/student/passport/route.ts` (new — STUDENT + GUARDIAN access scoping)
- `app/moe/curriculum/page.tsx` (new)
- `app/moe/policies/page.tsx` (new)
- `app/student/passport/page.tsx` (new — mastery bars, growth deltas, intervention summary)
- `lib/cache/redisCache.ts` (new — withRedisCache<T> with graceful degradation)
- `lib/moe/authority.ts` (new — requireMoeActor, resolveMoeScope, MoeScope)
- `lib/moe/rbac.ts` (new — isMoeSuperRole, isMoeDistrictRole, isAnyMoeRole)
- `lib/passport/buildStudentPassport.ts` (new — pure computed view from Sprint 2–3 data)
- `lib/permissions.ts` (updated — MOE_OFFICIAL / MOE_SUPER_ADMIN / MOE_DISTRICT_ADMIN added)
- `__tests__/moe.dashboard.enhanced.test.ts` (new — 6 tests)
- `__tests__/moe.counties.route.test.ts` (new — 7 tests)
- `__tests__/student.passport.route.test.ts` (new — 10 tests)

## Untracked files (not Sprint 6 scope — still pending)
- `__tests__/admin.import.route.test.ts`
- `__tests__/lowBandwidthMode.test.ts`
- `__tests__/reliableSend.test.ts`
- `app/admin/import/`
- `app/api/admin/import/`
- `components/LowBandwidthModeScript.tsx`
- `components/LowBandwidthToggle.tsx`
- `lib/import/`
- `lib/lowBandwidthMode.ts`
- `lib/sms/reliableSend.ts`
- `vercel-deploy.html`

## Exact next step
Await Sprint 7 instructions. Do not start Sprint 7 until directed.

## Note
Prior systems must be extended, not rebuilt. All gates (prisma generate, tsc, test, build) must pass before any Sprint commit.
