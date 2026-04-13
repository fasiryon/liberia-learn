# LIBERIALEARN EXECUTION PLAN

## EXECUTION PROTOCOL

1. Read `AGENTS.md`, this file, and `docs/roadmaps/CURRENT_EXECUTION_STATE.md`.
2. Resume from the sprint recorded in current execution state.
3. Execute one sprint at a time and inspect first before coding.
4. Extend validated systems; do not rebuild prior working phases.
5. Validate after each sprint:
   - `npx prisma generate`
   - `npx tsc --noEmit`
   - `npm test`
   - `npm run build`
6. Stop on any failure. Fix only the blocking issue, rerun the full gate, and do not advance to the next sprint.

## ACTIVE CLOSEOUT SEQUENCE

- Sprint 1 — Production Seeding Truth Audit + Fix: complete
- Sprint 2 — Data Architecture + Schema + Immutable Event Layer: complete locally, awaiting clean stage/commit in this checkout
- Sprint 3 — Intervention Chains + Derived Intelligence + Misconceptions: next

## BEFORE ENDING

- Update `docs/roadmaps/CURRENT_EXECUTION_STATE.md`
- Record the exact next step
- Do not silently skip or merge sprint scope
