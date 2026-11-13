# STEM School-Day Plans V1

Status: **reference journeys for the synthetic Demonstration Academy rehearsal.** Nothing here is activated. The learning-preview flag stays OFF until the founder authorizes each exact version.

Machine-readable plans: `curriculum/program/stem-v1/day-plans/g7-day1.json` and `g5-day1.json`. These are validated by `node scripts/cos-stem/build-program.cjs --check`. Times derive from Codex's STANDARD_45 anchors (`docs/qa/draft6/SCHOOLWIDE_IMPLEMENTATION_PLAN.md` @5f3348b30). Codex owns the final bell schedule and the fixtures. Minute splits inside each period are planning estimates until gate G6 timed rehearsal.

## Bell schedule used (STANDARD_45)

| Block | Time | Block | Time |
| --- | --- | --- | --- |
| Arrival | 07:30-08:00 | P4 | 11:10-12:00 |
| Assembly | 08:00-08:20 | Lunch | 12:00-12:40 |
| P1 | 08:20-09:10 | P5 | 12:40-13:30 |
| P2 | 09:10-10:00 | P6 | 13:30-14:20 |
| Break | 10:00-10:20 | Differentiated support | 14:20-14:40 |
| P3 | 10:20-11:10 | End-of-day activity | 14:40-14:50 |
| | | Dismissal | 14:50-15:00 |

Each teaching slot is 45 minutes of instruction plus 5 minutes of transition: 6 × 50 + 60 (break and lunch) + 30 (support and end of day) = 390 minutes from 08:20, which ends at 14:50. Every grade has 8 instructional slots: P1-P6, support and end of day.

## All 13 grades

Every grade from K to 12 has a Day 1 plan in `curriculum/program/stem-v1/day-plans/`. Grades 5 and 7 are hand-authored baselines. The other 11 are generated from band templates (`scripts/cos-stem/lib/days.cjs`):

| Grades | P1 | P2 | P3 | P4 | P5 | P6 |
| --- | --- | --- | --- | --- | --- | --- |
| K-2 | English | Math | Science | Engineering | Computing | Social Studies |
| 3-5 | Math | Science | English | Social Studies | Computing | Engineering |
| 6-9 | Math | Science | English | Civics | Computing | Engineering |
| 10 | Math | Physics | English | Chemistry | Computing | Engineering |
| 11 | Math | Chemistry | English | Biology | Computing | Engineering |
| 12 | Math | Biology | English | Physics | Computing | Engineering |

- **Section B** takes section A's period i+3. No course sits in the same slot for both sections, so one specialist teacher can cover both. The validator enforces this.
- **Rotation across days:** Social Studies, Civics, History and the third senior science rotate in on later days.
- **Unbound slots:** every slot without a factory lesson is a labelled gap carrying a generation order for T2. The live status of each slot is in `K12_PERIOD_MATRIX_V1.md`.

## One track: the full STEM day

Founder direction, 2026-10-23: there is no separate six-lesson pilot. The six sealed draft.6 lessons are extended into full school days. The remaining periods are filled by the Content Factory's school-day batch (Codex, `4.0.0-schoolday.1-draft.2`, branch `feat/content-factory-schoolday`, uncommitted and provisional). Gaps still open are shown as gaps. Draft.6 bytes are unchanged.

## Grade 7, Day 1: "Water stewardship at our school"

All 6 teaching periods are bound to V4 lessons: 4 sealed draft.6 and 2 provisional school-day. Remediation is the only gap.

