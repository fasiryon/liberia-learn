# Excellence gap report: Number Sense and Place Value: Millions to Thousandths

Grade 7 MATH · candidate `cv2-cand-g7-math-number-sense-place-value@0.2.0` · liberialearn-curriculum-excellence/1.0.0

> **CANDIDATE ONLY. Advisory AI review.** Nothing here approves, publishes, releases or certifies this lesson, and nothing here claims human qualification or MOE/WAEC approval. Approval of native curriculum requires an identified, qualified human reviewing the exact revision (`lib/curriculum/v2/governance.ts`). A design rubric is not learning evidence: a lesson succeeds only when students independently show they learned, retained and can apply it (pilot plan).

> **Not an independent review.** Reviewer claude-code:curriculum-excellence-v1 (AI, anthropic-claude) shares a model family with the candidate's author (SAME_MODEL_FAMILY:anthropic-claude). It may be used as advice but does not count toward an independent-review requirement.

## Exact revision

- Source: PR #191 at commit `1ad2e9ec3cbbcd15d3e0cccacfb5614951d52462` (read with `git show`; not copied, not modified)
- Candidate: `curriculum/v2/g7/candidates/math-number-sense-place-value.json` sha256 `3f612d907f52f5953d879476a627fde8e9a1c5b3d30d22e171a42a8ccec80c0c`
- Assessment (reviewer only): `curriculum/review/g7-native-v1/math-number-sense-place-value/assessment-review.json` sha256 `c79d29abcc504a67bf1d5b12d725241c51fda32900cf74c9827252ddecbbaed8`
- Proposed plan: `excellence-plan-g7-math-place-value-0.1.0` sha256 `8f296bdd8d8aeb8a86a899e845d4240bf6e50e4cb1a31aa251eef9d37d859287`
- Report sha256: `895409e42131fd11aca77ded4e5ea14e25672f133c3976e4feb52e3d0733bb98` (void for any other revision; see `assertReportMatchesRevision`)

## Summary

- Reviewer outcome: **REVISE_BEFORE_HUMAN_REVIEW** (the reviewer has no approve outcome)
- Findings: 10 blocking, 14 major, 2 minor (21 deterministic, 5 AI judgment needing human confirmation)
- Selected response share of end-of-lesson mastery evidence: 100% as is; 55% if the plan is adopted
- Blueprint blocking gaps as is: BP-PREREQUISITE-DIAGNOSTIC, BP-PRODUCTION, BP-REASONING, BP-SELECTED-SHARE, BP-RETENTION, BP-TRANSFER, BP-EXTENSION; if the plan is adopted (mechanical projection, unreviewed): none
- Existing package gaps from PR #191 (unchanged here): MOE_OBJECTIVE_UNBOUND, TEMPLATE_CELL_MISSING, ONTOLOGY_RELEASE_MISSING, SCOPE_EXTENSION_UNAPPROVED, LEGACY_COMPARISON_SIGNOFF, ASSESSMENT_ITEMS_PENDING

## Three layers

| Layer | Attained as is | Blocking criteria not yet met |
| --- | --- | --- |
| National Foundation | no | NF-ALN-1, NF-ALN-2, NF-ALN-3, NF-ACC-1, NF-ACC-2, NF-PRG-1, NF-ACS-1 |
| LiberiaLearn Mastery | no | LM-CON-1, LM-RSN-1, LM-ASM-1, LM-ASM-2, LM-ASM-3 |
| Global Excellence | no | GE-RSN-1, GE-TRN-1, GE-EXT-1, GE-ASM-1, GE-ACC-1 |

Layer attainment is cumulative and design-only (`isLearningEvidence: false`). HUMAN_REQUIRED criteria cannot be rated MET by this reviewer, so no layer can be attained without qualified human review. The last column re-evaluates only blueprint-checked criteria with the proposed plan added (— means the blueprint does not check that criterion); it ignores findings and is not a review of the plan.

### National Foundation

| Criterion | Blocking | As is | Blueprint if plan adopted | Basis |
| --- | --- | --- | --- | --- |
| `NF-ALN-1` Every lesson objective is bound to a structured MOE objective, or is recorded as a named LiberiaLearn scope extension that a curriculum owner has decided. | yes | NOT_EVALUATED | — | Requires a qualified human reviewer. |
| `NF-ALN-2` Where an examination applies (LJHSCE, WASSCE) the lesson is mapped to the WAEC baseline competency it prepares for, with the evidence specificity stated and no WAEC approval claimed. | yes | NOT_EVALUATED | — | No AI finding; advisory judgment is not a MET rating. |
| `NF-ALN-3` Content above the MOE grade scope is labelled as extension and is never required for the grade's mastery decision. | yes | NOT_MET | — | ai-m4-mastery-depends-on-unapproved-scope |
| `NF-ACC-1` Every keyed item has exactly one defensible correct response, verified mechanically where the domain allows. | yes | NOT_EVALUATED | — | No deterministic check covers this criterion yet. |
| `NF-ACC-2` Explanations, worked examples and Liberian facts are correct, checked by an identified subject expert. | yes | NOT_EVALUATED | — | Requires a qualified human reviewer. |
| `NF-PRG-1` Every stated prerequisite is diagnosed before instruction depends on it, with a route for learners who lack it. | yes | NOT_MET | MET | BP-PREREQUISITE-DIAGNOSTIC, det-prereq-0, det-prereq-1, det-prereq-2 |
| `NF-ASM-1` Every objective is assessed by at least one item or task at the end of the lesson. | yes | MET | MET | blueprint:BP-COVERAGE |
| `NF-ACS-1` Every scene has a text alternative and keyboard path, and every non-renderable interaction has an objective-preserving offline fallback. | yes | NOT_EVALUATED | — | No deterministic check covers this criterion yet. |
| `NF-REL-1` Liberian contexts are accurate, respectful and not stereotyped; invented data is labelled as invented. | no | NOT_EVALUATED | — | Requires a qualified human reviewer. |

