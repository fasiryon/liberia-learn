# Grade 4 Math governed template cell V1

- **Cell:** `cell-g4-math-v1` → release `lr-moe-g4-math-fractions-2026.1`. Authority: MOE source verified, LiberiaLearn review **UNREVIEWED**, MOE approval **NOT_CLAIMED**.
- **Internally executable:** **YES**. Every reference resolves in repository authority.
- **Live executable (production):** **NO**. Missing live: `learningTarget:LR-MATH-G4_6-02`, `lesson:ll-g4-math-fractions-equal-parts-2026.1` (snapshot 2026-09-26T09:07:15.873Z).

## Live certification gate: **NOT CERTIFIED**

| Result | Requirement | Detail |
|---|---|---|
| FAIL | 44/44 objectives have reviewed governed lessons | 43 failing: moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj2, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj3, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj4, moe-math-g4-s1-p2-multiplication-and-division-of-whole-numbers-obj1, ... |
| FAIL | classwork, homework and practice resolve from governed sources | 44 failing: moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj2, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj3, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj4, moe-math-g4-s1-p2-multiplication-and-division-of-whole-numbers-obj1, ... |
| FAIL | quiz, diagnostic check and exit assessment resolve from governed sources | 44 failing: moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj2, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj3, moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj4, moe-math-g4-s1-p2-multiplication-and-division-of-whole-numbers-obj1, ... |
| PASS | evidence bindings and policies resolve | release valid |
| PASS | ToolPolicies resolve to enabled toolkit tools | all keys mapped |
| PASS | interaction classifications resolve | all classified |
| PASS | every interaction has a valid offline behavior | all present |
| FAIL | release references resolve in production | 2 failing: learningTarget:LR-MATH-G4_6-02, lesson:ll-g4-math-fractions-equal-parts-2026.1 |
| PASS | no draft artifact is treated as governed | none |
| PASS | no MOE approval is claimed without recorded evidence | NOT_CLAIMED |
| PASS | cell is internally executable | no errors |

## Authority chain

MOE archive page → structured objective (`curriculum/structured/moe-structured-v1.json`) → cell unit (`lib/learning-authority/cells/grade4Math.ts`) → concept (release) → lesson / governed item → evidence policy + ToolPolicy → ontology release (`lib/learning-authority/governedGrade4Math.ts`). The certifier is `lib/learning-authority/templateCell.ts` and is cell-agnostic.

## Coverage (44 MOE objectives, 6 units)

| Measure | Covered |
|---|---|
| Objectives placed in a unit with interaction classified | 44/44 (100%) |
| Objectives with a governed (reviewed, release-bound) lesson | 1/44 (2%) |
| Objectives with only a DRAFT_UNREVIEWED lesson | 43/44 (98%) |
| Objectives with a governed item (diagnostic/practice) | 2/44 (5%) |
| classwork (governed / draft) | 1/44 (2%) / 43/44 (98%) |
| homework (governed / draft) | 1/44 (2%) / 43/44 (98%) |
| practice (governed / draft) | 1/44 (2%) / 43/44 (98%) |
| quiz (governed / draft) | 0/44 (0%) / 43/44 (98%) |
| diagnostic (governed / draft) | 1/44 (2%) / 43/44 (98%) |
| assessment (governed / draft) | 1/44 (2%) / 43/44 (98%) |
| project (governed / draft) | 0/44 (0%) / 0/44 (0%) |
| MOE resources referenced (materials) | 42 items |
| MOE assessment references (teacher metadata) | 60 items |
| MOE activities (teacher metadata) | 24 items |

## Interaction / lab classification

| Need | Objectives |
|---|---:|
| NONE | 24 |
| MANIPULATIVE_2D | 14 |
| SIMULATION | 0 |
| VIRTUAL_LAB | 0 |
| PRACTICAL | 5 |
| THREE_D | 1 |

