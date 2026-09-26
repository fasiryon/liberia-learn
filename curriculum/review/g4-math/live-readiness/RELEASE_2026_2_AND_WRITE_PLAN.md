# Grade 4 Math: release 2026.2 design and production write plan

Prepared 2026-09-26 on branch `feat/g4-math-governance-convergence-v1` (base `main` b3cbec30). **Nothing here has been executed. No production write has happened.** Every step in section 3 needs explicit founder authorization at the time it runs.

## 1. Where things stand

| Item | State |
|---|---|
| Release `lr-moe-g4-math-fractions-2026.1` | PUBLISHED/APPROVED in code, identity `de256495ec6f72fe8160179331c7f891d0574a2087a21163fbe28b93f9d88540`. **Unchanged** (pinned by `__tests__/learning-authority/g4-math-release-2026-2.test.ts`). |
| Lesson `ll-g4-math-fractions-equal-parts-2026.1` v1.0.0 | Bound by 2026.1. Payload sha256 `3138edc3...f447` unchanged. **Not in production** (0 rows, read-only check 2026-09-26). |
| Lesson `ll-g4-math-fractions-equal-parts-2026.2` v1.1.0 | New candidate: explicit parts-of-a-set model, practice, quiz, prerequisite check, teacher notes, governed evidence items. Payload sha256 `b9a2b08e2696d44d37cf1be222d36a78a2d54a398246a7d8978aabfef7381be8`. PENDING founder review. |
| Release `lr-moe-g4-math-2026.2` | Candidate, composed by `composeGrade4MathRelease2026_2` in `lib/learning-authority/releases/grade4Math2026_2.ts`. Today `IN_REVIEW/PENDING`, which `validateOntologyRelease` refuses. Not registered in `publishedReleases.ts`. |
| Review ledger | 0/44 decided. Nothing is founder-approved in the ledger. |
| Target `LR-MATH-G4_6-02` | Not in production. Spec `lr-math-g4_6-02.target.json`, `verificationStatus PARTIAL`. |

**Live defect to know about (not fixed here, needs a decision):** release 2026.1 is registered and binds a lesson for the equal-parts concept, but that lesson is not in production. `GET /api/student/learning-authority/next-action` looks the lesson up whenever the selected action's concept has a lesson binding, and throws `governed_lesson_unavailable` (HTTP 503) when it is missing. A new Grade 4 learner's first action is the equal-parts diagnostic, so the endpoint returns 503 for that learner today (traced in code; not reproduced against production). Whether any production Grade 4 learner reaches this endpoint was not checked: no production read was made in this session. Publishing either fractions lesson (step 3.1) removes it.

## 2. Release 2026.2 design

**Principle:** a release identity never changes meaning. 2026.1 stays byte-identical because learner evidence can carry its identity hash. Everything new goes into 2026.2.

**Composition (deterministic, reproducible):** `composeGrade4MathRelease2026_2({ ledger, approval })`

1. Carry forward every 2026.1 concept, prerequisite, item, construct binding, evidence policy and tool policy **verbatim**: same ids, same versions, byte-equal objects. An item id never changes meaning across releases.
2. Add each reviewed addition only if its MOE objective has `APPROVE` in `review-ledger.json`. Today there is one prepared addition (parts of a set): lesson 2026.2 v1.1.0, which replaces the 2026.1 content binding, plus four PRACTICE items (`g4-frac-practice-part-of-whole`, `-part-of-set`, `-unequal-parts`, `g4-frac-check-denominator-meaning`, all v1.0.0) bound to `g4-fractions-equal-parts` under the existing practice evidence and tool policies.
3. Never include `DRAFT_UNREVIEWED` lessons. A draft with `APPROVE` is still excluded until its promotion is authored (a concept linked to its MOE objective plus governed items built from its quiz, diagnostic and exit assessment). The manifest says why each exclusion happened.
4. Pin every bound lesson's payload: 2026.2 content bindings carry `contentSha256`, so the release identity changes if lesson content changes. (2026.1 predates this field and is left alone.)
5. Stay `IN_REVIEW/PENDING` until a **release-level founder approval** names the exact `approvableIdentity`. A different identity, a blank reviewer, or no approved addition leaves it unexecutable.

With only the fractions addition approved, the composed release is:

| Kind | Id @ version | sha256 (first 12) |
|---|---|---|
| ITEM (carried) | g4-frac-diagnostic-equal-parts@1.0.0 | 3c73bd555847 |
| ITEM (carried) | g4-frac-practice-equivalence@1.0.0 | bd851cc72d99 |
| ITEM (carried) | g4-frac-diagnostic-compare@1.0.0 | 50dbae78c2e1 |
| LESSON | ll-g4-math-fractions-equal-parts-2026.2@1.1.0 | b9a2b08e2696 |
| ITEM | g4-frac-practice-part-of-whole@1.0.0 | c923ad0e8073 |
| ITEM | g4-frac-practice-part-of-set@1.0.0 | 584c13ad0cfc |
| ITEM | g4-frac-practice-unequal-parts@1.0.0 | 99b5933e8477 |
| ITEM | g4-frac-check-denominator-meaning@1.0.0 | 52b155054a83 |

