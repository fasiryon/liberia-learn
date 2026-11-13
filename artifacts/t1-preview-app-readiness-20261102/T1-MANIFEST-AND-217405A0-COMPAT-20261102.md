# T1 → CoS / Atlas / T2: commit manifest, 217405a0 compatibility, PV-05 contract, smoke readiness (2026-11-02)

This replaces the partial version of this note.

- **Branch:** `fix/t1-preview-app-readiness` (`.task-worktrees/t1-preview-app`), local and unpushed.
- **Head:** `1c2bba0d`, based on `26026ca6`.
- **Not done:** no push, merge, deploy, CI dispatch, smoke execution, secret read, Production change or activation.
- **Untouched (net diff empty):** T2 files, `middleware.ts`, `next.config.js`, `prisma/**` and the sealed packages.

## 1. Clean T1 commit manifest (27 commits, oldest first)

| Area | RED / test | Fix / impl | Other |
|---|---|---|---|
| PV-01/02/04 DB guard, restricted role, dual-write, cron | `704d87f3`, `67eecdbe` (typing), `b7792859` (extra cases) | `f6ae06e7` | `0168a739` operator check; `c9542e53` move; `d4fa0f8c` path fix to that move |
| PV-03 demo mutation routes | `83fa166e` | `fb993ccd` | |
| PV-06 Preview session policy (proposal) | `d78fa5d5`, `8eb47680` (fixture iat) | `1ad19b14` | |
| LL Code execution fail-closed | `7752abbe`, `90fd5f9b`, `6a008922` (fixture), `1c2bba0d` (static guard) | `bb9f548c`, `16f598f4` | `4286b735` sandbox evidence |
| PV-05 application behavior and contract | `c7c90776`, `008c3a11` | none (app already correct) | |
| Hosted smoke suite (tool, not served) | `d8d25a13`, `0cdf167f` | `44cee9c4` | |
| Hosted next-auth assumptions | `e46a7dd4` | none | |
| Docs | | | `73792562`, `f71b4258`, `cd0dc04a` (it copied a stale draft of this note), plus this note's commit |

**Served application changes since `26026ca6`:** exactly 11 files, +153/−40:
- `lib/db.ts`
- `lib/database-target.ts`
- `lib/previewSideEffects.ts`
- `lib/auth.ts`
- `lib/auth/previewSessionPolicy.ts` (new)
- `lib/demo/reset.ts`
- `lib/learner-experience/stem/runInWorker.ts`
- `app/api/demo/reset/route.ts`
- `app/api/platform/demo/{reset,advance-day,simulate-activity}/route.ts`

Everything else is tests, `artifacts/` (excluded from the Vercel upload) or docs.

## 2. Compatibility with CoS `integration/preview-security-v1` @ `217405a0` (read-only)

- **Textual:** `git merge-tree --write-tree 217405a0 1c2bba0d` is CLEAN (tree `0c7e923f`), and the two chains change no file in common.
- **Scratch composition** (detached, unreferenced commit `62772027` of `217405a0` × `f71b4258`; worktree removed afterwards):
  - focused vitest from both sides (preview, auth/security, agents, offline-sync, WAEC, attendance, escalation, moderation, lab, learning-v4, pilot, LL Code): **177 files, 1,975 passed, 0 failed**, 9 existing skips;
  - `audit:api-routes`: **PASS, 112 changed routes declared**;
  - Atlas `run_verification.py`, default mode: **82/82 PASS**.
  - This is not CI. Local `node_modules` comes from the main lock, not the candidate lock `9006871…`.
- **Session assumptions:**
  - Every ported route authenticates through `requireUser`/`requireRole`; `requireAgentAdmin` wraps `requireUser`. They all pass through the PV-06 session callback, so they inherit the 8 h bound and uncached freshness consistently.
  - The ported changes do not rely on the 700 s freshness cache.
  - With PV-06, the agents' global (platform-admin) scope is unreachable on Preview, because no platform-admin password login is allowed; school-admin scope still works. That is intended.
- **Database targeting:**
  - The port adds no Prisma client and no `DATABASE_URL`/`DIRECT_URL`/RDS use.
  - The only other client in the tree (`lib/interoperability/onerosterService.ts`, pre-existing) imports `lib/db` first, so the Preview guard validates `DIRECT_URL` before that client can be built.
- **Environment:**
  - The port's new runtime reads are `NEXTAUTH_SECRET` (WAEC signing; present in Preview) and `AGENT_PLATFORM_EMERGENCY_DISABLED` (agents only; Preview crons are already refused).
  - No new required Preview variable.
- **Route policy:** the T1-touched demo routes and the CoS-touched routes are disjoint; the combined audit passes.
- **Verdict:** compatible. No compatibility defect was found that needs a fix in T1-owned files.

## 3. PV-05 test contract for T2 (tests in `__tests__/preview-pv05-reanchor.test.ts`, 28 passing; no seed file touched)

A re-anchor to demo date **R** is valid only if all of the following hold:

1. **Exactly one active** `learning-preview` policy for the school, with:
   - `startsAt ≤ now < endsAt`;
   - a window of at most 14 days that covers R;
   - `enabled: true`, `revokedAt: null`;
   - the cohort `studentUserIds`/`classIds` unchanged.

   An old policy left active means two rows, which **conceals the day**.
2. **Timetable rows** have `dayOfWeek` = the UTC weekday of R and `subject` equal to the policy binding's subject. A mismatch makes the period UNBOUND.
3. **A NEW approval row per lesson:**
   - `isActive: true`, `scope: SCHOOL`, same `schoolId`;
   - `config.bindingSha256 = pilotApprovalBinding(newPolicy, selection, packageHash)`. The binding hashes `startsAt`/`endsAt`, so old approvals never validate a new window;
   - `createdBy` is the **platform-admin ADMIN** authority row. K2 may make its password unusable, but the row must remain.
