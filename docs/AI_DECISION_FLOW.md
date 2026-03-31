# LiberiaLearn AI Decision Flow

## Entry Points

Implemented AI entry points in this repo include:
- student tutor: [app/api/student/tutor/route.ts](C:\Users\fasir\liberia-learn\app\api\student\tutor\route.ts)
- teacher assist: [app/api/teacher/assist/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\assist\route.ts)
- assignment tutor: [app/api/teacher/assignment/tutor/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\assignment\tutor\route.ts)
- grading assist: [app/api/teacher/grading/assist/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\grading\assist\route.ts)
- grounded RAG query: [app/api/rag/query/route.ts](C:\Users\fasir\liberia-learn\app\api\rag\query\route.ts)
- adaptive practice generation: [app/api/student/adaptive/practice/route.ts](C:\Users\fasir\liberia-learn\app\api\student\adaptive\practice\route.ts)
- exam generation: [app/api/admin/exams/generate/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\exams\generate\route.ts)

## Common Decision Sequence

1. route-level feature flag check in `app/api/*/route.ts`
2. RBAC check via `requireUser()` or `requireRole()`
3. tenant context validation through `schoolId` and role scope
4. hourly AI rate-limit check through [lib/ai/rateLimitGuard.ts](C:\Users\fasir\liberia-learn\lib\ai\rateLimitGuard.ts)
5. monthly AI budget check against `AiInteractionLog`
6. model call via [lib/ai/router.ts](C:\Users\fasir\liberia-learn\lib\ai\router.ts) or grounded RAG services
7. safe response shaping
8. audit and AI interaction logging

## Grounded Query Path

The grounded query path is the most structured AI path in the repo.

Flow:
1. [app/api/rag/query/route.ts](C:\Users\fasir\liberia-learn\app\api\rag\query\route.ts) authenticates the caller and resolves audience scope
2. [lib/ai/rag/assistantAccess.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\assistantAccess.ts) constrains retrieval mode by role
3. [lib/ai/rag/audienceScope.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\audienceScope.ts) narrows allowed subjects and grades
4. [lib/ai/rag/retrievalService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\retrievalService.ts) embeds the question, queries `RagChunk`, and reranks results
5. [lib/ai/rag/groundedAnswerService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\groundedAnswerService.ts) computes retrieval weakness, grounding score, confidence, citations, and explainability
6. low-grounding or invalid-response cases fall back safely with `fallbackReason`

## Trust Layer

The trust layer now exposes:
- `confidence`
- `groundingScore`
- `sourcesUsed`
- `citations`
- `fallbackReason`
- teacher/admin-only `explanation`

These values are sourced from:
- retrieved chunk similarities
- actual cited chunk count
- actual retrieval metadata
- routed model usage fields

No fabricated confidence, citations, or cost values are produced.

## Caching

Implemented cache:
- file: [lib/ai/cache.ts](C:\Users\fasir\liberia-learn\lib\ai\cache.ts)
- shape: `Map<string, { value: unknown; expiresAt: number }>`
- TTL: 5 minutes
- key format: `{tenantId}:{role}:{queryHash}`

Current use:
- grounded answer caching
- embedding caching with school-scoped cache keys where tenant context exists

## Advisory Layer

Teacher-facing advisory actions are derived from existing confusion and intervention signals, not from autonomous mutation logic.

Files:
- [lib/intelligence/advisoryActions.ts](C:\Users\fasir\liberia-learn\lib\intelligence\advisoryActions.ts)
- [components/intelligence/TeacherDashboardScreen.tsx](C:\Users\fasir\liberia-learn\components\intelligence\TeacherDashboardScreen.tsx)
- [components/intelligence/TeacherStudentIntelligenceScreen.tsx](C:\Users\fasir\liberia-learn\components\intelligence\TeacherStudentIntelligenceScreen.tsx)

Guardrail:
- advisory only
- no auto-assignment
- no grade mutation
- no automatic guardian or student notification
