# T1 → CoS (for Atlas): Preview Revision 3

- **Branch:** `fix/t1-preview-app-readiness`
- **Worktree:** `.task-worktrees/t1-preview-app`
- **Base:** `8c5ac01f` (code `5daefe7c`)
- **Status:** local and unpushed.

Nothing was merged, deployed, pushed or run against a host, and no hosted or Vercel setting was changed.

This revision covers:
- `COS-T1-ATLAS-REVISIONS-ROUTING-20261102.md` items 1–6;
- `COS-T1-T2-REVIEW-FINDINGS-ROUTING-20261102.md` items 1–4.

PV-01..04, PV-06 and the worker/LL Code fixes are unchanged; their regression suites are listed under Priority 4 below.

## Exact chain (RED → GREEN)

| # | SHA | Kind | Scope |
|---|---|---|---|
| 1 | `5acb2584c2b16672de4bc5211e3ee3304c6228e9` | RED | identity ordering, scanner, B5 route tests (+ unwired `recordsFreeze.ts`, public list) |
| 2 | `d650f02154f2bbb4e4078735c0b882a08636214f` | GREEN | route reordering + new freezes, `admin/school`, `safeError.ts`, route-policy |
| 3 | `a6a4b486cd3a9d18ee5ba48db88537f7c9e8a53d` | RED | audit guard / records freeze on the installed client |
| 4 | `94ae25cd99bc134ac2f65b57bfd231cbe4688a1f` | GREEN | `lib/db-guards.ts`, `lib/db.ts` |
| 5 | `3b97fd1f96c730efc2e3901d8a61bd9634e47373` | RED | hosted smoke acceptance |
| 6 | `e13c53cc98bcf53d716d416686effc77a26c7d3e` | GREEN | smoke lib + CLI |
| 7 | (this doc + evidence) | docs | `artifacts/t1-preview-app/T1-PREVIEW-REVISION-3.md`, `r3-*.json`, `r3-focused-evidence.txt` |

**Code head: `e13c53cc`.** The docs head is the commit that adds this file.

| RED commit | RED result | GREEN result |
|---|---|---|
| 1 | r3 route suite 86 fail / 55 pass (all controls pass); scanner 1 fail (real tree) / 33 pass | r3 141/141, scanner 34/34, legacy freeze 172/172 |
| 3 | 23 fail / 6 pass. Reproduces Atlas: root upsert and interactive-tx mutations reach the engine; no Preview record refusal | 29/29; `audit-immutability` 7/7; `preview-hosted-db-guard` 22/22; `factoryGapClosure` 6/6 |
| 5 | 11 fail / 33 pass | 44/44 |

**Test edits made after the RED commit:** the r3 file changed between commits 1 and 2 in two places only.
1. `admin/school` unauthenticated and wrong-role cases compare status plus a fixed code, because Preview error text is now sanitized by design. Every other route remains byte-identical to Production after normalizing UUIDs and timestamps.
2. The legacy `preview-identity-freeze.test.ts` no longer asserts "authority never called", since that ordering is the one Atlas rejected. Superseded blocks point to the r3 and scanner suites.

**Focused regression.** Each file was run on its own with `--maxWorkers=1`. Per-file counts are in `r3-focused-evidence.txt`.
- 26 existing test files for the changed routes: all pass (308 tests).
- Priority 4 set: all pass. The set covers `preview-*` boundary suites, PV-05, session policy, DB guard, `llcode-*` worker fail-closed and no page fallback, environment, `demo.reset`, `g4-school-day-*`, `content-factory-v4/pilot-preview*` and G4 admission.
  - DB-backed cases skip without a database: `pilot-preview-db` 8 skipped, admission 1 skipped.
- `audit:api-routes` PASS: 143 changed routes declared.

## Priority 1: identity freeze (security coverage inventory)

**Ordering contract.** On a protected route the freeze runs after the existing authority checks and before body parsing, provider or data work. Only `PREVIEW_PUBLIC_IDENTITY_ENTRY_POINTS` (8 routes) refuse first.

The direct-handler tests check, per route:
- the authorized Preview caller gets 403 with the code, and body, DB and provider are never touched;
- unauthenticated and wrong-role responses are identical to Production;
- authorized Production proceeds past the guard (reads the body or reaches data work);
- the `staging`, `DEMO_MODE=true` (Preview and staging) and Production+`DEMO_MODE` variants behave as expected.