| Slot | Course (unit) | Binding | What the learner does |
| --- | --- | --- | --- |
| P1 | Math (U2 Fractions) | draft.6 `g7-math-fractions` `ffaafcbb…` | Bar models and number line for 5/4 kg → worked renaming → guided checks → independent ordering and exact sums → diagnose a changed unit → measure seed exactly |
| P2 | Science (U2 States of matter) | draft.6 `g7-science-states-of-matter` `7863152e…` | Predict melting-ice temperature → paper energy model → heating curve → latent heat and evaporation below 100 °C |
| P3 | English (U1 Reading for evidence) | draft.6 `g7-english-reading-evidence` `fa54d6f4…` | Read an informational text → meaning and causes → direct evidence vs consequence → supported paragraph → revise |
| P4 | Civics (U1 Counties and capitals) | draft.6 `g7-civics-counties-capitals` `2a388b30…` + T1 geographic map | Explore the county map (pointer, keyboard, list) → capitals → recall vs spatial evidence → neighbours and direction |
| P5 | Computing (U3 Conditionals and loops) | schoolday `g7-computing-water-monitor-algorithms` `50d11724…` | Trace a counting loop over water-loss readings → boundary cases (> vs >=) → find a substituted bug → write pseudocode with tests → design input validation |
| P6 | Engineering (U6 Prototype, test, refine) | schoolday `g7-stem-water-cover-design` `ef241d39…` | Engineer and evaluate a water-container cover against criteria, using data |
| Remediation | Retrieval | **CONTENT_GAP** PO-G7-RET-01 | Teacher re-teaches one P1 or P2 misconception (pilot progress is memory-only) |

**Day 2:** P1 `g7-math-area-perimeter` (draft.6), P2 `g7-science-evaporation-fair-test`, P3 `g7-english-water-evidence-report`, P6 `g7-science-water-evidence-synthesis` (all schoolday). P4 Social Studies and a second Computing lesson are still gaps.

## Grade 5, Day 1: "Water for our school garden"

All 6 teaching periods are bound to V4 lessons: 1 sealed draft.6 and 5 provisional school-day. Remediation is the only gap.

| Slot | Course (unit) | Binding | What the learner does |
| --- | --- | --- | --- |
| P1 | Math (U1 Multiplication models) | draft.6 `math-multiplication-models` `7a469bac…` | Equal groups, array and area model → four partial products → independent 2-digit × 2-digit → recover missing rectangles → plan meeting seats |
| P2 | Science (U1 Earth and water) | schoolday `g5-science-water-change-investigation` `ff47e58e…` | Observe water loss and plan a fair comparison |
| P3 | English (U3 Reading science texts) | schoolday `g5-english-garden-water-report` `38dc0f11…` | Read and write a garden investigation report |
| P4 | Social Studies (U4 Rights and responsibilities) | schoolday `g5-civics-shared-water-decisions` `212048ce…` | Make a fair school-garden water decision from evidence |
| P5 | Computing (U2 Debugging strategies) | schoolday `g5-computing-garden-counting-rules` `a5b0aa1d…` | Make, trace and debug a garden counting algorithm |
| P6 | Engineering (U4 Irrigation channel) | schoolday `g5-stem-paper-channel-design` `be1561ca…` | Design and improve a dry model water channel |
| Remediation | Retrieval | **CONTENT_GAP** PO-G5-RET-01 | Partial-products retrieval and re-teach |

**Day 2:** P2 `g5-science-garden-evidence-review` (schoolday). Every other Day 2 period is still a gap.

The earlier CoS production orders for these periods (PO-G7-CMP-01, PO-G7-ENG-01, PO-G5-SCI-01, PO-G5-ELA-01, PO-G5-SS-01, PO-G5-CMP-01, PO-G5-ENG-01) are retired so they do not compete with the factory batch. Their objectives remain in git history (`28414049f`) as reference for G3 review.

## Band sequences (all grades)

The weekly allocation comes from `WEEKLY` in `curriculum/program/stem-v1/source/courses.cjs`. The day shapes below are how a band's periods are used. The unit and lesson content for every grade is in the course catalog.

### K-2: "Explore, make, tell"

Weekly: English 8, Math 7, Science 4, Social Studies 3, Computing 2, Engineering 2, Arts/PE 4.

