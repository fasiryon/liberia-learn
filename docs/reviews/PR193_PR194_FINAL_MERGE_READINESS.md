# PR #193 and PR #194 — final review, validation and merge readiness

Repository `fasiryon/liberia-learn` · review date 2026-10-16 · reviewer: Claude (AI engineering
review). This report is not an independent human GitHub approval and must not be counted as one.

## 1. Exact heads

| | Branch | Reviewed head (origin, CI-green) | Repaired head (local, not pushed) |
| --- | --- | --- | --- |
| PR #193 Assessment Architecture V2 | `feat/assessment-architecture-v2` | `f5ec97099de1d856cc79cd7d6068685f8af2649c` | `dd85685001fe3a62c2c561680cb55a8c997497a4` |
| PR #194 Academic Records & Promotion V2 | `feat/academic-records-promotion-v2` | `0a8e32145c176c03133bfd93cfae3d20de5d929b` | `420e4d6115bd9a9a01ffcf995d527cd415222cbb` + the docs-only commit that adds this report |
| `main` | | `a1508cea` (unchanged during review) | |

Repair commits:

- PR #193: `b29988c9` (assessment repairs) and `dd856850` (smoke-test mock for the new conditional claim).
- PR #194: `dbabb63d` (official-grade authority and appeals) and `420e4d61` (mastery boundary).

**The repaired heads are local only.** A push to either PR branch starts a Vercel preview
deployment (the `Vercel` commit status on both reviewed heads reads "Deployment has completed").
Preview deployment is outside this mission's authorization, so nothing was pushed.

The previously reported repairs are present at the reviewed heads (`89cfe632`, `f5ec9709`,
`465df596`, `bc888175`, `0a8e3214`). The reviewed heads were also checked against `refs/pull/193/head`
and `refs/pull/194/head`.

## 2. Findings and repairs

Each repair was made test-first: a failing regression test came before the narrow fix.

### PR #193

| # | Sev | Finding | Repair |
| --- | --- | --- | --- |
| A1 | P1 | `recordModeratedScore` returned `SCORED` for the first human mark on SUMMATIVE or EXAMINATION work. `scoreAttemptForm` therefore finalized a high-stakes form total from one marker, even though `verifyObservation` refused the same score. | A first mark that needs second marking stays `PENDING_HUMAN_MODERATION`. Only an agreed second mark or an examiner reconciliation produces `SCORED`. |
| A2 | P2 | A second mark or reconciliation could pass a different moderation policy, for example a 100% tolerance. | Both require the first mark's policy id and version. |
| A3 | P2 | `summarizeObjectiveEvidence` ignored admitted evidence (it under-reported, so it failed safe). | Admitted evidence counts as verified, once per response. |
| A4 | P2 | After submission the gateway still accepted ONLINE responses backdated by the client clock. | After submission only OFFLINE captures made before the submission are accepted. |
| A5 | P2 (pre-existing) | The legacy exam submit checked `submittedAt` and then wrote unconditionally. Two concurrent submits could both be graded, and both could issue a certificate. | The write is a conditional `updateMany` (`submittedAt: null`). A lost race returns 409 and writes nothing. |
| — | Advisory | An evidence hash is an integrity checksum, not an authentication code. `resolveDelivery` compares ISO strings. | The persistence stage must be the only writer of VERIFIED and ADMITTED envelopes, and must pass canonical UTC timestamps. |

Verified sound at review: answer-key and explanation secrecy (allow-list projection on the list and
start routes), blank answers scored as BLANK (never option 0), approved question points, 409 on
question-identity mismatch, release authority and author/reviewer separation, deny-by-default
delivery, school scoping of releases and moderators, append-only ledger, idempotent replay with
conflict detection, revocation dispositions, and downstream writes pinned off
(`ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED = false`).

### PR #194

| # | Sev | Finding | Repair |
| --- | --- | --- | --- |
| R1 | P1 | The live legacy generator (`/api/admin/report-cards/generate`) still averaged every non-null `score`. That included AI scores auto-released before the fix and submissions from another school in the term window. | Submissions are scoped to the card's school. Only scores that `legacyAssignmentScoreAuthority` classifies as `TEACHER` count. |
| R2 | P1 | Teacher grade routes never set `teacherApproved`. This PR keeps auto-released submissions in the teacher queue, so a teacher who graded one there left it unverified. The student saw "AI score — not confirmed by your teacher" on the teacher's grade, the V2 classifier called it `AI_AUTO_RELEASED`, and the row never left the queue. The 72-hour job could also mark an already teacher-graded row. | Both teacher grade routes set `teacherApproved: true` and now declare a route policy. The 72-hour job skips rows with a `score` or `gradedBy`. The classifier accepts a teacher grade only when it is dated after the auto-release, because the old job left a stale `gradedBy` in place. |
| R3 | P1 | `resolveAppeal` could revise a decision to RETAIN without documented intervention, or to PROMOTE at the terminal grade. | A decision carries `interventionDocumented` and `terminalGrade`, and a revision applies the same rules as `decidePromotion`. |
| R4 | P1 (cross-PR) | `masterySummaryFromEvidence` counted verified practice (unofficial) deliveries, and single-marked high-stakes human scores, toward Secure and Advanced mastery. The integration test found this. | Only official deliveries count, and a human score that needs second marking counts only when AGREED or RECONCILED. |
| — | P2 (pre-existing, not changed) | The live `retainStudents` admin route does not require documented intervention. | LL-AEP-001 is not activated, and the V2 decision path enforces the rule. Wiring the route to V2 decisions belongs to the separately authorized activation. |
| — | Advisory | Thresholds compare the rounded percent (69.995 rounds to 70.00 and passes). Appeal `filedBy` and intervention reviewer independence are checked by callers, not the domain layer. | Confirm rounding-before-threshold with academic leadership. Enforce caller authorization at wiring time. |

