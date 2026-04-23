# Elite Curriculum Upgrade System

## Existing Systems Reused

- AI routing: `lib/ai/router.ts` re-exports the central `routedCompletion` path from `lib/ai/routedCompletion.ts`, including AI usage and cost telemetry.
- Prompt registry: `lib/ai/promptRegistry.ts` stores versioned prompt entries with hashes, placeholders, and metadata.
- Curriculum guidelines: `lib/curriculum/framework.ts` remains the source of curriculum governance, lesson schema, assessment schema, grade bands, and subject guidance.
- Curriculum storage: `CurriculumContent` stores lesson payloads and status; `CurriculumVersion` stores version records.
- Curriculum import: `lib/curriculum/importer.ts` parses PDF, DOCX, text, and JSON into existing pending `CurriculumContent` lesson records.
- Review and approval: `app/admin/curriculum/[contentId]/review/page.tsx` and `app/api/admin/curriculum/approve/route.ts` provide the existing review and publish flow.
- Audit and cost logging: `app/api/admin/curriculum/upgrade/route.ts` writes audit events, while `routedCompletion` logs AI usage through the existing AI interaction path.

## Partial Areas Completed

- Elite upgrade prompt wiring now uses `curriculum.lesson_upgrade_elite_v1.system`, `curriculum.lesson_upgrade_elite_v1.user`, and `curriculum.lesson_upgrade_refinement_v1.user`.
- The upgrade service remains in `lib/curriculum/eliteUpgrade.ts` and produces reviewable drafts rather than overwriting source lessons.
- The score model now uses the required weighted 100-point rubric and stores score details in `payload.upgradeMetadata`.
- A low-score first pass automatically attempts one refinement pass through the same AI router.
- Review UI shows original vs upgraded content, score breakdown, weak categories, improvement summary, and a refinement control.

## Missing Areas Not Added as New Systems

- No new curriculum model, prompt registry, AI route, review workflow, or approval workflow was added.
- No additive Prisma schema change was required because `CurriculumContent.payload.upgradeMetadata` and `CurriculumVersion` already support draft governance and version preservation.

## Versioning and Governance

- Original imported or published lessons remain unchanged.
- Elite outputs are saved as new `CurriculumContent` records with `status: pending_approval`.
- Each elite draft is tied to a new `CurriculumVersion` with `status: DRAFT`.
- Publishing still requires the existing admin approval route.
