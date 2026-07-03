# SPRINT 5A-FOUNDATION — Between-Sprints Report

> Status at pause point, before SPRINT 5A-SURFACE. Foundation goal: make the WAEC
> infrastructure **real** (syllabus map, content tagging, mastery expansion, readiness
> scoring) before building the student-facing surface.

## What shipped

| # | Deliverable | Result |
|---|---|---|
| D1 | WAEC syllabus map | `lib/waec/syllabus.ts` (7 subjects, stable topic ids, exam weights, strand mappings) + cited `docs/curriculum/WAEC_SYLLABUS_MAP.md` |
| D2 | Content tagging | `CurriculumContent.waecSyllabusTopics` field + additive migration + `scripts/tag-waec-content.ts` (deterministic + optional LLM). **924 / 940 G9+ WAEC lessons tagged.** |
| D3 | Mastery expansion + FK fix | `lib/mastery/resolveStrand.ts` guarantees a StrandCatalog-valid target before every write; `completeScheduledLesson` now surfaces write failures instead of the silent `.catch(() => null)`. Fixed `coerceSubject` (Physics/Chem/Bio → SCIENCE, no more LITERACY default). |
| D4 | Readiness scoring | `lib/waec/readiness.ts` — recompute-on-read, exam-weighted, null when unassessed, `available:false` for Geography. |
| D5 | Backfill + verify | `scripts/backfill-waec-mastery.ts`, `scripts/verify-waec-readiness.ts`. Verified real non-fabricated readiness. |

## Tagged lesson counts per WAEC subject (production)

| WAEC subject | Tagged G9+ lessons | Readiness data? |
|---|---:|---|
| WAEC Mathematics | 191 | ⚠ No mastery data yet |
| WAEC English Language | 268 | ⚠ No mastery data yet |
| WAEC Physics | 120 | ⚠ No mastery data yet |
| WAEC Chemistry | 120 | ⚠ No mastery data yet |
| WAEC Biology | 105 | ✅ 60 students (real) |
| WAEC Geography | 120 | ❌ No mastery strand (gap) |
| WAEC Literature-in-English | 0 | ❌ No dedicated content |

16 lessons remain untagged (15 Biology, 1 English); rerun with `--llm` to close.

## How readiness looks for real students

Verified against production (`scripts/verify-waec-readiness.ts`):

- **student03@lib-bon-0001.edu.lr (Grade 11):** WAEC Biology **60%** (coverage 58%, trend
  *improving*, next focus "Organisation of Life"). All other subjects show *"take placement
  assessment"* (null). Geography *"unavailable"*.
- **marcus.sumo@pcs.edu.lr (Grade 9, pcs cohort):** all subjects null — this cohort has **no
  mastery data at all**.

The engine is proven: readiness is real where data exists and honestly null everywhere else.
No fabricated scores.

## StrandCatalog

No new strands were added. The existing catalog already contains subject-distinct WASSCE
strands (`physics_mechanics`, `organic_chemistry`, `advanced_biology`, `ecology_advanced`,
MATH G10-12, LITERACY G10-12) that let one `SCIENCE`/`LITERACY` mastery bucket resolve into
distinct WAEC subjects. **Geography has no strand** and is the one true gap (see below).

## Subjects too thin to ship an honest score (the <20 / no-data list)

Per the "fewer than 20 / degraded card" rule, the Surface dashboard must **not** ship a real
score card for these:

1. **WAEC Mathematics, Physics, Chemistry, English** — content is well tagged (120-268
   lessons each) but **zero mastery data exists** because no Grade 9+ student has completed a
   WAEC lesson with a scored exit ticket yet (0 such completions in production). Cards should
   render *"take a placement assessment"*, not a number.
2. **WAEC Geography** — no mastery strand and no `Subject`-enum bucket. Mark *"coming soon"*.
3. **WAEC Literature-in-English** — no dedicated content (Literature folds into
   LITERACY/English). Either merge into WAEC English or defer to a follow-up.
4. **WAEC Biology** — the one subject with real readiness (60 G9+ students). Shippable.

## Decision needed before / during Surface — demo data

Production has **0 organic Grade 9+ WAEC lesson completions**, so only Biology (seeded via an
earlier labs/adaptive path) has readiness. For the Surface sprint's screenshots and demo to
show a populated multi-subject dashboard, we would need to **seed a demo Grade 11 student's
genuine completions across MATH + Physics + Chemistry** through the real mastery pipeline
(realistic exit-ticket scores → engine derives readiness). This is standard demo-data
seeding, not score fabrication, but it introduces chosen input scores — flagging it for an
explicit go-ahead rather than deciding unilaterally.

## Doc B additions

1. **WAEC readiness is data-gated, not code-gated.** The engine is complete; coverage is
   limited by the absence of Grade 9+ WAEC lesson completions. Readiness populates
   automatically as students complete tagged lessons (the fixed mastery-write path now lands
   on the correct strands).
2. **Geography needs a `Subject`-enum expansion** (+ strands) before it can carry readiness —
   deliberately deferred to avoid a broad core migration inside a WAEC-scoped sprint.
3. **WAEC Literature has no content corpus.** Decide: merge into English, or generate a
   Literature-in-English set in a future content sprint.
4. **`NEXT_PUBLIC_ENABLE_MASTERY_ENGINE` is a Vercel env flag** — activate in production before
   Surface if any mastery UI is gated on it (the write path is not gated and already active).

## SPRINT 5A-SURFACE addendum

- **PATH A is not viable for practice questions.** The Grade 9+ corpus is **prose lessons**
  (objectives, worked examples, prose "assessment") with **no structured questions** anywhere
  (0 exit-ticket / quiz objects across 400 sampled tagged lessons). Tagging produced topic
  labels, not a question bank. Practice therefore uses **PATH B**: WAEC-style MCQs are
  **generated via `routedCompletion` and cached** in a new `WaecPracticeItem` bank (migration
  `20260703_000001_waec_practice_item`). 120 questions pre-generated for Math/English/Physics/
  Chemistry/Biology. **Doc B:** a real WAEC past-paper item bank is future content work.
- **Geography & Literature deferred** (per decision): Geography has no mastery strand (needs a
  `Subject`-enum expansion); Literature has no dedicated content. Both render as "coming soon".
- Surfaces built: `/student/waec` (G9+ gated dashboard) + `/student/waec/[subject]` detail +
  `/student/waec/[subject]/practice`; teacher & MOE WAEC panels; homepage "WAEC Prep, built in"
  section; Today G9+ CTA.

## Gate status

- TypeScript: `tsc --noEmit` clean.
- Migration `20260702_000001_waec_syllabus_topics`: applied to production (additive).
- Tests: WAEC foundation suite + affected mastery tests green (full-suite result recorded at commit).
