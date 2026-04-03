LIBERIALEARN — MASTER EXECUTION PLAN
File: EXECUTION_PLAN.md
Version: 1.0
Last updated: 2026-04-03

════════════════════════════════════════════════════════════
AGENT EXECUTION PROTOCOL
════════════════════════════════════════════════════════════

This file contains the complete sprint sequence for
LiberiaLearn national scale completion.

RULES FOR ANY AGENT EXECUTING THIS PLAN:

1. READ THIS ENTIRE FILE before starting any sprint.

2. Execute sprints IN ORDER. Never skip a sprint unless
   explicitly marked SKIPPABLE.

3. After each sprint, run the FULL VALIDATION GATE:
     git add -A
     npx tsc --noEmit
     npx vitest run
     npm run build
   If ANY of these fail: STOP. Report the failure.
   Do NOT continue to the next sprint.

4. After each successful sprint, commit with the exact
   commit message specified in that sprint.

5. Push to origin/main after every successful commit.

6. At the end of each sprint, output:
     SPRINT [N] COMPLETE
     Files changed: [list]
     Tests: [X passing]
     Build: PASS
     Next sprint: [name]

7. If a sprint is BLOCKED by missing infrastructure
   (AWS creds, env vars, external services):
     - Document exactly what is missing
     - Output: SPRINT [N] BLOCKED — [reason]
     - Continue to next sprint if the block is external
     - Stop if the block is a code failure

8. NEVER lower test quality gates to make tests pass.
   NEVER skip failing tests. Fix them or stop.

9. NEVER modify existing passing tests unless the sprint
   explicitly requires it and explains why.

10. Branch discipline:
    - Start each sprint on main
    - Create the branch specified in the sprint
    - Merge back to main after sprint validation passes
    - Confirm with: git branch --show-current

════════════════════════════════════════════════════════════
CURRENT STATE (as of plan creation)
════════════════════════════════════════════════════════════

Tests: 1540 passing, 203 test files
Build: Clean
CI: All 5 checks green
Live: https://liberia-learn.vercel.app
Demo accounts: Seeded and verified
Migrations: All applied to production

Known issues to fix in this plan:
- ECS cluster has zero running services (silent prod bug)
- Worker SQS consumer not deployed
- Repo has clutter files
- COMPUTER_SCIENCE curriculum missing
- DISTRICT_ADMIN role not smoke-tested
- SLO tracking is in-memory only
- No ops dashboard
- No AI cost guardrails
- No environment separation beyond DEMO_MODE flag

════════════════════════════════════════════════════════════
SPRINT SEQUENCE
════════════════════════════════════════════════════════════

SPRINT 0  — Repo Hygiene
SPRINT 0.5 — ECS Worker Deployment (CRITICAL)
SPRINT 0.7 — Deployment Stability
SPRINT 1  — Ops Dashboard + SLO Layer
SPRINT 2  — AI Cost Guardrails
SPRINT 3  — Environment Separation
SPRINT 4  — Curriculum Completion
SPRINT 5  — Data Governance Audit Pack
SPRINT 6  — Scale Readiness + Incident Response
SPRINT 7  — Product Metrics
SPRINT 8  — Mobile UX Polish
SPRINT 9  — Executive Architecture Narrative

════════════════════════════════════════════════════════════
SPRINT 0 — REPO HYGIENE
Branch: fix/repo-hygiene
════════════════════════════════════════════════════════════

GOAL: Clean the repository so it looks like professional
national infrastructure, not a development workspace.

INSPECT FIRST:
  - List all files in repo root (not in subdirectories)
  - List contents of /scripts/
  - List all *.bak, *.txt, *.zip, tmp-* files
  - Check .gitignore current state

PHASE 1 — ROOT CLEANUP

Move to /archive/ (do not delete yet):
  - Any *.txt files in root (ci-log.txt, deploy-log.txt,
    pr-triage-log.txt, test-output.txt, etc.)
  - Any *.zip files
  - Any *.bak files
  - Any tmp-*.ts, tmp-*.js, tmp-*.config.ts files
  - vitest-full.json, vitest-hardening.json
  - Any LL_AUDIT*.* files
  - ._ARCHIVE_* directories → move contents to /archive/
  - _app_backup_* directories → move to /archive/
  - _audit/ directory → move to /archive/

Create /archive/.gitkeep and add /archive/ to .gitignore
so the archive itself is not committed.

PHASE 2 — SCRIPTS CLEANUP

In /scripts/, keep:
  - curriculum generation/enrichment/promotion scripts
  - audit-lesson scripts
  - db migration helpers
  - seed helpers
  - patch-vitest-offline-wildcard.mjs

