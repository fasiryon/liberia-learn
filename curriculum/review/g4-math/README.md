# Grade 4 Math founder review package

Generated from `lib/curriculum/authority/grade4Math/`, `lib/curriculum/authority/grade4FractionsLesson.ts`, `lib/learning-authority/cells/grade4Math.ts` and `curriculum/structured/moe-structured-v1.json` by `scripts/build-g4-math-review-package.ts`. Do not edit the unit files by hand; edit the lessons and regenerate.

## How to review

1. Take one batch (one unit file) at a time. Each objective shows the MOE text and page, the lesson in full with answers, the interaction classification and known uncertainties.
2. Record a decision per objective in `review-ledger.json`: `APPROVE`, `REVISE` (put what to change in `notes`) or `REJECT`, with your name as `reviewer` and an ISO `reviewedAt`. For 3.4 (two lesson versions exist) also add `reviewedContentId` naming the lesson you reviewed; the publication script refuses without it.
3. A ledger decision is a record of your review, not a publication. Promotion to a governed lesson and publication are separate, explicitly authorized steps through the canonical curriculum workflow.
4. Nothing here is MOE approval. MOE approval needs its own recorded evidence.

**Status:** 0/44 objectives decided.

## Batches

- [Batch 1: NUMERATION, ADDITION AND SUBTRACTION](unit-1.md), 4 objectives
- [Batch 2: MULTIPLICATION AND DIVISION OF WHOLE NUMBERS](unit-2.md), 6 objectives
- [Batch 3: NUMBER THEORY AND FRACTION](unit-3.md), 9 objectives
- [Batch 4: MULTIPLICATION AND DIVISION OF 2 - DIGITS MULTIPLIERS AND DIVISORS (DECIMALS TO HUNDREDTHS)](unit-4.md), 8 objectives
- [Batch 5: MEASUREMENT](unit-5.md), 9 objectives
- [Batch 6: GEOMETRY AND STATISTICS](unit-6.md), 8 objectives

## Uncertainty dispositions

35 flagged uncertainties, each resolved from source context where possible (details and evidence in each batch file; data in `review-support.json`): 27 SOURCE_RESOLVED, 3 LIBERIALEARN_CLARIFICATION_REQUIRED, 5 HUMAN_POLICY_DECISION_REQUIRED. MOE text is never normalized in place.

