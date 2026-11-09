# T1 → Atlas: independent review request (2026-11-02)

**Branch:** `fix/t1-preview-app-readiness` in `.task-worktrees/t1-preview-app`. It is local and unpushed, based on candidate `26026ca6`; the source head is `d4fa0f8c`.
Each repair is test-first: a RED commit, then the fix. Nothing was merged, deployed, pushed or seeded, and no flag was enabled.
**Untouched (net diff empty):** sealed packages, `curriculum/**`, `scripts/e2e/**`, `scripts/preview/**`, `middleware.ts`, `next.config.js`, `previewFlag.ts`, `learningPreview.ts`, `prisma/**`.

## 1. Database-target protection (PV-01/PV-02)

**RED `704d87f3` → fix `f6ae06e7`.** Extra cases are in `b7792859`.

`lib/db.ts` now calls `assertStagingDatabaseIsolation()` at module evaluation, before the Prisma singleton and the RDS client exist. It runs once per instance and does not enable `instrumentationHook`.

The guard in `lib/database-target.ts` now:
- accepts exactly `postgres.<ref>` or `preview_app.<ref>`, and `sslmode` of `require` or `verify-full`;
- refuses `ENABLE_RDS_DUAL_WRITE=true` in Preview/staging.

Error messages are unchanged and contain no URL.

**Tests:** `__tests__/preview-hosted-db-guard.test.ts`. It covers:
- client creation with the Production ref, a missing pin, a mismatched pin and dual-write;
- the restricted role, verify-full and the refusal matrix;
- that Production and local behavior are unchanged;
- that no secret appears in errors.

**Operator aid (no connection):** `artifacts/t1-preview-app/check-app-db-guard.ts`. Path fix: `d4fa0f8c`.

## 2. Demo-route mutations (PV-03)

**RED `83fa166e` → fix `fb993ccd`.** `DEMO_MODE=true` makes a deployed Preview classify as `demo`, not `staging`. The fix applies after the authority check, so T2's authority-first contract still holds:
- the reset routes need `ALLOW_LIVE_DEMO_RESET`;
- advance-day and simulate refuse on any deployed Preview/staging.

**Tests:** `__tests__/preview-hosted-demo-mutation.test.ts`, plus T2's `preview-demo-authority` (unchanged, passes).

## 3. Cron restriction (PV-04)

**RED `704d87f3` → fix `f6ae06e7`.** `isCronNamespace` now classifies an undecodable path by its raw prefix.

**Tests:** `__tests__/preview-hosted-failure-paths.test.ts`. It covers malformed, double-encoded (`%2563`), upper-case and `%2F` forms, plus T2's `preview-cron-*`.

## 4. Session behavior (PV-06): PROPOSED, parameters need your and CoS's agreement

**RED `d78fa5d5` (fixture `8eb47680`) → implementation `1ad19b14`.** It changes `lib/auth.ts` and adds `lib/auth/previewSessionPolicy.ts`. It applies only when `VERCEL_ENV` is `preview` or `staging`:

| Control | Implemented |
|---|---|
| Cookie `maxAge` | 8 h (Production and local stay at 30 d) |
| Absolute bound | `authTime` is stamped at sign-in and never moved by a refresh. The `session` callback returns no user at ≥8 h, or when the anchor is missing, malformed or in the future (more than 60 s skew). Every server reader goes through that callback; `middleware.ts` (`getToken`) is only an authentication gate, and data access still fails. |
| Revocation | Freshness (password, role, school, school status) is read **uncached** instead of through the 700 s cache. |
| Platform admin | Password login refused with `privileged_mfa_required`. SEC-R08 enforcement still runs first when enabled. |

**Tests:** `__tests__/preview-session-policy.test.ts` (17), plus 49 existing auth/security files (543 tests) unchanged and passing.

**Precise blockers. Not implemented, because they are impossible without a server-side session store (the SEC-R08 v2 migration):**
- **(a) Inactivity timeout.** There is no `SessionProvider`, and Server Components cannot re-issue the cookie, so a JWT `lastActivity` claim cannot advance.
- **(b) Durable logout revocation.** A copied cookie stays valid until the 8 h bound. The hosted smoke records this as `LIMITATION`, never `PASS`.

**Questions for you and CoS:**
- Is 8 h right for Preview (the v2 proposal used 8 h absolute for privileged sessions)?
- Should Preview also bound student and teacher sessions, as implemented, or only privileged ones?
- Is the uncached freshness load acceptable for Preview?

## 5. Student code execution (founder directive): student execution REMAINS DISABLED

**First repair: RED `7752abbe` → fix `bb9f548c`.** It removes both page-thread fallbacks, for a missing `Worker` and for a constructor throw such as a CSP refusal. Both now return a fixed learner-facing `RUNTIME` message in a `role="alert"` region.

**Second repair: RED `90fd5f9b` (fixture `6a008922`) → fix `16f598f4`.** Worker messages are now strictly schema-validated:
- exact version;
- bounded output and trace;
- known error kinds;
- `ok` if and only if there is no error;
- no extra fields.

`onmessageerror`, crashes and malformed messages all terminate the worker and fail closed.

**Pinned by tests:** Stop and timeout terminate the worker and suppress late output, and callers cannot raise limits or the timeout.

**Evidence (`4286b735`), unit level only:**
- the production `script-src` has no `unsafe-eval`, `unsafe-inline`, `blob:` or `data:`, and there is no `worker-src`/`child-src` override, so only the same-origin bundled module worker can start;
- the worker removes network, storage and loader globals and runs one program;
- the interpreter cannot name host APIs (existing `llcode` tests).

**Tests:**
- `llcode-worker-no-page-fallback` (4)
- `llcode-worker-fail-closed` (15)
- `llcode-sandbox-evidence` (5)
- existing `llcode` / `stem-blocks` / `registry-1.2` (48)

**Gating is unchanged and no flag exists or was added:**
- CODE_TRACE/CODE_RUNNER are registry-limited to COMPUTING grades 6–12;
- the eight Grade 4 packages contain no execution block (your probe agrees).

**Still owed before any activation:**
- a real-browser worker+CSP run on a hosted or production build;
- accessibility of the error and Stop flows under axe/keyboard;
- offline behavior;
- your independent review.

## Evidence

Focused local run at `d4fa0f8c`: **107 files, 1,327 passed, 0 failed, 9 existing skips** (`artifacts/t1-preview-app-readiness-20261102/focused-GREEN-summary.json`).

**Checks on all changed files:**
- **scoped tsc:** exit 0;
- **eslint:** exit 0;
- **`audit:api-routes`:** PASS (108 declared).

Full tsc, build and browser runs were not run (laptop rule; CoS owns CI). A composed candidate needs fresh private CI plus the browser run.

Please review each area independently. Your acceptance gates CoS integration.
