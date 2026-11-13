# T1 — hosted Preview application readiness (2026-11-02)

**To:** CoS (coordinator), Atlas (independent review), T2 (candidate owner). **From:** Claude T1.
**Base:** exact candidate `26026ca699df254aaf120e9ad23adf1d897d7346`. T2's worktree is untouched.
**T1 branch:** `fix/t1-preview-app-readiness` in `.task-worktrees/t1-preview-app`. It is local and unpushed; head `fb993ccd` (+ evidence commit below).
No push, deploy, secret read, env mutation, Production change or record activation was done.

## 1. Actual hosted-readiness defects

| ID | Sev | Defect | Status |
|---|---|---|---|
| T1-PV-01 | P1 | **The runtime DB isolation guard is dormant.** `assertStagingDatabaseIsolation` runs only from `instrumentation.ts → register()`. Next 14 never calls it (no `instrumentationHook`). A deployed Preview whose `DATABASE_URL` names the **production** project, or that lacks `STAGING_SUPABASE_PROJECT_REF`, creates its Prisma client with no refusal (RED proved). | Fixed `f6ae06e7` |
| T1-PV-02 | P1 (latent) | **The guard contradicts the operator contract.** It required the pooler user `postgres.<ref>` and `sslmode=require` only. `scripts/preview/preview-target.mjs` requires the restricted `preview_app.<ref>` and also allows `verify-full`. Activating the guard unchanged would have broken the Preview. | Fixed `f6ae06e7` |
| T1-PV-03 | P2 | **DEMO_MODE makes a deployed Preview classify as `demo`, not `staging`.** `getEnvironment()` checks DEMO_MODE before VERCEL_ENV. So `/api/demo/reset` and `/api/platform/demo/{reset,advance-day,simulate-activity}` pass their env gate on the hosted Preview, although CI refuses them. Only the absent `DEMO_SCHOOL_IDS`/`ENABLE_MOE_PORTAL` stop a platform admin from writing fabricated progress, mastery, homework and attendance rows. The synthetic `authority` account is a platform admin. | Fixed `fb993ccd` |
| T1-PV-04 | P3 | An undecodable `/api/cron(s)/…%` path escaped the Preview cron refusal (`isCronNamespace` returned false on a decode error). | Fixed `f6ae06e7` |
| T1-PV-05 | **P1 demo-blocking** | **The synthetic day is valid only on the seed day.** `seed-school-day.ts` binds all 8 timetable rows to the seed's UTC weekday (`:12,:49`), and the policy window is `[seedDay−1h, seedDay+48h)` (`:53`). `setup-preview-db.mjs` is one-shot: a rerun returns ALREADY_COMPLETE, and re-seeding would rotate passwords. On a hosted demo on any other weekday, `/learn/day` says "no classes today". After 48h, `/learn/day` and every player link return 404. CI never sees this because it seeds and tests on the same day. | **Open: T2/CoS decision** |
| T1-PV-06 | Risk | **Session and privileged access.** The JWT `maxAge` is 30 days in every environment. Logout only clears the cookie; there is no server-side revocation apart from the freshness check on password, role or school (700s process cache). `PRIVILEGED_MFA_ENFORCEMENT_ENABLED` is absent, so the synthetic ADMIN and platform-admin accounts log in with a password only. This is SEC-R08 open, not weakened. | Not changed: CoS decides |
| T1-PV-07 | Forward | **D4 (Next 15) will activate instrumentation.** `assertProductionEnv` then requires `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET` and `BLOB_READ_WRITE_TOKEN`, so the 6-variable Preview would hard-fail at cold start (D4A-STARTUP-01). | Atlas (D4 owner) |

**Proposals for T1-PV-05 (pick one):**
- **(a)** Run the one-shot setup on the demo day itself.
- **(b)** T2 adds an operator `--reanchor` mode that updates only `timetable.dayOfWeek` and the policy window. It would not rotate passwords and would need tests.
- **(c)** The seed takes an explicit approved demo window and writes rows for each school weekday. This changes the cardinality 8→40 and the receipt check.