| # | Uncertainty | Disposition | Proposed correction or decision needed |
|---|---|---|---|
| 1.4 | MOE extraction confidence MEDIUM (TAIL_BOUNDARY_UNCERTAIN). | SOURCE_RESOLVED | The operation and data context are corroborated on the same page: act3 'Add two or more (births and deaths) from the pollution data', act4 'Subtract two or more components of (births and deaths) from the population data', out1 'Use population data of births and death to add and subtract whole numbers'. Text past the parsed boundary could not change the operation. ('pollution' in act3 is itself a source typo; act4 and out1 say population.) MOE text kept verbatim. |
| 1.4 | MOE table text may continue past the parsed boundary ('... births, deaths, and migration'). Population figures in the lesson are invented example data. | HUMAN_POLICY_DECISION_REQUIRED | Keep labeled invented figures, or source real figures (POPFLE resource or national census) with a citation. |
| 2.6 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | Page 41 is the second page of this topic's table: its assessment references asr8-asr10 are also on page 41 and the next topic (Number Theory and Fraction) starts on page 42. out1 'Apply computational skills about multiplication and division to real life situations' fits a division word-problem objective. |
| 2.6 | Parsed from a continuation page; confirm it belongs to this topic on the source page. | SOURCE_RESOLVED | Same evidence as #confidence: page 41 continues the topic 2 table. |
| 3.3 | MOE says 'Find LCM and GCF'. The lesson uses listing methods only (no prime factorisation); confirm that depth is right for Grade 4. | SOURCE_RESOLVED | Add to 3.3 (or 3.2) one factor-tree activity ('Break 12 into factors until every factor is prime: 12 = 2 x 6 = 2 x 2 x 3') and two practice items: 'Write 12 as a product of prime factors.' Answer: 2 x 2 x 3. 'Write 30 as a product of prime factors.' Answer: 2 x 3 x 5. Keep LCM and GCF by listing. |
| 3.4 | Covered by the founder-authored lesson (part of a whole). MOE says 'parts of a set'; the set model appears only in its activities. | SOURCE_RESOLVED | Implemented as a candidate, not in place: ll-g4-math-fractions-equal-parts-2026.2 v1.1.0 teaches parts of a set explicitly and adds practice, quiz and evidence items (release 2026.2 candidate). The 2026.1 lesson is unchanged. Pending founder review. |
| 3.7 | MOE says 'Add fractions' without scope. The lesson covers like denominators plus related denominators (halves/quarters/eighths); confirm unlike denominators are out of scope for Grade 4. | SOURCE_RESOLVED | Restrict 3.7 to like denominators. Remove the related-denominator paragraph and objective 2. Replace: practice '1/2 + 1/4 = ?' with '1/4 + 2/4 = ?' (3/4); homework '1/3 + 1/6 = ? (simplest form)' with '1/6 + 2/6 = ? (simplest form)' (1/2); quiz '1/4 + 1/2' with '1/4 + 2/4 = ?' options 3/4, 3/8, 2/4, 1/4 (3/4); assessment '3/8 + 1/4' with '3/8 + 2/8 = ?' options 5/8, 5/16, 1/8, 6/8 (5/8); diagnostic '1/2 = ?/4' with 'How many eighths make one whole?' options 8, 4, 2, 16 (8). Reword the counters sentence to 'The MOE curriculum suggests base-10 counters: 3 counters out of 10 plus 4 counters out of 10 makes 7 out of 10.' |
| 3.8 | Same scope question as adding fractions. | SOURCE_RESOLVED | Restrict 3.8 to like denominators and taking from a whole. Remove the related-denominator paragraph and objective 3. Replace: practice '5/6 - 1/3' with '5/6 - 2/6 = ? (simplest form)' (1/2); homework cloth '3/4 m, cut 1/2 m' with 'cut 1/4 m' (2/4 m = 1/2 m); quiz '1/2 - 1/4' with '3/4 - 1/4 = ?' options 1/2, 2/8, 1, 4/4 (1/2); assessment '7/8 - 1/4' with '7/8 - 2/8 = ?' options 5/8, 9/8, 5/16, 6/8 (5/8). |
| 3.9 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | Page 43 is the second page of topic 3 (asr8-asr10 on p43; topic 4 starts on p44). |
| 3.9 | MOE wording is circular ('Solve problems involving multi-step problems'); the lesson interprets it as multi-operation word problems. | SOURCE_RESOLVED | MOE's own activity defines the circular objective: act6 'Solve problems involving multi-step problems; (using more than one operation).' That is the lesson's reading. |
| 4.6 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | Page 45 is the second page of topic 4 (asr7-asr10 on p45; topic 5 starts on p46). |
| 4.6 | Source text is truncated ('Divide 2, 3, or 4-Digit numbers by 2-Digit'); read as 'by 2-digit divisors'. Letter spacing was repaired automatically. | SOURCE_RESOLVED | The same topic's content column reads 'Dividing by 2' / 'Digit divisors' (con7, con8: one cell split across lines), and out1/out2 read 'multiplication and division of 2 / Digits multipliers and divisors'. 'Divide 2, 3, or 4-digit numbers by 2-digit divisors' is the source's own wording elsewhere in the table. Raw objective text kept verbatim. |
| 4.7 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | The topic's content column lists 'Decimal numerals up to hundredths place Comparing and Ordering decimal numerals up to hundredths place' (con9), and out2 names 'decimals to hundredths'. The decimals objectives belong to this topic. |
| 4.7 | The MOE topic title says 'decimals to hundredths' while the objectives are mostly multiplication/division; confirm decimals belong in this unit. | SOURCE_RESOLVED | Same evidence as #confidence (con9, out2). |
| 4.8 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | Same evidence as objective 7 (con9 names comparing and ordering decimals). |
| 5.2 | No Grade 4-6 clock tool is enabled online; interaction relies on paper-plate clocks. | SOURCE_RESOLVED | MOE's own method is a physical clock: act1 'Demonstrate finding elapsed time using a toy clock...' and mat1 'Toy or paper Clock'. The paper-plate clock is source-aligned; no online tool is needed for alignment. A Grade 4-6 online clock tool remains a non-blocking product gap. |
| 5.2 | Interaction MANIPULATIVE_2D has no enabled online tool; offline fallback only. | SOURCE_RESOLVED | Same as #known-1: the MOE material is a toy or paper clock. |
| 5.5 | The lesson treats weight and mass together, using everyday customary units (ounce, pound). Confirm terminology. | LIBERIALEARN_CLARIFICATION_REQUIRED | Open 5.5 with 'Mass tells how heavy something is. People often call it weight.' and use 'mass' after that; keep MOE's 'weight' where objectives 7 and 8 use it. |
| 5.7 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | Page 47 is the second page of topic 5 (asr8-asr10 on p47; topic 6 starts on p48); con4 and con6 list converting units of measure. |
| 5.8 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | Page 47 is the second page of topic 5 (asr8-asr10 on p47; topic 6 starts on p48). |
| 5.9 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | The topic's content column lists 'Perimeters' (con7) and 'Finding areas of squares and rectangles' (con8). |
| 5.9 | No Grade 4-6 grid tool is enabled online; interaction relies on squared paper. | HUMAN_POLICY_DECISION_REQUIRED | Accept squared paper as the only modality for 2026.2, or schedule a Grade 4-6 grid tool. |
| 5.9 | Interaction MANIPULATIVE_2D has no enabled online tool; offline fallback only. | HUMAN_POLICY_DECISION_REQUIRED | Same as #known-1. |
| 6.1 | MOE source says 'interesting lines'; read as 'intersecting lines'. | LIBERIALEARN_CLARIFICATION_REQUIRED | Add to 6.1 teacher notes: 'The MOE objective reads "interesting lines"; LiberiaLearn reads this as "intersecting lines".' Keep the MOE text verbatim in the objective record. |
| 6.2 | Grade 4 does not measure degrees; the lesson uses a folded-paper right-angle tester. Protractor tool is enabled only for Grades 7+. | SOURCE_RESOLVED | The objective sets its own scope: 'right angle, less than right angle, or greater than right angle', i.e. comparison with a right angle, not degree measurement. A folded-paper tester satisfies it; a protractor (enabled for Grades 7+) is not needed. |
| 6.2 | Interaction MANIPULATIVE_2D has no enabled online tool; offline fallback only. | SOURCE_RESOLVED | Same as #known-1: the objective needs a right-angle comparison, which the paper tester provides. The online gap is non-blocking. |
| 6.3 | MOE source says 'pentago n' (spacing artifact) for pentagon. | SOURCE_RESOLVED | 'pentago n' is a text-extraction spacing artifact inside one word; the list (triangles, quadrilaterals, ___, hexagon) and act3 'Sort out polygons according to sides and identify each' admit only 'pentagon'. Raw text kept verbatim. |
| 6.5 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | The topic's content column lists 'Solid figures' (con5, p48); page 49 is the topic's second page. |
| 6.5 | Classified THREE_D; no 3D engine exists, so real objects are the required fallback. | HUMAN_POLICY_DECISION_REQUIRED | Keep THREE_D with real objects as the required modality, or reclassify as PRACTICAL until a 3D manipulative exists. |
| 6.5 | Interaction THREE_D has no enabled online tool; offline fallback only. | HUMAN_POLICY_DECISION_REQUIRED | Same as #known-1. |
| 6.6 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | The topic's content column includes 'Reading and interpreting figures from charts and graphs such as Bar graphs, line graphs, pie chart' (con5, p48). |
| 6.6 | MOE combines graphs with 'mode, mean, median & average'. The lesson introduces the words only; calculation is in the next objective. | SOURCE_RESOLVED | Make the class survey a voluntary, anonymous family-size survey (act6) and add: practice 'In the family-size bar graph, which family size has the tallest bar? That value is the mode.' and a quiz item reading the mode from a bar graph. Calculation of mean and median stays in 6.7. |
| 6.7 | MOE extraction confidence LOW (AMBIGUOUS_COLUMN_ASSIGNMENT, CONTINUATION_PAGE_ASSIGNMENT). | LIBERIALEARN_CLARIFICATION_REQUIRED | LOW confidence comes from an ambiguous column (objective vs activity). The instructional target is corroborated (out2 p48 lists mean, mode, median/'medium'; act6 p49 family-size data; Grade 3 p37 'Find the mean, mode and median of the data'), so the lesson content stands either way. The column itself can only be confirmed by a person reading page 49 of Math 1-6.pdf. |
| 6.7 | LOW extraction confidence (ambiguous column). MOE says 'medium'; read as 'median'. Data is invented example data. | SOURCE_RESOLVED | The same MOE document spells 'median' correctly in Grade 4 objective 6 (p49) and Grade 3 (p37). 'Medium' recurs only as a consistent misspelling (Grade 3 act p36, Grade 4 out2 p48, this objective) and is not a statistical measure. The lesson says 'median'; the MOE text is preserved verbatim in the objective record and review package. The lesson's family-size data follows act6; figures are invented and labeled. |
| 6.8 | MOE extraction confidence MEDIUM (CONTINUATION_PAGE_ASSIGNMENT). | SOURCE_RESOLVED | Page 49 is the second page of topic 6 (asr8-asr10 on p49), the last Grade 4 topic. |

