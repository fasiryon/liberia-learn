# Agent Instructions — School Operations Completion

## Mandatory First Step
Before writing any code, read:
- docs/roadmaps/school-operations-completion/CURRENT_EXECUTION_STATE.md
- docs/roadmaps/school-operations-completion/EXECUTION.md
- docs/SYSTEM_COMPLETE_SIGNOFF.md

## Core Rules
- Inspect before writing
- Do not duplicate existing systems
- Extend existing services and UI where possible
- Preserve existing tests
- Keep multi-tenant boundaries strict
- Keep feature flags intact
- Do not introduce unnecessary new vendors
- Do not claim completion without passing gates

## Branch
feat/school-operations-completion

## Phase Discipline
Run only the current phase listed in CURRENT_EXECUTION_STATE.md.

When finished:
1. Run all gates
2. Write final phase report
3. Update CURRENT_EXECUTION_STATE.md
4. Commit with message: "phase X: description"
5. Stop and wait for next instruction

## Required Gates (every phase unless stated otherwise)
npx prisma generate
npx tsc --noEmit
npx vitest run
npm run build

## After Every Phase
Update CURRENT_EXECUTION_STATE.md with:
- phase completed
- files changed
- gate results
- risks discovered
- next phase
- whether safe to proceed

## Hard Rules

NEVER do these:
- Use Supabase Realtime, WebSockets, Pusher, Ably
- Break student.gradeLevel reads anywhere
- Rebuild CSV import from scratch
- Generate curriculum content without dry_run + approval
- Auto-approve generated content
- Push to main without explicit instruction
- Claim PASS on Day-1 gate unless real user can do it