Approvable identity for that composition: `2e790d5842519b5874f3d971ee9aa64cff36369bf717abec7563e28d5be28752`. Any later change to the lesson, the items or the ledger-selected set gives a different identity, and an approval of this one no longer executes.

**Code work required before 2026.2 can be registered** (each is a reviewed PR, none done yet):

| # | Change | Why |
|---|---|---|
| R1 | Record the release approval (a reviewed file such as `curriculum/review/g4-math/release-approvals.json`) and export the approved composition. | Human input; the composer never approves. |
| R2 | Template cell v2 (`cell-g4-math` with `releaseId` 2026.2 and the 2026.2 lesson as GOVERNED) and register it in `governedInventoryRuntime.ts` CELLS. | Inventory is built per release; no cell means `inventory_cell_missing`. |
| R3 | Learner routing: `publishedReleaseForLearner` returns the first release for a grade. Registering 2026.2 next to 2026.1 needs an explicit current-vs-replay-only distinction, and every caller that omits a release (`compatibilityRelease()` fails closed at 2 releases) must pass one. | 2026.1 must stay registered so its evidence can still be replayed (`replayStudentConceptState` resolves the release by id). |
| R4 | **Founder decision, then a STOP-level review:** mastery continuity. Evidence is scoped to a release identity, so learners start 2026.2 with empty concept states unless a carry-forward policy maps 2026.1 evidence. That changes what mastery means across releases. | Material mastery semantics; this plan does not choose. |
| R5 | Misconception policy: `GRADE4_MATH_MISCONCEPTION_POLICY` is keyed to the 2026.1 identity, so no misconception signal fires under 2026.2 unless the governed policy is extended. | Governed educational policy change; founder decision. |

## 3. Production write plan (ordered)

Dependency order differs slightly from the mission's list: lessons must exist in production **before** a release that binds them is deployed, or the route returns 503 (see section 1). The learning target is optional at runtime (no runtime code reads it) and depends on a published lesson.

Environment rule for every step: `.env`, `.env.local` and `.env.production` in the main checkout all point at production (`bnphuinpvgpmebcsvmsp`). Run nothing from a shell that has loaded them unless the step says so.

### 3.1 Publish a reviewed fractions lesson

Founder chooses **one** path (decision D1):

- **Path A, now:** review `ll-g4-math-fractions-equal-parts-2026.1` v1.0.0 (unit-3.md §3.4, first half) and publish it. Fixes the live 503 immediately under the existing 2026.1 release. The lesson has no practice set or quiz.
- **Path B, complete exemplar:** review `ll-g4-math-fractions-equal-parts-2026.2` v1.1.0 (unit-3.md §3.4, "Candidate successor") and publish it. It is only served after 2026.2 is registered (3.3), so the 503 persists until then unless Path A is also done.

| Aspect | Detail |
|---|---|
| Precondition (repo) | `review-ledger.json` entry `...-obj4`: `decision APPROVE`, `reviewer` = founder name, `reviewedAt`, `reviewedContentId` = the chosen contentId. Written by the founder, never by tooling. |
| Precondition (prod, read-only) | `select count(*) from "CurriculumContent" where "contentId" = '<contentId>';` expect 0 (or an identical row from a prior partial run). Founder `User.id` exists: `select id, email, role from "User" where id = '<id>';` |
| Dry run | `npx tsx scripts/author-grade4-fractions-authority.ts --lesson=<contentId>` prints payload sha256, idempotency keys and whether the founder review is recorded. Touches no database. |
| Apply (founder) | `DATABASE_URL=<prod> LIBERIALEARN_FOUNDER_REVIEWER_ID=<founder User.id> CONFIRM_PRODUCTION_WRITE=<contentId> npx tsx scripts/author-grade4-fractions-authority.ts --lesson=<contentId> --apply` |
| Idempotency / retry | Keys `curriculum:<contentId>:<version>`, `:submitted`, `:approved`. A re-run after partial failure completes without duplicates. |
| Verification | Query in `README.md` §1 with the chosen contentId: `status published`, lifecycle `APPROVED`, completeness `VERIFIED`, events `{SUBMITTED:, APPROVED:HUMAN_REVIEW}`; and `sha256(payload)` equals the dry-run value. |
| Rollback / revoke | Never delete. Append `REVOKED` via `appendCurriculumGovernanceEvent` (reason; `futureAssignmentPolicy BLOCK_NEW`, `existingAssignmentPolicy WITHDRAW_EXISTING`, `offlineCachePolicy URGENT_INVALIDATE_ON_NEXT_REFRESH`; actor = founder). `REINSTATED` (HUMAN_REVIEW) reverses it. |