## All objectives

| # | MOE objective | Lesson | Lesson status | Interaction | Uncertainties | Decision |
|---|---|---|---|---|---:|---|
| 1.1 | Read and write whole numbers up to hundred thousand | Reading and Writing Numbers to 100,000 | draft | NONE | 0 | PENDING |
| 1.2 | Compare and order whole numbers to hundred thousand | Comparing and Ordering Numbers to 100,000 | draft | MANIPULATIVE_2D | 0 | PENDING |
| 1.3 | Round whole numbers up to thousand | Rounding Whole Numbers to the Nearest Ten, Hundred and Thousand | draft | MANIPULATIVE_2D | 0 | PENDING |
| 1.4 | Add and subtract whole numbers using population data on births, deaths, and migration | Adding and Subtracting with Population Data | draft | NONE | 2 | PENDING |
| 2.1 | Identify multiplication facts and properties. | Multiplication Facts and Properties | draft | MANIPULATIVE_2D | 0 | PENDING |
| 2.2 | Multiply multiples of 10’s, 100’s, and 1000’s. | Multiplying Multiples of 10, 100 and 1,000 | draft | NONE | 0 | PENDING |
| 2.3 | Multiply 2, 3, or 4 digits by 1 - digit. | Multiplying 2-, 3- and 4-Digit Numbers by a 1-Digit Number | draft | NONE | 0 | PENDING |
| 2.4 | Divide 2, 3, or 4 - digit numbers by 1 - digit divisor. | Dividing 2-, 3- and 4-Digit Numbers by a 1-Digit Divisor | draft | NONE | 0 | PENDING |
| 2.5 | Divide whole numbers with zero in the quotient. | Division with Zero in the Quotient | draft | NONE | 0 | PENDING |
| 2.6 | Solve problem involving division. | Solving Problems Involving Division | draft | NONE | 2 | PENDING |
| 3.1 | Identify even and odd numbers. | Even and Odd Numbers | draft | NONE | 0 | PENDING |
| 3.2 | Identify factors and multiples. | Factors and Multiples | draft | MANIPULATIVE_2D | 0 | PENDING |
| 3.3 | Find LCM and GCF of numbers. | Least Common Multiple and Greatest Common Factor | draft | NONE | 1 | PENDING |
| 3.4 | Find parts of a set. | Fractions as Equal Parts | founder-authored | MANIPULATIVE_2D | 1 | PENDING |
| 3.5 | Write equivalent fractions. | Writing Equivalent Fractions | draft | MANIPULATIVE_2D | 0 | PENDING |
| 3.6 | Simplify fractions. | Simplifying Fractions | draft | MANIPULATIVE_2D | 0 | PENDING |
| 3.7 | Add fractions. | Adding Fractions | draft | MANIPULATIVE_2D | 1 | PENDING |
| 3.8 | Subtract fractions. | Subtracting Fractions | draft | MANIPULATIVE_2D | 1 | PENDING |
| 3.9 | Solve problems involving multi-step problems. | Solving Multi-Step Problems | draft | NONE | 2 | PENDING |
| 4.1 | Multiply 2 - Digits factors of multiples of 10’s, 100’s, and 1000’s. | Multiplying Multiples of 10, 100 and 1,000 by 2-Digit Multiples of 10 | draft | NONE | 0 | PENDING |
| 4.2 | Estimate products involving 2 - Digits multipliers. | Estimating Products with 2-Digit Multipliers | draft | NONE | 0 | PENDING |
| 4.3 | multiply 2, 3, or 4 – Digits multipliers | Multiplying by a 2-Digit Multiplier | draft | NONE | 0 | PENDING |
| 4.4 | Divide multiples of 10’s, 100’s, and 1000’s by 2 - Digit Divisors mentally. | Dividing Multiples of 10, 100 and 1,000 by 2-Digit Divisors Mentally | draft | NONE | 0 | PENDING |
| 4.5 | Estimate quotient of 2 - Digit Divisors. | Estimating Quotients with 2-Digit Divisors | draft | NONE | 0 | PENDING |
| 4.6 | Divide 2, 3, or 4 - Digit numbers by 2 - Digit | Dividing by a 2-Digit Divisor | draft | NONE | 2 | PENDING |
| 4.7 | Read and write decimal numerals up to hundredths place. | Reading and Writing Decimals to Hundredths | draft | MANIPULATIVE_2D | 2 | PENDING |
| 4.8 | Compare and order decimal numerals up to hundredths place. | Comparing and Ordering Decimals to Hundredths | draft | MANIPULATIVE_2D | 1 | PENDING |
| 5.1 | Estimate time. | Estimating Time | draft | PRACTICAL | 0 | PENDING |
| 5.2 | Find elapsed time. | Finding Elapsed Time | draft | MANIPULATIVE_2D | 2 | PENDING |
| 5.3 | Estimate customary units of lengths. | Estimating Length in Customary Units | draft | PRACTICAL | 0 | PENDING |
| 5.4 | Measure lengths using customary units. | Measuring Length in Customary Units | draft | PRACTICAL | 0 | PENDING |
| 5.5 | Estimate customary units of mass and capacity. | Estimating Mass and Capacity in Customary Units | draft | PRACTICAL | 1 | PENDING |
| 5.6 | Estimate metric units of lengths, capacity and mass. | Estimating Length, Capacity and Mass in Metric Units | draft | PRACTICAL | 0 | PENDING |
| 5.7 | Convert subunits of lengths and weight in the metric system. | Converting Metric Units of Length and Mass | draft | NONE | 1 | PENDING |
| 5.8 | Perform addition and subtraction of measurement of lengths and weights. | Adding and Subtracting Measurements of Length and Mass | draft | NONE | 1 | PENDING |
| 5.9 | Find the perimeters and areas of squares and rectangles. | Perimeter and Area of Squares and Rectangles | draft | MANIPULATIVE_2D | 3 | PENDING |
| 6.1 | Identify geometric figures of line, line segments, rays, interesting lines, parallel lines. | Lines, Line Segments, Rays, Intersecting and Parallel Lines | draft | NONE | 1 | PENDING |
| 6.2 | Identify angles by shapes as right angle, less than right angle, or greater than right angle; perpendicular lines. | Right Angles, Smaller and Larger Angles, and Perpendicular Lines | draft | MANIPULATIVE_2D | 2 | PENDING |
| 6.3 | Identify triangles, quadrilaterals or pentago n, hexagon as polygon. | Polygons: Triangles, Quadrilaterals, Pentagons and Hexagons | draft | NONE | 1 | PENDING |
| 6.4 | Identify parts of a circle. | Parts of a Circle | draft | NONE | 0 | PENDING |
| 6.5 | Identify solid figures – spheres, cylinder, cones, cubes, rectangular prisms. | Solid Figures: Spheres, Cylinders, Cones, Cubes and Rectangular Prisms | draft | THREE_D | 3 | PENDING |
| 6.6 | Read and interpret bar graphs, line graphs, pie chart, and mode, mean, median, & average. | Reading and Interpreting Bar Graphs, Line Graphs and Pie Charts | draft | NONE | 2 | PENDING |
| 6.7 | Find the mode, medium, and mean using the given population data. | Finding the Mode, Median and Mean | draft | NONE | 2 | PENDING |
| 6.8 | Solve word problems involving drawing of diagrams. | Solving Word Problems by Drawing Diagrams | draft | NONE | 1 | PENDING |
