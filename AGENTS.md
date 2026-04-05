# AGENTS.md
# LiberiaLearn execution rules

## Identity
LiberiaLearn is a production platform for Liberia's Ministry of Education. Treat every change as production-impacting.

## Scope
This file defines execution rules only.
- `EXECUTION_PLAN.md` is the roadmap and sprint order.
- `docs/roadmaps/CURRENT_EXECUTION_STATE.md` is the live progress record.

## Mandatory session start
1. Read `AGENTS.md` completely.
2. Read `EXECUTION_PLAN.md` completely.
3. Read `docs/roadmaps/CURRENT_EXECUTION_STATE.md` completely.
4. Run `git branch --show-current`.
5. Run `git status`.
6. Confirm the branch, progress, blockers, and worktree state match `docs/roadmaps/CURRENT_EXECUTION_STATE.md`.
7. If there is a mismatch, stop normal sprint execution and report the discrepancy before proceeding.

## Execution protocol
1. Execute roadmap items in the order defined by `EXECUTION_PLAN.md`.
2. Do not skip a sprint unless the roadmap explicitly marks it skippable.
3. At the end of each sprint phase, run `npx tsc --noEmit`.
4. If phase validation fails, stop and fix the code failure before continuing.
5. At the end of each full sprint, run the full validation gate:
   - `git add -A`
   - `npx tsc --noEmit`
   - `npx vitest run`
   - `npm run build`
6. If any full validation step fails, stop and report the failure. Do not continue to the next sprint.
7. After a successful sprint, create the required commit, push the branch required by the roadmap, and update `docs/roadmaps/CURRENT_EXECUTION_STATE.md`.

## Required implementation rules
1. Never lower test quality gates to force a pass.
2. Never comment out failing tests. Fix them or stop.
3. Never modify existing passing tests unless the active sprint explicitly requires it.
4. Never use `npx jest`. This repository uses Vitest.
5. Never call OpenAI or Groq directly. Use `routedCompletion()` from `lib/ai/routedCompletion.ts`.
6. Never use `getServerSession()` directly. Use `requireUser()` from `lib/auth`.
7. Never hardcode school IDs. Use database lookup or environment configuration.
8. All multi-step database writes must use `prisma.$transaction()`.
9. External infrastructure blockers must be documented precisely. Report them as `SPRINT [N] BLOCKED - [exact reason]`.
10. Continue past a blocker only when the blocker is external infrastructure, not a code failure.

## Branch discipline
1. Start sprint work from `main` unless the live state explicitly documents a different in-progress branch.
2. Create and use the sprint branch named by the roadmap when a sprint requires branch isolation.
3. Merge back according to the roadmap only after validation passes.
4. Confirm the active branch with `git branch --show-current` before and after sprint work.

## Session close requirement
Before ending any session, update `docs/roadmaps/CURRENT_EXECUTION_STATE.md` with:
- current sprint or active workstream
- last completed phase
- last successful validation results
- exact next step
- blockers or discrepancies
- files changed in the session
- current branch
- current worktree status when it is not clean

## End-of-sprint output format
`SPRINT [N] - [NAME]: [COMPLETE/BLOCKED/FAILED]`

`Files changed: [count] ([key files])`

`Tests: [summary]`

`Build: PASS/FAIL`

`Blocker: [none or exact reason]`

`Next sprint: [identifier]`

`CURRENT_EXECUTION_STATE.md: UPDATED`

## Resume prompt
Read `AGENTS.md`, `EXECUTION_PLAN.md`, and `docs/roadmaps/CURRENT_EXECUTION_STATE.md`. Resume from the recorded current state. Follow the execution protocol strictly. Update `docs/roadmaps/CURRENT_EXECUTION_STATE.md` before ending the session.
