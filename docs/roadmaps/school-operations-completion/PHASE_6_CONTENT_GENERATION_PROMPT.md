# Phase 6 — Missing Content Generation

## Required First Step

Read:
- `docs/roadmaps/school-operations-completion/CURRENT_EXECUTION_STATE.md`
- `docs/roadmaps/school-operations-completion/AGENT.md`
- `docs/SYSTEM_COMPLETE_SIGNOFF.md`

Inspect before writing. Resume only if Phase 5 is complete and safe to proceed.

## Hard Rules

- Run audit first.
- Dry run first.
- Provide cost estimate before generation.
- Require human approval before real generation.
- Do not auto-approve generated content.
- New generated content must start as `DRAFT` or `NEEDS_REVIEW`.
- Do not overwrite approved content.
- Do not duplicate existing lessons.

## Objective

Use the Phase 5 year-readiness report to fill missing curriculum only after audit, dry run, and explicit approval.

## Required Inputs

- `scripts/audit-curriculum-year-readiness.ts`
- Year readiness dashboard data from `/api/admin/curriculum/year-readiness`
- Existing generation services and safety gates

## Exit Condition

Phase 6 is not complete unless:
- dry run completed
- cost estimate reviewed
- approval obtained
- generated content remains review-gated
- all gates pass
