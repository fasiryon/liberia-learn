# T1 → CoS: Preview application readiness, round 2 (2026-11-02)

This supersedes the "commits" and "ready?" sections of `T1-PREVIEW-APP-READINESS-20261102.md`; the rest of that note still stands.

- **Branch:** `fix/t1-preview-app-readiness` (`.task-worktrees/t1-preview-app`), local and unpushed. Source head `d4fa0f8c`, based on `26026ca6`. History preserved.
- **Not done:** no push, merge, deploy, secret read, database connection, seed, flag change or Production change.
- **Untouched:** T2-owned files and the sealed packages (net diff empty).
- **Atlas review request:** `T1-ATLAS-REVIEW-REQUEST-20261102.md`, listing the exact commits per area.

## Deliverables

1. **PV-01..04 regression evidence.**
   - **Commits:** `704d87f3`→`f6ae06e7` (DB guard, restricted role, dual-write, cron), `83fa166e`→`fb993ccd` (demo routes), extra cases `b7792859`.
   - **WO1 conformance:**
     - The guard runs on the Prisma creation path, once per instance.
     - No `instrumentationHook`.
     - `assertProductionEnv` and Production defaults are unchanged.
     - Error text is fixed.
     - The `RDS_DATABASE_URL` client is covered: dual-write is refused before the second client exists.
   - **Fix to a move commit:** I had added `scripts/preview/check-app-db-guard.ts`, inside T2's path, and moved it to `artifacts/t1-preview-app/` (`c9542e53`). That move commit left the import path broken in the committed file; `d4fa0f8c` repairs it, and it was re-verified PASS on synthetic values.
2. **PV-06:** implemented as a Preview-only PROPOSAL, `d78fa5d5`→`1ad19b14`.
   - **What it does:**
     - 8 h cookie and absolute bound anchored at sign-in;
     - uncached freshness;
     - no platform-admin password login.
   - **Precise blockers:**
     - no idle timeout and no durable logout revocation without a server-side session store (the SEC-R08 v2 migration);
     - parameters await CoS/Atlas agreement.
3. **Hosted smoke suite:** `d8d25a13`, `artifacts/t1-preview-app/hosted-smoke.ts` and `-lib.ts`, plus 32 synthetic tests. It has not been run against any host.
   - **Run (after A3 only):** `vc env run -- node --import tsx artifacts/t1-preview-app/hosted-smoke.ts --deployment-url https://<deployment>.vercel.app --authorization A3-<ref> --expect-source-sha <sha> [--browser]`
   - **What it covers:** all 9 founder items plus your WO2 list. It runs a hidden password prompt, then sends requests through `vercel curl -K -` with secrets on stdin only. A marker self-check runs before any secret is typed. Output is PASS/FAIL/SKIP/LIMITATION with fixed codes and no bodies.
   - **Before the first run, please verify:**
     - **(a)** `vercel curl`'s "automatic protection bypass" does not mint or expose a project bypass secret (Atlas gate). It should use your Vercel login, but that is not verified here. If it would create one, use the `--browser` OIDC-header path only.
     - **(b)** Under K2 the foreign teacher has no credential, so cross-school denial reports `SKIP`. Another approved route is needed if you want it hosted.
     - **(c)** Academic-record invariants need T2's operator recount after the run. The smoke itself audits that it sent no writes.
4. **PV-05 application tests:** `c7c90776`, `__tests__/preview-pv05-reanchor.test.ts` (17, passing against unchanged app code).
   - **Contract for T2's re-anchor:** approval bindings hash `startsAt`/`endsAt`, so a re-anchor must create **new** approval rows and **new append-only** audit rows. Updating audits conflicts with immutability (Atlas B3). Moving only the window or weekday admits nothing; it fails closed.
   - **Pinned behavior:**
     - stale slot links are refused;
     - old timetable ids stay unbound;
     - unrelated classes and unenrolled students are excluded;
     - invalid, expired, revoked and not-started windows are refused;
     - no writes.
5. **Execution safety (founder and Atlas):** `7752abbe`→`bb9f548c` (no page fallback) and `90fd5f9b`→`16f598f4` (validated messages, `messageerror`, fail closed), with evidence `4286b735`.
   - **Student execution remains disabled:** no flag was added, CODE blocks remain grades 6–12 Computing only, and none exists in the 8 G4 packages.
6. **Evidence:** focused run at `d4fa0f8c`: 107 files, 1,327 passed, 0 failed, 9 existing skips. Scoped tsc, eslint and `audit:api-routes` all PASS.

## Integration notes

- **Combined CI:** every listed fix changes served source (`lib/db.ts`, `lib/database-target.ts`, `lib/previewSideEffects.ts`, `lib/auth.ts`, `lib/demo/reset.ts`, 4 demo routes, `runInWorker.ts`). Any successor candidate needs your full private CI plus the browser run on its exact SHA.
- **Sequencing:**
  - PV-06 can be split out if Atlas or the founder defer it.
  - If PV-06 ships, the smoke's `SESSION_ABSOLUTE_BOUND` expects 8 h. On `26026ca6` it reports FAIL `over_8h_pv06_absent`, which is the expected result there.
- **Operator check before deploy:** with PV-01/02 active, the Preview refuses to start if the stored URLs lack `sslmode`. Run: `node --import tsx artifacts/t1-preview-app/check-app-db-guard.ts --env-file C:\liberia-learn\.env.preview.local`.