Implemented with an enabled tool, lab or practical protocol: 16. Gaps (need classified, no Grade 4-6 tool/engine exists): `obj2:MANIPULATIVE_2D` MANIPULATIVE_2D, `obj9:MANIPULATIVE_2D` MANIPULATIVE_2D, `obj2:MANIPULATIVE_2D` MANIPULATIVE_2D, `obj5:THREE_D` THREE_D.
No objective needs a VIRTUAL_LAB or SIMULATION: the lab engine's 19 typed labs are all science, and none is claimed here.

| Unit | Objective | Page | Interaction | Lesson | Governed components |
|---|---|---:|---|---|---|
| u1-numeration-add-subtract | Read and write whole numbers up to hundred thousand | 38 | NONE | draft | none |
| u1-numeration-add-subtract | Compare and order whole numbers to hundred thousand | 38 | MANIPULATIVE_2D | draft | none |
| u1-numeration-add-subtract | Round whole numbers up to thousand | 38 | MANIPULATIVE_2D | draft | none |
| u1-numeration-add-subtract | Add and subtract whole numbers using population data on births, deaths, and migration | 38 | NONE | draft | none |
| u2-multiply-divide-whole | Identify multiplication facts and properties. | 40 | MANIPULATIVE_2D | draft | none |
| u2-multiply-divide-whole | Multiply multiples of 10’s, 100’s, and 1000’s. | 40 | NONE | draft | none |
| u2-multiply-divide-whole | Multiply 2, 3, or 4 digits by 1 - digit. | 40 | NONE | draft | none |
| u2-multiply-divide-whole | Divide 2, 3, or 4 - digit numbers by 1 - digit divisor. | 40 | NONE | draft | none |
| u2-multiply-divide-whole | Divide whole numbers with zero in the quotient. | 40 | NONE | draft | none |
| u2-multiply-divide-whole | Solve problem involving division. | 41 | NONE | draft | none |
| u3-number-theory-fractions | Identify even and odd numbers. | 42 | NONE | draft | none |
| u3-number-theory-fractions | Identify factors and multiples. | 42 | MANIPULATIVE_2D | draft | none |
| u3-number-theory-fractions | Find LCM and GCF of numbers. | 42 | NONE | draft | none |
| u3-number-theory-fractions | Find parts of a set. | 42 | MANIPULATIVE_2D | governed | classwork, homework, diagnostic, assessment |
| u3-number-theory-fractions | Write equivalent fractions. | 42 | MANIPULATIVE_2D | draft | practice |
| u3-number-theory-fractions | Simplify fractions. | 42 | MANIPULATIVE_2D | draft | none |
| u3-number-theory-fractions | Add fractions. | 42 | MANIPULATIVE_2D | draft | none |
| u3-number-theory-fractions | Subtract fractions. | 42 | MANIPULATIVE_2D | draft | none |
| u3-number-theory-fractions | Solve problems involving multi-step problems. | 43 | NONE | draft | none |
| u4-two-digit-decimals | Multiply 2 - Digits factors of multiples of 10’s, 100’s, and 1000’s. | 44 | NONE | draft | none |
| u4-two-digit-decimals | Estimate products involving 2 - Digits multipliers. | 44 | NONE | draft | none |
| u4-two-digit-decimals | multiply 2, 3, or 4 – Digits multipliers | 44 | NONE | draft | none |
| u4-two-digit-decimals | Divide multiples of 10’s, 100’s, and 1000’s by 2 - Digit Divisors mentally. | 44 | NONE | draft | none |
| u4-two-digit-decimals | Estimate quotient of 2 - Digit Divisors. | 44 | NONE | draft | none |
| u4-two-digit-decimals | Divide 2, 3, or 4 - Digit numbers by 2 - Digit | 45 | NONE | draft | none |
| u4-two-digit-decimals | Read and write decimal numerals up to hundredths place. | 45 | MANIPULATIVE_2D | draft | none |
| u4-two-digit-decimals | Compare and order decimal numerals up to hundredths place. | 45 | MANIPULATIVE_2D | draft | none |
| u5-measurement | Estimate time. | 46 | PRACTICAL | draft | none |
| u5-measurement | Find elapsed time. | 46 | MANIPULATIVE_2D (gap) | draft | none |
| u5-measurement | Estimate customary units of lengths. | 46 | PRACTICAL | draft | none |
| u5-measurement | Measure lengths using customary units. | 46 | PRACTICAL | draft | none |
| u5-measurement | Estimate customary units of mass and capacity. | 46 | PRACTICAL | draft | none |
| u5-measurement | Estimate metric units of lengths, capacity and mass. | 46 | PRACTICAL | draft | none |
| u5-measurement | Convert subunits of lengths and weight in the metric system. | 47 | NONE | draft | none |
| u5-measurement | Perform addition and subtraction of measurement of lengths and weights. | 47 | NONE | draft | none |
| u5-measurement | Find the perimeters and areas of squares and rectangles. | 47 | MANIPULATIVE_2D (gap) | draft | none |
| u6-geometry-statistics | Identify geometric figures of line, line segments, rays, interesting lines, parallel lines. | 48 | NONE | draft | none |
| u6-geometry-statistics | Identify angles by shapes as right angle, less than right angle, or greater than right angle; perpendicular lines. | 48 | MANIPULATIVE_2D (gap) | draft | none |
| u6-geometry-statistics | Identify triangles, quadrilaterals or pentago n, hexagon as polygon. | 48 | NONE | draft | none |
| u6-geometry-statistics | Identify parts of a circle. | 48 | NONE | draft | none |
| u6-geometry-statistics | Identify solid figures – spheres, cylinder, cones, cubes, rectangular prisms. | 49 | THREE_D (gap) | draft | none |
| u6-geometry-statistics | Read and interpret bar graphs, line graphs, pie chart, and mode, mean, median, & average. | 49 | NONE | draft | none |
| u6-geometry-statistics | Find the mode, medium, and mean using the given population data. | 49 | NONE | draft | none |
| u6-geometry-statistics | Solve word problems involving drawing of diagrams. | 49 | NONE | draft | none |