Verified sound at review: the 72-hour job writes only `autoReleasedAt` through a conditional claim
(no official `score`, `feedback` or `gradedAt`). Published report cards cannot be edited through the
comment route. Report-card term and class are school-checked. Missing evidence is null, never 0%.
EXCUSED is reported apart from ABSENT. Promotion targets are a later year of the same school, and
retention closes the source enrollment as RETAINED. Only an APPROVED school-scoped policy grades.
Graduation keeps the LiberiaLearn program and national school-leaving outcomes separate.

## 3. LL-AEP-001 compatibility

- `lib/academic-policy/llAep001.ts` is byte-identical in both repaired heads and in the merge. Its
  SHA-256 is `c69ddd89e743400707ddd6e26fcda4f9cd3a6dbb137531c30eed1279572d2561`, which equals the
  digest pinned in both branches' tests. The merge has one module and no conflict.
- No other file under `lib/` defines the thresholds or weights.
- Institutional decisions are pinned by the cross-PR test:
  - passing threshold 70 and proficiency target 80;
  - Grades 4–12 weights 20/15/20/20/25 and Grades 1–3 weights 40/20/25/15;
  - `NO_AUTOMATIC_OFFICIAL_AI_GRADING`;
  - Secure requires at least 3 independent items on at least 2 occasions;
  - Advanced requires verified transfer;
  - retention requires documented, reviewed intervention;
  - graduation outcomes are recorded separately.
- Policy status remains `PROPOSED_INSTITUTIONAL_BASELINE` and `NOT_ACTIVATED`.
- Engineering assumptions still need academic sign-off (`LL_AEP_001_ENGINEERING_ASSUMPTIONS`).

## 4. Tests

| Run | Tree | Result |
| --- | --- | --- |
| GitHub Actions `build` job (npm ci, route audit, tsc, full vitest, os-vault daemon tests, `next build`, PWA E2E, Student Today fixtures) | reviewed heads `f5ec9709`, `0a8e3214` | success (runs 38981471090 and 38981488480) |
| Full vitest, 2 workers | integration `cfdca4c3` (both repaired heads) | **774 files passed, 2 skipped; 7,595 tests passed, 8 skipped, 0 failed** |
| Full vitest (first attempt) | integration before `dd856850` | 1 failure: `final-gate/smoke.all-roles` mock lacked `examAttempt.updateMany`, which A5 introduced. Fixed in `dd856850`, then the full run above was repeated. |
| Focused (assessment-v2, exams, discovery, final-gate) | `dd856850` | 16 files, 164 tests passed |
| Focused (academic-records-v2, academics, report cards, autograding, grading routes) | `420e4d61` | 13 files, 137 tests passed |
| Cross-PR integration test `__tests__/integration/assessment-records-ll-aep-001.test.ts` | integration `cfdca4c3` | 10/10 |

Skipped tests are real-PostgreSQL suites (`learning-evidence.postgres-race` and others gated on a
database) that are skipped on `main` as well.

Static checks:

