# LiberiaLearn System Architecture

## Scope

This document describes the implemented system in this repository as of the current hardening/refinement state. It references current code paths only.

## 1. Runtime Shape

LiberiaLearn is a Next.js App Router application with:
- UI pages in [app](C:\Users\fasir\liberia-learn\app)
- server routes in [app/api](C:\Users\fasir\liberia-learn\app\api)
- shared domain logic in [lib](C:\Users\fasir\liberia-learn\lib)
- persistence defined in [prisma/schema.prisma](C:\Users\fasir\liberia-learn\prisma\schema.prisma)

The default runtime path is:
1. Request enters Next.js middleware in [middleware.ts](C:\Users\fasir\liberia-learn\middleware.ts)
2. Route-level RBAC and tenant checks run via [lib/auth.ts](C:\Users\fasir\liberia-learn\lib\auth.ts) and route-specific guards
3. Business logic executes in `lib/*`
4. Persistence is handled through [lib/db.ts](C:\Users\fasir\liberia-learn\lib\db.ts) and Prisma
5. Audit and metric events are emitted through [lib/audit.ts](C:\Users\fasir\liberia-learn\lib\audit.ts) and [lib/metrics/events.ts](C:\Users\fasir\liberia-learn\lib\metrics\events.ts)

## 2. Tenant Isolation

Tenant boundaries are application-enforced, not Redis- or proxy-enforced.

Implemented tenant controls:
- middleware protects authenticated paths in [middleware.ts](C:\Users\fasir\liberia-learn\middleware.ts)
- role guards are applied in API routes through `requireUser()` and `requireRole()`
- teacher student scope resolution lives in [lib/intelligence/teacherScope.ts](C:\Users\fasir\liberia-learn\lib\intelligence\teacherScope.ts)
- MOE route restrictions live in [lib/moe/routeGuard.ts](C:\Users\fasir\liberia-learn\lib\moe\routeGuard.ts)
- final-gate tenant certification tests live in [smoke.tenant-isolation.test.ts](C:\Users\fasir\liberia-learn\__tests__\final-gate\smoke.tenant-isolation.test.ts)

Examples:
- teacher student-detail route: [app/api/teacher/intelligence/[studentId]/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\intelligence\[studentId]\route.ts)
- guardian linked-student route: [app/api/guardian/performance/route.ts](C:\Users\fasir\liberia-learn\app\api\guardian\performance\route.ts)
- MOE aggregate route: [app/api/moe/dashboard/route.ts](C:\Users\fasir\liberia-learn\app\api\moe\dashboard\route.ts)

## 3. Data Layer

Primary persistence uses Prisma models defined in [prisma/schema.prisma](C:\Users\fasir\liberia-learn\prisma\schema.prisma).

Important implemented models:
- `User`, `School`, `Student`, `Class`, `Enrollment`
- `CurriculumContent`
- `RagChunk`
- `ConfusionSignal`
- `InterventionRecommendation`
- `AuditLog`
- `AiInteractionLog`

The Prisma singleton and AuditLog immutability wrappers are in [lib/db.ts](C:\Users\fasir\liberia-learn\lib\db.ts).

## 4. AI Layer

### 4.1 Router

All text-completion AI flows use the shared router in [lib/ai/router.ts](C:\Users\fasir\liberia-learn\lib\ai\router.ts).

Current implementation:
- Groq fast tier when available for short/simple requests
- OpenAI smart tier fallback/default
- provider usage returned as `inputTokens`, `outputTokens`, and `estimatedCostUSD`

### 4.2 Grounded RAG

Grounded answering is implemented through:
- retrieval in [lib/ai/rag/retrievalService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\retrievalService.ts)
- trust formatting in [lib/ai/rag/groundedAnswerService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\groundedAnswerService.ts)
- route exposure in [app/api/rag/query/route.ts](C:\Users\fasir\liberia-learn\app\api\rag\query\route.ts)