T1 recommends (b). T1 did not edit T2's seed.

**For T1-PV-06:** do not distribute the `authority` (platform-admin) credential to demo viewers. A Preview-only shorter `maxAge` is a small change if CoS wants it; T1 did not implement it.

**Verified OK (no change needed):**
- Every file the `/learn/day`, `/learn/preview/[selection]` and `/api/student/learning-preview/[key]` loaders actually read is covered by that route's `outputFileTracingIncludes`. None is `.vercelignore`d, and all paths stay inside the repo. This is proven by instrumenting fs on the real admitted path for all 8 packages, with a negative control.
- Lesson identity, hash and tamper checks: existing tests.
- The pilot flag conceals the namespace before any token read.
- Unauthenticated users are denied; a wrong role is refused by `requireRole` (404).
- Cross-school isolation: existing tests plus CI e2e.
- `/lab-review` and `/curriculum-candidates` return 404 on Vercel even when the harness flag is set.
- The player only issues `GET` (`?accessOnly=1`); there is no record write.
- The code-block worker is a same-origin module, which the production CSP allows.
- Two items are by design and not hosted-verified:
  - `NEXTAUTH_URL` is not required on Vercel; next-auth v4 derives the origin from the forwarded host.
  - Google OAuth is absent.
- CSP blocks Vercel's preview toolbar script. This only produces console noise.

## 2. Files

- **Fixes:**
  - `lib/db.ts`
  - `lib/database-target.ts`
  - `lib/previewSideEffects.ts`
  - `lib/demo/reset.ts`
  - `app/api/demo/reset/route.ts`
  - `app/api/platform/demo/{reset,advance-day,simulate-activity}/route.ts` (route-policy directives added to the 3 that lacked them)
- **Operator aid:** `scripts/preview/check-app-db-guard.ts`
- **Tests (new):**
  - `__tests__/preview-hosted-db-guard.test.ts`
  - `__tests__/preview-hosted-trace-coverage.test.ts`
  - `__tests__/preview-hosted-failure-paths.test.ts`
  - `__tests__/preview-hosted-demo-mutation.test.ts`
- **Demo-window defect (unchanged):**
  - `scripts/e2e/seed-school-day.ts`
  - `scripts/preview/setup-preview-db.mjs`
  - `lib/curriculum/v4/pilotDay.ts`

## 3. Repairs and evidence (RED → GREEN, local, focused)

**RED at the T1 test commits (before fixes):**

| Test file | Failed | What failed |
|---|---|---|
| db-guard | 5 | production-ref Preview and a missing pin were not refused; the restricted role and verify-full were rejected |
| failure-paths | 5 | malformed cron paths |
| demo-mutation | 4 | all four routes reached the DB on `VERCEL_ENV=preview` |

**GREEN:** 56 focused files, **724 passed / 0 failed / 9 skipped**. Evidence: `artifacts/t1-preview-app-readiness-20261102/focused-GREEN-summary.json`. The set covers all preview-*, staging foundation, PROD-CFG-01, demo, environment, g4-school-day, learning-v4 and pilot tests.

**Other checks:**
- **Unchanged contracts:** T2's existing assertions (authority before refusal in Preview) and the existing guard message test.
- **Scoped tsc:** all 18 changed TS files, exit 0.
- **eslint:** exit 0.
- **`audit:api-routes`:** PASS, 108 changed routes declared.
- **Production:** behavior unchanged. With `VERCEL_ENV=production` the guard is a no-op and demo routes keep refusing first. Runs without a Vercel identity are unchanged (tests).
- **Not run:** full tsc, build and browser (laptop rule). These are required CI gates.

## 4. Commits (local, unpushed)