### LiberiaLearn Mastery

| Criterion | Blocking | As is | Blueprint if plan adopted | Basis |
| --- | --- | --- | --- | --- |
| `LM-PRG-1` Support fades from modelled to guided to independent: every objective reaches unscaffolded (NONE) practice before mastery evidence is collected. | yes | MET | MET | blueprint:BP-INDEPENDENT-PRACTICE |
| `LM-CON-1` Every catalogued misconception is taught against and is diagnosable in assessment through a correctly mapped distractor or response pattern. | yes | PARTIALLY_MET | — | det-mc-unassessed-mc-decimal-word-form, det-mismap-g7-pv-exit-1-0, det-mismap-g7-pv-exit-1-1, det-mismap-g7-pv-exit-1-3, det-mismap-g7-pv-exit-2-1, det-mismap-g7-pv-exit-2-2, det-mismap-g7-pv-exit-4-1, det-mismap-g7-pv-exit-5-0, det-mismap-g7-pv-exit-5-2, det-mismap-g7-pv-exit-6-0, det-mismap-g7-pv-exit-6-2, ai-m2-place-shift-uncatalogued, ai-m3-whole-number-item-decimal-misconception |
| `LM-CON-2` Each objective is evidenced in more than one form (e.g. recognise and produce; explain and apply). | no | NOT_EVALUATED | — | No deterministic check covers this criterion yet. |
| `LM-RSN-1` Where reasoning is central, the learner must produce a justification or explanation without scaffolds; selection of a correct option is not accepted as reasoning evidence. | yes | NOT_MET | MET | BP-REASONING, det-bp-reasoning |
| `LM-ASM-1` The subject assessment blueprint is satisfied (assessmentBlueprint.ts). | yes | NOT_MET | MET | BP-PRODUCTION, BP-SELECTED-SHARE, det-bp-production, det-bp-selected-share |
| `LM-ASM-2` Mastery evidence is independent: collected with hints, worked examples, AI help and answer feedback withheld, and any assistance recorded. | yes | PARTIALLY_MET | — | det-mastery-assistance |
| `LM-ASM-3` Retention is planned: each mastery objective has spaced, delayed retrieval at least 7 days after the lesson. | yes | NOT_MET | MET | BP-RETENTION, det-bp-retention |
| `LM-ACS-1` Language load suits the age band, with support for emerging readers that does not lower the mathematical or literary demand. | no | NOT_EVALUATED | — | Requires a qualified human reviewer. |
| `LM-REL-1` At least one task applies the objective to an authentic Liberian situation the learner could meet. | no | NOT_EVALUATED | — | No AI finding; advisory judgment is not a MET rating. |

### Global Excellence

| Criterion | Blocking | As is | Blueprint if plan adopted | Basis |
| --- | --- | --- | --- | --- |
| `GE-RSN-1` Includes a non-routine problem or argument at the reasoning level of strong international frameworks (e.g. TIMSS reasoning domain, PISA proficiency levels). | yes | NOT_EVALUATED | — | No AI finding; advisory judgment is not a MET rating. |
| `GE-TRN-1` Transfer is assessed in a context, representation or genre the lesson did not rehearse. | yes | NOT_MET | MET | BP-TRANSFER, det-bp-transfer |
| `GE-EXT-1` An optional extension path goes beyond grade scope for ready learners without gating anyone's progress. | yes | NOT_MET | MET | BP-EXTENSION, det-bp-extension |
| `GE-ASM-1` Performance is independently comparable: some outcome measures are scored blind or by an external, independently developed instrument. | yes | NOT_EVALUATED | — | Requires a qualified human reviewer. |
| `GE-ACC-1` A second, independent subject expert has checked the reasoning and extension tasks. | yes | NOT_EVALUATED | — | Requires a qualified human reviewer. |

## Assessment blueprint

Subject family MATH, liberialearn-assessment-blueprint/1.0.0.