| Class | Routes |
|---|---|
| Protected, `PREVIEW_IDENTITY_FROZEN` after authority (21 reordered) | oneroster import, `admin/import`, `import/confirm`, `import/batches/[id]/credentials`, `onboarding/import-students`, `onboarding/import-teachers`, `admin/students` POST, `admin/teachers` POST/PATCH, `admin/guardian-link`, `admin/invites`, `onboard/invite`, `rollout/invite/{teacher,student,student/bulk}`, `students/[id]/generate-reset-code`, `admin/credentials/send`, `admin/schools/pending`, `platform/security/{accept,demote}`, `admin/security/mfa/recovery/reset` |
| **New** in R3 (identity) | `platform/security/transfer` (after MoE platform + step-up), `student/change-pin` and `teacher/change-password` (CoS decision), `guardian/link` (**found by the new scanner**: consumes a GUARDIAN_LINK invite and upserts StudentGuardian) |
| `admin/school` | whole PATCH frozen after `requireSchoolAdmin` and before body parsing. All five actions and malformed bodies (`{not json`, empty, unknown action) are frozen. Preview GET/PATCH errors are fixed codes only (`UNAUTHORIZED` 401, `FORBIDDEN` 403, `BAD_REQUEST` 400, `INTERNAL_ERROR` 500); an injected freshness-error marker is not returned. Production text is unchanged (test). |
| B5 route level, `PREVIEW_RECORDS_FROZEN` after authority | `admin/students/[id]` PATCH (class move); `admin/enrollment` POST/PATCH |
| Public (refuse first) | `register/student`, `register/guardian`, `guardian/register`, `enroll`, `auth/forgot-password`, `auth/reset-password`, `auth/reset-with-code`, `onboard/accept` |
| Reviewed, not frozen | `auth/[...nextauth]`. `lib/auth.ts#authOptions` callbacks are the only NextAuth provisioner and are non-propagating in the scanner. Acceptance still depends on the hosted `CREDENTIALS_ONLY_PROVIDER` check. |

### Scanner coverage and limitations

The scanner is `__tests__/helpers/identityFreezeScanner.ts` and replaces the 5daefe7c regex/substring guard. The full inventory is in `r3-scanner-inventory.json`: 2,094 files, 31 provisioning handlers, 0 offenders, 0 unreviewed.

**How it works:**
- Parses every `app/` and `lib/` module with the TypeScript compiler.
- Each top-level declaration is a unit; nested functions belong to their unit.
- References resolve across files to a fixpoint through:
  - named and aliased imports;
  - default imports;
  - namespace members (`ns.fn`);
  - re-exports and `export *`;
  - literal dynamic imports;
  - callback references.

**What counts as an identity write:**
- create/createMany/createManyAndReturn/upsert on user, account, session, verification/reset/invite/privileged/transfer models;
- any write on the credential, token or privilege models;
- `user.update*` setting `hashedPwd`, `role`, `isPlatformAdmin` or `passwordChangedAt` (or using a spread);
- any non-boolean `hashedPwd:` property, which catches nested writes.

Property and element access are both read, so whitespace and `["user"]` are seen.

