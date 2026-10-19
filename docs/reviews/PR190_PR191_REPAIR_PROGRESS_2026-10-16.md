# Joint repair progress — validation interrupted

This is an interim engineering handoff, not the requested final joint certification.
Neither PR is ready for merge on the evidence from this repair run. The original
review decisions remain REVISE. No original PR branch was changed.

## Versions and reproduced cause

Remote refs were checked again with `git ls-remote origin refs/heads/main
refs/pull/190/head refs/pull/191/head` and still resolve to:

- Main: `a1508ceaf7d89a338de624e9f63c9c4c592ca28c`.
- PR190: `45d86dc56ce4f9b02f66bae72ff773b701c32d4a`.
- PR191: `5650c4be8a9dbbb07cfbdb4d2f8312cf66443885`.

The authoritative generator was rerun in the existing isolated combined review
tree, at report commit `2da863481ccd7103d530e198b649c9fae8282bfe` (review additions
above integration `7db2e1669d7aa5f9743a39049e00805493a2930f`):

`node node_modules/tsx/dist/cli.mjs scripts/build-curriculum-v2-g7-native.ts --check`

It exited 1: `review package stale: math-number-sense-place-value/scene-manifest.json`.
PR190 commit `376df51d` changes `components/experience/demo/PlaceValueDemo.tsx`:
204 lines of the old standalone demo are replaced by a wrapper importing
`TeachingLessonPlayer`, `GRADE7_PLACE_VALUE` and `TeachingAvailability`. The
wrapper accepts availability and initial-scene inputs and delegates to the new
synthetic demo. This is a substantive referenced demo implementation change,
not generated metadata. It does not edit either v0.3.0 native candidate. The
old source hash is `d96f84969167c6376f1b040e4047fc2822ffe3771d79854918b4f042e2e726c7`;
the reviewed replacement hash is
`4772d44beda9429c659f4bf8e8c6de5e928e32b1a9dd65ab948002e73437746c`.
Do not weaken the freshness check or restore obsolete demo code to hide the mismatch.

## Isolated repair state

`repair/pr190-joint-blockers`, worktree `.task-worktrees/repair-pr190`, starts
at the exact PR190 head. Its current edits are **uncommitted and unvalidated**:

- `lib/learner-experience/assistancePolicy.ts`: shared conservative native-scene policy.
- `lib/ai/tutor/tutorContext.ts`: apply that policy to the authorized server
  lesson before generating tutor sources; refuse native requests without a
  scene; exclude protected scene text from whole-lesson grounding.
- `components/learner-experience/LessonPlayerV2.tsx`,
  `components/experience/AskTutorButton.tsx`,
  `components/rag/GlobalAssistantShell.tsx`: withhold help on independent
  scenes, pass exact scene identity on permitted help, clear previous scene
  conversations, and prevent fallback that drops native scene identity.
- `lib/learner-experience/evidenceAdapter.ts`: conservatively set the existing
  assistance boolean true with an `assistance-unverified` policy reference.
  This does not assert observed help: it prevents unknown help history from
  being classified as unaided. Raw response payloads, unassessed status and
  no-scoring/no-mastery behavior remain unchanged by the intended repair.
- `components/textbooks/TextbookReader.tsx`: disable empty-book bookmarks,
  guard their creation, and filter indices on every render before dereference.
- `lib/learner-experience/lessonText.ts` and
  `components/experience/LegacyLesson.tsx`: distinguish authored section headings
  from fallback titles and preserve a single authored heading.
- `app/student/textbooks/page.tsx`: pass the already-authorized payload to the
  title helper.
- Tests: `__tests__/student-v3-reader-repairs.test.tsx`,
  `__tests__/tutor.grounding-v2.test.ts`,
  `__tests__/tutor.route-context.browser.test.tsx`,
  `__tests__/learner-experience/evidence-authority.test.ts`.

No trusted attempt-level assistance ledger exists in this delivery seam.
Consequently these edits cannot certify independently assessed work or prevent
a learner from seeking outside help. A future governed assessment boundary
must bind assistance receipts and assessment attempts on the server. Do not
treat this conservative observation adapter as that system.

`repair/pr191-joint-blockers`, worktree `.task-worktrees/repair-pr191`, starts
at the exact PR191 head. No provenance has been regenerated. Both native
candidate files, review status, release registrations and candidate hashes
remain untouched. PR191 should be refreshed only after the final frontend
repair is validated; then run the authoritative generator and inspect the
precise generated diff. No manual hash replacement is authorized by this handoff.

There is no repair commit SHA or fast-forward delivery yet. The branch roots
are their target PR heads, but uncommitted changes are not a delivered commit.
No repair branch was pushed.

## Validation evidence and interruption

Before reader fixes, this command executed and failed all three new regression
cases (missing single heading, payload title ignored, empty bookmark enabled):

`node node_modules/vitest/vitest.mjs run __tests__/student-v3-reader-repairs.test.tsx --reporter=dot`

The subsequent edit-and-test shell command was **not executed** because automatic
approval review could not complete: the account usage limit was reached, with
the service indicating retry at 4:19 PM. This was a service failure, not an
unsafe-action determination. Its shell edits were subsequently applied through
ordinary workspace edits; its tests were not run or silently retried through a
different approval path. The separate tutor test-authoring agent also stopped
on the usage limit before returning a test result.

