# LiberiaLearn

LiberiaLearn is a multi-role K-12 learning platform for Liberia built with Next.js, Prisma, and a grounded AI layer. The codebase supports students, teachers, guardians, school admins, platform admins, and Ministry-facing aggregate views from one repository.

## What It Is

Implemented product areas in this repo include:
- student daily work, adaptive practice, exams, certifications, and offline sync
- teacher schedule delivery, grading, intelligence dashboards, labs, and training
- guardian dashboard and simplified progress summaries
- school-admin onboarding, pilot readiness, compliance, and curriculum operations
- platform school management and reporting
- MOE aggregate dashboards, placements, and standards coverage

Core application paths:
- UI surfaces: [app](C:\Users\fasir\liberia-learn\app)
- API routes: [app/api](C:\Users\fasir\liberia-learn\app\api)
- AI services: [lib/ai](C:\Users\fasir\liberia-learn\lib\ai)
- intelligence layer: [lib/intelligence](C:\Users\fasir\liberia-learn\lib\intelligence)
- data model: [prisma/schema.prisma](C:\Users\fasir\liberia-learn\prisma\schema.prisma)

## Who It Helps

- Students get structured daily learning, adaptive practice, and grounded support flows.
- Teachers get delivery, grading, intervention, and intelligence surfaces without automatic AI mutation of grades or assignments.
- Guardians get summary-safe progress views and simple support suggestions.
- Schools get operational readiness, compliance, and onboarding visibility.
- Ministry and district users get aggregate views without school-level PII leakage.

## Architecture Overview

The implemented stack is:
- Next.js App Router UI and route handlers in [app](C:\Users\fasir\liberia-learn\app)
- authentication and RBAC in [lib/auth.ts](C:\Users\fasir\liberia-learn\lib\auth.ts) and [middleware.ts](C:\Users\fasir\liberia-learn\middleware.ts)
- Prisma access through [lib/db.ts](C:\Users\fasir\liberia-learn\lib\db.ts)
- runtime feature flags in [lib/serverFlags.ts](C:\Users\fasir\liberia-learn\lib\serverFlags.ts)
- audit and telemetry through [lib/audit.ts](C:\Users\fasir\liberia-learn\lib\audit.ts) and [lib/metrics/events.ts](C:\Users\fasir\liberia-learn\lib\metrics\events.ts)

Long-form implementation docs:
- [SYSTEM_ARCHITECTURE.md](C:\Users\fasir\liberia-learn\docs\SYSTEM_ARCHITECTURE.md)
- [AI_DECISION_FLOW.md](C:\Users\fasir\liberia-learn\docs\AI_DECISION_FLOW.md)
- [CURRICULUM_PIPELINE.md](C:\Users\fasir\liberia-learn\docs\CURRICULUM_PIPELINE.md)
- [INTELLIGENCE_FLOW.md](C:\Users\fasir\liberia-learn\docs\INTELLIGENCE_FLOW.md)

## AI Trust Layer

The current hardening pass includes:
- grounded answer confidence, grounding score, and citations in [lib/ai/rag/groundedAnswerService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\groundedAnswerService.ts)
- role-aware citation shaping and explainability in [lib/ai/trust.ts](C:\Users\fasir\liberia-learn\lib\ai\trust.ts)
- tenant-safe in-memory caching in [lib/ai/cache.ts](C:\Users\fasir\liberia-learn\lib\ai\cache.ts)
- role-aware hourly AI rate limiting through [lib/ai/rateLimitGuard.ts](C:\Users\fasir\liberia-learn\lib\ai\rateLimitGuard.ts) using [lib/rateLimit.ts](C:\Users\fasir\liberia-learn\lib\rateLimit.ts)
- AI usage and cost aggregation through `AiInteractionLog` and [app/api/admin/ai-costs/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\ai-costs\route.ts)

The trust layer is grounded in retrieved metadata and provider usage fields. It does not fabricate citations, confidence labels, or costs.

## Key Features

- grounded curriculum and policy retrieval through `RagChunk`
- curriculum generation, approval, and ingestion into retrieval
- teacher confusion detection and intervention workflows
- advisory-only AI action suggestions on teacher surfaces
- guardian-safe response shaping
- immutable audit protections
- feature-flag-driven rollout controls
- offline queueing and reconnect sync for student work

## Diagrams

Mermaid diagrams in this repo:
- [system-architecture.mmd](C:\Users\fasir\liberia-learn\docs\architecture\system-architecture.mmd)
- [ai-decision-flow.mmd](C:\Users\fasir\liberia-learn\docs\architecture\ai-decision-flow.mmd)
- [multi-tenant-isolation.mmd](C:\Users\fasir\liberia-learn\docs\architecture\multi-tenant-isolation.mmd)
- [curriculum-pipeline.mmd](C:\Users\fasir\liberia-learn\docs\architecture\curriculum-pipeline.mmd)
- [intelligence-flow.mmd](C:\Users\fasir\liberia-learn\docs\architecture\intelligence-flow.mmd)

## Screenshots

Real screenshots are intentionally not committed as placeholders. The capture list is documented in:
- [docs/assets/screenshots/README.md](C:\Users\fasir\liberia-learn\docs\assets\screenshots\README.md)

## Pilot Readiness

The current repo state is engineering-ready for pilot review when tests, typecheck, build, and curriculum audit thresholds are met. The operational readiness surfaces live in:
- [app/api/admin/pilot-readiness/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\pilot-readiness\route.ts)
- [app/api/admin/onboarding/readiness/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\onboarding\readiness\route.ts)
- [lib/readiness/readinessService.ts](C:\Users\fasir\liberia-learn\lib\readiness\readinessService.ts)

Deployment and ops references:
- [docs/ops/DEPLOYMENT_RUNBOOK.md](C:\Users\fasir\liberia-learn\docs\ops\DEPLOYMENT_RUNBOOK.md)
- [docs/ops/FEATURE_FLAGS.md](C:\Users\fasir\liberia-learn\docs\ops\FEATURE_FLAGS.md)

## Why This Matters In Low-Resource Environments

The product shape in this repo is biased toward practical rollout constraints:
- offline flows exist for interrupted connectivity
- guardian surfaces use simplified language
- AI answers are grounded to approved content instead of open-ended generation
- feature flags support staged activation instead of all-at-once deployment
- teacher-facing AI recommendations remain advisory, not automatic

## Local Development

```bash
npm install
npx prisma generate
npx vitest run
npx tsc --noEmit
npm run build
```