| Tree | `tsc --noEmit` | ESLint `--max-warnings=0` (changed files) | API route-policy audit |
| --- | --- | --- | --- |
| `dd856850` (PR #193) | 0 errors | pass | PASS |
| `420e4d61` (PR #194) | 0 errors | pass | PASS (85 changed routes declared) |
| integration `cfdca4c3` | 0 errors | pass, every file either PR changes | PASS (88 changed routes declared) |

## 5. Production build

`next build` was run on integration `cfdca4c3` with the CI placeholder environment from
`ci.yml`. No real database or secrets were used, and `prisma generate` was skipped because neither
PR changes the schema. The linked client was already generated from it.

- **Exit 0.** All 388 static pages were generated, and type and lint validity passed.
- The only compile warnings are the existing Sentry/OpenTelemetry `require-in-the-middle`
  dynamic-require notices.
- Standalone tracing logged one non-fatal `EPERM` symlink warning. It comes from the local
  `node_modules` junction and Windows symlink permissions, not from the code.
- `scripts/labs/check-next-renderer-chunk.ts` (RX-005 A8) passed against the build.
- Not run locally: the PWA Playwright E2E and the Student Today browser fixtures (CI only).
  `os-vault/daemon` tests were not run either; neither PR touches `os-vault`.

## 6. Combined integration

Worktree `.task-worktrees/pr193-pr194-integration`, detached from `origin/main` `a1508cea`. Neither
branch was force-pushed, and nothing was pushed or merged.

- `dd856850` (PR #193) fast-forwards from main.
- Merge `080b1e64` brings in `420e4d61` (PR #194) with no conflicts.
- `cfdca4c3` adds the cross-PR test.

The test sends real PR #193 envelopes through the PR #194 boundary and checks:

- raw observations and provisional AI feedback are excluded from grades;
- revoked, unofficial and cross-school evidence is excluded or rejected;
- PR #193 refuses to verify another school's response against a school-scoped release;
- a single-marked high-stakes score is neither verifiable nor a grade entry, even when forged as SCORED;
- assisted evidence is neither admissible nor counted toward mastery;
- the verified and admitted envelopes of one response count once;
- one response is not Secure, and three independent items on two occasions are.

The test belongs on `main` once both PRs have merged. It cannot live in either branch alone,
because it imports both.

## 7. Security and academic-authority verification

- Answer keys and explanations: the allow-list projection is tested on the list and start routes.
  The client type no longer carries `explanation`.
- Official grades: only teacher, server-keyed or human-moderator authority counts. No code path
  writes an AI score into `score`. Legacy auto-released AI scores are excluded from the live report
  card (R1).
- Tenant isolation: school checks hold at release delivery, moderation, verification, the records
  boundary, report-card generation (term, class and now submissions), promotion targets, policy
  adoption and appeals.
- Mastery: only verified, independent, official, unrevoked and reconciled evidence counts
  (R4 plus PR #193 admission).
- Records: published cards are immutable through the comment route. Appeals, decisions and
  transition plans are versioned and idempotent, and RETAINED history is preserved.
- No migration was run, no production data was touched, and no grading, mastery or promotion write
  was activated.

## 8. Independent review status

- No formal GitHub review is submitted on either PR, and no reviewers are requested (public API,
  2026-10-16). Both PRs are still **draft**; `mergeable_state` is `clean`.
- Requesting reviewers was **blocked**: the GitHub connector failed to authenticate, `gh` is not
  installed, and this session had no other GitHub credentials. The founder or a maintainer must
  request reviews (see §11).
- Branch protection on `main` could not be read without authentication (HTTP 401). Required checks
  and merge permissions therefore remain **unverified**.

## 9. Outstanding blockers

1. **Push the repaired heads** (authorization needed: the push starts Vercel preview deployments).
   Until they are pushed, GitHub CI has not run on the repaired heads.
2. **Exact-head GitHub CI** on the pushed heads: full suite, build and PWA E2E. The local full suite
   and build cover the combined tree. The PWA E2E and Student Today browser-fixture steps were not
   run locally.
3. **Independent human reviews** on the exact final heads (§11).
4. **Branch protection and required checks** must be confirmed by someone with repository admin access.
5. **Mark both PRs ready for review** (they are drafts).
6. Academic sign-off on the engineering assumptions. This does not block merging the code, because
   nothing is activated.

## 10. Decisions

- **PR #193: REVISE.** The repaired head `dd856850` has no open P0 or P1 findings and passed every
  local check. It cannot be approved until it is pushed, GitHub CI passes on that exact head, and an
  independent human reviewer approves.
- **PR #194: REVISE.** Same conditions, for the repaired head `420e4d61` plus this report.

Neither PR is BLOCKED by code defects. The remaining blockers are process and authorization steps.

## 11. Next actions, safe merge order and post-merge verification

**Founder actions:**

1. Authorize the push and the resulting Vercel preview builds. Then push without force:
   `git push origin feat/assessment-architecture-v2` and
   `git push origin feat/academic-records-promotion-v2`.
   Both are fast-forwards of the PR heads.
2. Confirm the `build` check and GitGuardian are green on both new heads.
3. Mark #193 and #194 ready for review and request a human reviewer on each. Reviewers should check
   `git rev-parse` against the heads in §1 and read §2 of this report.

**Merge order:**

1. PR #193 first. It fast-forwards from `main` and carries the shared policy module and the
   exam-route security fixes.
2. Update PR #194 from `main`. A clean merge is expected, because it is identical to integration
   merge `080b1e64`. Wait for CI to pass again, then merge #194.
3. Land `__tests__/integration/assessment-records-ll-aep-001.test.ts` (integration commit
   `cfdca4c3`) in a follow-up PR.

**Post-merge verification on `main`:**

1. Confirm CI is green.
2. Run `npx vitest run __tests__/assessment-v2 __tests__/academic-records-v2 __tests__/integration`.
3. Recompute the `llAep001.ts` digest and check it against the pinned value.
4. Confirm `ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED === false`.
5. Confirm the policy `activation === "NOT_ACTIVATED"`.
6. Smoke-test as a student: start and submit an exam. Expect no `correctIndex` or `explanation` in
   the responses, and a 409 on a second submit.
7. Smoke-test as a teacher: grade an auto-released submission. It should leave the AI queue, and
   the student should see "Graded by Teacher".
8. Generate a report card for a class that has legacy auto-released rows. Their AI scores should be
   absent from the averages.