| Period | Typical day | Inside the 45 minutes (segments of 10 minutes or less) |
| --- | --- | --- |
| P1 | Reading and language | Song or rhyme (5) → phonics on the platform with audio (10) → partner reading (10) → mark-making and writing (10) → share (5) → move (5) |
| P2 | Mathematics | Counting objects such as seeds and bottle caps (10) → platform ten-frame or array (10) → partner game (10) → draw and tell how they know (10) → stretch (5) |
| P3 | Science or Engineering (alternating) | Wonder question (5) → hands-on observation or build (10) → short platform sort or sequence (8) → test and improve (10) → tell the class (7) → move (5) |
| P4 | Reading and language 2 | Read-aloud (10) → retell with picture cards (5) → sentence builder (10) → drawing with labels (10) → share (5) → move (5) |
| P5 | Social Studies or Computing (unplugged) | Floor-grid "robot" directions or a community map walk (10) → plan a route with arrow cards (10) → platform sequence task (10) → act it out (10) → talk (5) |
| P6 | Arts/PE (teacher-led) | Not platform content |

The screen is one segment, never the whole period. Proposed blocks needed: `TEN_FRAME_COUNTERS`, `PHONICS_BLENDER`, `AUDIO_PROMPT`, `GRID_ROBOT_PROGRAM`, `OBSERVATION_LOG`, `DESIGN_CYCLE`.

### Grades 3-5: "Investigate and build"

Weekly: English 7, Math 7, Science 5, Social Studies 3, Computing 3, Engineering 2, Arts/PE 3. The Grade 5 day above is the reference journey. Science periods run predict → fair test → table and graph → explain. Computing moves from grid programs to block programs with loops, conditionals and procedures. Engineering runs a full design cycle across two periods, test then refine. Proposed blocks: `MEASUREMENT_TABLE`, `FAIR_TEST_PLANNER`, `GRAPH_BUILDER`, `BLOCK_PROGRAM`.

### Grades 6-8 (and 9): "Model, test, argue"

Weekly: English 6, Math 6, Science 6, Social Studies 3, Civics 2, Computing 3, Engineering 2, Arts/PE 2. The Grade 7 day above is the reference journey. Mathematics uses the V4 math pattern with algebraic models (`EQUATION_BALANCE`, `FUNCTION_TABLE`, `COORDINATE_PLANE`). Science uses the registered labs (molecule-motion, periodic-table, chemical-reaction, gravity-explorer, wave-motion, cell-division, tectonic-plates, electric-circuit, ecosystem-balance, human-heart, weather-system) inside the predict-experiment-observe-explain-apply sequence. Computing introduces text code in Grade 7 (`CODE_TRACE`, `CODE_RUNNER`). Engineering projects apply that week's mathematics: area-perimeter to a garden bed, trusses to forces.

### Grades 9-12: "Specialise and prepare"

Grade 9 keeps the 6-9 shape with integrated science. Grades 10-12 weekly: Math 6, English 5, Biology 3, Chemistry 3, Physics 3, Computing 3, Engineering 2, History and Geography 2, Civics 1, Arts/PE 2.

| Period | Typical day (Grade 10-12) |
| --- | --- |
| P1 | Mathematics: concept → worked → guided → independent → WASSCE-style mistake analysis |
| P2 | One science strand (rotating Bio/Chem/Phys): practical investigation with uncertainty (`MEASUREMENT_TABLE`, `UNCERTAINTY_CALCULATOR`) |
| P3 | English: WASSCE comprehension and summary, or technical and scientific writing |
| P4 | Second science strand, or Computing: tested programs, data science |
| P5 | Engineering design project, or History/Geography with source and data reasoning |
| P6 | Third science strand, or Civics |
| Remediation | Targeted WASSCE retrieval |

In BLOCK_A/B mode, a 90-minute block holds a full practical or a full design-build-test cycle.
