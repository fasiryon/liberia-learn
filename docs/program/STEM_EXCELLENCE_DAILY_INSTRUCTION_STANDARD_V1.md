# STEM Excellence Daily Instruction Standard V1

Status: **program standard, proposed by the Chief of Staff for founder adoption (2026-10-23).** It sets a day-level and course-level bar. It does not approve any lesson.

## How this relates to existing standards

This standard adds a **day** layer and the two missing STEM families on top of what already exists. It does not replace either existing standard.

| Layer | Existing authority | This standard adds |
| --- | --- | --- |
| Lesson instruction | `liberialearn-v4-instruction/1.0.0` (`lib/curriculum/v4/standard.ts`): subject teaching patterns, brevity, 60-85% activity share, practice counts, independence, misconceptions, retention | Engineering and Computing patterns, which V4 does not have (it recognises only Mathematics, Science, Humanities and Language) |
| Curriculum quality | Curriculum Excellence Standard V1 (`docs/curriculum/excellence/`): 23-criterion rubric, MOE/WAEC foundation | Nothing new. Every lesson still passes that rubric. |
| School day | none | Eight daily commitments, a day-composition rule and the honesty rules for empty periods |

## The eight daily commitments

The validator in `scripts/cos-stem/build-program.cjs` checks each commitment by machine: every day plan must exercise all eight. Human review then judges whether each is actually done well.

| Code | Commitment | Evidence a period must produce |
| --- | --- | --- |
| `CONCEPT_BEFORE_PROCEDURE` | Conceptual understanding before memorization | The learner meets a model, picture or phenomenon before any rule or procedure, and explains the rule in terms of that model. A list to memorise is never the first scene. |
| `MATHEMATICAL_REASONING` | Real mathematical reasoning | The learner justifies, compares strategies, or diagnoses an error, not only computes. Exact answers have a stated answer policy, which teachers see and learners never do. |
| `SCIENTIFIC_EVIDENCE` | Scientific investigation and evidence | A prediction, then data (measured, or supplied and labelled as supplied), then a claim tied to that data. Changing one variable at a time is taught explicitly. |
| `ENGINEERING_DESIGN` | Engineering design and iteration | A brief with measurable criteria and constraints, two or more designs, a test with recorded results, and at least one evidence-based refinement. |
| `COMPUTATIONAL_THINKING` | Computational thinking and age-appropriate coding | Decomposition, an algorithm the learner writes (unplugged in K-2, blocks in 3-6, text code from 7), tracing, and debugging a real error. |
| `COMMUNICATION_AND_CRITICAL_THINKING` | Reading, writing, communication, critical thinking | The learner reads for evidence, writes a supported claim, or argues and responds. English and Civics keep their own objectives and feed STEM communication (lab reports, data claims, map reasoning). |
| `LIBERIAN_APPLICATION` | Practical Liberian application | A real Liberian situation that needs the concept (market, seed library, hand-pump, hydropower, rainy season), not a name swap in a generic word problem. |
| `PRACTICE_CONTINUUM` | Guided practice, independent work, extension and reflection | All four appear in that order inside the period. Independent work has no hints or worked steps (V4 rule). Extension goes beyond the objective; reflection asks what changed in the learner's thinking. |

## Two new teaching patterns (proposed `liberialearn-v4-instruction/1.1.0`, additive)

| Family | Pattern | Minimum per lesson |
| --- | --- | --- |
| ENGINEERING | DEFINE → DESIGN → BUILD_OR_MODEL → TEST → REFINE → REFLECT | 1 brief with criteria and constraints, 2 designs, 1 recorded test, 1 refinement with re-test plan |
| COMPUTING | PREDICT → DECOMPOSE → DEMONSTRATE → BUILD_WITH_SUPPORT → BUILD_INDEPENDENTLY → DEBUG → APPLY | 1 worked algorithm, 2 guided and 2 independent build tasks, 1 trace, 1 real bug to fix |

The frozen contract stays frozen. T1 owns the instruction and registry change, made as an additive minor version agreed with T2 first (the C1 collision rule).

