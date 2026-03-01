# AI Factory Audit — Remediation Log

This document tracks identified compliance gaps in the LiberiaLearn AI Factory
and records their resolution status for MOE National Deployment readiness.

---

## Identified Gaps

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| 1 | Assessment items and rubric criteria generated without per-item MOE standard codes | High | Resolved |
| 2 | `toneGuidance()` defined but not injected into curriculum generation prompts | Medium | Resolved |
| 3 | Curriculum approval/rejection outcomes not captured as structured telemetry | High | Resolved |

---

## Remediation Log

### Gap 1 — Per-Item Standards Mapping on Assessments

**Status:** Resolved

**Problem:** `generateAssessmentItems()` and `generateRubric()` in
`lib/curriculum-helpers.ts` produced assessment items and rubric criteria
without any MOE standard code references. This is a compliance gap — MOE
national deployment requires each generated item to be traceable to specific
curriculum standards.

**Resolution:**
- Added `moeAlignmentCodes: string[] = []` parameter to both
  `generateAssessmentItems()` and `generateRubric()`.
- Each generated assessment item now includes `standardCodes: string[]`
  mapped from the provided alignment codes.
- Each rubric criterion now includes `standardCodes: string[]` at the
  criterion level.
- Updated `generate-full-pack` route to accept optional `moeAlignmentCodes`
  in the request body and thread it through to both functions.
- Default behaviour: `standardCodes: []` — never crashes if codes are absent.

**Files changed:**
- `lib/curriculum-helpers.ts`
- `app/api/admin/curriculum/generate-full-pack/route.ts`

**Tests added:** `__tests__/curriculum.helpers.test.ts` (7 test cases)

---

### Gap 2 — toneGuidance() Not Injected into Curriculum Prompts

**Status:** Resolved

**Problem:** `toneGuidance()` in `lib/localization/tone-standardizer.ts`
defines rich grade-band writing instructions (1-3, 4-6, 7-9, 10-12) but
was not injected into the AI system prompt in `generateCurriculumPayload()`.
Grades 7-12 received no sophistication guidance, producing weaker output.

**Resolution:**
- Imported `toneGuidance` into `lib/ai/curriculum-factory.ts`.
- Built a `toneHint` variable from `toneGuidance(input.grade)` and appended
  it to the system prompt alongside existing `liberiaHint`/`readingHint`/`moeHint`.
- Applied to all grade bands (1-3, 4-6, 7-9, 10-12).
- Lower grade simplification via `standardizeTone()` is unaffected.

**Files changed:**
- `lib/ai/curriculum-factory.ts`

**Tests added:** `__tests__/curriculum.factory.tone.test.ts` (4 test cases)

---

### Gap 3 — Curriculum Quality Feedback Loop

**Status:** Resolved

**Problem:** Curriculum approval and rejection outcomes were not captured as
structured telemetry. The platform could not learn from teacher feedback to
improve AI generation quality over time.

**Resolution:**
- Added `CurriculumFeedback` model to Prisma schema (minimal: curriculumId,
  action, rejectionReason, grade, subject, generationMethod, timestamp).
- Created migration `prisma/migrations/20260228_curriculum_feedback/migration.sql`.
- Added server feature flag `isCurriculumFeedbackEnabled()` in `lib/serverFlags.ts`
  (env: `ENABLE_CURRICULUM_FEEDBACK`, DEFAULT OFF).
- Updated `approve` route to write telemetry when flag is enabled.
- Added `reject` route (`app/api/admin/curriculum/reject/route.ts`) accepting
  optional `rejectionReason`; captures telemetry when flag is enabled.
- Telemetry writes are wrapped in try/catch — never crash the approval/rejection
  response.
- No PII captured (no student IDs, teacher names, or personal data).

**Files changed:**
- `prisma/schema.prisma`
- `lib/serverFlags.ts`
- `app/api/admin/curriculum/approve/route.ts`
- `app/api/admin/curriculum/reject/route.ts` (new)
- `prisma/migrations/20260228_curriculum_feedback/migration.sql` (new)

**Tests added:** `__tests__/curriculum.feedback.test.ts` (7 test cases)
