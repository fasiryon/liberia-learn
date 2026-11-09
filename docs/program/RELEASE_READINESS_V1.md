# K-12 STEM School Day: Release Readiness V1

CoS, 2026-10-23. Program branch `docs/stem-excellence-program-v1`. **Verdict: NOT READY.** No grade's day is complete. Nothing may be published, merged or activated without explicit release authorization, and the learning-preview flag stays OFF.

The numbers below come from the generated reports, which are the source of truth:

- `docs/program/SCHOOL_DAY_SIMULATION_V1.md` (13 grades, 26 sections, 520 synthetic learners)
- `docs/program/K12_PERIOD_MATRIX_V1.md` (every grade, section, slot, lesson candidate, hash, validation, G3, G4)
- `docs/program/GRADE_QUALITY_REPORTS_V1.md` (per-grade academic QA)

## Where the school stands (the six-stage ladder)

Each slot is placed on a stage by evidence alone (`scripts/cos-stem/lib/simulate.cjs`):

| Stage | Evidence required |
| --- | --- |
| PLANNED | The slot is in a day plan. An outline or order is never a lesson. |
| GENERATED | An exact pinned factory package fills the slot |
| FACTORY_VALIDATED | T2 validation evidence exists, and T2 has not held the batch |
| ACADEMICALLY_REVIEWED | CoS G3 passes, and the independent academic review (AI-assisted, internal) accepts the exact hash. No human approval is claimed. |
| PREVIEW_ELIGIBLE | Release evidence records T2 eligibility, accessibility, rights, security and timing for the hash |
| PUBLISHED | An authorized official publication is recorded |

State at `docs/stem-excellence-program-v1` (see the simulation for current figures). Each figure counts the 8 instructional slots of one section.

| Grades | Planned | Generated | Factory validated | Reviewed | Preview eligible | Published | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 7 | 8 | 6 | 4 (draft.6; the school-day batch is held) | 0 | 0 | 0 | DAY_PARTIAL |
| 5 | 8 | 6 | 1 | 0 | 0 | 0 | DAY_PARTIAL |
| K, 1-4, 6, 8-12 | 8 | 0 | 0 | 0 | 0 | 0 | DAY_NOT_STARTED |

- **Milestone (first grade with a verified day): not yet reached.**
- 0 of 17 factory lessons pass CoS G3.
- No academic review is recorded, because a review only follows a G3 pass.
- No human subject-expert review has taken place.

A grade's day is **VERIFIED** only when all 8 instructional slots (P1-P6, support, end of day) reach ACADEMICALLY_REVIEWED and the day shows complete progression and its band's STEM rigor. Preview eligibility and publication are separate, later stages. The simulation computes all of this; nothing is asserted by hand.

## Release gates beyond lesson quality (founder decisions 1 and 10)

These gates are separate from lesson quality, and each is enforced by the CoS simulation:

- **Dependency security:** evidence in `curriculum/program/stem-v1/security/gate.json` (`scripts/cos-stem/security-gate.cjs`). It is OPEN for both origin/main (production 6 critical, 18 high) and T2 `5f3348b30` (production 1 critical `next`, 18 high). A lesson cannot reach PREVIEW_ELIGIBLE unless the build commit named in its release evidence passes.
- **Platform risk register:** `curriculum/program/stem-v1/security/risk-register.json`, from Project Atlas `9fff8615b` plus the CoS dependency gate. SEC-R01 and SEC-R02 are CoS-verified P0s, repaired by the Atlas Codex task. Any OPEN finding with `blocksPreview` blocks every lesson.
- **Code execution:** lessons using CODE_RUNNER or BLOCK_PROGRAM also need `codeExecutionSafety: PASS` (`docs/program/CODE_EXECUTION_SAFETY_V1.md`).
- **Planning authority:** resolved. `scripts/cos-stem/check-authority.cjs` reports every retired plan RETIRED; T1's day shell reads `resolved-days/` only since `ae4e2d081`.

## Blockers, by owner

| # | Blocker | Owner | Unblocks |
| --- | --- | --- | --- |
| B1 | **Factory output for 11 grades:** 90 generation orders in `generation-backlog.json` (66 lessons, 11 support, 13 end-of-day) plus 2 CoS support specs (PO-G7-RET-01, PO-G5-RET-01). Batches run in parallel by band: K-2 24, 3-5 17, 6-8 17, 9-12 32. | T2 | Every DAY_NOT_STARTED grade |
| B2 | **Mojibake in 10 of 11 schoolday lessons** (S1). The source is `lib/content-factory/v4/schoolday/curriculum.ts` and `lessonAuthor.ts`, and it is still present at `c33fd6fbf`. | T2 | G3 for G5/G7 |
| B3 | **Recipe defects across all 17 lessons** (G3): single misconception (17), no hints in guided scenes (17), generic learner actions (15), policy text shown to learners (12), template bodies (11), generator title prefix (6, draft.6 only; fixed in the derived view per D2) | T2 | G3 everywhere |
| B4 | **Computing and Engineering recorded as SCIENCE in the science pattern** (4 lessons). Needs T2 subject codes and the T1 instruction 1.1.0 patterns (`COMPUTING_ENGINEERING_STANDARD_V1.md`). | T2 + T1 | Founder item 9 |
| B5 | **Proposed blocks not yet built** (GRID_ROBOT_PROGRAM, BLOCK_PROGRAM, CODE_TRACE, DESIGN_CYCLE, MEASUREMENT_TABLE, BUDGET_CONSTRAINT_TABLE, OBSERVATION_LOG, AUDIO_PROMPT; CODE_RUNNER needs a security review). Interim lessons can use registered blocks if labelled. | T1 | Interactive K-2 and Computing/Engineering quality |
| B6 | **Day navigation** (`school-day/1.0.0`, `/learn/day`) not built. T1 was waiting for CoS answers, which are now given in `COS-K12-STEM-PROGRAM.md`. | T1 | The learner experience of a whole day |
| B7 | **Admission policy for a whole day:** per-period `lessons[].timetable` binding; a cap large enough for 8 slots × 13 grades; Civics hash and map attachment bound | T2 | Running any day through `/learn/preview` |
| B8 | **Isolated synthetic school:** 26 sections, 520 learners, teachers and guardians, STANDARD_45 timetables seeded from the day plans (section B rotation included) | T2 | G7, and the real-route simulation |
| B9 | **Security HOLD:** npm audit 124 findings, 7 critical, disposition pending | T2 | Any activation |
| B10 | **Linux production packaging** not yet verified | T2 | Any activation |
| B11 | **G4 qualified human subject review:** no reviewer appointed for these versions | Founder | Every lesson |
| B12 | **G6 timing:** no lesson's period fit has been measured | T1 + CoS | Every lesson |
| B13 | **T1 authenticated run blocked:** the schema push into T1's disposable database was denied by tool permission (D8) | Founder decision | T1 G5 authenticated evidence |
| B14 | **G8 authorization:** exact-version release authorization; flag OFF | Founder | Activation |

## What can run in parallel now

- **T2:** the four band batches (B1) are independent of each other. B2 and B3 are recipe fixes that should land before the batches, so the batches don't repeat the defects.
- **T1:** the instruction 1.1.0 and block proposals (B4, B5) and the day shell (B6) can proceed alongside T2's fixture work (B8). They meet at the policy binding (B7).
- **CoS:** re-runs G3 on each new batch (`scripts/cos-stem/g3-audit.cjs`), re-pins, and regenerates every report with `node scripts/cos-stem/build-program.cjs`.