## Day composition (STANDARD_45)

- Six 45-minute teaching periods plus a 5-minute transition each, 30 minutes of remediation, and assembly, break and lunch, all within Codex's 07:30-15:00 anchors.
- Every day has at least one Science, one Technology/Computing, one Engineering and one Mathematics period (S, T, E and M each checked).
- STEM share of the week is 15/30 periods in K-2, 17/30 in 3-5, 17/30 in 6-9 and 20/30 in 10-12 (from `WEEKLY` in the course catalog).
- K-2 periods are split into activity segments of 10 minutes or less: movement, talk, hands-on making, a short screen activity. No 45-minute screen sessions.
- BLOCK_A/B (four 90-minute courses) is Codex's extended-day option, ending at 16:00. It is not claimed as MOE policy. A 90-minute period holds two linked lessons, or one investigation or design cycle, never one stretched lesson.

## Honesty rules (machine-enforced)

1. Every timetable slot carries one of four bindings: `V4_DRAFT` (exact selection, package hash and candidate hash), `CONTENT_GAP`, `TEACHER_LED` or `NON_INSTRUCTIONAL`.
2. A `CONTENT_GAP` tells the learner "No approved lesson for this period yet - teacher-led session". It carries no lesson text. It must have a production order with objectives, a 45-minute sequence covering the whole continuum, named misconceptions, evidence, Liberian context and registered blocks.
3. A `V4_DRAFT` period says "Pilot draft lesson (not yet approved) - ungraded" and carries `officialStatus: NOT_APPROVED`.
4. No learner-facing label may say approved or official unless a release record says so. Today none does: no live lesson has passed qualified independent review (the 2026-10-16 library audit is a mechanical/AI classification, not that review).
5. Live lessons on track A or B (repair or redesign) are modernization sources only. They are never placed in a day plan as curriculum.

## Progression, rising rigor, no generic template (founder, 2026-10-23)

These rules are machine-checked in G3 (`scripts/cos-stem/g3-audit.cjs`; definitions in `curriculum/program/stem-v1/source/standards.cjs`).

1. **Progression in every lesson.** Every lesson moves through five steps: the learner meets a **new idea**, **investigates** it, **practises**, **applies** it to something meaningful, and receives **feedback** that helps them improve. Each family's phases map onto those five steps, and feedback also counts when a block responds to the learner's own attempt. A lesson that skips a step fails `PROGRESSION_INCOMPLETE`.
2. **Rising STEM rigor.** Every STEM lesson must meet its band's floor (`RIGOR_BELOW_BAND`):
   - **K-2:** observe, sort, count, build and tell.
   - **3-5:** at least one quantitative task, plus a written justification.
   - **6-8:** two or more quantitative tasks; science and engineering work with data, and computing traces and tests code.
   - **9-12:** three or more quantitative tasks, data in science, engineering and computing, and a quantitative model or code in every STEM lesson.

   The day as a whole must also show the band's needs: data from Grade 3, plus a model or code from Grade 6. This follows the founder's examples: a Kindergarten learner tests which objects float, a Grade 6 learner measures water use and graphs it, and a Grade 12 learner analyses real data, writes code, tests a model and defends a design.
3. **No generic template.** A lesson whose phase sequence and block set match lessons in other courses fails `TEMPLATE_STRUCTURE`. Engineering, computing and science must each look like their own discipline.

The milestone is not the number of files generated. It is the **first grade whose whole day is verified**: all 8 instructional slots reach ACADEMICALLY_REVIEWED, with complete progression and the band's rigor across the day. After that comes all 13 grades. `docs/program/SCHOOL_DAY_SIMULATION_V1.md` reports this milestone automatically.

## Measuring "excellent"

Static checks only show structure. Excellence is judged by:

1. Qualified human subject review of the exact version (gate G4).
2. Timed rehearsal: the lesson actually fills its period (G6).
3. Learning evidence under the pilot measurement plan (`docs/curriculum/excellence/PILOT_MEASUREMENT_PLAN_V1.md`): independent performance, delayed retention and transfer.
