# LiberiaLearn Curriculum Pipeline

## Implemented Pipeline

The curriculum pipeline in this repository is implemented across the admin curriculum routes, AI content generation helpers, storage models, approval workflow, and RAG ingestion services.

## 1. Generation

Generation entry point:
- [app/api/admin/curriculum/generate/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\curriculum\generate\route.ts)

Core generation function:
- [lib/ai/curriculum-factory.ts](C:\Users\fasir\liberia-learn\lib\ai\curriculum-factory.ts)

What happens in the implemented route:
- validates grade, subject, topic, and mode
- supports `lesson`, `term_plan`, and `unit_plan`
- uses AI generation for lesson mode
- localizes tone and Liberia-specific context
- persists output into `CurriculumContent`
- optionally syncs labs
- best-effort queues or performs RAG chunk generation and embedding

## 2. Approval

Approval entry point:
- [app/api/admin/curriculum/approve/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\curriculum\approve\route.ts)

Approval behavior:
- sets content status to `published`
- stamps approval metadata into payload
- writes audit log
- triggers chunk sync and embeddings
- optionally writes curriculum feedback telemetry when the flag is enabled

## 3. Storage

Primary curriculum storage model:
- [prisma/schema.prisma](C:\Users\fasir\liberia-learn\prisma\schema.prisma)

Relevant persisted objects:
- `CurriculumContent`
- `VirtualLab`
- `CurriculumFeedback`
- `RagChunk`

## 4. Unit Assembly

Unit assembly is implemented in:
- [lib/ai/units/unitAssembler.ts](C:\Users\fasir\liberia-learn\lib\ai\units\unitAssembler.ts)
- [app/api/admin/curriculum/units/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\curriculum\units\route.ts)

This layer groups generated lesson artifacts into structured units and supports later textbook compilation and delivery workflows.

## 5. RAG Readiness

Curriculum becomes RAG-ready after approval and ingestion:
- chunk sync: [lib/ai/rag/ragIngestionService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\ragIngestionService.ts)
- embedding generation: [lib/ai/rag/embeddingService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\embeddingService.ts)
- grounded query use: [lib/ai/rag/groundedAnswerService.ts](C:\Users\fasir\liberia-learn\lib\ai\rag\groundedAnswerService.ts)

## 6. Audit And Regeneration Tooling

Current lesson-depth tooling:
- audit script command from [package.json](C:\Users\fasir\liberia-learn\package.json): `npm run audit:lessons`
- regeneration command from [package.json](C:\Users\fasir\liberia-learn\package.json): `npm run regen:lessons`

These commands are used operationally to determine whether curriculum depth is ready for pilot-quality use.

## 7. Pilot Readiness Tie-In

Pilot readiness surfaces consume curriculum coverage indirectly:
- [lib/readiness/readinessService.ts](C:\Users\fasir\liberia-learn\lib\readiness\readinessService.ts)
- [app/api/admin/pilot-readiness/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\pilot-readiness\route.ts)
- [app/api/admin/onboarding/readiness/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\onboarding\readiness\route.ts)