Move to /archive/ from /scripts/:
  - *.txt output files
  - smoke-test-*.* scripts
  - demo-credentials.txt
  - audit-report.txt
  - One-off debugging scripts (check-*, fix-demo-*,
    reset-demo-*, patch-login-*)

PHASE 3 — GITIGNORE

Add to .gitignore:
  # Archives and temp
  /archive/
  *.log
  *.bak
  tmp-*
  vitest-full.json
  vitest-hardening.json
  ci-log.txt
  deploy-log.txt
  pr-triage-log.txt
  scripts/*.txt
  scripts/demo-credentials.txt

PHASE 4 — GITATTRIBUTES

Create or update .gitattributes:
  * text=auto eol=lf
  *.ps1 text eol=crlf
  *.bat text eol=crlf
  *.cmd text eol=crlf

PHASE 5 — README STRUCTURE SECTION

Add to README.md a "Repository Structure" section
documenting the main directories.

VALIDATION GATE:
  npx tsc --noEmit    → must pass
  npx vitest run      → must pass (same count as before)
  npm run build       → must pass
  git status          → working tree clean

COMMIT MESSAGE:
  "chore(hygiene): archive clutter files, normalize line
   endings, update gitignore, add repo structure docs"

════════════════════════════════════════════════════════════
SPRINT 0.5 — ECS WORKER DEPLOYMENT
Branch: feat/ecs-worker
Priority: CRITICAL — silent production failure
════════════════════════════════════════════════════════════

CONTEXT:
  The ECS cluster (liberialearn) exists with zero running
  services. The SQS queue exists. The worker builds and
  pushes to ECR (liberialearn-worker) on every push.
  But nothing is consuming the queue — embeddings,
  analytics, SMS, and textbook jobs silently queue forever.

  Account: 258048833400
  Region: us-east-1
  ECR repos: liberialearn-web, liberialearn-worker

INSPECT FIRST:
  - worker/index.ts
  - Dockerfile
  - .github/workflows/deploy-ecs.yml
  - lib/queue.ts
  - worker/handlers/ (all handlers)
  - package.json (worker scripts)

PHASE 1 — WORKER DOCKERFILE STAGE

Check if Dockerfile has a separate worker stage.
If not, add:

  FROM node:20-alpine AS worker
  WORKDIR /app
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/worker ./worker
  COPY --from=builder /app/lib ./lib
  COPY --from=builder /app/prisma ./prisma
  COPY --from=builder /app/package.json ./package.json
  ENV NODE_ENV=production
  CMD ["node", "--experimental-specifier-resolution=node",
       "worker/index.js"]

PHASE 2 — WORKER GITHUB ACTIONS

UPDATE .github/workflows/deploy-ecs.yml:

Add job: push-worker-image
  Runs after push-web-image succeeds.
  ECR_REPOSITORY: liberialearn-worker
  Build with --target worker stage
  Tags: :latest and :${GITHUB_SHA}
  Push to ECR

PHASE 3 — ECS TASK DEFINITION FILE

CREATE: infra/ecs-worker-task-definition.json

  {
    "family": "liberialearn-worker",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "executionRoleArn": "arn:aws:iam::258048833400:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::258048833400:role/ecsTaskRole",
    "containerDefinitions": [{
      "name": "liberialearn-worker",
      "image": "258048833400.dkr.ecr.us-east-1.amazonaws.com/liberialearn-worker:latest",
      "essential": true,
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:258048833400:secret:liberialearn/DATABASE_URL"
        },
        {
          "name": "DIRECT_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:258048833400:secret:liberialearn/DIRECT_URL"
        },
        {
          "name": "SQS_QUEUE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:258048833400:secret:liberialearn/SQS_QUEUE_URL"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:258048833400:secret:liberialearn/OPENAI_API_KEY"
        },
        {
          "name": "GROQ_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:258048833400:secret:liberialearn/GROQ_API_KEY"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/liberialearn-worker",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL",
          "node -e \"require('./worker/index.js')\" || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }]
  }

PHASE 4 — WORKER RETRY + GRACEFUL SHUTDOWN

UPDATE worker/index.ts:

Add:
  - MAX_RETRIES = 3 per message
  - After 3 failures: log structured error with
    full message body, move to DLQ if configured
  - SIGTERM handler: finish current message, then exit
  - Startup log: "[WORKER] Starting. Queue: {SQS_QUEUE_URL}"
  - Per-message log: "[WORKER] Processing {messageType}"
  - Success log: "[WORKER] Processed {messageType} in {ms}ms"

PHASE 5 — WORKER RUNBOOK

CREATE: docs/ops/WORKER_DEPLOYMENT.md

  # Worker Service Runbook
  ## Architecture
  ## What the worker processes
  ## Manual deployment
    aws ecs register-task-definition \
      --cli-input-json file://infra/ecs-worker-task-definition.json
    aws ecs create-service \
      --cluster liberialearn \
      --service-name liberialearn-worker \
      --task-definition liberialearn-worker \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "..."
  ## How to verify it's running
    aws ecs list-tasks --cluster liberialearn
    aws logs tail /ecs/liberialearn-worker --follow
  ## How to check queue backlog
    aws sqs get-queue-attributes --queue-url $SQS_QUEUE_URL \
      --attribute-names ApproximateNumberOfMessages
  ## Restart procedure
  ## CloudWatch log group: /ecs/liberialearn-worker

NOTE: The task definition and runbook can be committed
and tested. The actual ECS service creation requires
AWS secrets to be configured and is documented in the
runbook. If AWS secrets are not available in this
environment, output SPRINT 0.5 PARTIALLY COMPLETE and
continue — the code and infra definition are ready,
manual AWS steps are documented.

VALIDATION GATE:
  npx tsc --noEmit    → must pass
  npx vitest run      → must pass
  npm run build       → must pass
  docker build --target worker . → must succeed if Docker available
                                   skip if Docker not available

COMMIT MESSAGE:
  "feat(infra): ECS worker task definition, worker
   Dockerfile stage, deploy workflow, retry logic,
   graceful shutdown, ops runbook"

════════════════════════════════════════════════════════════
SPRINT 0.7 — DEPLOYMENT STABILITY
Branch: fix/deployment-stability
════════════════════════════════════════════════════════════

GOAL: Guarantee CI always passes or fails loudly.
Never have a broken main branch.

INSPECT FIRST:
  - .github/workflows/ci.yml
  - .github/workflows/deploy-ecs.yml
  - .github/workflows/pr-triage.yml
  - .github/workflows/ (all workflow files)
  - package.json (scripts section)

PHASE 1 — CI HARDENING

UPDATE .github/workflows/ci.yml:

Ensure:
  1. Tests run before build (fail fast)
  2. Build runs after tests pass
  3. Type check runs as separate step
  4. All steps fail-fast: true
  5. Node version pinned (not "latest"):
     node-version: '20'
  6. Cache npm dependencies:
     uses: actions/cache@v3
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

Steps order:
  1. Checkout
  2. Setup Node (with cache)
  3. npm ci (not npm install)
  4. npx tsc --noEmit
  5. npx vitest run --reporter=dot
  6. npm run build

PHASE 2 — BRANCH PROTECTION RULES

CREATE: docs/ops/BRANCH_PROTECTION.md

Document (cannot configure via code, manual step):
  Settings → Branches → main → Branch protection rules:
  ✅ Require status checks to pass before merging
  ✅ Require branches to be up to date
  Required checks:
    - CI / build
    - Runtime Gate 1 / runtime-gate
  ✅ Require pull request reviews (optional for solo)
  ✅ Do not allow bypassing the above settings

PHASE 3 — RUNTIME GATE

Inspect existing Runtime Gate 1 workflow.
If it exists and is working, document what it tests.
If it's a stub, make it real:

CREATE or UPDATE: .github/workflows/runtime-gate.yml

  name: Runtime Gate 1
  on: [push]
  jobs:
    runtime-gate:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: npm ci
        - name: Smoke test critical routes
          env:
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test"
            DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/test"
            NEXTAUTH_SECRET: "ci-secret"
            NEXTAUTH_URL: "http://localhost:3000"
            OPENAI_API_KEY: "sk-test"
          run: |
            npx vitest run __tests__/final-gate/ --reporter=dot
            npx vitest run __tests__/permissions.test.ts --reporter=dot

PHASE 4 — ROLLBACK DOCUMENTATION

ADD to docs/ops/INCIDENT_RESPONSE.md (create if not exists):

  ## Emergency Rollback
  
  If a bad deploy reaches production:
  
  Option A — Revert last commit:
    git revert HEAD --no-edit
    git push origin main
    [Vercel auto-deploys in ~2 minutes]
  
  Option B — Vercel instant rollback:
    vercel.com → Project → Deployments → Previous → Promote
    [Instant, no code change needed]
  
  Option C — Pin to known good commit:
    git checkout <good-sha>
    git checkout -b emergency-fix
    git push origin emergency-fix
    [Deploy emergency-fix branch in Vercel]

VALIDATION GATE:
  npx tsc --noEmit    → must pass
  npx vitest run      → must pass
  npm run build       → must pass

COMMIT MESSAGE:
  "fix(ci): deployment stability — npm ci, cache deps,
   fail-fast ordering, runtime gate, rollback docs"

════════════════════════════════════════════════════════════
SPRINT 1 — OPS DASHBOARD + SLO LAYER
Branch: feat/ops-dashboard
════════════════════════════════════════════════════════════

INSPECT FIRST:
  - app/api/admin/ops/metrics/ (existing routes)
  - app/api/health/route.ts, app/api/healthz/route.ts
  - app/api/health/db/route.ts
  - app/platform/ directory (platform shell)
  - prisma/schema.prisma (look for AIUsage, AuditLog,
    PerformanceEvent models)
  - lib/rateLimit.ts (check backend type)

PHASE 1 — PERSISTENT SLO TRACKING

IMPORTANT: SLO tracking must be persistent, not in-memory.
In-memory SLO is an interview red flag at senior level.

Create a lightweight SLO events table if not exists:

  model SloEvent {
    id        String   @id @default(cuid())
    service   String   // "login", "tutor", "submit", "export"
    success   Boolean
    latencyMs Int
    schoolId  String?
    createdAt DateTime @default(now())

    @@index([service, createdAt])
    @@index([createdAt])
  }

If adding schema, use the Supabase shadow DB workaround:
  Create SQL manually → npx prisma db execute → resolve

CREATE: lib/slo/definitions.ts
  export const SLO_TARGETS = {
    LOGIN_SUCCESS_RATE: 0.995,
    TUTOR_RESPONSE_SUCCESS: 0.95,
    ASSIGNMENT_SUBMIT_SUCCESS: 0.99,
    EXPORT_GENERATION_SUCCESS: 0.98,
    DB_QUERY_P95_MS: 500,
    AI_RESPONSE_P95_MS: 8000,
  } as const

CREATE: lib/slo/tracker.ts
  - recordSloEvent(service, success, latencyMs, schoolId?)
    Fire-and-forget. Never blocks the calling route.
  - getSloStatus(): Returns current vs target for each SLO
    Uses last 24 hours of SloEvent records.
  - getSloSummary(): Returns simplified status per service:
    "healthy" | "degraded" | "critical"

Wire recordSloEvent() into:
  - app/api/auth/login/route.ts (after login attempt)
  - app/api/student/tutor/route.ts (after AI response)
  - app/api/student/assignments/[id]/submit/route.ts
  - app/api/moe/export/national/route.ts

PHASE 2 — OPS DASHBOARD API

CREATE: app/api/admin/ops/dashboard/route.ts

GET, requires isPlatformAdmin.

Returns:
  {
    timestamp: string,
    build: {
      version: string,      // from package.json
      commitSha: string,    // VERCEL_GIT_COMMIT_SHA
      environment: string,  // NODE_ENV
    },
    health: {
      db: "healthy" | "degraded" | "down",
      dbLatencyMs: number,
      rateLimitBackend: "upstash" | "memory",
      sentryConfigured: boolean,
      workerQueueDepth: number | null,
    },
    slo: {
      login: { current: number, target: number, status: string },
      tutor: { current: number, target: number, status: string },
      submit: { current: number, target: number, status: string },
      export: { current: number, target: number, status: string },
    },
    ai: {
      totalRequestsToday: number,
      fallbackRatePercent: number,
      estimatedCostUsdToday: number,
    },
    users: {
      activeStudentsToday: number,
      activeTeachersToday: number,
      totalSchools: number,
    },
    errors: {
      count5xxLast24h: number,
    }
  }

PHASE 3 — OPS DASHBOARD PAGE

CREATE: app/platform/ops/page.tsx

Platform admin only. Shows cards for:
  Row 1: DB Health | Rate Limit | Sentry | Environment
  Row 2: SLO status (color coded: green/amber/red)
  Row 3: AI usage summary
  Row 4: User activity
  Row 5: Build info bar

PHASE 4 — ENVIRONMENT BADGE

CREATE: components/ui/EnvironmentBadge.tsx
  - PRODUCTION (green dot)
  - DEMO (amber dot)
  - STAGING (blue dot)
  - DEVELOPMENT (gray dot)

Add to app/platform/ layout.

TESTS:
  __tests__/ops.dashboard.route.test.ts
  __tests__/slo.tracker.test.ts

COMMIT MESSAGE:
  "feat(ops): platform ops dashboard, persistent SLO
   tracking, environment badge, health aggregation"

════════════════════════════════════════════════════════════
SPRINT 2 — AI COST GUARDRAILS
Branch: feat/ai-cost-guardrails
════════════════════════════════════════════════════════════

INSPECT FIRST:
  - lib/ai/router.ts
  - lib/ai/routedCompletion.ts
  - lib/serverFlags.ts (AI_BUDGET_MONTHLY_CAP_USD)
  - app/api/admin/ai-costs/route.ts
  - prisma/schema.prisma (AIUsage or similar model)

PHASE 1 — USAGE RECORDING

Find existing AIUsage model or create:
  model AIUsageRecord {
    id               String   @id @default(cuid())
    route            String
    feature          String   // "tutor"|"teacherAssist"|"grading"|"curriculum"
    schoolId         String?
    userId           String?
    tokensUsed       Int
    estimatedCostUsd Float
    model            String
    tier             String
    fallbackUsed     Boolean  @default(false)
    createdAt        DateTime @default(now())
    @@index([createdAt])
    @@index([schoolId, createdAt])
    @@index([feature, createdAt])
  }

UPDATE lib/ai/routedCompletion.ts:
  After every completion, fire-and-forget:
    recordAiUsage({ route, feature, schoolId, userId,
                    tokensUsed, estimatedCostUsd, model,
                    tier, fallbackUsed })

  estimatedCostUsd formula:
    GPT-4o: input $2.50/1M tokens, output $10/1M tokens
    GPT-4o-mini: input $0.15/1M tokens, output $0.60/1M
    Groq: ~$0.10/1M tokens

PHASE 2 — BUDGET CAPS

ADD to lib/serverFlags.ts:
  AI_BUDGET_MONTHLY_CAP_USD
  AI_BUDGET_DAILY_CAP_USD
  AI_TUTOR_DAILY_BUDGET_USD         (default: 5.00)
  AI_TEACHER_ASSIST_DAILY_BUDGET_USD (default: 10.00)
  AI_GRADING_DAILY_BUDGET_USD       (default: 8.00)
  AI_CURRICULUM_DAILY_BUDGET_USD    (default: 20.00)

CREATE: lib/ai/budgetGuard.ts
  checkBudget(feature: string, schoolId?: string):
    Promise<{ allowed: boolean, remaining: number }>

  - Queries AIUsageRecord for today's spend on feature
  - Returns false if over budget
  - Returns true with remaining amount if under

UPDATE lib/ai/routedCompletion.ts:
  Before every call: await checkBudget(feature, schoolId)
  If not allowed: return structured fallback response:
    { answer: "Service temporarily limited", fallbackReason:
      "Daily AI budget reached", hadFallback: true }
  Never throw — always degrade gracefully.

PHASE 3 — BUDGET ALERTS

In budgetGuard.ts, when feature exceeds 80% of daily cap:
  log.warn("[AI_BUDGET] {feature} at 80% daily cap",
           { feature, used, cap, schoolId })

When platform exceeds 90% of monthly cap:
  log.error("[AI_BUDGET] Platform at 90% monthly cap",
            { used, cap })

PHASE 4 — ADMIN COST PAGE

UPDATE app/api/admin/ai-costs/route.ts to return:
  {
    today: {
      totalCostUsd, totalTokens, requestCount,
      fallbackCount, fallbackRate,
      byFeature: { tutor, teacherAssist, grading, curriculum },
      topSchoolsBySpend: Array<{schoolId, name, costUsd}>,
    },
    thisMonth: {
      totalCostUsd, budgetCapUsd, percentUsed,
      projectedMonthEndUsd,
    },
    alerts: string[],
  }

CREATE: app/admin/ai-costs/page.tsx
  - Monthly budget gauge
  - Daily spend by feature (cards)
  - Top schools by spend
  - Fallback rate
  - Month projection

TESTS:
  __tests__/ai.budget.test.ts
  __tests__/ai.usage.recording.test.ts

COMMIT MESSAGE:
  "feat(ai): cost guardrails — usage tracking, budget caps,
   per-feature limits, budget alerts, admin cost dashboard"

════════════════════════════════════════════════════════════
SPRINT 3 — ENVIRONMENT SEPARATION
Branch: feat/environment-separation
════════════════════════════════════════════════════════════

INSPECT FIRST:
  - lib/serverFlags.ts (DEMO_MODE usage)
  - app/login/LoginClient.tsx
  - lib/demoCredentials.ts
  - app/api/demo/reset/route.ts
  - app/platform/demo/ directory

PHASE 1 — ENVIRONMENT DETECTION MODULE

CREATE: lib/environment.ts

  export type AppEnvironment =
    "production" | "staging" | "demo" | "development"

  export function getEnvironment(): AppEnvironment {
    if (process.env.NODE_ENV === "development")
      return "development"
    if (process.env.DEMO_MODE === "true") return "demo"
    if (process.env.VERCEL_ENV === "preview") return "staging"
    return "production"
  }

  export const isProduction = () =>
    getEnvironment() === "production"
  export const isDemo = () =>
    getEnvironment() === "demo"
  export const isStaging = () =>
    getEnvironment() === "staging"
  export const isDevelopment = () =>
    getEnvironment() === "development"

PHASE 2 — DEMO-ONLY ROUTE GUARDS

Routes that must return 403 in production/staging:
  - app/api/demo/reset/route.ts
  - app/api/platform/demo/advance-day/route.ts
  - app/api/platform/demo/reset/route.ts
  - app/api/platform/demo/simulate-activity/route.ts

Add at top of each:
  if (isProduction() || isStaging()) {
    return NextResponse.json(
      { error: "Not available in this environment" },
      { status: 403 }
    )
  }

PHASE 3 — CREDENTIAL VISIBILITY GATING

UPDATE lib/demoCredentials.ts:
  export function shouldShowDemoCredentials(): boolean {
    return isDemo() || isDevelopment()
  }

UPDATE app/login/LoginClient.tsx:
  Only render demo hints when shouldShowDemoCredentials()
  In production: clean login page, no credentials shown

PHASE 4 — ENVIRONMENTS DOCUMENTATION

CREATE: docs/ops/ENVIRONMENTS.md

  | Environment | DEMO_MODE | VERCEL_ENV | Demo hints | Reset |
  |---|---|---|---|---|
  | Production | false | production | No | No |
  | Staging | true | preview | Yes | Yes |
  | Development | any | - | Yes | Yes |

TESTS:
  __tests__/environment.test.ts

COMMIT MESSAGE:
  "feat(env): environment separation — lib/environment.ts,
   demo route guards, credential visibility gating,
   environments documentation"

════════════════════════════════════════════════════════════
SPRINT 4 — CURRICULUM COMPLETION
Branch: feat/curriculum-completion
════════════════════════════════════════════════════════════

INSPECT FIRST:
  Run: npm run audit:lessons
  Read: lib/curriculum/subjectTaxonomy.ts
  Check: which subjects have < 200 lessons

PHASE 1 — COMPUTER SCIENCE CURRICULUM

Add COMPUTER_SCIENCE to subjectTaxonomy.ts.
Grades 7-12 only.

Grade topics:
  7: Digital literacy, internet safety, basic computing
  8: Spreadsheets, word processing, research skills
  9: Introduction to programming (block-based/Scratch)
  10: Text-based programming (Python basics)
  11: Algorithms, data structures, web development basics
  12: Software development lifecycle, databases, careers

Run:
  npm run enrich:lessons -- --subjects COMPUTER_SCIENCE --grades 7,8,9,10,11,12
  npm run promote:lessons

Target: 100+ READY lessons, avg >= 1200 words.

PHASE 2 — DISTRICT_ADMIN SMOKE COVERAGE

CREATE: __tests__/district.admin.smoke.test.ts

Happy path smoke tests:
  - DISTRICT_ADMIN can access /api/admin/dashboard/district
  - DISTRICT_ADMIN can access district/interventions
  - DISTRICT_ADMIN can access district/trends
  - TEACHER returns 403 on all district routes
  - Responses are district-scoped

PHASE 3 — FULL CURRICULUM AUDIT

Run: npm run audit:lessons

Requirements:
  All subjects: >= 200 READY lessons (or grade range total)
  Average word count: >= 1200
  Zero lessons below 1000 words
  All lessons: conceptTag and prerequisiteConcepts populated

If gaps found: run targeted enrichment.

PHASE 4 — WAEC ALIGNMENT REPORT

CREATE: app/api/admin/curriculum/waec-alignment/route.ts

GET, requires ADMIN or isPlatformAdmin.
Returns coverage % per subject against MOE standards.

TESTS:
  __tests__/district.admin.smoke.test.ts (new)
  Update existing curriculum tests if needed

COMMIT MESSAGE:
  "feat(curriculum): Computer Science K-12, district admin
   smoke coverage, WAEC alignment endpoint, full audit"

════════════════════════════════════════════════════════════
SPRINT 5 — DATA GOVERNANCE AUDIT PACK
Branch: feat/governance-audit-pack
════════════════════════════════════════════════════════════

INSPECT FIRST:
  - lib/audit.ts
  - app/api/admin/compliance/audit-log/route.ts
  - app/admin/compliance/ directory
  - prisma/schema.prisma (AuditLog model)

PHASE 1 — AUDIT LOG UI COMPLETION

Inspect app/admin/compliance/audit-log/page.tsx.
If stub: complete it. If partial: enhance it.

Required:
  - Search by actor email
  - Filter: action type, role, schoolId, date range
  - Paginated table (50/page): timestamp, actor, role,
    action, resource type, resource ID, school, IP
  - Export filtered results as CSV
  - Clear "no results" empty state

PHASE 2 — GOVERNANCE REPORT API

CREATE: app/api/admin/governance/report/route.ts

GET, requires isPlatformAdmin or MOE_OFFICIAL.
Returns governance summary for a time period.

PHASE 3 — AUDIT COMPLETENESS

Verify ALL of these have logAudit() calls:
  □ Teacher created, deactivated, password reset, edited
  □ Student created, soft-deleted
  □ Guardian linked
  □ Curriculum approved, rejected
  □ MOE export (all 3 types) — already done
  □ Exam published
  □ School settings changed
  □ Platform admin transfer

For any missing: add logAudit() call.

PHASE 4 — GOVERNANCE DASHBOARD

CREATE: app/admin/governance/page.tsx
  Export activity, admin actions, AI actions,
  sensitive action log, link to full audit log.

TESTS:
  __tests__/governance.report.test.ts

COMMIT MESSAGE:
  "feat(governance): audit log UI, governance report,
   audit completeness, governance dashboard"

════════════════════════════════════════════════════════════
SPRINT 6 — SCALE READINESS + INCIDENT RESPONSE
Branch: feat/scale-and-incident
════════════════════════════════════════════════════════════

This sprint is primarily documentation.
No schema changes. Minimal code changes.

PHASE 1 — SCALE READINESS DOCUMENT

CREATE: docs/ops/SCALE_READINESS.md

Required sections:
  ## What Has Been Tested (load test results table)
  ## Current Architecture Limits
    - Supabase connection limit (~60 concurrent)
    - Mitigation: PgBouncer at 500+ concurrent users
    - Rate limiting: Upstash Redis (active)
    - AI: 30s timeout, OpenAI/Groq routed
    - Worker: ECS Fargate 256 CPU / 512 MB
  ## Assumptions at 1K / 10K / 100K Users
  ## Likely Bottlenecks (ranked)
  ## Next Infrastructure Steps (numbered)
  ## Load Test Results Table (Tiers 1-6 from nationalScaleSmoke)

PHASE 2 — INCIDENT RESPONSE RUNBOOK

CREATE: docs/ops/INCIDENT_RESPONSE.md

  ## Severity Definitions (P0-P3)
  ## Response Times per severity
  ## Runbooks for each scenario:
    - Login fails for all users
    - AI tutor returns errors
    - MOE exports fail
    - Offline sync stops
    - Database unreachable
    - Worker stops processing
    - Vercel deployment fails
  ## Emergency Rollback Procedure
  ## Contacts

PHASE 3 — DATABASE SCALING GUIDE

CREATE: docs/ops/DATABASE_SCALING.md

  ## Current State (direct Supabase, ~60 concurrent)
  ## Enabling PgBouncer (step by step)
  ## Connection string format
  ## When to upgrade (trigger: 100+ schools active)
  ## RDS migration path (Sprint 10 / national rollout)

PHASE 4 — WORKER RETRY HARDENING

UPDATE worker/index.ts:
  - MAX_RETRIES = 3
  - After 3 failures: structured error log
  - SIGTERM: drain current message, then exit
  - Startup confirmation log
  - Per-message processing logs

COMMIT MESSAGE:
  "feat(ops): scale readiness, incident response runbook,
   database scaling guide, worker retry hardening"

════════════════════════════════════════════════════════════
SPRINT 7 — PRODUCT METRICS
Branch: feat/product-metrics
════════════════════════════════════════════════════════════

INSPECT FIRST:
  - prisma/schema.prisma (PerformanceEvent, LessonView,
    ExamAttempt, AssignmentSubmission)
  - app/api/moe/dashboard/route.ts
  - lib/intelligence/ directory

PHASE 1 — PRODUCT METRICS API

CREATE: app/api/admin/metrics/product/route.ts

GET, requires ADMIN or isPlatformAdmin.
Returns learning outcomes, engagement, platform metrics,
and week-over-week trends.

Key metrics:
  lessonCompletionRate, examCompletionRate, examPassRate,
  avgExamScore, masteryProgressRate,
  assignmentSubmissionRate, guardianEngagementRate,
  aiTutorAdoptionRate, teacherAiAssistAdoptionRate,
  interventionAcceptanceRate,
  moeExportCount, activeStudentsPercent,
  activeTeachersPercent

PHASE 2 — ADMIN METRICS PAGE

CREATE: app/admin/metrics/page.tsx
  Learning Outcomes + Engagement sections
  Trend indicators (up/down, color coded)
  Period selector: 7d / 30d / 90d

PHASE 3 — MOE NATIONAL OUTCOMES

UPDATE app/api/moe/dashboard/route.ts:
  Add productMetrics section:
    nationalLessonCompletionRate,
    nationalExamPassRate,
    nationalGuardianEngagementRate,
    topPerformingDistricts,
    lowestPerformingDistricts,
    interventionImpactRate

UPDATE app/moe/dashboard/page.tsx:
  Add "National Outcomes" section.

TESTS:
  __tests__/product.metrics.route.test.ts

COMMIT MESSAGE:
  "feat(metrics): product metrics API, admin metrics page,
   national outcomes for MOE, trend indicators"

════════════════════════════════════════════════════════════
SPRINT 8 — MOBILE UX POLISH
Branch: feat/mobile-ux-polish
════════════════════════════════════════════════════════════

INSPECT FIRST:
  - app/student/dashboard/ page
  - app/student/lessons/[id]/LessonDeliveryClient.tsx
  - app/student/exams/[examId]/StudentExamSessionClient.tsx
  - app/student/adaptive/AdaptivePracticeClient.tsx
  - app/teacher/dashboard/page.tsx
  - app/guardian/dashboard/page.tsx
  - app/globals.css

TARGET: Works well on a cheap Android phone, 5" screen,
bright outdoor light, 2G connectivity.

PHASE 1 — GLOBAL CSS BASELINE

UPDATE app/globals.css:
  - Minimum touch targets: 44px
  - Body text: 16px, line-height 1.6
  - Secondary text: gray-600 minimum (not gray-400)
  - Confirm reduced motion already in place

PHASE 2 — STUDENT DASHBOARD

  - Primary action (Today's Work) above fold on mobile
  - All touch targets >= 44px
  - Cards don't overflow on 320px width
  - Progress indicators readable in sunlight

PHASE 3 — LESSON DELIVERY

  - Text 16-18px, line-height 1.6+
  - Max content width 680px
  - Next/Back buttons sticky at bottom
  - Practice questions well-spaced
  - Progress indicator visible throughout

PHASE 4 — EXAM SESSION

  - Answer options >= 52px height
  - Clear selected state visual feedback
  - Timer visible but not dominant
  - Submit button requires confirmation dialog
  - Large, deliberate submit button (no accidental tap)

PHASE 5 — TEACHER + GUARDIAN QUICK FIXES

  - Teacher: struggling students section prominent
  - Guardian: child name prominent, progress visible

COMMIT MESSAGE:
  "feat(ux): mobile-first polish — touch targets,
   readable text, exam confirmation, sticky nav,
   student/teacher/guardian improvements"

════════════════════════════════════════════════════════════
SPRINT 9 — EXECUTIVE ARCHITECTURE NARRATIVE
Branch: feat/executive-architecture
════════════════════════════════════════════════════════════

THIS SPRINT IS DOCUMENTATION ONLY.
No code changes. Take time to get this right.

INSPECT FIRST (to ensure accuracy):
  - README.md
  - docs/ (all existing docs)
  - docs/architecture/ (Mermaid diagrams)
  - package.json (version)
  - prisma/schema.prisma (model count)
  - Run: npm run audit:lessons (for accurate curriculum count)

PHASE 1 — EXECUTIVE ARCHITECTURE DOCUMENT

CREATE: docs/ARCHITECTURE_EXECUTIVE.md

11 sections as specified in the original plan.
All numbers must match actual codebase state.
All diagrams must be referenced from existing files.
No placeholders. No invented numbers.

PHASE 2 — README REWRITE

Rewrite README.md as a technical showcase document.
Target audience: Senior engineers, technical recruiters,
MOE technical advisors.

Include:
  - Platform description (national infrastructure, not demo)
  - Test count badge equivalent
  - Technical highlights (8 bullet points)
  - Architecture section with embedded diagram
  - Live URL
  - Clear local setup instructions
  - Documentation table

PHASE 3 — API REFERENCE

CREATE: docs/API_REFERENCE.md

Human-readable API reference for MOE technical reviewers.
All 6 role groups. Method, path, role, request, response.

PHASE 4 — MOE TECHNICAL BRIEF

CREATE: docs/MOE_TECHNICAL_BRIEF.md

One document for MOE's IT department.
10 sections covering security, curriculum, offline,
integration, support, and pilot requirements.
No technical jargon — readable by a government official.

COMMIT MESSAGE:
  "docs: executive architecture, README showcase,
   API reference, MOE technical brief"

════════════════════════════════════════════════════════════
EXECUTION COMPLETE
════════════════════════════════════════════════════════════

When all 10 sprints are complete, output:

  LIBERIALEARN NATIONAL SCALE COMPLETION — SUMMARY
  ================================================
  Sprints completed: X/10
  Total tests passing: X
  Total test files: X
  Build status: PASS
  Curriculum: X READY lessons, avg X words
  Sprints blocked: [list with reasons]
  Manual steps required: [list]

  PLATFORM STATUS: NATIONAL SCALE READY