### 3.2 Seed learning target `LR-MATH-G4_6-02` (optional at runtime)

| Aspect | Detail |
|---|---|
| Precondition (repo) | `lr-math-g4_6-02.target.json` `lessonContentId` and its `ONTOLOGY_RELEASE` evidence ref name a lesson and release that match (the script checks the release is published in code, the identity matches, the release binds the lesson and binds no other target code). Today: 2026.1 lesson + 2026.1 identity (Path A). For Path B, edit both after 3.3. |
| Precondition (prod) | The lesson from 3.1 is `published` with a HUMAN_REVIEW approval on its current revision (the script checks, in a transaction). |
| Status | `verificationStatus PARTIAL`, enforced by `__tests__/curriculum/g4-learning-target-readiness.test.ts`. It stays PARTIAL until all 44 objectives are reviewed, promoted and live-certified; the row existing does not make it VERIFIED. |
| Dry run | `DIRECT_URL=<prod> npx tsx scripts/seed-g4-learning-target.ts` (read-only transaction). |
| Apply | `DIRECT_URL=<prod> CONFIRM_PRODUCTION_WRITE=LR-MATH-G4_6-02 npx tsx scripts/seed-g4-learning-target.ts --apply` |
| Idempotency / retry | `(code, version)` unique; identical existing row is a no-op, a different one aborts. |
| Verification | `select id, code, version, "verificationStatus", "curriculumRevisionId" from "CurriculumLearningTarget" where code = 'LR-MATH-G4_6-02';` one row, v1, PARTIAL, revision = lesson's `currentRevisionId`. |
| Rollback | Unreferenced at creation: delete by id if created in error. Once referenced: supersede with v2 (`supersedesTargetId`). |

### 3.3 Register release 2026.2 (a code deploy, not a database write)

| Aspect | Detail |
|---|---|
| Preconditions | 3.1 Path B done (the 2026.2 lesson is published; otherwise the route 503s). R1-R3 merged; R4 and R5 decided. Release approval names the exact approvable identity. |
| Apply | Merge the registration PR after exact-head CI is green; Vercel deploys `main`. |
| Idempotency | Code identity is deterministic; re-deploying the same commit is a no-op. |
| Verification | On the deployed build: `GET /api/student/learning-authority/next-action` for a Grade 4 test learner returns `releaseId lr-moe-g4-math-2026.2` and the approved identity; `npx tsx scripts/certify-template-cell-v1.ts --live-gate` against a fresh read-only snapshot. |
| Rollback | Revert the registration commit and redeploy. Evidence written under 2026.2 stays valid and replayable only while 2026.2 remains registered as replay-only, so the revert must keep it registered for replay (R3), not delete it. |

### 3.4 Reviewed draft lessons and their items

For each objective the founder approves: author the promotion (concept, governed items from its quiz/diagnostic/exit assessment, content binding with `contentSha256`), which changes the 2026.2 composition and so its approvable identity (a new approval is needed), then publish the lesson through the same canonical workflow as 3.1 (a per-lesson script generalized from `author-grade4-fractions-authority.ts`, dry run by default, same idempotency-key scheme), then register the release (3.3). Same preconditions, verification and revoke path as 3.1. No draft is published today.

## 4. Decisions only the founder can make

| # | Decision | Where |
|---|---|---|
| D1 | Publish path for the fractions objective: 2026.1 v1.0.0 now (fixes the live 503), the 2026.2 v1.1.0 exemplar, or both. | section 3.1; unit-3.md §3.4 |
| D2 | Ledger decision for each of the 44 objectives (APPROVE / REVISE / REJECT), including whether to accept the proposed corrections (fraction scope 3.7/3.8, prime factors 3.3, graph measures 6.6, distractors 3.8/5.8, benchmarks 5.5, cone/cylinder models 6.5, estimate check 1.4). | `../README.md`, unit files |
| D3 | The 5 policy uncertainties: real vs example population data (1.4); grid tool vs squared paper (5.9, 2 items); THREE_D vs PRACTICAL for solids (6.5, 2 items). | `../README.md` Uncertainty dispositions |
| D4 | The 3 LiberiaLearn clarifications to adopt: "interesting lines" read as intersecting (6.1), mass/weight convention (5.5), and a human check of the page-49 column for 6.7. | same |
| D5 | Interaction reclassifications suggested for 1.1, 2.3, 6.3, 6.4 (MANIPULATIVE_2D) and 6.6 (PRACTICAL). Classification is judgment work; nothing was changed. | unit files, "Reviewer support" |
| D6 | Release-level approval of an exact 2026.2 identity (R1). | section 2 |
| D7 | Mastery continuity across releases (R4) and misconception-policy extension (R5). | section 2 |
| D8 | Target `LR-MATH-G4_6-02`: seed now against 2026.1 or after 2026.2; it stays PARTIAL either way. | section 3.2 |
