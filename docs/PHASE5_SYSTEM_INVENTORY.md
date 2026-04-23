# Phase 5 System Inventory

Phase 5 must extend the systems below. It must not create parallel analytics, AI, queue, storage, curriculum, recommendation, or lesson-rendering paths.

## Analytics And Event Tracking

What exists:
- Canonical append-only `LearningEvent` model with actor, target, curriculum context, version refs, offline sync fields, dedupe, replay, and indexes.
- Typed event logger in `lib/events/logLearningEvent.ts`.
- `/api/track` accepts authenticated client learning events and routes them through `logLearningEvent`.
- Offline sync uses `LearningEvent` through `app/api/student/sync/route.ts`.
- Multimedia analytics are aggregated from `LearningEvent`, `LessonAudio`, and `LessonVideo` in `lib/analytics/multimediaAnalytics.ts`.
- Admin and MOE dashboards already consume analytics routes.

What is partial:
- Some older dashboard counters still use `AuditLog` for legacy activity, while newer learning signals use `LearningEvent`.

What is missing:
- Phase 5 decision-support aggregations for school, district, subject weakness, class distribution, and curriculum adoption trends.

Must extend:
- `LearningEvent`, existing analytics services in `lib/analytics`, and existing admin/MOE dashboard routes.

Must not duplicate:
- Do not add another event table, another tracking endpoint, or a second multimedia aggregation path.

## Mastery, Progress, Recommendations

What exists:
- `AssessmentAttempt`, append-only `MasterySnapshot`, `DerivedStudentProgress`, `Intervention`, `InterventionChain`, `MisconceptionCategory`, `MisconceptionTag`, `ConfusionSignal`, and `InterventionRecommendation`.
- Pure mastery computation in `lib/mastery/compute.ts`.
- Current profile update service in `lib/mastery/masteryService.ts`.
- Append-only snapshot/derived progress helpers in `lib/intelligence/derivedProgress.ts`.
- Existing student progress aggregation in `lib/student/progressSummary.ts`.
- Existing intervention and advisory logic in `lib/intelligence/interventionEngine.ts` and `lib/intelligence/advisoryActions.ts`.
- Student lesson quizzes write `AssessmentAttempt` and misconception tags.

What is partial:
- `lib/intelligence/performanceAggregator.ts` still reads legacy `studentPerformanceEvent` via `prisma as any`, so teacher intelligence should be upgraded to use existing normalized attempts, progress, misconception, and intervention data.
- Student progress shows subject summaries but not a full mastery-by-subject/concept intelligence model or deterministic next actions.

What is missing:
- Student-facing mastery confidence tiers, weakness detection, overdue review detection, and explainable next actions.
- Class-level insight blocks for struggling students, top performers, low-performing lessons, and intervention suggestions using normalized data.

Must extend:
- `buildStudentProgressSummary`, `app/api/student/progress/route.ts`, existing teacher intelligence/dashboard surfaces, `AssessmentAttempt`, `DerivedStudentProgress`, `StudentProgress`, and `ScheduledWork`.

Must not duplicate:
- Do not rebuild quiz scoring, lesson completion, progress dashboards, or Today scheduling.

## AI Routing And Prompt Registry

What exists:
- Central prompt registry in `lib/ai/promptRegistry.ts` with metadata, version, hash, placeholders, previews, and prompt building.
- Central AI routing through `lib/ai/router.ts` and `lib/ai/routedCompletion.ts`.
- AI interaction telemetry in `lib/ai/interactionLog.ts` and `AIInteraction`.
- Existing prompt families for student tutor, lesson quiz, gap analysis, teacher assist, teacher class insights, curriculum generation, curriculum optimizer, exams, RAG, labs, MOE alignment, and interventions.

What is partial:
- Curriculum generation uses the registry baseline prompt `lesson.deep` plus dynamic runtime additions.
- No elite curriculum upgrade prompt set exists yet.

What is missing:
- Prompt assets for lesson upgrade, objective refinement, examples, misconception analysis, assessment strengthening, teacher notes, local-context enrichment, and workforce-readiness enrichment.
- Quality scoring routed through the existing AI path.

Must extend:
- `promptRegistry`, `routedCompletion`, and AI telemetry.

Must not duplicate:
- Do not call providers directly. Do not create a second prompt registry or an uncontrolled prompt system.

## Curriculum Generation, Guidelines, Review, Versioning

What exists:
- Curriculum model: `CurriculumContent` with status, version, payload, hash, MOE alignments, `versionId`, and relation to `CurriculumVersion`.
- National curriculum guidelines in `lib/curriculum/framework.ts` and schemas in `lib/schemas/curriculumFramework.ts`.
- AI curriculum generation in `app/api/admin/curriculum/generate/route.ts` through `generateCurriculumPayload`.
- Full-pack generation, unit assembly, media artifacts, labs, RAG chunking, embedding generation, approval, rejection, and scheduling.
- Admin curriculum UI in `app/admin/curriculum/page.tsx`.
- Pack review UI in `app/admin/curriculum/[contentId]/review/page.tsx`.
- MOE curriculum version management in `/api/moe/curriculum/version`, `/api/moe/curriculum/publish`, and `/moe/curriculum`.

What is partial:
- `CurriculumVersion` exists but most admin-generated lessons are not consistently placed into version review workflows.
- Review UI exists for full packs and simple approve/reject exists for lesson records, but no side-by-side original vs upgraded review exists.

