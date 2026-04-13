# LiberiaLearn  Codex Execution Runbook

## Required reading order

1. Read `AGENTS.md`.
2. Read `docs/roadmaps/MASTER_EXECUTION_PLAN.md`.
3. Read `docs/roadmaps/CURRENT_EXECUTION_STATE.md`.

## Execution rules

1. Find the first sprint marked `PENDING`.
2. Execute only that sprint.
3. Inspect first before coding.
4. Extend existing validated systems instead of rebuilding prior phases.
5. Run the mandatory gate exactly as written in `docs/roadmaps/MASTER_EXECUTION_PLAN.md`.
6. If any gate step fails:
   - stop
   - diagnose the root cause
   - fix only what is required
   - rerun the gate
   - do not continue to the next sprint
7. After a passed gate:
   - commit with the sprint message
   - push to `main`
   - confirm push succeeded
   - note CI status
   - update the `docs/roadmaps/MASTER_EXECUTION_PLAN.md` status row for that sprint:
     - `Status = COMPLETE`
     - `Gate = PASS`
     - `Commit = YES`
   - update `docs/roadmaps/CURRENT_EXECUTION_STATE.md`
   - stop
8. Never execute more than one sprint in a single run unless explicitly told.
9. Never skip a sprint unless explicitly told.
10. Never silently downgrade scope. Report any deviation clearly.

## Stop conditions

- unresolved gate failure
- conflicting prior architecture
- ambiguous data ownership
- security or privacy risk
- migration risk
- external credentials or provider missing where live verification is required