| Commit | Change |
|---|---|
| `704d87f3` | test: DB guard / trace coverage / failure paths (RED) |
| `67eecdbe` | test: type env helper (no assertion change) |
| `f6ae06e7` | fix: enforce Preview DB isolation at the Prisma singleton; restricted role + verify-full; refuse RDS dual-write; fail-closed cron classification |
| `0168a739` | chore: read-only operator check for the application DB guard |
| `83fa166e` | test: demo data mutation on a deployed Preview (RED) |
| `fb993ccd` | fix: refuse demo data mutation on a deployed Preview after authority |

## 5. Environment variable names (no values)

- **Required in Vercel Preview (all 6 present per the 11-02 read-only state):**
  - `DATABASE_URL`: `preview_app.<ref>` transaction pooler on 6543, with `pgbouncer=true` and `sslmode=require|verify-full`.
  - `DIRECT_URL`: direct host as `preview_app`, or `preview_app.<ref>` session pooler on 5432, with sslmode.
  - `STAGING_SUPABASE_PROJECT_REF`
  - `NEXTAUTH_SECRET`
  - `V4_LEARNING_PREVIEW_ENABLED` (must be exactly `1`)
  - `DEMO_MODE`
- **Must stay ABSENT from Preview:**
  - `ENABLE_RDS_DUAL_WRITE`, `RDS_DATABASE_URL` (now refused)
  - `DEMO_SCHOOL_IDS`, `ALLOW_LIVE_DEMO_RESET`, `ENABLE_MOE_PORTAL`
  - `GOOGLE_CLIENT_ID/SECRET`, `AUTH0_*`
  - `CRON_SECRET`, `UPSTASH_REDIS_REST_URL/TOKEN`, `BLOB_READ_WRITE_TOKEN`
  - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `RESEND_API_KEY`, `AT_API_KEY`, `SENTRY_*`, `SUPABASE_SERVICE_ROLE_KEY`
  - `LAB_REVIEW_HARNESS`, `STUDENT_DESIGN_PREVIEW`
- **Optional:**
  - `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`: if set, they must match the ref.
  - `NEXTAUTH_URL`: unnecessary; if set, it must equal the protected Preview alias.
- **Operator file only (never Vercel):** `PREVIEW_DB_PASSWORD`, plus `DATABASE_URL`/`DIRECT_URL` in `.env.preview.local`.

**Important:** because the guard is now live, the Preview **fails closed** if the stored URLs lack sslmode. The operator validator tolerates a missing sslmode in the source file; it adds sslmode only for its child process. Before any deploy, CoS should run:
`node --import tsx scripts/preview/check-app-db-guard.ts --env-file C:\liberia-learn\.env.preview.local`
It connects to nothing and prints only PASS or a fixed refusal code. If it refuses on sslmode, the Preview values must be re-stored with `sslmode=require`. That is a platform mutation, so the founder or CoS authorizes it.

## 6. Dependencies

- **CoS:**
  1. Accept or decline the T1 heads. They change application source, so a composed candidate needs private full CI and the 6-case browser run on its new SHA. 26026ca6 evidence does not transfer.
  2. Run the operator guard check.
  3. Decide T1-PV-05 (a/b/c) and T1-PV-06.
  4. Resolve the existing standard-Preview transport/target blocker. It is unchanged by this work, but T1-PV-01 is why a mis-targeted or mis-bound deploy now fails closed instead of reaching a wrong DB.
- **T2:** review the changes to the Preview-adjacent files it authored. If (b) is chosen, implement `--reanchor`. T1 can do it instead if reassigned.
- **Atlas:** independent review of `f6ae06e7` and `fb993ccd`; T1-PV-07 on the D4 line.
- **Codex:** none.

## 7. Ready for isolated hosted verification?

**Not yet, from the application side.** Required first:
1. Integrate T1-PV-01..04 and accept them (otherwise the hosted Preview has no runtime DB-target guard).
2. Private CI plus browser on the composed SHA.
3. The operator guard check PASSes.
4. A plan for T1-PV-05; otherwise the student day is empty or 404 on any day other than setup day.

With those done, nothing else found in the app blocks an isolated hosted check. The platform target/transport blocker and SEC-R08 remain separate.