What is missing:
- Real PDF/DOCX/text curriculum import into `CurriculumContent`.
- Parser/normalizer for imported units, lessons, objectives, assessments, and teacher notes.
- Elite AI upgrade drafts that preserve originals and feed existing review/version governance.
- Quality scoring and score delta review UX.

Must extend:
- `CurriculumContent`, `CurriculumVersion`, admin curriculum UI/routes, existing framework guidelines, existing approval/reject routes, and RAG/embedding queue.

Must not duplicate:
- Do not create a parallel curriculum content model, a second approval model, or replacement guideline set.

## Lesson Storage And Delivery Payloads

What exists:
- `CurriculumContent.payload` stores lesson/full-pack payloads.
- `ScheduledWork` maps content to class/date/period.
- `/api/student/work/[scheduledWorkId]` resolves scheduled lessons for student delivery.
- `app/student/lessons/[id]/LessonDeliveryClient.tsx` renders scheduled lessons with Read/Slides/Listen modes, quiz, labs, audio, video, AI help, completion, exit ticket, and mode tracking.
- `app/student/lesson/[contentId]/page.tsx` renders generic library lessons by content id.
- Lesson cache/offline helpers exist.

What is partial:
- The Read/Slides/Listen toggle is wired for scheduled-work lesson delivery only.
- Generic library lessons use a separate simple viewer without Slides/Listen mode parity.

What is missing:
- Shared or extended lesson rendering so library lessons expose the same Read/Slides/Listen mode behavior without creating a second multimedia renderer.

Must extend:
- The existing `LessonDeliveryClient` concepts, `parseToSlides`, `selectLessonBody`, lesson audio generation, and `/api/curriculum/[contentId]`.

Must not duplicate:
- Do not create another multimedia lesson renderer. Reuse or factor existing rendering logic.

## Admin And MOE Dashboards

What exists:
- Admin analytics page and `/api/admin/analytics` with legacy activity, daily active students, top lessons, and multimedia analytics.
- MOE dashboard page and `/api/moe/dashboard` with national KPIs, county breakdown, delivery, intervention, exam, product metrics, AI usage, multimedia usage, caching, audit, and data-access logging.
- Additional MOE routes for delivery compliance, intervention impact, placements, curriculum health, standards coverage, exports, districts, and national geo performance.

What is partial:
- Decision support exists as reporting snapshots but not yet as explicit intelligence cards for class distributions, teacher effectiveness proxy, weak-subject heatmaps, curriculum adoption/usage trends, and readiness summaries.

What is missing:
- Admin and MOE intelligence presentation using real aggregate data from existing normalized sources.

Must extend:
- `app/api/admin/analytics`, `app/admin/analytics/page.tsx`, `app/api/moe/dashboard`, and `app/moe/dashboard/page.tsx`.

Must not duplicate:
- Do not create a second admin dashboard or second MOE dashboard.

## Queue, Jobs, Storage, Cost Tracking

What exists:
- SQS helper in `lib/queue.ts` with `JobType` values for embeddings, lesson audio, textbook, analytics snapshots, SMS, confusion detection, and student import.
- Audio generation queue/status/cost in `LessonAudio`, `lib/lessons/audioGeneration.ts`, and admin audio routes.
- Export S3 helper in `lib/storage.ts`.
- Lesson video upload helpers and `LessonVideo`.
- AI usage/cost tracking in `AIInteraction`, `lib/ai/costSummary.ts`, and admin AI cost surfaces.

What is partial:
- Queue processing differs by job type; audio has explicit process endpoints while other jobs depend on existing worker paths/tests.

What is missing:
- Curriculum import/upgrade jobs if imports become long-running. These should use existing `enqueueJob` patterns only if needed.

Must extend:
- `lib/queue.ts`, existing job handlers, `LessonAudio`, `AIInteraction`, and existing storage helpers.

Must not duplicate:
- Do not create another queue abstraction, storage abstraction, or cost table.

## Today Sequencing And Adaptive Flow

What exists:
- `/student/today` and `/api/student/today`.
- Today API uses `ScheduledWork`, student enrollment, `StudentProgress`, ordered periods, lesson links, quiz links, and lab links.
- Dashboard Today CTAs now route to `/student/today`.

What is partial:
- Current sequencing is schedule-first and status-aware but not yet adaptive to weak areas, incomplete quizzes, or next-best lesson signals.

What is missing:
- Deterministic adaptive prioritization combining scheduled work, weak areas, incomplete lessons/quizzes, and next lesson recommendations.

Must extend:
- `/api/student/today`, `/student/today`, progress/recommendation helpers, `ScheduledWork`, `StudentProgress`, and `AssessmentAttempt`.

Must not duplicate:
- Do not create a second Today route or recommendation endpoint.

## Phase 5 Extension Targets

- Phase 1 should add learning intelligence services on top of `AssessmentAttempt`, `DerivedStudentProgress`, `StudentProgress`, `ScheduledWork`, misconceptions, and interventions, then surface them inside existing student progress and teacher intelligence UI.
- Phase 2 should extend admin and MOE analytics routes/pages with real aggregate intelligence.
- Phase 3 should add curriculum import into `CurriculumContent` and existing admin curriculum UI.
- Phase 4 should add elite upgrade prompts, quality scoring, draft preservation, and side-by-side review inside existing curriculum governance.
- Phase 5 should make `/api/student/today` deterministic and adaptive.
- Phase 6 should add duplication audit tests and Playwright flows, including the seeded lesson Read/Slides/Listen live check and generic library lesson mode parity.
