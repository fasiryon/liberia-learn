# AGENTS.md

## Project identity
LiberiaLearn is a national-scale education platform.

## Files to read
1. CLAUDE.md
2. docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md
3. docs/roadmaps/CURRENT_EXECUTION_STATE.md
4. docs/agents/ADVISOR_ESCALATION_CONTRACT.md

`docs/roadmaps/MASTER_EXECUTION_PLAN.md`, `rules.md`, and `SPEC.md` are
historical references and are superseded for live execution.

## Rules
1. Resume from CURRENT_EXECUTION_STATE.md
2. Do not skip sprints
3. Execute no more than one sprint per unattended cycle
4. Stop at every standing or sprint-specific escalation point
5. Independently re-verify at least one concrete success claim at every gate
6. Unattended work uses a dedicated branch and never commits directly to main
7. Validate:
   - npx prisma generate
   - npx tsc --noEmit
   - npx vitest run
   - npm run build
8. Stop on code failure
9. Never weaken RBAC, tenant isolation, audit logging, or cost controls

## Validation cadence
- During implementation, use `npm run validate:changed` after a coherent edit.
- The changed-file validator runs focused tests, incremental TypeScript, Prisma
  checks when schema files changed, and `git diff --check`. It never runs a
  production build.
- Run the complete Rule 7 gate once at the final sprint gate, in CI, or before
  a staging/release decision. Do not repeat full builds after every edit.

## Output
- sprint
- status
- files changed
- validation results
- next step
