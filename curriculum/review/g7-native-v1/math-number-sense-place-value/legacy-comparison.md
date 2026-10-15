# Legacy comparison — Number Sense and Place Value: Millions to Thousandths

**REVIEWER ONLY. CANDIDATE ONLY.** This compares the DRAFT candidate with the live legacy revision it may later replace. It records evidence and recommendations; it approves, publishes and changes nothing. Recommendations marked _reviewer decides_ are **not** applied to the candidate.

## Source and revision evidence

| Field | Value |
| --- | --- |
| Legacy content | `math-g7-1-number-sense-and-place-value-foundations` (pk `cmoeaemvu01i6vor4u3zch5hq`) |
| Revision compared | `cmss8t4hz00unvo54epnfst66` (BACKFILL_SNAPSHOT, origin LEGACY_UNKNOWN, backfill `p2a-production-backfill-20260814`) |
| Current revision of the row | yes (1 revision in total) |
| Provenance | `cmss8t4fo00ulvo54k7gexkpp`: lifecycle APPROVED, completeness UNVERIFIED |
| Stored content hash | `93cc90030c242b39cfbf9a86095802d967a7fd2dbcb6af7b9f7227f312fc540b` |
| Recomputed from extract | `93cc90030c242b39cfbf9a86095802d967a7fd2dbcb6af7b9f7227f312fc540b` (match) |
| Live row equals revision at capture | yes |
| Extract | `artifacts/g7-native-curriculum-v1/legacy/math-number-sense-place-value.json` (sha256 `639b89b918f6409f5caa2083186def70b3652a6f8f39129609b2e7b494c79357`) |
| Captured | 2026-10-15T19:09:16.876Z, transaction_read_only = on; lesson content only, no learner or user data |
| Candidate compared | `cv2-cand-g7-math-number-sense-place-value` v0.1.0, hash `5817d80911154bceb61fe117e0916ad64d0b7ae5c6afd2a2c6028b9cdc972ffb` |

## The legacy lesson

- The legacy body is a template shell (payload metadata: model "template-engine", source "national_curriculum_generation", estimated cost 0). Its ten sections describe what a teacher should do ("Model one complete math example…") but contain no numbers, place names, examples, questions or answers.
- `delivery.bodyBlock` (Day 1, Day 2, Home Support) repeats sentences from the same sections; it adds no material.
- The only concrete material is one offline lab, "Understanding Place Value with Local Materials" (25 minutes, 3 steps): leaves, stones and cassava stand for tens, ones and hundreds; learners build a number such as 123 and record it. Its two analysis questions ask how 345 breaks into hundreds, tens and units (expected "3 hundreds, 4 tens, and 5 units") and why place value matters.
- Assessment is a sentence ("a short exit task with two checks…"); `assessmentQuestions` and `problemSets` are empty, so the legacy lesson has no keyed items to compare.
- Standards: a keyword alignment (confidence low) to LiberiaLearn code LR-MATH-G7_9-04, "Apply the Pythagorean theorem and basic trigonometric ratios". The payload's own `moeAlignments` is empty.
- Governance: row status APPROVED, payload approvalStatus pending_approval, provenance UNVERIFIED with origin LEGACY_UNKNOWN (single BACKFILL_SNAPSHOT revision). Payload metadata nevertheless says qualityValidated: true and marks every section complete.

## Section-by-section comparison

Disposition: PRESERVED (kept in substance) · IMPROVED (kept, made more precise or correct) · REORGANIZED (kept, moved or split) · REPLACED (same job, new material) · OMITTED (not carried over) · NOT_RESTORED (deliberately excluded).