## Teacher-facing metadata (from the MOE tables)

- **g4-math-u1-numeration-add-subtract**: NUMERATION, ADDITION AND SUBTRACTION (semester 1, period 1, source pages 38, 39): 4 activities, 7 materials, 10 assessment references, 3 competencies
- **g4-math-u2-multiply-divide-whole**: MULTIPLICATION AND DIVISION OF WHOLE NUMBERS (semester 1, period 2, source pages 40, 41): 2 activities, 7 materials, 10 assessment references, 3 competencies
- **g4-math-u3-number-theory-fractions**: NUMBER THEORY AND FRACTION (semester 1, period 3, source pages 42, 43): 7 activities, 7 materials, 10 assessment references, 3 competencies
- **g4-math-u4-two-digit-decimals**: MULTIPLICATION AND DIVISION OF 2 - DIGITS MULTIPLIERS AND DIVISORS (DECIMALS TO HUNDREDTHS) (semester 2, period 4, source pages 44, 45): 3 activities, 7 materials, 10 assessment references, 3 competencies
- **g4-math-u5-measurement**: MEASUREMENT (semester 2, period 5, source pages 46, 47): 2 activities, 7 materials, 10 assessment references, 3 competencies
- **g4-math-u6-geometry-statistics**: GEOMETRY AND STATISTICS (semester 2, period 6, source pages 48, 49): 6 activities, 7 materials, 10 assessment references, 3 competencies

## Offline behavior

Every non-NONE interaction carries an offline fallback (paper strips, drawn number lines, real objects, practical protocols). Practicals produce TEACHER_OBSERVATION evidence under `g4-math-teacher-observation` (human actor required). Manipulatives produce evidence only through governed item responses, where tool use is checked against the ToolPolicy.

## Production state

Production units for this cell not in the cell: `yearmap-g4-math-u01`, `yearmap-g4-math-u02`. These are year-map placeholders whose titles don't match the MOE topics.