| Rule | Criterion | Requirement | As is | If plan adopted |
| --- | --- | --- | --- | --- |
| BP-COVERAGE | NF-ASM-1 | Every objective has end-of-lesson mastery evidence at scaffold NONE. | met | met |
| BP-PREREQUISITE-DIAGNOSTIC | NF-PRG-1 | Every stated prerequisite has a diagnostic task with a fallback route. | **not met** (prerequisite[0], prerequisite[1], prerequisite[2]) | met |
| BP-INDEPENDENT-PRACTICE | LM-PRG-1 | Every objective reaches unscaffolded practice before mastery evidence. | met | met |
| BP-PRODUCTION | LM-ASM-1 | Every objective has mastery evidence that is a produced answer or justification (not a selected option). | **not met** (ll-g7-math-place-value-read-write, ll-g7-math-place-value-digit-value, ll-g7-math-place-value-compare) | met |
| BP-REASONING | LM-RSN-1 | At least one unscaffolded, rubric-scored reasoning or justification task. | **not met** (EXTENDED_REASONING) | met |
| BP-SELECTED-SHARE | LM-ASM-1 | Selected response is at most 60% of end-of-lesson mastery evidence. | **not met** (SELECTED_RESPONSE_SHARE) | met |
| BP-RETENTION | LM-ASM-3 | Every objective has delayed retrieval at least 7 days after the lesson. | **not met** (ll-g7-math-place-value-read-write, ll-g7-math-place-value-digit-value, ll-g7-math-place-value-compare) | met |
| BP-TRANSFER | GE-TRN-1 | At least one unscaffolded transfer task in a context the lesson did not rehearse. | **not met** (TRANSFER_TASK) | met |
| BP-EXTENSION | GE-EXT-1 | An optional, non-gating extension task. | **not met** (EXTENSION) | met |

## Findings

### BLOCKING · BLUEPRINT_PRODUCTION_UNMET · `det-bp-production`

Every objective has mastery evidence that is a produced answer or justification (not a selected option). Not met: ll-g7-math-place-value-read-write, ll-g7-math-place-value-digit-value, ll-g7-math-place-value-compare. Accepted kinds: SHORT_CONSTRUCTED_RESPONSE, EXTENDED_REASONING, PERFORMANCE_TASK.

- Criterion: `LM-ASM-1` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `e06c2a768e1b…`)

### BLOCKING · BLUEPRINT_REASONING_UNMET · `det-bp-reasoning`

At least one unscaffolded, rubric-scored reasoning or justification task. Not met: EXTENDED_REASONING. 0 reasoning task(s) at mastery.

- Criterion: `LM-RSN-1` (LiberiaLearn Mastery, REASONING)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `e06c2a768e1b…`)

### BLOCKING · BLUEPRINT_SELECTED_SHARE_UNMET · `det-bp-selected-share`

Selected response is at most 60% of end-of-lesson mastery evidence. Not met: SELECTED_RESPONSE_SHARE. 6/6 selected response (100%).

- Criterion: `LM-ASM-1` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `e06c2a768e1b…`)

### BLOCKING · BLUEPRINT_RETENTION_UNMET · `det-bp-retention`

Every objective has delayed retrieval at least 7 days after the lesson. Not met: ll-g7-math-place-value-read-write, ll-g7-math-place-value-digit-value, ll-g7-math-place-value-compare. Spaced retrieval, unscaffolded.

- Criterion: `LM-ASM-3` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `e06c2a768e1b…`)

### BLOCKING · BLUEPRINT_TRANSFER_UNMET · `det-bp-transfer`

At least one unscaffolded transfer task in a context the lesson did not rehearse. Not met: TRANSFER_TASK. Near or far transfer, NEW context.

- Criterion: `GE-TRN-1` (Global Excellence, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `e06c2a768e1b…`)

### BLOCKING · BLUEPRINT_EXTENSION_UNMET · `det-bp-extension`

An optional, non-gating extension task. Not met: EXTENSION. Extension is optional and never required for mastery.

- Criterion: `GE-EXT-1` (Global Excellence, ADVANCED_EXTENSION)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `e06c2a768e1b…`)

### BLOCKING · PREREQUISITE_NOT_DIAGNOSED · `det-prereq-0`

The lesson assumes "Can read and write whole numbers to at least 100,000 (MOE Grade 4 numeration)." but no diagnostic task checks it or routes learners who lack it.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: DETERMINISTIC
- Recommendation: Add a short diagnostic item for this prerequisite with a stated fallback route.
- Evidence: CANDIDATE `/prerequisiteAssumptions/0` (value sha256 `f3d97b8d9b12…`)

### BLOCKING · PREREQUISITE_NOT_DIAGNOSED · `det-prereq-1`

The lesson assumes "Knows that 0.5 means five tenths and can read simple decimals aloud." but no diagnostic task checks it or routes learners who lack it.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: DETERMINISTIC
- Recommendation: Add a short diagnostic item for this prerequisite with a stated fallback route.
- Evidence: CANDIDATE `/prerequisiteAssumptions/1` (value sha256 `7cd2840d036d…`)

### BLOCKING · PREREQUISITE_NOT_DIAGNOSED · `det-prereq-2`

The lesson assumes "Can multiply a single digit by 10, 100 and 1,000." but no diagnostic task checks it or routes learners who lack it.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: DETERMINISTIC
- Recommendation: Add a short diagnostic item for this prerequisite with a stated fallback route.
- Evidence: CANDIDATE `/prerequisiteAssumptions/2` (value sha256 `7b503b495473…`)

### MAJOR · MISCONCEPTION_NOT_DIAGNOSABLE · `det-mc-unassessed-mc-decimal-word-form`