4. **A NEW append-only audit row per approval:**
   - `action: V4_PILOT_RELEASE_AUTHORIZED`, `resourceType: PolicyConfig`;
   - `resourceId` = that approval id;
   - `userId` = the approval's author, same `schoolId`;
   - `details.bindingSha256` equal to the approval's binding.

   Never UPDATE existing audit rows (Atlas B3, immutability).
5. **No academic-record writes** (the tests use a write-refusing DB).

**After re-anchoring, the application then provides:**
- all 8 exact hashes admitted on R;
- the old seed day returns 404;
- stale slot links are refused;
- old timetable ids stay UNBOUND;
- unrelated or unenrolled classes are excluded;
- the player's `expiresAt` equals the new `endsAt`.

T2 should add a scratch-DB test asserting rules 1–4, then the operator recount.

## 4. Hosted smoke readiness (`artifacts/t1-preview-app/hosted-smoke.ts`; NOT executed)

**Review finding, fixed (P1 for the tool, not served code):** my earlier transport used `vercel curl`. Reading Vercel CLI 65.0.0 shows that `getOrCreateDeploymentProtectionToken` defaults to `createIfMissing=true` and **PATCHes `/v1/projects/:id/protection-bypass`, minting a project automation-bypass secret**; it also logs the token at debug level. Fix (RED `0cdf167f` → fix `44cee9c4`):

- **Transport:**
  - in-process `fetch` with `x-vercel-trusted-oidc-idp-token` from `vc env run`, sent only to the deployment origin;
  - plain requests carry no header or cookie;
  - no child process, no bypass secret and no fallback;
  - `OIDC_TRUSTED_SOURCE` must admit `/login` before any password prompt.
- **Credentials:** hidden prompt only. Passwords and cookies stay in memory. Results are fixed codes with no bodies. The browser pass captures no trace or screenshot, clears the password field and aborts every non-origin request.
- **Writes:** only GETs, the credential sign-in/sign-out POSTs and one 405 probe on a GET-only route. The own-request audit enforces this. No mutation endpoint is called.
- **Accounts:** student, teacher and school admin are required; the foreign teacher is optional (SKIP under K2). The platform-admin authority and the extra students are never used.
- **Operator prerequisites:**
  - run from the directory linked to `prj_2weR…` (`.task-worktrees/preview-link`) under `vc env run`;
  - Trusted Sources same-project Preview access is the default, so there is no setting change;
  - founder A3 and the exact deployment URL/SHA;
  - T2's academic-record recount afterwards.
- **`NEXTAUTH_URL` (CoS question):** **not required.**
  - On Vercel, next-auth 4.24 takes the origin from the forwarded host and ignores `NEXTAUTH_URL`.
  - `getToken` reads `__Secure-` cookies from `VERCEL`.
  - If set, it must be `https://`. An http value hides every session from middleware.
  - Pinned by `e46a7dd4`, which runs against the installed next-auth (CI checks it against the candidate lock `4.24.15`).

## 5. Exact tests for the combined candidate (after Atlas accepts the security integration)

1. **CoS private CI on the exact combined SHA:** full tsc, build, unit, routes/vault/chunks/coverage. Required **`__tests__` subsets** (all must pass):
   - `preview-*`
   - `hosted-smoke`
   - `llcode-*`
   - `p2a.staging-foundation`
   - `demo.reset.route`
   - `environment`
   - `security/*`
   - `*auth*`
   - `*session*`
   - `learning-v4/**`
   - `content-factory-v4/pilot-*`
   - `agents/**`
   - `offline-sync-policies`
   - `*waec*`
   - `*attendance*`
2. **`atlas-focused`:** `run_verification.py --phase GREEN` for the seven ported findings, and 82/82 in default mode.
3. **The six-case browser run plus safe retention**, unchanged; it must still pass with PV-06 active. In that run the browser suite has no `VERCEL_ENV`, so the policy is inert. PV-06's hosted effect is covered by the smoke's `SESSION_ABSOLUTE_BOUND`.
4. **Operator checks:**
   - before deploy: `artifacts/t1-preview-app/check-app-db-guard.ts` against `.env.preview.local`, which must PASS;
   - after A3: the hosted smoke with `--browser`;
   - then T2's recount.

## 6. Exact unresolved Atlas review gates

1. PV-01..04 fixes (`f6ae06e7`, `fb993ccd`), plus the port composition above.
2. **PV-06 (`1ad19b14`) parameters:** 8 h for all roles, and uncached freshness. **Blocked without a session store (SEC-R08 v2):** idle timeout and durable logout revocation; a copied cookie stays valid up to the 8 h bound, which the smoke reports as LIMITATION.
3. **LL Code (`bb9f548c`, `16f598f4`, guards):** remaining evidence before any activation:
   - real-browser worker isolation under the production CSP;
   - accessibility of the error and Stop flows;
   - offline behavior.

   Student execution remains **disabled**: no flag exists, CODE blocks are grades 6–12 Computing only, and none is in the 8 G4 packages.
4. **Hosted smoke transport (`44cee9c4`):** confirm the OIDC trusted-source path, and that no bypass secret exists on `prj_2weR…` (read-only project check by CoS).
5. **SEC-R08 A1–A6:** open; T1 owes a scoped plan (`T1-SEC-R08-PLAN-*`), not started in this candidate.
6. **B5 mutation inventory:** open. New item for it: the school-admin OneRoster **import** (`app/api/admin/interoperability/oneroster/import`) creates identities with temporary passwords and is reachable by the synthetic school ADMIN on Preview. Define it as a permitted or denied synthetic write.