| Legacy section | Legacy content | Candidate scenes | Disposition | Note |
| --- | --- | --- | --- | --- |
| Objective | "Students in Grade 7 will explain and apply number sense and place value ideas using age-appropriate math tasks." | `objectives` | IMPROVED | One unmeasurable objective became three measurable ones (read/write, digit value, compare) with a success check on 3,462,105.68. |
| Teacher Explanation | Instruction to the teacher to introduce the concept with modelling, Liberia-relevant examples, vocabulary and a check; no content. | `chart`, `ten-times` | REPLACED | The candidate supplies the explanation itself: the millions-to-thousandths chart, periods, zero as a place holder, and the ×10 / ÷10 relationship. |
| Worked Example | "Model one complete math example connected to number sense and place value…" (placeholder; no example). | `worked-example`, `compare-strategy` | REPLACED | Two complete worked examples: value, expanded and word form of L$2,350,480 with a check by adding; ordering 0.5, 0.45, 0.405 and 4,099,999 vs 4,100,000. |
| Guided Practice | One shared and one partner task "with teacher prompts" (no tasks given). | `build-number`, `guided-decimals` | REPLACED | Concrete guided tasks with feedback. Pair work is not specified in the candidate (see R-M1). |
| Independent Practice | Individual work, then "explain one answer in writing or orally" (no items). | `practice`, `reflect` | REPLACED | Five independent items with feedback. The legacy "explain one answer" intent is kept in the written place-versus-value reflection. |
| Assessment | "Use a short exit task with two checks: one recall item and one application item." No items exist. | `exit-ticket` | REPLACED | Six candidate exit items (reviewer only), each mapped to an objective and misconception and machine-verified. See the assessment comparison. |
| Remediation | Re-teach with simpler examples, sentence frames and one scaffolded task (generic). | `misconceptions`, `warm-up` | IMPROVED | Four named misconceptions with targeted responses and per-option feedback; the warm-up diagnoses Grade 4 gaps before teaching. |
| Extension | Ask confident learners to solve a harder version or justify reasoning (generic). | — | OMITTED | The candidate has no extension task. See R-M3. |
| Guardian Support | Learner explains the main idea at home and does a short task with household materials (generic). | — | OMITTED | The candidate has no home connection. See R-M2. |
| Metadata | Grade 7 MATH unit "Number Sense and Place Value" lesson "Number Sense and Place Value: Foundations". | — | IMPROVED | Title revised to "Millions to Thousandths" (see the revision ledger); unit placement is a reviewer decision. |
| Lab: Understanding Place Value with Local Materials | Leaves = tens, stones = ones, cassava = hundreds; build and record a number such as 123; analysis questions on 345. | `build-number` | REORGANIZED | The candidate keeps the local-counter idea only as a fallback line ("stones or bottle caps as counters on your paper chart"). The legacy token values are not restored (L-M3); the group activity is a restoration option (R-M1). |
| Standards alignment (LR-MATH-G7_9-04) | Keyword alignment, confidence low: "Apply the Pythagorean theorem and basic trigonometric ratios". | — | NOT_RESTORED | Wrong topic; the candidate records exact MOE relationships instead. |

New candidate material with no legacy counterpart:
- `intro`: Hook with a large money amount (L$2,350,480) and a decimal measurement (2.375 kg).
- `warm-up`: Diagnostic check of Grade 4 place value and tenths.
- `misconceptions`: Three misconception checks (longer decimal is bigger, dropped zeros, decimal word form).
- `review`: Four key ideas before the exit ticket.

## Learning objectives

| Legacy objective | Candidate objectives | Change |
| --- | --- | --- |
| Explain and apply number sense and place value ideas using age-appropriate math tasks. | `ll-g7-math-place-value-read-write`<br>`ll-g7-math-place-value-digit-value`<br>`ll-g7-math-place-value-compare` | Scope made explicit: whole numbers to the millions and decimals to the thousandths, read/write in three forms, digit value through the ×10 relationship, comparing from the left. The legacy objective named no range; its only worked content (the lab) stopped at hundreds. |

## Questions, answers and assessment expectations

| Aspect | Legacy | Candidate | Reviewer must |
| --- | --- | --- | --- |
| Items | None. A one-line instruction for a teacher-made exit task. | Six single-choice candidate items in GovernedItem shape (assessment-review.json), 2 per objective. | Approve, revise or reject each item and key; confirm 2 items per objective is enough evidence. |
| Answer expectations | Lab analysis: "3 hundreds, 4 tens, and 5 units" for 345 (correct); "helps in understanding the value of numbers and performing arithmetic operations" (acceptable). | Keys verified by machine against independent place-value arithmetic; distractors mapped to named misconceptions. | Confirm distractors are plausible for Liberian Grade 7 learners and none is defensibly correct. |
| Scoring | Lab rubric: "1 point for each correct place value identification"; no mastery path. | No local scoring: Assessment Player V2 scores only after a released ontology binding (SERVER_AUTHORITY). | Decide the evidence context (DIAGNOSTIC or PRACTICE) for the release. |
| Calculator | Not addressed. | Calculators prohibited in the exit ticket. | Confirm the tool policy. |

## Concerns in the legacy lesson

Not restored unless a reviewer decides otherwise.

