# LiberiaLearn Codex Execution Runbook

## Required reading order

1. Read `CLAUDE.md`.
2. Read `AGENTS.md`.
3. Read `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`.
4. Read `docs/roadmaps/CURRENT_EXECUTION_STATE.md`.
5. Read `docs/agents/ADVISOR_ESCALATION_CONTRACT.md`.

`docs/roadmaps/MASTER_EXECUTION_PLAN.md`, `rules.md`, and `SPEC.md` are
historical references. Do not use them to choose live work.

## Execution rules

1. Find the first sprint marked `PENDING` in
   `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`.
2. Execute only that sprint.
3. Inspect first before coding.
4. Extend existing validated systems instead of rebuilding prior phases.
5. Stop at the union of the standing advisor escalation contract and the
   selected sprint's named escalation points.
6. Re-derive at least one concrete success claim from live state before
   accepting a reported gate as passed.
7. Run the mandatory gate in
   `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`.
8. If any gate step fails:
   - stop
   - diagnose the root cause
   - fix only what is required
   - rerun the gate
   - do not continue to the next sprint
9. After a passed gate:
   - commit with the sprint message
   - push to the dedicated working branch
   - confirm push succeeded
   - note CI status
   - update the national rollout plan status row for that sprint:
     - `Status = COMPLETE`
     - `Gate = PASS`
     - `Commit = YES`
   - update `docs/roadmaps/CURRENT_EXECUTION_STATE.md`
   - stop
10. Never execute more than one sprint in a single unattended cycle.
11. Never skip a sprint unless explicitly told.
12. Never silently downgrade scope. Report any deviation clearly.
13. Never push unattended work directly to `main`; human review and merge are
    required.

## Stop conditions

- unresolved gate failure
- conflicting prior architecture
- ambiguous data ownership
- security or privacy risk
- migration risk
- external credentials or provider missing where live verification is required
