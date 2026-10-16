# Modernization review package: Decimal place value: reading and comparing decimals

- **Lesson:** `wk_pcs6a_mon_p1`, grade 6 MATH, track B_INSTRUCTIONAL_REDESIGN
- **Replaces (if released):** legacy revision `cmss8q6oi005jvo54b44tp6h5` (hash `818fee10b0c1684ab082208982b918e4b831d35014a5e34a102a8024e20216d4`). The legacy revision is preserved; historical references keep pointing at it.
- **Candidate:** `lmv1-g6-math-decimal-place-value@0.1.0`, hash `da6ab75973154ab6d68049f8196efc62a09d6632299e7c33e299af5b7686586c`
- **Author:** AI_AGENT `claude-code:library-modernization-v1` (anthropic-claude). The author may not review this candidate.
- **Pipeline status:** READY_FOR_INDEPENDENT_REVIEW (mechanical readiness only; not a review, not an approval).
- **Legacy audit outcome:** REVISE (12 findings).

## What successful independent performance looks like

- **ll-g6-math-decimal-place-value:** Without the chart, hints or a calculator, the learner writes the correct value of named digits in decimals up to thousandths, including digits after a zero (27.093: 9 → 0.09, 3 → 0.003), and still does so one week later.
- **ll-g6-math-decimal-compare:** Without help, the learner orders decimals of different lengths correctly (0.06, 0.6, 0.606, 0.66), explains a comparison by comparing tenths then hundredths, rejects the 'more digits is bigger' argument in writing, and applies the comparison in an unrehearsed context where the smaller number is better.

## Three layers

- **National Foundation:** Decimal place value to thousandths, the base for MOE Grade 6 rounding and decimal operations.
- **LiberiaLearn Mastery:** Comparing and ordering decimals with a written place-value justification, misconception-specific feedback, unscaffolded practice, and a 7-day retrieval check.
- **Global Excellence:** Transfer to race times where the smaller value wins, and an optional density challenge (decimals between 0.35 and 0.36), labelled beyond Grade 6 and never required.

## Readiness checks

| Check | Result | Blocking | Detail |
|---|---|---|---|
| V2-PARSE | pass | yes | Strict Curriculum V2 parse (authority and secret keys refused). |
| V2-CONTEXT | pass | yes | 0 errors; 0 review gap(s): none |
| SPEC-OBJECTIVES | pass | yes | Candidate scenes teach exactly the spec objectives. |
| SPEC-SUCCESS-CRITERIA | pass | yes | Every objective defines successful independent performance. |
| SPEC-PREREQUISITES | pass | yes | Spec prerequisites equal the candidate's prerequisite assumptions. |
| SPEC-AGE-BAND | pass | yes | Candidate age band UPPER_PRIMARY; grade 6 → UPPER_PRIMARY. |
| LEGACY-DISPOSITION-COMPLETE | pass | yes | All 6 legacy sections have a disposition. |
| AUTHORITY-NO-INVENTED-MOE | pass | yes | Every proposed MOE id exists in the structured source (proposal only). |
| DELIVERABILITY | pass | yes | Every scene deliverable (primary or fallback) in every runtime scenario. |
| BLUEPRINT | pass | yes | Assessment blueprint satisfied: coverage, diagnostics, independent practice, production, reasoning, selected share, retention, transfer, extension. |
| EXCELLENCE-AUTOMATED | pass | yes | No blocking automated findings (0 non-blocking). |
| PROTECTED-KEYS-SEPARATE | pass | yes | Mastery keys and rubrics live only in the reviewer-only assessment definitions. |
| PROJECTION-NO-REVIEWER-CONTENT | pass | yes | No keys, rubrics, expected observations or fallback routes in the learner projection. |
| PROJECTION-AUTHORITY | pass | yes | Projection authority CURRICULUM_V2_DRAFT: never APPROVED_RELEASE. |
| SX-INTRO-AND-OBJECTIVES | pass | yes | Clear introduction and stated objectives. |
| SX-TEXT-DENSITY | pass | yes | Every scene within 140 words (UPPER_PRIMARY). |
| SX-MEDIA-ALT | pass | yes | Every media item has alt text. |
| SX-KEYBOARD-SCREEN-READER | pass | yes | Every scene has a text alternative and keyboard path. |
| SX-OFFLINE | pass | yes | Packageable offline: true. |
| SX-PAGINATION | pass | yes | 13 scenes (contract 3-20); one scene per slide. |
| SX-NO-MASTERY-CLAIM | pass | yes | No learner-facing claim of mastery or completion success. |
| SX-FULLSCREEN-SLIDES-V2 | **fail** | no | Fullscreen Slides V2 layout contracts are not on this base (feat/fullscreen-slides-v2 is unmerged); checked against Lesson Player V2 only. |

## Automated Excellence checks (AUTOMATED reviewer; not a review)

Outcome: READY_FOR_QUALIFIED_HUMAN_REVIEW. Blueprint blocking gaps: none. Findings: 0.


## Decisions for humans

- **OD-MOE-COMPARE:** Is comparing decimals a National Foundation objective for Grade 6, or LiberiaLearn mastery beyond the listed MOE objectives? Author recommendation: Treat it as LiberiaLearn mastery that supports MOE rounding (obj2), so it never blocks an MOE-scoped mastery decision.
- **OD-LEGACY-ERROR:** The live legacy revision teaches that the 5 in 15.258 is worth 0.5. Should learners who saw it get a short correction note? Author recommendation: Yes: notify the 1 class with scheduled work on this lesson through the teacher, independent of whether this candidate is released.

## What the reviewer must do

1. Academic review (subject expert): accuracy of every explanation, example, key and Liberian context, against the exact candidate hash above.
2. Assessment review: keys, rubrics, misconception mappings, retention and transfer tasks in `assessment-definitions.json`.
3. Accessibility and localization review.
4. Record each decision as a `REVIEW_RECORDED` ledger event bound to this candidate hash. Acceptance needs human, independent ACCEPT on the ACADEMIC and ASSESSMENT scopes.
