# AGENTS.md

## Project identity
LiberiaLearn is a national-scale education platform.

## Files to read
- docs/roadmaps/IMPLEMENT.md
- docs/roadmaps/MASTER_EXECUTION_PLAN.md
- docs/roadmaps/CURRENT_EXECUTION_STATE.md

## Rules
1. Resume from CURRENT_EXECUTION_STATE.md
2. Do not skip sprints
3. Validate:
   - npx prisma generate
   - npx tsc --noEmit
   - npx vitest run
   - npm run build
4. Stop on code failure
5. Never weaken RBAC, tenant isolation, or audit logging

## Output
- sprint
- status
- files changed
- validation results
- next step