`git diff --check` passed during editing before the final browser-test addition.
No GREEN test result, typecheck, lint, build, route audit, full suite or browser
matrix is claimed for these repair edits. Previous review results do not
validate this changed tree.

## Required continuation

1. Restore the approval service, inspect all uncommitted diffs and run the focused
   tests. Confirm tutor tests fail on the original implementation and pass on
   repairs; verify policy/scene identity UI tests and protected text exclusion.
2. Run `npm.cmd run validate:changed`, related auth/evidence/offline tests,
   then commit focused PR190 fixes and record exact SHA and ancestry.
3. Independently revalidate Slides V2 `0360045006a544539277315add886aa6fb9f6192`
   using the real Civics content/revision from the original report. Do not merge
   its implementation into PR190. Existing recommendation remains separate,
   after repaired PR190 and before the joint student-experience release.
4. Refresh PR191 in its dedicated branch against that validated frontend;
   regenerate only via `scripts/build-curriculum-v2-g7-native.ts`, inspect
   generated diffs and verify exact candidate hashes. Repair the production
   candidate-artwork boundary with a denial guard and regression. Prepare an
   accurate v0.3.0 PR description without claiming approval.
5. Keep J07/J08 release-blocking academic recommendations explicit: require an
   independently produced conclusion and whole-structure evidence (or narrow
   the objective through qualified review), teacher remediation administration,
   and governed 7/21-day retention/transfer administration. Candidate-only
   recommendations grant no scoring, release or mastery authority.
6. Add permanent required combined-integration CI: a read-only job must resolve
   and record both dependency heads and main, merge the exact commits locally,
   run full freshness and safety gates, and fail on stale/missing dependencies
   or merge conflicts. Reusable workflow/dependency metadata should support
   future related curriculum and frontend PRs; a hard-coded one-off #190/#191
   check alone is insufficient. No deployment, write token, auto-repair or
   auto-merge. Branch-protection enforcement needs the authorized repository
   owner; no such setting has been changed here.
7. Rebuild final exact heads in a fresh integration worktree, then run all gates
   requested in the mission: full Vitest, typecheck, ESLint, build, auth audit,
   OS-vault security, PWA, Student Today, curriculum and release freshness,
   four-width candidate/keyboard/axe/offline tests and separate real Civics.
   Record failures and reruns without weakening assertions. Produce the final
   joint report only after this work.

The repair author cannot independently approve these changes. No qualified human
curriculum review, official approval or proof of student learning is claimed.
No merge, force push, deployment, migration, production-data write, curriculum
publication, scoring activation or approval bypass occurred.

## Continuation checkpoint

The approval service is available again. Status and the complete tracked diff
were inspected before work; the branch still starts at the intended PR190 SHA.
Main and both PR heads were reverified unchanged during the continuation.

The first targeted run passed 90 tests. A new mount-order regression then
reproduced a missed protected-scene event: a shell mounting after the player
could appear during independent work. The player now exposes an identity/policy
marker that the shell reads on mount. It carries no responses or answer keys.
The changed-file gate passed (79 changed tests, 331 related tests, route audit
and TypeScript). ESLint passed with existing warnings. OS-vault tests passed
4 cases with 2 Windows symlink skips. The full suite passed 769 files / 7,501
tests, with the existing 2 skipped files / 8 skipped tests.

Tests were subsequently strengthened to require the intended 403 rather than
any error, and an explicit conservative assistance flag/policy marker rather
than merely a value other than false. All 79 targeted tests passed. The reader
regression was also strengthened to remove pages while Bookmarks is already
open; its 3 tests passed. The initial four-width repair browser matrix passed;
the matching stronger browser run timed out before its first page loaded while
the production build was active. Its log is retained; its assertions and timeout
have not been relaxed. It will run again with the build idle.

The separate Slides checkout at `0360045006a544539277315add886aa6fb9f6192`
passed the real Civics six-size regression: 307 presentation pages, exact
text/order, keyboard/history, accessibility and assessment handoff. It was not
merged into PR190. The original Slides branch and earlier review checkout were
preserved; this run used `.task-worktrees/repair-slides-validation`.

The first production build exited 0 after compilation, type checking and all
391 static-page steps, but logged `EPERM` when standalone packaging attempted
to recreate the shared dependency junction as a Windows symlink. This is not
accepted as a verified standalone artifact. Its log is retained as
`artifacts/joint-repairs/build-shared-dependencies.log`.

Only this repair worktree's verified junction was removed, nonrecursively;
the shared target was preserved. `npm.cmd ci --offline --ignore-scripts`
installed 1,153 packages locally. Package manifests and lockfile are unchanged.
The canonical postinstall Vitest patch and local Prisma generation succeeded.
A fresh complete suite and production build are running on this real local
installation. Browser gates will follow with the build idle. The PWA runner
also verifies this build's manifest and refuses an occupied port.

No repair commit exists yet. PR191 content and provenance remain untouched.
The prepared integration worktree starts at verified main and contains a
read-only package comparison helper; it will integrate the final validated
repair commit and exact PR191 head before reporting which manifests are stale.
This checkpoint does not declare either PR ready or claim actual learning.

## Validation completed

The fresh full suite, standalone production build, 14 PWA cases, stronger four-width repair browser matrix and every Student Today fixture group passed. See PR190_REPAIR_VALIDATION_2026-10-16.md for commands, limitations and retained failed runs. PR191 remains untouched. Focused repair commits and the isolated combined provenance comparison follow this checkpoint.