| Id | Severity | Category | Where | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| L-M1 | HIGH | STRUCTURAL | All body sections | The body contains no mathematics: every section is a template instruction with the topic name inserted. A learner or teacher receives nothing to teach from. | Nothing to preserve from the body. The candidate replaces every section. |
| L-M2 | HIGH | ALIGNMENT | standards.moeAlignments | Aligned (keyword, low confidence) to LR-MATH-G7_9-04, the Pythagorean theorem and trigonometric ratios, which is unrelated to place value. LR-* codes are LiberiaLearn codes (lib/curriculum/nr13Grades58.ts), not MOE items. | Do not carry the alignment forward. |
| L-M3 | MEDIUM | PEDAGOGICAL | Lab steps 1-2 | Different objects stand for different values (1 cassava = 100, 1 leaf = 10, 1 stone = 1). The tokens do not show that ten of one place make one of the next, so learners can build 123 by counting objects without understanding the grouping. | If the activity is restored, use identical counters placed in labelled columns of a paper chart, with a ten-for-one exchange (R-M1). |
| L-M4 | MEDIUM | ALIGNMENT | Lab | The lab only reaches hundreds (MOE Grade 2-3 scope: Math 1-6 p.14 and p.26), far below Grade 7. | Restore only the method, at the Grade 7 range. |
| L-M5 | LOW | STRUCTURAL | Lab materials | Materials list bottle caps and cups that no step uses; quantities (10 leaves, 20 stones, 5 cassava) do not match a number-building task. | Not restored. |
| L-M6 | LOW | LINGUISTIC | Lab analysis question 1 | Uses "units"; the MOE Grade 3 objective (Math 1-6 p.26) and the candidate use "ones". | Keep "ones". |
| L-M7 | MEDIUM | GOVERNANCE | Row status and payload metadata | Row status APPROVED while payload approvalStatus is pending_approval; metadata claims qualityValidated: true and full contentCompleteness for placeholder text. Provenance is UNVERIFIED, origin LEGACY_UNKNOWN. | Treat the legacy approval as unverified; it is not evidence of review. |

## Concerns in the candidate found by the comparison