Misconception mc-decimal-word-form is catalogued but no exit-item distractor is mapped to it, so the exit evidence cannot detect it.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map a distractor or a constructed-response pattern to it, or record why end-of-lesson evidence need not detect it.
- Evidence: CANDIDATE `/misconceptions/2` (value sha256 `4b1cef65a4b7…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-1-0`

Distractor 0 ("600") of g7-pv-exit-1 is mapped to mc-digit-not-value (DIGIT_INSTEAD_OF_VALUE), but that error does not produce this option. It is produced by: PLACE_SHIFT.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Remap to a misconception for PLACE_SHIFT (add one to the catalogue if needed), or replace the distractor.
- Evidence: ASSESSMENT `/items/0/distractorMisconceptions/0` (value sha256 `3336d6cd51b1…`)
- Evidence: ASSESSMENT `/items/0/item/options/0` (value sha256 `b08eab77f8e1…`)
- Evidence: ASSESSMENT `/items/0/verification` (value sha256 `256a186ef987…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-1-1`

Distractor 1 ("6,000") of g7-pv-exit-1 is mapped to mc-digit-not-value (DIGIT_INSTEAD_OF_VALUE), but that error does not produce this option. It is produced by: PLACE_SHIFT.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Remap to a misconception for PLACE_SHIFT (add one to the catalogue if needed), or replace the distractor.
- Evidence: ASSESSMENT `/items/0/distractorMisconceptions/1` (value sha256 `3336d6cd51b1…`)
- Evidence: ASSESSMENT `/items/0/item/options/1` (value sha256 `6f6f1a638379…`)
- Evidence: ASSESSMENT `/items/0/verification` (value sha256 `256a186ef987…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-1-3`

Distractor 3 ("600,000") of g7-pv-exit-1 is mapped to mc-digit-not-value (DIGIT_INSTEAD_OF_VALUE), but that error does not produce this option. It is produced by: PLACE_SHIFT.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Remap to a misconception for PLACE_SHIFT (add one to the catalogue if needed), or replace the distractor.
- Evidence: ASSESSMENT `/items/0/distractorMisconceptions/3` (value sha256 `3336d6cd51b1…`)
- Evidence: ASSESSMENT `/items/0/item/options/3` (value sha256 `b11c3c555810…`)
- Evidence: ASSESSMENT `/items/0/verification` (value sha256 `256a186ef987…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-2-1`

Distractor 1 ("0.8") of g7-pv-exit-2 is mapped to mc-digit-not-value (DIGIT_INSTEAD_OF_VALUE), but that error does not produce this option. It is produced by: PLACE_SHIFT.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Remap to a misconception for PLACE_SHIFT (add one to the catalogue if needed), or replace the distractor.
- Evidence: ASSESSMENT `/items/1/distractorMisconceptions/1` (value sha256 `3336d6cd51b1…`)
- Evidence: ASSESSMENT `/items/1/item/options/1` (value sha256 `07d60e4fca0c…`)
- Evidence: ASSESSMENT `/items/1/verification` (value sha256 `108c2db4528e…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-2-2`

Distractor 2 ("0.08") of g7-pv-exit-2 is mapped to mc-digit-not-value (DIGIT_INSTEAD_OF_VALUE), but that error does not produce this option. It is produced by: PLACE_SHIFT.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Remap to a misconception for PLACE_SHIFT (add one to the catalogue if needed), or replace the distractor.
- Evidence: ASSESSMENT `/items/1/distractorMisconceptions/2` (value sha256 `3336d6cd51b1…`)
- Evidence: ASSESSMENT `/items/1/item/options/2` (value sha256 `8b9f7be29657…`)
- Evidence: ASSESSMENT `/items/1/verification` (value sha256 `108c2db4528e…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-4-1`

Distractor 1 ("5 + 0.03 + 0.007") of g7-pv-exit-4 is mapped to mc-digit-not-value (DIGIT_INSTEAD_OF_VALUE), but that error does not produce this option. It is produced by: PLACE_SHIFT.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Remap to a misconception for PLACE_SHIFT (add one to the catalogue if needed), or replace the distractor.
- Evidence: ASSESSMENT `/items/3/distractorMisconceptions/1` (value sha256 `3336d6cd51b1…`)
- Evidence: ASSESSMENT `/items/3/item/options/1` (value sha256 `063b40a809b2…`)
- Evidence: ASSESSMENT `/items/3/verification` (value sha256 `9130249f00c3…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-5-0`

Distractor 0 ("0.37, 0.307, 0.3") of g7-pv-exit-5 is mapped to mc-longer-decimal-bigger (LONGER_DECIMAL_GREATER), but that error does not produce this option. It is produced by: ORDER_REVERSED.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Remap to a misconception for ORDER_REVERSED (add one to the catalogue if needed), or replace the distractor.
- Evidence: ASSESSMENT `/items/4/distractorMisconceptions/0` (value sha256 `7939241e13cd…`)
- Evidence: ASSESSMENT `/items/4/item/options/0` (value sha256 `d4fd72bd912f…`)
- Evidence: ASSESSMENT `/items/4/verification` (value sha256 `a188eeeec009…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-5-2`

Distractor 2 ("0.307, 0.3, 0.37") of g7-pv-exit-5 is mapped to mc-longer-decimal-bigger (LONGER_DECIMAL_GREATER), but that error does not produce this option. No modelled error produces it.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Replace the distractor with one a learner holding the mapped misconception would choose, or remove the mapping.
- Evidence: ASSESSMENT `/items/4/distractorMisconceptions/2` (value sha256 `7939241e13cd…`)
- Evidence: ASSESSMENT `/items/4/item/options/2` (value sha256 `477787b76996…`)
- Evidence: ASSESSMENT `/items/4/verification` (value sha256 `a188eeeec009…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-6-0`

Distractor 0 ("6,009,999") of g7-pv-exit-6 is mapped to mc-longer-decimal-bigger (LONGER_DECIMAL_GREATER), but that error does not produce this option. No modelled error produces it.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Replace the distractor with one a learner holding the mapped misconception would choose, or remove the mapping.
- Evidence: ASSESSMENT `/items/5/distractorMisconceptions/0` (value sha256 `7939241e13cd…`)
- Evidence: ASSESSMENT `/items/5/item/options/0` (value sha256 `a3950abdd802…`)
- Evidence: ASSESSMENT `/items/5/verification` (value sha256 `234c34c34806…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `det-mismap-g7-pv-exit-6-2`

Distractor 2 ("They are equal") of g7-pv-exit-6 is mapped to mc-longer-decimal-bigger (LONGER_DECIMAL_GREATER), but that error does not produce this option. No modelled error produces it.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Replace the distractor with one a learner holding the mapped misconception would choose, or remove the mapping.
- Evidence: ASSESSMENT `/items/5/distractorMisconceptions/2` (value sha256 `7939241e13cd…`)
- Evidence: ASSESSMENT `/items/5/item/options/2` (value sha256 `888a3d3b8699…`)
- Evidence: ASSESSMENT `/items/5/verification` (value sha256 `234c34c34806…`)

### MINOR · MASTERY_ITEMS_CARRY_ASSISTANCE · `det-mastery-assistance`

6 end-of-lesson item(s) (g7-pv-exit-1, g7-pv-exit-2, g7-pv-exit-3, g7-pv-exit-4, g7-pv-exit-5, g7-pv-exit-6) carry a hint and/or worked example; if either is shown before the response, the response is not independent evidence.

- Criterion: `LM-ASM-2` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC, requires human confirmation
- Recommendation: Withhold hints and worked examples until after the scored response, and record any assistance in the governed evidence metadata.
- Evidence: ASSESSMENT `/items/0/item` (value sha256 `83a7caf5e819…`)
- Evidence: ASSESSMENT `/items/1/item` (value sha256 `f472bfcf0aa0…`)
- Evidence: ASSESSMENT `/items/2/item` (value sha256 `3d1d98033510…`)
- Evidence: ASSESSMENT `/items/3/item` (value sha256 `a538ad15ec25…`)
- Evidence: ASSESSMENT `/items/4/item` (value sha256 `7f0da1595e59…`)
- Evidence: ASSESSMENT `/items/5/item` (value sha256 `9f6688a0fe13…`)

### MAJOR · STRONGEST_REASONING_TASK_UNSCORED · `ai-m1-reasoning-left-unscored`

The lesson's only unscaffolded explanation task is in the reflect scene, recorded as REFLECTION evidence, so the best reasoning evidence the lesson collects never counts toward mastery. The end-of-lesson evidence is six selected-response items.

- Criterion: `LM-RSN-1` (LiberiaLearn Mastery, REASONING)
- Method: AI_JUDGMENT, confidence 0.9, requires human confirmation
- Recommendation: Keep the reflection, and add a rubric-scored explanation task to the end-of-lesson evidence using new numbers (proposed task pm-r2), so explaining place value is part of the mastery decision.
- Evidence: CANDIDATE `/scenes/14/interaction/prompts/0/prompt` "Explain to a friend why the 4 in 40,000 and the 4 in 0.04 are worth different amounts." (value sha256 `ba29c891427a…`)
- Evidence: CANDIDATE `/scenes/14/evidence/kind` "REFLECTION" (value sha256 `097fcafb48c4…`)
- Evidence: CANDIDATE `/assessmentRequests/0/interaction` "SINGLE_CHOICE" (value sha256 `eca366e39a1f…`)

### MAJOR · DOMINANT_ERROR_UNCATALOGUED · `ai-m2-place-shift-uncatalogued`

Most digit-value distractors are the right digit in the wrong place (600, 6,000 and 600,000 for a true value of 60,000), but the catalogue has no misconception for a place shift. They are filed under mc-digit-not-value, which describes giving the digit itself.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: AI_JUDGMENT, confidence 0.9, requires human confirmation
- Recommendation: Add a catalogue entry for the place-shift error (proposed mc-place-shift) and remap those distractors to it, so a teacher can tell a learner who miscounts places from one who ignores place altogether.
- Evidence: CANDIDATE `/misconceptions/0/description` "Gives the digit itself (3) instead of its value in the number (300,000)." (value sha256 `8ee51e08b251…`)
- Evidence: ASSESSMENT `/items/0/item/options` "600,000" (value sha256 `c94c3f432ab4…`)
- Evidence: ASSESSMENT `/items/0/distractorMisconceptions/3` "mc-digit-not-value" (value sha256 `3336d6cd51b1…`)

### MAJOR · ITEM_MISCONCEPTION_DOMAIN_MISMATCH · `ai-m3-whole-number-item-decimal-misconception`

g7-pv-exit-6 compares two whole numbers, but both of its mapped distractors name mc-longer-decimal-bigger, a decimal misconception. A learner who picks 6,009,999 is more likely judging by the larger digits (the run of nines) than by decimal length.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: AI_JUDGMENT, confidence 0.85, requires human confirmation
- Recommendation: Map option 0 to a new whole-number comparison misconception (proposed mc-compare-by-digits) and leave 'They are equal' unmapped or map it after classroom evidence; or replace the item with a decimal comparison that the mapped misconception actually predicts.
- Evidence: ASSESSMENT `/items/5/item/prompt` "Which number is greater: 6,009,999 or 6,010,000?" (value sha256 `56f3c673e714…`)
- Evidence: CANDIDATE `/misconceptions/3/description` "Thinks a decimal with more digits is greater" (value sha256 `7444cba69d18…`)

### BLOCKING · MASTERY_EVIDENCE_DEPENDS_ON_UNAPPROVED_SCOPE · `ai-m4-mastery-depends-on-unapproved-scope`

Three of the six exit items use millions, which the package records as an unapproved LiberiaLearn scope extension. If the extension is declined, each objective is left with one end-of-lesson item, which is too thin a basis for a mastery decision.

- Criterion: `NF-ALN-3` (National Foundation, ALIGNMENT)
- Method: AI_JUDGMENT, confidence 0.8, requires human confirmation
- Recommendation: Ask the curriculum owner for the scope decision before item review. In the meantime, add constructed-response mastery tasks within MOE scope (proposed pm-c1, pm-c2, pm-r1) so mastery evidence survives either decision.
- Evidence: CANDIDATE `/scenes/0/content/body` "from the millions down to the thousandths" (value sha256 `93fe513ac600…`)
- Evidence: ASSESSMENT `/items/0/item/prompt` "What is the value of the 6 in 3,462,105?" (value sha256 `634732acfcc5…`)
- Evidence: ASSESSMENT `/items/2/item/prompt` "Which number is seven million, three hundred five thousand, forty?" (value sha256 `34e551d8c60f…`)
- Evidence: ASSESSMENT `/items/5/item/prompt` "Which number is greater: 6,009,999 or 6,010,000?" (value sha256 `56f3c673e714…`)

### MINOR · WARM_UP_NOT_DIAGNOSTIC · `ai-m5-warm-up-is-not-a-diagnostic`

The warm-up is the natural place to check prerequisites, but it is fully scaffolded and unmarked, has two items, does not check the multiply-by-10, 100 and 1,000 prerequisite, and gives no route for a learner who answers wrongly.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: AI_JUDGMENT, confidence 0.85, requires human confirmation
- Recommendation: Turn the warm-up into a three-item diagnostic, one item per prerequisite, each with a fallback route (proposed pm-d0 to pm-d2). It can stay unmarked for the learner while still informing the teacher.
- Evidence: CANDIDATE `/scenes/2/content/body` "These answers are not marked." (value sha256 `ce435fe7e4ca…`)
- Evidence: CANDIDATE `/prerequisiteAssumptions/2` "Can multiply a single digit by 10, 100 and 1,000." (value sha256 `7b503b495473…`)

## Proposed assessment plan (unreviewed)

`excellence-plan-g7-math-place-value-0.1.0` was written by the same AI reviewer, so the reviewer may not review it (`SELF_REVIEW_PROHIBITED`). The coverage columns above are a mechanical projection, not a review. Keys and scoring guides are reviewer only.

### Prerequisite diagnostics

- **`pm-d0`** PREREQUISITE_DIAGNOSTIC · PRE_LESSON · scaffold NONE · REHEARSED context · KEYED · prerequisite[0] · objectives `ll-g7-math-place-value-read-write`
  - Prompt: (a) Write 40,306 in words. (b) Write 'twelve thousand, five' in digits.
  - Key: (a) forty thousand, three hundred six (b) 12,005
  - If missing: Before the chart scene, rebuild the thousands period with counters on a paper chart (MOE Grade 4 numeration), then re-check with two similar numbers.
- **`pm-d1`** PREREQUISITE_DIAGNOSTIC · PRE_LESSON · scaffold NONE · REHEARSED context · KEYED · prerequisite[1] · objectives `ll-g7-math-place-value-digit-value`
  - Prompt: How many tenths are in 0.5? How many hundredths are in 0.5?
  - Key: 5 tenths; 50 hundredths
  - If missing: Fold a paper strip into ten equal parts and shade five; then fold each tenth into ten to show 50 hundredths. Re-check with 0.3.
- **`pm-d2`** PREREQUISITE_DIAGNOSTIC · PRE_LESSON · scaffold NONE · REHEARSED context · KEYED · prerequisite[2] · objectives `ll-g7-math-place-value-digit-value`
  - Prompt: Work out 7 × 10, 7 × 100 and 7 × 1,000.
  - Key: 70; 700; 7,000
  - If missing: Do the counter-exchange activity (ten counters become one in the next column) before the ten-times scene, then re-check with 4 × 10, 4 × 100, 4 × 1,000.

### Reasoning and production evidence

- **`pm-c1`** SHORT_CONSTRUCTED_RESPONSE · END_OF_LESSON · scaffold NONE · REHEARSED context · KEYED · objectives `ll-g7-math-place-value-read-write`
  - Prompt: Write in standard form: four hundred sixty thousand, three and twenty-five thousandths.
  - Key: 460,003.025
  - Targets: `mc-zero-placeholder`, `mc-decimal-word-form`
  - Note: Stays within MOE scope (hundred thousands and thousandths), so it survives a decision against the millions extension.
- **`pm-c2`** SHORT_CONSTRUCTED_RESPONSE · END_OF_LESSON · scaffold NONE · REHEARSED context · KEYED · objectives `ll-g7-math-place-value-digit-value`
  - Prompt: In 135,276.049, write the value of the 3 and the value of the 4.
  - Key: 3 → 30,000; 4 → 0.04
  - Targets: `mc-digit-not-value`, `mc-place-shift`
- **`pm-r1`** EXTENDED_REASONING · END_OF_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-math-place-value-compare`
  - Prompt: Kebeh says 0.7 is less than 0.65 because 65 is bigger than 7. Is she right? Explain using place value, and show one way to check your answer.
  - Scoring: 0: Agrees with Kebeh, or no place-value reasoning. · 1: Correct decision with a vague or partly correct reason, or a correct reason with no check. · 2: Says Kebeh is wrong and justifies by place: 7 tenths is more than 6 tenths, or 0.70 is more than 0.65 when both are written to hundredths; gives a check (chart, number line or hundredths grid).
  - Targets: `mc-longer-decimal-bigger`
- **`pm-r2`** EXTENDED_REASONING · END_OF_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-math-place-value-digit-value`
  - Prompt: The digit 5 appears three times in 505.05. Write what each 5 is worth. Then explain how the value of the first 5 compares with the value of the 5 in the ones place.
  - Scoring: 0: Gives 5 for every digit, or no relationship stated. · 1: All three values correct with no explanation of the relationship, or a correct relationship with one value wrong. · 2: 500, 5 and 0.05, and explains that 500 is 100 times 5 because it is two places to the left (each place is ten times the place to its right).
  - Targets: `mc-digit-not-value`, `mc-place-shift`

### Retention (delayed retrieval)

- **`pm-dr1`** DELAYED_RETRIEVAL · DELAYED 7 days · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-math-place-value-read-write`, `ll-g7-math-place-value-digit-value`, `ll-g7-math-place-value-compare`
  - Prompt: Without notes: (a) What is the value of the 9 in 293,400.6? (b) Write 3.046 in expanded form. (c) Order 0.08, 0.8 and 0.088 from least to greatest and explain how you decided.
  - Key: (a) 90,000 (b) 3 + 0.04 + 0.006 (c) 0.08, 0.088, 0.8; explanation compares tenths first, then hundredths/thousandths
  - Scoring: 0: none correct · 1: one part correct · 2: two parts correct · 3: three parts correct, explanation partial · 4: (a), (b) and (c) correct with a place-value explanation
- **`pm-dr2`** DELAYED_RETRIEVAL · DELAYED 21 days · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-math-place-value-compare`
  - Prompt: Which is greater, 0.6 or 0.599? Explain.
  - Scoring: 0: 0.599 · 1: 0.6 with no valid reason · 2: 0.6, explained by tenths (6 tenths > 5 tenths) or by writing 0.600
  - Targets: `mc-longer-decimal-bigger`

### Transfer

- **`pm-t1`** TRANSFER_TASK · END_OF_LESSON · scaffold NONE · NEW context · ANALYTIC_RUBRIC · objectives `ll-g7-math-place-value-compare`
  - Prompt: Draw a number line from 2.3 to 2.4 and mark it in hundredths. Place 2.35 and 2.305 on it. Which one is closer to 2.3? Explain how the number line shows it.
  - Scoring: 0: Says 2.35 is closer, or places 2.305 beyond 2.35. · 1: Correct answer with an imprecise placement or explanation. · 2: 2.35 at the halfway mark, 2.305 between 2.30 and 2.31; says 2.305 is closer to 2.3 and explains using the marks (2.305 is less than one hundredth away; 2.35 is five hundredths away).
  - Note: New representation: the lesson uses charts and grids, never a number line, so this checks whether place value transfers to a new model.

### Advanced extension (optional)

- **`pm-x1`** EXTENSION · END_OF_LESSON · scaffold NONE · NEW context · ANALYTIC_RUBRIC · objectives `ll-g7-math-place-value-compare`
  - Prompt: Use each of the digits 0, 3, 5 and 8 exactly once, and one decimal point, to make the number closest to 5. Explain why no other arrangement is closer.
  - Key: 5.038
  - Scoring: 0: other · 1: 5.038 without a complete argument, or 5.083 with place-value reasoning · 2: 5.038 with an argument from the left: 5 ones first, then the smallest possible tenths (0), hundredths (3) and thousandths (8)
  - Note: Optional and non-gating. Non-routine: learners must reason about every place, not apply a taught procedure.

## Misconception-mapping corrections (proposed)

Catalogue additions:

- `mc-place-shift` (ll-g7-math-place-value-digit-value): Puts the right digit in the wrong place, so its value is ten or a hundred times too big or too small (the 6 in 3,462,105 given as 6,000 or 600,000). Response: Name every place from the ones up to the digit before giving its value; check with the ten-times ladder.
- `mc-shorter-decimal-bigger` (ll-g7-math-place-value-compare): Thinks a decimal with fewer digits is greater because tenths are bigger than hundredths (0.3 > 0.37). Response: Write both numbers to the same number of places (0.30 and 0.37) and compare place by place.
- `mc-compare-by-digits` (ll-g7-math-place-value-compare): Compares whole numbers by their larger or more numerous digits (6,009,999 has many nines) instead of comparing from the left. Response: Line the numbers up by place and compare from the left until the digits differ.

| Item | Option | From | To | Rationale |
| --- | --- | --- | --- | --- |
| `g7-pv-exit-1` | 0 | `mc-digit-not-value` | `mc-place-shift` |  |
| `g7-pv-exit-1` | 1 | `mc-digit-not-value` | `mc-place-shift` |  |
| `g7-pv-exit-1` | 3 | `mc-digit-not-value` | `mc-place-shift` |  |
| `g7-pv-exit-2` | 1 | `mc-digit-not-value` | `mc-place-shift` |  |
| `g7-pv-exit-2` | 2 | `mc-digit-not-value` | `mc-place-shift` |  |
| `g7-pv-exit-4` | 1 | `mc-digit-not-value` | `mc-place-shift` |  |
| `g7-pv-exit-5` | 0 | `mc-longer-decimal-bigger` | unmapped | A descending list is an order-direction error, not a misconception about decimals; leave it unmapped. |
| `g7-pv-exit-6` | 0 | `mc-longer-decimal-bigger` | `mc-compare-by-digits` |  |
| `g7-pv-exit-6` | 2 | `mc-longer-decimal-bigger` | unmapped | 'They are equal' is not produced by any catalogued error; unmapped until classroom evidence shows a pattern. |

- Replace `g7-pv-exit-5` option 2 with "0.307, 0.37, 0.3" mapped to `mc-shorter-decimal-bigger`. Mechanical check: produced by SHORTER_DECIMAL_GREATER → consistent with SHORTER_DECIMAL_GREATER.
- Remap `g7-pv-exit-1` option 0 ("600") to `mc-place-shift`. Mechanical check: produced by PLACE_SHIFT → consistent with PLACE_SHIFT.
- Remap `g7-pv-exit-1` option 1 ("6,000") to `mc-place-shift`. Mechanical check: produced by PLACE_SHIFT → consistent with PLACE_SHIFT.
- Remap `g7-pv-exit-1` option 3 ("600,000") to `mc-place-shift`. Mechanical check: produced by PLACE_SHIFT → consistent with PLACE_SHIFT.
- Remap `g7-pv-exit-2` option 1 ("0.8") to `mc-place-shift`. Mechanical check: produced by PLACE_SHIFT → consistent with PLACE_SHIFT.
- Remap `g7-pv-exit-2` option 2 ("0.08") to `mc-place-shift`. Mechanical check: produced by PLACE_SHIFT → consistent with PLACE_SHIFT.
- Remap `g7-pv-exit-4` option 1 ("5 + 0.03 + 0.007") to `mc-place-shift`. Mechanical check: produced by PLACE_SHIFT → consistent with PLACE_SHIFT.
- Remap `g7-pv-exit-6` option 0 ("6,009,999") to `mc-compare-by-digits`. Mechanical check: produced by no modelled error → no error model for `mc-compare-by-digits`, judgment only.

These mechanical checks test reviewer-authored proposals against the error models. They are not a review of the proposals.

## National mapping kept explicit

- MOE: objectives remain LiberiaLearn candidates with MOE relationships, not bindings; the open decisions are recorded in PR #191 (MOE_OBJECTIVE_UNBOUND, SCOPE_EXTENSION_UNAPPROVED). This report does not bind or rebind anything.
- WAEC: LJHSCE (Grade 9), then WASSCE; math.number_numeration (Number & Numeration); evidence specificity SUBJECT_LEVEL. Grade 7 is not examined by WAEC. The repository's WAEC map is WASSCE section-level from aggregator sources; no LJHSCE topic-level syllabus is pinned. Relevance is forward preparation only, with no topic-level baseline commitment and no WAEC approval claimed.

## Required before any use

1. A qualified human confirms or rejects each AI judgment finding against this exact revision.
2. Independent review (not this reviewer, not its model family where possible) of the proposed plan and corrections.
3. The curriculum decisions already blocking the package in PR #191.
4. Pilot measurement under the Learning outcome standard before any claim that the lesson works.