**Per-handler rule.** Each exported HTTP handler (including wrapped arrows and re-exported handlers) and each `"use server"` export that provisions must contain `const x = previewIdentityFrozen(); if (x) return x;`:
- at the top level of the body or of a top-level `try`, never inside a branch;
- bound to the real export of `@/lib/preview/identityFreeze` (aliases and namespaces are allowed; a local look-alike or another module's function is not);
- before every provisioning reference and every `req.json/formData/text/arrayBuffer/blob` read;
- after an authority call on protected routes: `requireUser/Role/PlatformAdmin/PrivilegedStepUp`, `requireMoePlatformAdmin`, `getServerSession`, or any local or imported helper that reaches them.

**Unknown shapes need explicit review:**
- `UNKNOWN_COMPUTED_MODEL_WRITE`;
- `UNKNOWN_USER_UPDATE_DATA`;
- `UNKNOWN_DYNAMIC_IMPORT` (computed specifier);
- `UNKNOWN_NAMESPACE_MEMBER`.

One review is recorded: `admin/guardian-link` POST, which builds its user data object dynamically and is frozen.

**Detector regressions (34 tests):**
- T2's 8 cases verbatim, from `completeness-mutations.cjs`, including the ordinary-writer control;
- 16 further escape forms;
- 3 ordering offenders (body before guard, write before guard, guard before authority);
- 1 unknown-shape case;
- 3 positive placements;
- 3 real-tree tests (no offender, no unreviewed shape, known entry points detected).

**Limits:**
- Calls through properties of non-namespace objects, callbacks stored in data structures, `eval`/`Function`, runtime model names (beyond the REVIEW classes) and raw SQL are not resolved.
- A provisioning unit is detected by syntax, not by data-flow proof.
- School-lifecycle actions such as `schools/pending` approve/reject write `School.status`, not identity models. They are frozen at route level (tested) and at the data layer (School is a frozen record model), but the scanner does not classify them as provisioning.
- Credential reveal and delivery (`import/batches/[id]/credentials`, `credentials/send`) are covered by the direct tests, not the scanner.

## Priority 2: audit immutability (`DB-AUDIT-USE-INERT`, app side)

**Implementation.** `lib/db-guards.ts` uses the supported query extension (`$extends` with `$allModels.$allOperations`) on the root and RDS clients.

**Prisma compatibility.**
- Installed `@prisma/client` package is 6.19.2; the generated runtime reports 6.19.3.
- `$use` is undefined, which the test asserts.
- Extended clients keep the PrismaClient type: query extensions do not change method signatures. No app code uses `$on` or `$use`; the only `$use` is a doc comment in `lib/agents/triggers.ts`, which is also inert.

**Evidence method.** The tests run the real generated client from `lib/db.ts` with its engine replaced by a recorder, so nothing connects.

| Path | Result |
|---|---|
| Root AuditLog update / updateMany / updateManyAndReturn / upsert / delete / deleteMany | refused before the engine, `AUDIT_LOG_IMMUTABLE` (message kept: "AuditLog mutations are forbidden") |
| Interactive transaction, each of the six | refused. The engine sees only `start` → `rollback`, never `commit` and no query. |
| Batch transaction, each of the six | refused before the batch is sent |
| AuditLog create / findMany, root and interactive | reach the engine (append and read preserved) |
| `ENABLE_AUDIT_IMMUTABILITY=false` | all six pass through. The DB trigger remains the net. |
| Inert `$use` audit + 8s timeout race | removed |

**Timeout.** The removed race could never cancel DB work. Bounded queries need a server-side `statement_timeout`; I propose it as a T2/CoS DB-plan item. I added no client timeout.

**Test doubles** without `$extends` keep an equivalent root wrapper, so the existing `audit-immutability` suite passes unchanged.

### B5 default refusal at the data layer

`PREVIEW_FROZEN_RECORD_MODELS` lists 46 models. On `VERCEL_ENV=preview|staging`, every write op is refused with `PREVIEW_RECORDS_FROZEN` (403), on the root client and in interactive and batch transactions. `DEMO_MODE` does not reopen it; Production and local are untouched.

| Group | Models |
|---|---|
| Roster | School, Class, Student, StudentGuardian, Enrollment, AcademicEnrollment, AcademicYear, Term, TeacherAssignment, TeacherLessonAssignment, Timetable, TimetableAssignment |
| Grades and assessment status | Grade, GradedSubmission, Assessment, AssessmentAttempt, AssessmentAttemptDetail, Submission, AssignmentSubmission, HomeworkSubmission, Exam, ExamAttempt, ExamCertification, Certificate, ReportCard, Transcript, GradePipelineJob, PortfolioCredential |
| Mastery and progress | MasteryRecord, StudentMasteryProfile, AdaptiveMasteryRecord, MasterySnapshot, DerivedStudentProgress, StudentProgress |
| Attendance | Attendance, AttendanceRecord |
| Sync/lab | LabSession |
| Advisory | Intervention, InterventionChain, InterventionLog, InterventionRecommendation |
| Placement and promotion | PlacementSession, PlacementSessionItem, PlacementReview, PlacementDecision, PlacementTest |

- **Excluded on purpose:** User and session models, because sign-in writes them and the identity freeze owns them. AuditLog appends are also excluded.
- **Static inventory:** 64 route files and 28 lib files write these models directly (`r3-records-write-inventory.json`). All of them now fail closed on Preview without per-route edits.
- **Admitted synthetic write set: empty.** The reviewer journeys' GET routes contain no write calls (checked: `/learn/day`, learning-preview, teacher schedule GET, advisory, admin students/placements/report-cards GET).

**Not covered, by construction.** Raw SQL, nested writes through another model, and separately constructed clients (seeds, scripts) are outside the extension. The application guard is **not** a substitute for T2's triggers, grants or RLS. Real-database rollback and trigger proof belongs to the CoS combined-CI DB matrix and T2's scratch-Postgres plan; the local scratch Postgres on :55432 was down after the shutdown and was not started.

## Priority 3: hosted smoke acceptance

**Credentials.**
- `REQUIRED_ROLES` is student, teacher and admin. `Smoke.run` throws `smoke_required_credential_missing:<roles>` before any request when a required credential is undefined, empty or blank.
- The CLI prompt (`acceptPromptAnswer`) aborts on an empty required answer.

**Required-check set (`requiredCheckIds()`, 67 ids, or 76 with `--browser`):**
- public surface and headers;
- 3 cron and 3 dev-surface refusals;
- per required role: sign-in, cookie flags, 8h bound, logout clears cookie, logout session empty;
- 8 package identities and 8 players;
- read-only probe;
- student, teacher and admin allow/deny checks;
- `IDENTITY_PROVISIONING_FROZEN`;
- `SMOKE_SENT_NO_WRITES` and `NO_PRODUCTION_IDENTIFIERS`;
- with `--browser`: 9 browser checks (3 widths × 3).

**`acceptance()`:**
- FAIL if any check fails;
- INCOMPLETE if a required check is missing or not PASS;
- otherwise PASS.

Only declared optional checks may skip: the foreign-teacher cross-school checks (reported in `openOptional` and never closing tenant isolation) and `LOGOUT_COPIED_COOKIE:*` (an honest LIMITATION). `summarize().ok` means verdict PASS, and the CLI exits 0 only on PASS.

**Tests cover:** none missing, each missing individually, failed login, a missing required result, a SKIP on a required check, browser absent/FAIL/PASS, the optional SKIP reported open, and a successful 3-role control.

**Transport is unchanged:** in-process fetch with the OIDC trusted-source header, never `vercel curl`, no bypass secret (existing static tests pass). **Not executed against any host.**

## Remaining questions for Atlas

1. **Own-credential placement.** `change-pin` and `change-password` freeze after `requireRole` authentication and before body or DB work, matching the protected-route contract. T2 suggested before authority; CoS said before DB work. Is after-authentication acceptable?
2. **Rate limiting.** In `onboard/invite` and `rollout/invite/{student,teacher}`, `checkRateLimit` still runs before authority, as in Production. Is a counter increment ahead of the freeze acceptable?
3. **Body-dependent tenant checks.** Some checks run after the freeze (`import/confirm` and `enrollment` use `resolveAdminSchoolScope(body.schoolId)`). On Preview a foreign-tenant caller gets the freeze 403 rather than the tenant 403. It is still a denial with no body read. Acceptable?
4. **Frozen model set.** Confirm the membership, especially the content-like Exam, Assessment and PlacementTest, and StudentProgress. If any reviewer journey turns out to write one, hosted smoke reports a FAIL rather than a silent write.
5. **Safe errors.** Fixed-code Preview errors are applied to `admin/school` only. Other routes whose catch returns `err?.message` (for example transfer, `admin/students/[id]`, change-password) can still surface a raw `requireUser` infrastructure error on Preview. Do you want a repo-wide Preview error policy? That is a wider change.
6. **Scanner limits** as listed above. Should the scanner also classify credential reveal/delivery and school-lifecycle writes as identity?
7. **Timeout.** Is removal plus a proposed server-side `statement_timeout` (T2/CoS) acceptable for the "bounded query" requirement?

## Evidence limits

- Local, focused runs only, one file at a time under low RAM (about 1.5–2.6 GB free). They resolved the main checkout's `node_modules` through the junction; this is not frozen-lock CI.
- No full tsc, build, browser run or Atlas harness run was performed.
- Combined-candidate CI (CoS) must still run the full matrix on the composed SHA.