| Id | Severity | Category | Where | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| C-M1 | HIGH | ALIGNMENT | Objectives, chart, worked-example, practice, exit items 1, 3, 6 | No MOE grade in the repository source covers whole numbers in the millions: Grade 4 stops at hundred thousand (Math 1-6 p.38), and the word "million" does not occur anywhere in the extracted Math 1-6 or Math 7-9 text. The millions range is a LiberiaLearn extension. | Curriculum authority decides (alignment decision A-M1). |
| C-M2 | MEDIUM | PEDAGOGICAL | Whole lesson | No group hands-on activity and no home connection. The legacy lesson had both (generic, but the intent is sound for classrooms with few devices). | See R-M1 and R-M2. |
| C-M3 | LOW | LINGUISTIC | intro, worked-example | Writes Liberian dollars as L$; the legacy essay lesson and other LiberiaLearn content use LD$. Both are in use in Liberia. | Reviewer chooses one convention (R-M4). |
| C-M4 | LOW | FACTUAL | intro | A market trader weighing 2.375 kg of rice assumes a scale that reads grams. Many market scales do not. | Reviewer confirms the context is realistic or substitutes one (for example a shop's digital scale). |

## Corrective recommendations

| Id | Kind | Scenes | Recommendation | Rationale | Status | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |
| R-M1 | RESTORE_ADAPTED | `build-number` | Restore the legacy local-materials activity as an optional classroom (no-device) activity, adapted: pairs draw a chart from millions to thousandths and place identical counters (stones or bottle caps) in the columns to build 3,406,029.508; ten counters in a column are exchanged for one counter in the next column to the left. | Keeps the legacy's hands-on, offline intent and pair work, fixes L-M3, and reaches the Grade 7 range. | reviewer decides | ACCEPT / MODIFY / REJECT: |
| R-M2 | RESTORE_ADAPTED | `reflect` | Add a home connection: the learner finds one large number (a price or a figure heard on the radio) and one decimal measurement, reads both to a family member and names the value of each digit. | Restores the legacy guardian-support intent with a concrete task. | reviewer decides | ACCEPT / MODIFY / REJECT: |
| R-M3 | REVIEWER_DECISION | `practice` | Decide whether to add an extension task, for example: using the digits 0, 3, 5, 7 and 9 once each with three decimal places, write the greatest and the least number possible and explain why. | The legacy named an extension but gave none; the candidate has none. | reviewer decides | ACCEPT / MODIFY / REJECT: |
| R-M4 | REVIEWER_DECISION | `intro`, `worked-example` | Choose L$ or LD$ for Liberian dollars and apply it across Grade 7 content. | C-M3. | reviewer decides | ACCEPT / MODIFY / REJECT: |
| R-M5 | DO_NOT_RESTORE | — | Do not restore the LR-MATH-G7_9-04 alignment, the cassava/leaf/stone token values, the hundreds-only range, or "units" terminology. | L-M2, L-M3, L-M4, L-M6. | reviewer decides | ACCEPT / MODIFY / REJECT: |

## Open curriculum-alignment decisions

### A-M1. Should place value through the thousandths remain a Grade 7 prerequisite/reinforcement lesson supporting decimals, fractions and percentages?

Evidence (repository-held MOE source; MOE source provenance is not MOE approval):
- MOE Grade 7 Math (Math 7-9 pp.2-16) has six periods: Arithmetic skills and Sets (S1 P1), Fractions (P2), Decimals, percents and fractions (P3, p.10), Basic algebra (S2 P4), Geometry (P5), Co-ordinate geometry (P6). None has a place-value objective (test: "the structured source has no Grade 7 objective…").
- Grade 7 P3 (p.10): obj1 "Convert from decimal to percent/fraction and vice versa"; obj2 "Apply decimal and percent to the solution of problems involving commissions, discounts, taxes, interest, profits and losses and rayolty" [sic]. Both use decimal place value.
- Earlier grades: G3 place value to thousands (Math 1-6 p.26); G4 read/write and compare whole numbers to hundred thousand (p.38) and decimals to hundredths (p.45); G5 multiply and divide whole numbers and decimals; G6 "Round off decimals to the nearest tenth, hundredths and thousandths" (p.67).
- The word "million" does not occur in the extracted Math 1-6 or Math 7-9 text (curriculum/sources/intermediate).
- The legacy row is lesson 1 of LiberiaLearn unit math-g7-1-number-sense-and-place-value; MOE Grade 7 period 1 is Arithmetic skills and Sets, not number sense.

| Option | Description | Consequences |
| --- | --- | --- |
| A. Keep as a prerequisite/reinforcement lesson before P3 | Keep the three objectives as LiberiaLearn candidates with their PREREQUISITE_FOR relationships to Math 7-9 p.10, placed before the decimals, percents and fractions period. Millions stay as a labelled extension of the Grade 4 range. | No content change. The authority must accept a LiberiaLearn extension beyond any MOE grade (millions). |
| B. Keep, but rescope to decimal place value | Make tenths to thousandths (reading, digit value, comparing) the core, matching G4 p.45 and G6 p.67 and feeding P3 directly. Whole numbers above hundred thousand become optional enrichment. | Revise intro, chart, worked-example, practice items 1-3 and exit items 1, 3 and 6 (or mark them enrichment); regenerate the package. |
| C. Use as a diagnostic/remediation resource only | Remove the lesson from the Grade 7 core sequence and offer it when the warm-up or P3 work shows place-value gaps. | No Grade 7 core objective. Retiring or repointing the legacy unit needs a separate authorized change that respects its learner history. |

Author's recommendation: A, placed as a prerequisite to Math 7-9 P3 rather than as unit 1 core content, with millions labelled as a LiberiaLearn extension. This is the author's recommendation, not a decision; a qualified Math reviewer and the curriculum authority decide.

- [ ] Decision on A-M1 (A / B / C / other), recorded through governed curriculum review: ____

## Reviewer sign-off

Sign-off is valid only when recorded through governed curriculum review (HUMAN_REVIEW) against candidate hash `5817d80911154bceb61fe117e0916ad64d0b7ae5c6afd2a2c6028b9cdc972ffb` and legacy revision `cmss8t4hz00unvo54epnfst66`. Filling in this file records nothing.

- [ ] I compared the candidate with the legacy revision and confirm (or have corrected) the section matrix above.
- [ ] I recorded a decision on every recommendation.
- [ ] I confirm no legacy material listed under Concerns is re-introduced without correction.

| Field | Entry |
| --- | --- |
| Reviewer name | |
| Qualification (subject, grade band) | |
| Organisation / role | |
| Date | |
| Governed review record id | |
| Decision (APPROVE / REVISE / REJECT) | |
| Notes | |
