# Phase 2 — Unit Map Data Gaps (Doc B)

*Recorded 30 June 2026 while building the Unit Map (Phase 2, Deliverable 1).*
*Decision: do NOT backfill during Phase 2. The unit map degrades gracefully where
data is thin; these gaps are tracked here for a later content pass.*

## What the data supports today

Measured against the production database (approved/published lessons only):

| Metric | Value |
|---|---|
| Approved lessons | 5,905 |
| Lessons with a `unitId` | 4,637 (**78.5%**) |
| Distinct units | 783 |
| Multi-lesson units (a real sequence) | 773 (avg **5.9 lessons/unit**) |
| Single-lesson units | 10 |
| `LessonPrerequisite` edges | 3,828 |
| `CurriculumUnit` rows (named units) | 276 |

**Conclusion:** sequencing is real and widespread — the unit map works well for
the large majority of the library. A sampled unit
(`math-g8-5-geometry-and-spatial-thinking`) stacks cleanly:
Foundations → Teacher Modeling → Guided Application → Independent Practice →
Assessment.

## Gaps (not fixed in Phase 2)

1. **`unitId` coverage varies by subject.** The unit map sidebar simply does not
   render for a lesson without a `unitId`, so these subjects show fewer sequences:

   | Subject | Lessons with unitId |
   |---|---|
   | SOCIAL_STUDIES | 99% |
   | HISTORY / BIOLOGY / CHEMISTRY / PHYSICS / GEOGRAPHY / ECONOMICS | 100% |
   | LITERACY | 94% |
   | CIVICS | 92% |
   | SCIENCE | 89% |
   | MATH | 87% |
   | **ENGLISH** | **57%** |
   | **COMPUTER_SCIENCE** | **10%** |
   | **ENGINEERING_FOUNDATIONS** | **0%** |
   | **ENGINEERING** | **0%** |

2. **Most units have no `CurriculumUnit` row** (only 276 rows back 783 unit IDs).
   The unit map therefore **synthesises the unit name** from the shared lesson-
   title prefix (e.g. "Geometry and Spatial Thinking") or, failing that, a
   humanised version of the `unitId` slug. Named-unit rows are used when present.
   Effect: cosmetic only — names are readable, but not curated.

3. **Prerequisite edges are mostly "recommended", not "required".** The unit map
   uses required-strength edges for lock state, so very few lessons are hard-
   locked. The *sequence* itself is always shown via `orderInUnit`, which is the
   reliable signal. Edge distribution is uneven across subjects.

## How the UI handles each gap (graceful degradation)

- No `unitId` → no sidebar on that lesson (no broken/empty card).
- No `CurriculumUnit` name → synthesised name from titles/slug.
- Thin/recommended prerequisites → sequence shown by order; navigation stays open.

## Recommended follow-up (future content pass, not Phase 2)

- Backfill `unitId` + `orderInUnit` for ENGLISH, COMPUTER_SCIENCE, and the two
  ENGINEERING subjects (these are also the known content "deserts").
- Optionally create curated `CurriculumUnit` rows (names/descriptions) for the
  highest-traffic units so the synthesised names can be replaced with editorial
  ones.