Implemented hardening in this branch:
- confidence
- grounding score
- citation shaping by audience
- teacher/admin explainability summary
- tenant-scoped 5-minute in-memory cache via [lib/ai/cache.ts](C:\Users\fasir\liberia-learn\lib\ai\cache.ts)

### 4.3 AI Cost and Rate Controls

Implemented controls:
- shared role-aware in-memory rate limiting via [lib/ai/rateLimitGuard.ts](C:\Users\fasir\liberia-learn\lib\ai\rateLimitGuard.ts) using the existing [lib/rateLimit.ts](C:\Users\fasir\liberia-learn\lib\rateLimit.ts)
- per-request usage derivation in [lib/ai/interactionLog.ts](C:\Users\fasir\liberia-learn\lib\ai\interactionLog.ts)
- persisted AI interaction records in `AiInteractionLog`
- admin cost summary route in [app/api/admin/ai-costs/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\ai-costs\route.ts)

## 5. Curriculum Pipeline

Implemented lesson-generation and approval path:
1. request enters [app/api/admin/curriculum/generate/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\curriculum\generate\route.ts)
2. AI lesson payload is generated in [lib/ai/curriculum-factory.ts](C:\Users\fasir\liberia-learn\lib\ai\curriculum-factory.ts)
3. content is stored in `CurriculumContent`
4. approval is performed in [app/api/admin/curriculum/approve/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\curriculum\approve\route.ts)
5. approved content is chunked and embedded through [lib/ai/rag/ragIngestionService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\ragIngestionService.ts) and [lib/ai/rag/embeddingService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\embeddingService.ts)
6. unit assembly exists in [lib/ai/units/unitAssembler.ts](C:\Users\fasir\liberia-learn\lib\ai\units\unitAssembler.ts)

## 6. Intelligence Layer

Implemented intelligence path:
- performance events recorded in [lib/intelligence/recordPerformanceEvent.ts](C:\Users\fasir\liberia-learn\lib\intelligence\recordPerformanceEvent.ts)
- confusion detection in [lib/intelligence/confusionDetector.ts](C:\Users\fasir\liberia-learn\lib\intelligence\confusionDetector.ts)
- interventions generated in [lib/intelligence/interventionEngine.ts](C:\Users\fasir\liberia-learn\lib\intelligence\interventionEngine.ts)
- summaries computed in [lib/intelligence/performanceAggregator.ts](C:\Users\fasir\liberia-learn\lib\intelligence\performanceAggregator.ts)
- teacher-facing intelligence routes in [app/api/teacher/performance/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\performance\route.ts), [app/api/teacher/confusions/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\confusions\route.ts), and [app/api/teacher/interventions/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\interventions\route.ts)

Teacher-facing advisory-only action rendering is implemented through [lib/intelligence/advisoryActions.ts](C:\Users\fasir\liberia-learn\lib\intelligence\advisoryActions.ts).

## 7. Offline and Client Resilience

Offline support is implemented through:
- service worker registration in [app/layout.tsx](C:\Users\fasir\liberia-learn\app\layout.tsx)
- offline queue logic in [lib/offline](C:\Users\fasir\liberia-learn\lib\offline)
- student offline status page at [app/student/offline-status/page.tsx](C:\Users\fasir\liberia-learn\app\student\offline-status\page.tsx)

## 8. Operational Docs Already Present

Relevant existing docs:
- [docs/ops/FEATURE_FLAGS.md](C:\Users\fasir\liberia-learn\docs\ops\FEATURE_FLAGS.md)
- [docs/rollout/PRODUCTION_DEPLOY_GUIDE.md](C:\Users\fasir\liberia-learn\docs\rollout\PRODUCTION_DEPLOY_GUIDE.md)
- [docs/governance/SECURITY_MODEL.md](C:\Users\fasir\liberia-learn\docs\governance\SECURITY_MODEL.md)
- [docs/adr/0002-tenant-isolation.md](C:\Users\fasir\liberia-learn\docs\adr\0002-tenant-isolation.md)
