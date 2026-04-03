# AGENTS.md
# LiberiaLearn — Agent Execution Rules
# This file is ALWAYS read first. Every session. No exceptions.

## IDENTITY

You are executing the LiberiaLearn National Scale
Completion Plan. This is a real production platform
for Liberia's Ministry of Education — not a demo,
not a portfolio project. Treat every decision as if
1.5 million students depend on it.

## MANDATORY FIRST STEPS (every session)

1. Read this file completely
2. Read EXECUTION_PLAN.md completely
3. Read docs/roadmaps/CURRENT_EXECUTION_STATE.md
4. Run: git branch --show-current
5. Run: git status
6. Confirm current state matches CURRENT_EXECUTION_STATE.md
7. If mismatch: stop and report the discrepancy
8. Then and only then: begin execution

## EXECUTION RULES

1. Execute sprints IN ORDER as defined in EXECUTION_PLAN.md
   Never skip a sprint unless marked SKIPPABLE.

2. After each sprint phase, run the PHASE VALIDATION:
     npx tsc --noEmit
   If this fails: STOP. Fix before continuing.

3. After each full sprint, run the FULL VALIDATION GATE:
     git add -A
     npx tsc --noEmit
     npx vitest run
     npm run build
   If ANY of these fail: STOP. Report. Do not continue.

4. After each successful sprint:
     git commit with the exact message in the sprint
     git push origin main
     Update CURRENT_EXECUTION_STATE.md

5. Before ending ANY session (success or failure):
   Update CURRENT_EXECUTION_STATE.md with:
     - Current sprint
     - Last completed phase
     - Last successful validation output
     - Exact next step
     - Any blockers
     - Files changed this session

6. NEVER lower test quality gates to make tests pass.
   NEVER comment out failing tests. Fix them or stop.

7. NEVER modify existing passing tests unless the sprint
   explicitly requires it and explains why.

8. NEVER use npx jest — this project uses Vitest only.

9. NEVER call OpenAI or Groq directly — always use
   routedCompletion() from lib/ai/routedCompletion.ts

10. NEVER use getServerSession() directly — always use
    requireUser() from lib/auth

11. NEVER hardcode school IDs — use DB lookup or env vars

12. ALL multi-step DB writes must use prisma.$transaction()

13. External infrastructure blockers (AWS secrets, env vars,
    external services not available in this environment):
    - Document exactly what is missing
    - Output: SPRINT [N] BLOCKED — [exact reason]
    - Continue to next sprint ONLY if block is external
    - Stop if block is a code failure

14. Branch discipline — every sprint:
    - Start from main
    - Create the branch specified in the sprint
    - Merge back to main after validation passes
    - Confirm: git branch --show-current

## CODE QUALITY RULES

- Auth: requireUser() — not requireRole() or getToken()
- LLM calls: routedCompletion() — never direct
- Feature flags: lib/serverFlags.ts (server)
              lib/featureFlags.ts (client)
- Migrations: Shadow DB unreachable. Create SQL manually
              → npx prisma db execute
              → npx prisma migrate resolve --applied
- PowerShell: Never pipe Get-Content into Select-String
              Use -LiteralPath for bracket paths
              Prefer single-line commands

## OUTPUT FORMAT (end of every sprint)

  SPRINT [N] — [NAME]: [COMPLETE/BLOCKED/FAILED]
  ─────────────────────────────────────────────
  Files changed: [count] ([list key files])
  Tests: [X passing], [X test files]
  Build: PASS/FAIL
  Blocker: [none / description]
  Next sprint: [N+1] — [NAME]
  CURRENT_EXECUTION_STATE.md: UPDATED

## RESUME PROMPT (use this every new session)

  Read AGENTS.md, EXECUTION_PLAN.md, and
  docs/roadmaps/CURRENT_EXECUTION_STATE.md.
  Resume execution from the current state.
  Follow the agent execution protocol strictly.
  Update CURRENT_EXECUTION_STATE.md before ending.