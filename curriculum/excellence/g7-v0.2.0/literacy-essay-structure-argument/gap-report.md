# Excellence gap report: Understanding Essay Writing: Structure and Argument

Grade 7 LITERACY · candidate `cv2-cand-g7-literacy-essay-structure-argument@0.2.0` · liberialearn-curriculum-excellence/1.0.0

> **CANDIDATE ONLY. Advisory AI review.** Nothing here approves, publishes, releases or certifies this lesson, and nothing here claims human qualification or MOE/WAEC approval. Approval of native curriculum requires an identified, qualified human reviewing the exact revision (`lib/curriculum/v2/governance.ts`). A design rubric is not learning evidence: a lesson succeeds only when students independently show they learned, retained and can apply it (pilot plan).

> **Not an independent review.** Reviewer claude-code:curriculum-excellence-v1 (AI, anthropic-claude) shares a model family with the candidate's author (SAME_MODEL_FAMILY:anthropic-claude). It may be used as advice but does not count toward an independent-review requirement.

## Exact revision

- Source: PR #191 at commit `1ad2e9ec3cbbcd15d3e0cccacfb5614951d52462` (read with `git show`; not copied, not modified)
- Candidate: `curriculum/v2/g7/candidates/literacy-essay-structure-argument.json` sha256 `80b9592641effbdae8f5868323289873a8c1a6e547676241e09ab8ee5db060b1`
- Assessment (reviewer only): `curriculum/review/g7-native-v1/literacy-essay-structure-argument/assessment-review.json` sha256 `0ed4b231651e7663ae9ebc73514f38915473beeca275896e38c48e34d7ca6d15`
- Proposed plan: `excellence-plan-g7-literacy-essay-argument-0.1.0` sha256 `0ff24a77d44d19be622d834b434578ae8dec60d26e0b76579a1229ae47822a32`
- Report sha256: `981fd877cda249ce393a0a8220d129dc9eeb816561400adeb4f197ea6847ad54` (void for any other revision; see `assertReportMatchesRevision`)

## Summary

- Reviewer outcome: **REVISE_BEFORE_HUMAN_REVIEW** (the reviewer has no approve outcome)
- Findings: 11 blocking, 5 major, 9 minor (19 deterministic, 6 AI judgment needing human confirmation)
- Selected response share of end-of-lesson mastery evidence: 100% as is; 43% if the plan is adopted
- Blueprint blocking gaps as is: BP-PREREQUISITE-DIAGNOSTIC, BP-INDEPENDENT-PRACTICE, BP-PRODUCTION, BP-REASONING, BP-SELECTED-SHARE, BP-RETENTION, BP-TRANSFER, BP-EXTENSION; if the plan is adopted (mechanical projection, unreviewed): none
- Existing package gaps from PR #191 (unchanged here): MOE_OBJECTIVE_UNBOUND, MOE_SOURCE_STRUCTURING_DEFECT, MOE_GRADE_SCOPE_REVIEW, TEMPLATE_CELL_MISSING, ONTOLOGY_RELEASE_MISSING, LEGACY_COMPARISON_SIGNOFF, ASSESSMENT_ITEMS_PENDING

## Three layers

| Layer | Attained as is | Blocking criteria not yet met |
| --- | --- | --- |
| National Foundation | no | NF-ALN-1, NF-ALN-2, NF-ALN-3, NF-ACC-1, NF-ACC-2, NF-PRG-1, NF-ACS-1 |
| LiberiaLearn Mastery | no | LM-PRG-1, LM-CON-1, LM-RSN-1, LM-ASM-1, LM-ASM-2, LM-ASM-3 |
| Global Excellence | no | GE-RSN-1, GE-TRN-1, GE-EXT-1, GE-ASM-1, GE-ACC-1 |

Layer attainment is cumulative and design-only (`isLearningEvidence: false`). HUMAN_REQUIRED criteria cannot be rated MET by this reviewer, so no layer can be attained without qualified human review. The last column re-evaluates only blueprint-checked criteria with the proposed plan added (— means the blueprint does not check that criterion); it ignores findings and is not a review of the plan.

### National Foundation

| Criterion | Blocking | As is | Blueprint if plan adopted | Basis |
| --- | --- | --- | --- | --- |
| `NF-ALN-1` Every lesson objective is bound to a structured MOE objective, or is recorded as a named LiberiaLearn scope extension that a curriculum owner has decided. | yes | NOT_EVALUATED | — | Requires a qualified human reviewer. |
| `NF-ALN-2` Where an examination applies (LJHSCE, WASSCE) the lesson is mapped to the WAEC baseline competency it prepares for, with the evidence specificity stated and no WAEC approval claimed. | yes | NOT_EVALUATED | — | No AI finding; advisory judgment is not a MET rating. |
| `NF-ALN-3` Content above the MOE grade scope is labelled as extension and is never required for the grade's mastery decision. | yes | NOT_EVALUATED | — | Requires a qualified human reviewer. |
| `NF-ACC-1` Every keyed item has exactly one defensible correct response, verified mechanically where the domain allows. | yes | NOT_EVALUATED | — | No deterministic check covers this criterion yet. |
| `NF-ACC-2` Explanations, worked examples and Liberian facts are correct, checked by an identified subject expert. | yes | NOT_EVALUATED | — | Requires a qualified human reviewer. |
| `NF-PRG-1` Every stated prerequisite is diagnosed before instruction depends on it, with a route for learners who lack it. | yes | NOT_MET | MET | BP-PREREQUISITE-DIAGNOSTIC, det-prereq-0, det-prereq-1, det-prereq-2 |
| `NF-ASM-1` Every objective is assessed by at least one item or task at the end of the lesson. | yes | MET | MET | blueprint:BP-COVERAGE |
| `NF-ACS-1` Every scene has a text alternative and keyboard path, and every non-renderable interaction has an objective-preserving offline fallback. | yes | NOT_EVALUATED | — | No deterministic check covers this criterion yet. |
| `NF-REL-1` Liberian contexts are accurate, respectful and not stereotyped; invented data is labelled as invented. | no | NOT_EVALUATED | — | Requires a qualified human reviewer. |

### LiberiaLearn Mastery

| Criterion | Blocking | As is | Blueprint if plan adopted | Basis |
| --- | --- | --- | --- | --- |
| `LM-PRG-1` Support fades from modelled to guided to independent: every objective reaches unscaffolded (NONE) practice before mastery evidence is collected. | yes | NOT_MET | MET | BP-INDEPENDENT-PRACTICE, det-bp-independent-practice |
| `LM-CON-1` Every catalogued misconception is taught against and is diagnosable in assessment through a correctly mapped distractor or response pattern. | yes | PARTIALLY_MET | — | det-mc-unassessed-mc-circular-reasoning, det-unmapped-g7-essay-exit-1-1, det-unmapped-g7-essay-exit-1-2, det-unmapped-g7-essay-exit-4-2, det-unmapped-g7-essay-exit-4-3, det-unmapped-g7-essay-exit-5-1, det-unmapped-g7-essay-exit-5-2, det-unmapped-g7-essay-exit-6-3, ai-l3-exit1-distractor-mismapped, ai-l4-exit5-distractor-mismapped |
| `LM-CON-2` Each objective is evidenced in more than one form (e.g. recognise and produce; explain and apply). | no | PARTIALLY_MET | — | ai-l2-exit-items-recall-dominated |
| `LM-RSN-1` Where reasoning is central, the learner must produce a justification or explanation without scaffolds; selection of a correct option is not accepted as reasoning evidence. | yes | NOT_MET | MET | BP-REASONING, det-bp-reasoning |
| `LM-ASM-1` The subject assessment blueprint is satisfied (assessmentBlueprint.ts). | yes | NOT_MET | MET | BP-PRODUCTION, BP-SELECTED-SHARE, det-bp-production, det-bp-selected-share, ai-l1-writing-objectives-evidenced-by-selection |
| `LM-ASM-2` Mastery evidence is independent: collected with hints, worked examples, AI help and answer feedback withheld, and any assistance recorded. | yes | PARTIALLY_MET | — | det-mastery-assistance, ai-l6-conclusion-task-supplies-the-argument |
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

Subject family LITERACY, liberialearn-assessment-blueprint/1.0.0.

| Rule | Criterion | Requirement | As is | If plan adopted |
| --- | --- | --- | --- | --- |
| BP-COVERAGE | NF-ASM-1 | Every objective has end-of-lesson mastery evidence at scaffold NONE. | met | met |
| BP-PREREQUISITE-DIAGNOSTIC | NF-PRG-1 | Every stated prerequisite has a diagnostic task with a fallback route. | **not met** (prerequisite[0], prerequisite[1], prerequisite[2]) | met |
| BP-INDEPENDENT-PRACTICE | LM-PRG-1 | Every objective reaches unscaffolded practice before mastery evidence. | **not met** (ll-g7-lit-essay-structure, ll-g7-lit-argument-build, ll-g7-lit-evidence-support) | met |
| BP-PRODUCTION | LM-ASM-1 | Every objective has mastery evidence that is original unscaffolded writing scored with an analytic rubric. | **not met** (ll-g7-lit-essay-structure, ll-g7-lit-argument-build, ll-g7-lit-evidence-support) | met |
| BP-REASONING | LM-RSN-1 | At least one unscaffolded, rubric-scored reasoning or justification task. | **not met** (EXTENDED_REASONING) | met |
| BP-SELECTED-SHARE | LM-ASM-1 | Selected response is at most 50% of end-of-lesson mastery evidence. | **not met** (SELECTED_RESPONSE_SHARE) | met |
| BP-RETENTION | LM-ASM-3 | Every objective has delayed retrieval at least 7 days after the lesson. | **not met** (ll-g7-lit-essay-structure, ll-g7-lit-argument-build, ll-g7-lit-evidence-support) | met |
| BP-TRANSFER | GE-TRN-1 | At least one unscaffolded transfer task in a context the lesson did not rehearse. | **not met** (TRANSFER_TASK) | met |
| BP-EXTENSION | GE-EXT-1 | An optional, non-gating extension task. | **not met** (EXTENSION) | met |

## Findings

### BLOCKING · BLUEPRINT_INDEPENDENT_PRACTICE_UNMET · `det-bp-independent-practice`

Every objective reaches unscaffolded practice before mastery evidence. Not met: ll-g7-lit-essay-structure, ll-g7-lit-argument-build, ll-g7-lit-evidence-support. Formative IN_LESSON tasks at scaffold NONE.

- Criterion: `LM-PRG-1` (LiberiaLearn Mastery, INSTRUCTIONAL_PROGRESSION)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `18b8c8900410…`)

### BLOCKING · BLUEPRINT_PRODUCTION_UNMET · `det-bp-production`

Every objective has mastery evidence that is original unscaffolded writing scored with an analytic rubric. Not met: ll-g7-lit-essay-structure, ll-g7-lit-argument-build, ll-g7-lit-evidence-support. Accepted kinds: ORIGINAL_WRITING.

- Criterion: `LM-ASM-1` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `18b8c8900410…`)

### BLOCKING · BLUEPRINT_REASONING_UNMET · `det-bp-reasoning`

At least one unscaffolded, rubric-scored reasoning or justification task. Not met: EXTENDED_REASONING. 0 reasoning task(s) at mastery.

- Criterion: `LM-RSN-1` (LiberiaLearn Mastery, REASONING)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `18b8c8900410…`)

### BLOCKING · BLUEPRINT_SELECTED_SHARE_UNMET · `det-bp-selected-share`

Selected response is at most 50% of end-of-lesson mastery evidence. Not met: SELECTED_RESPONSE_SHARE. 6/6 selected response (100%).

- Criterion: `LM-ASM-1` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `18b8c8900410…`)

### BLOCKING · BLUEPRINT_RETENTION_UNMET · `det-bp-retention`

Every objective has delayed retrieval at least 7 days after the lesson. Not met: ll-g7-lit-essay-structure, ll-g7-lit-argument-build, ll-g7-lit-evidence-support. Spaced retrieval, unscaffolded.

- Criterion: `LM-ASM-3` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `18b8c8900410…`)

### BLOCKING · BLUEPRINT_TRANSFER_UNMET · `det-bp-transfer`

At least one unscaffolded transfer task in a context the lesson did not rehearse. Not met: TRANSFER_TASK. Near or far transfer, NEW context.

- Criterion: `GE-TRN-1` (Global Excellence, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `18b8c8900410…`)

### BLOCKING · BLUEPRINT_EXTENSION_UNMET · `det-bp-extension`

An optional, non-gating extension task. Not met: EXTENSION. Extension is optional and never required for mastery.

- Criterion: `GE-EXT-1` (Global Excellence, ADVANCED_EXTENSION)
- Method: DETERMINISTIC
- Recommendation: Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.
- Evidence: CANDIDATE `/assessmentRequests/0` (value sha256 `18b8c8900410…`)

### BLOCKING · PREREQUISITE_NOT_DIAGNOSED · `det-prereq-0`

The lesson assumes "Can write a paragraph with a topic sentence and supporting sentences (MOE Grade 7 paragraph writing)." but no diagnostic task checks it or routes learners who lack it.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: DETERMINISTIC
- Recommendation: Add a short diagnostic item for this prerequisite with a stated fallback route.
- Evidence: CANDIDATE `/prerequisiteAssumptions/0` (value sha256 `9d0e87c95910…`)

### BLOCKING · PREREQUISITE_NOT_DIAGNOSED · `det-prereq-1`

The lesson assumes "Can tell a fact from an opinion in simple sentences." but no diagnostic task checks it or routes learners who lack it.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: DETERMINISTIC
- Recommendation: Add a short diagnostic item for this prerequisite with a stated fallback route.
- Evidence: CANDIDATE `/prerequisiteAssumptions/1` (value sha256 `c4472c657c92…`)

### BLOCKING · PREREQUISITE_NOT_DIAGNOSED · `det-prereq-2`

The lesson assumes "Has discussed both sides of a school or community question in class." but no diagnostic task checks it or routes learners who lack it.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: DETERMINISTIC
- Recommendation: Add a short diagnostic item for this prerequisite with a stated fallback route.
- Evidence: CANDIDATE `/prerequisiteAssumptions/2` (value sha256 `9019cbbec06a…`)

### MAJOR · MISCONCEPTION_NOT_DIAGNOSABLE · `det-mc-unassessed-mc-circular-reasoning`

Misconception mc-circular-reasoning is catalogued but no exit-item distractor is mapped to it, so the exit evidence cannot detect it.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map a distractor or a constructed-response pattern to it, or record why end-of-lesson evidence need not detect it.
- Evidence: CANDIDATE `/misconceptions/2` (value sha256 `04ebab154b94…`)

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-1-1`

Distractor 1 of g7-essay-exit-1 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/0/item/options/1` (value sha256 `b47a097fe1c0…`)

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-1-2`

Distractor 2 of g7-essay-exit-1 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/0/item/options/2` (value sha256 `6722c5641d47…`)

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-4-2`

Distractor 2 of g7-essay-exit-4 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/3/item/options/2` (value sha256 `45fad5fd459e…`)

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-4-3`

Distractor 3 of g7-essay-exit-4 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/3/item/options/3` (value sha256 `da03afe6e40b…`)

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-5-1`

Distractor 1 of g7-essay-exit-5 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/4/item/options/1` (value sha256 `bdb56c2d8e02…`)

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-5-2`

Distractor 2 of g7-essay-exit-5 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/4/item/options/2` (value sha256 `f277c0e1abfa…`)

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-6-3`

Distractor 3 of g7-essay-exit-6 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/5/item/options/3` (value sha256 `8cc7c76a3747…`)

### MINOR · MASTERY_ITEMS_CARRY_ASSISTANCE · `det-mastery-assistance`

6 end-of-lesson item(s) (g7-essay-exit-1, g7-essay-exit-2, g7-essay-exit-3, g7-essay-exit-4, g7-essay-exit-5, g7-essay-exit-6) carry a hint and/or worked example; if either is shown before the response, the response is not independent evidence.

- Criterion: `LM-ASM-2` (LiberiaLearn Mastery, ASSESSMENT)
- Method: DETERMINISTIC, requires human confirmation
- Recommendation: Withhold hints and worked examples until after the scored response, and record any assistance in the governed evidence metadata.
- Evidence: ASSESSMENT `/items/0/item` (value sha256 `0309d00352ac…`)
- Evidence: ASSESSMENT `/items/1/item` (value sha256 `010c6684dcf2…`)
- Evidence: ASSESSMENT `/items/2/item` (value sha256 `94d0d1c399e5…`)
- Evidence: ASSESSMENT `/items/3/item` (value sha256 `cdaa51e7d8ba…`)
- Evidence: ASSESSMENT `/items/4/item` (value sha256 `6792bf5ff254…`)
- Evidence: ASSESSMENT `/items/5/item` (value sha256 `8b5ae4220f85…`)

### BLOCKING · WRITING_MASTERY_WITHOUT_WRITING · `ai-l1-writing-objectives-evidenced-by-selection`

The objectives are about building an argument and supporting it with evidence, but the learner's own writing is explicitly unmarked and the rubric is labelled as not a mastery score. A learner could reach mastery by recognising good theses without ever writing one.

- Criterion: `LM-ASM-1` (LiberiaLearn Mastery, ASSESSMENT)
- Method: AI_JUDGMENT, confidence 0.95, requires human confirmation
- Recommendation: Make an unscaffolded, original argumentative paragraph on a new question, scored with the existing four-criterion rubric, part of the end-of-lesson evidence (proposed pl-w1). Keep the selected-response items as diagnostic support, not as the mastery basis.
- Evidence: CANDIDATE `/scenes/11/content/body` "Your teacher reads this writing; it is not marked by this lesson." (value sha256 `46aaa0956231…`)
- Evidence: ASSESSMENT `/writingRubric/use` "Not a mastery score" (value sha256 `76dd26f964e5…`)
- Evidence: CANDIDATE `/assessmentRequests/0/interaction` "SINGLE_CHOICE" (value sha256 `eca366e39a1f…`)

### MAJOR · EXIT_ITEMS_RECALL_DOMINATED · `ai-l2-exit-items-recall-dominated`

Three of the six exit items ask the learner to recall where a part goes or what it does (thesis position, the conclusion's job, the Explain sentence's job). That is recall, below the analysis and production the objectives name.

- Criterion: `LM-CON-2` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: AI_JUDGMENT, confidence 0.85, requires human confirmation
- Recommendation: Replace at least two of the recall items with items that ask the learner to judge or repair a short piece of writing (proposed pl-r1), and keep one recall item for diagnosis.
- Evidence: ASSESSMENT `/items/0/item/prompt` "where does the thesis statement usually appear?" (value sha256 `71e6a365f9b0…`)
- Evidence: ASSESSMENT `/items/3/item/prompt` "What should the conclusion of an argumentative essay do?" (value sha256 `80c685194e47…`)
- Evidence: ASSESSMENT `/items/4/item/prompt` "In a PEEL paragraph, what does the Explain sentence do?" (value sha256 `8add4898d0dd…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `ai-l3-exit1-distractor-mismapped`

In g7-essay-exit-1, 'Only in the conclusion' is mapped to mc-conclusion-new-idea. That misconception is about adding a new reason in the conclusion; choosing this option shows confusion about where the thesis goes, a different error.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: AI_JUDGMENT, confidence 0.85, requires human confirmation
- Recommendation: Unmap the option, or map it to a new thesis-placement misconception (proposed mc-thesis-placement) if classroom evidence shows the error is common.
- Evidence: ASSESSMENT `/items/0/item/options/3` "Only in the conclusion" (value sha256 `d3d0a871e4c7…`)
- Evidence: ASSESSMENT `/items/0/distractorMisconceptions/3` "mc-conclusion-new-idea" (value sha256 `b138ac679650…`)
- Evidence: CANDIDATE `/misconceptions/5/description` "Adds a brand-new reason in the conclusion." (value sha256 `5b557ce48ddb…`)

### MAJOR · MISCONCEPTION_MAPPING_INCONSISTENT · `ai-l4-exit5-distractor-mismapped`

In g7-essay-exit-5, 'It repeats the evidence word for word' is mapped to mc-irrelevant-evidence (true but unrelated evidence). The option describes a different and common error: treating the Explain step as restating the evidence instead of showing how it proves the point.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: AI_JUDGMENT, confidence 0.85, requires human confirmation
- Recommendation: Add a catalogue entry for that error (proposed mc-explain-restates-evidence), teach against it in the peel scene, and remap this distractor to it.
- Evidence: ASSESSMENT `/items/4/item/options/3` "It repeats the evidence word for word" (value sha256 `bdfcb641a185…`)
- Evidence: ASSESSMENT `/items/4/distractorMisconceptions/3` "mc-irrelevant-evidence" (value sha256 `24bde0cdb7ed…`)
- Evidence: CANDIDATE `/misconceptions/3/description` "Gives true but unrelated evidence" (value sha256 `d7cfaf76539a…`)

### MAJOR · PRODUCTION_PREREQUISITE_CHECKED_BY_RECOGNITION · `ai-l5-paragraph-prerequisite-checked-by-recognition`

The whole writing sequence depends on the learner already writing a paragraph with a topic sentence, but the warm-up only asks what a topic sentence does. A learner who can name it but not write it reaches the PEEL writing task with no support route.

- Criterion: `NF-PRG-1` (National Foundation, INSTRUCTIONAL_PROGRESSION)
- Method: AI_JUDGMENT, confidence 0.85, requires human confirmation
- Recommendation: Diagnose the prerequisite by production: a short paragraph checked against a two-point checklist, with a paragraph-frame route before PEEL for learners who need it (proposed pl-d0).
- Evidence: CANDIDATE `/prerequisiteAssumptions/0` "Can write a paragraph with a topic sentence and supporting sentences" (value sha256 `9d0e87c95910…`)
- Evidence: CANDIDATE `/scenes/2/interaction/items/0/prompt` "What does a topic sentence do?" (value sha256 `4e7b1f52e40f…`)

### MINOR · TASK_SUPPLIES_THE_ARGUMENT · `ai-l6-conclusion-task-supplies-the-argument`

The write-conclusion task gives the learner the essay's reasons and objection, so it shows control of conclusion structure, not independent argument. That is appropriate for practice but should not be counted as evidence of building an argument.

- Criterion: `LM-ASM-2` (LiberiaLearn Mastery, ASSESSMENT)
- Method: AI_JUDGMENT, confidence 0.8, requires human confirmation
- Recommendation: Keep it as practice. In the assessment plan, count conclusion-writing evidence only when the learner wrote the argument the conclusion closes (proposed pl-dr2).
- Evidence: CANDIDATE `/scenes/12/content/body` "Its body paragraphs argued two reasons" (value sha256 `c7b2a25efa04…`)

## Proposed assessment plan (unreviewed)

`excellence-plan-g7-literacy-essay-argument-0.1.0` was written by the same AI reviewer, so the reviewer may not review it (`SELF_REVIEW_PROHIBITED`). The coverage columns above are a mechanical projection, not a review. Keys and scoring guides are reviewer only.

Proposes retiring: `g7-essay-exit-1`, `g7-essay-exit-4`, `g7-essay-exit-5`. These three items test recall of where parts go and what they do. pl-w1, pl-r1 and pl-r2 test the same knowledge by use. If a reviewer keeps any of them, apply the remaps below.

### Prerequisite diagnostics

- **`pl-d0`** PREREQUISITE_DIAGNOSTIC · PRE_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · prerequisite[0] · objectives `ll-g7-lit-essay-structure`
  - Prompt: Write a short paragraph (three to five sentences) about a place in your community that you know well. Start with a sentence that tells the main idea.
  - Scoring: 0: No identifiable main idea. · 1: A main idea is present but not first, or the support drifts to other ideas. · 2: First sentence states one main idea and at least two later sentences support that same idea.
  - If missing: Before PEEL, teach a paragraph frame (topic sentence + two supporting sentences) with a shared example; the teacher conferences with learners who scored 0 before the write-argument scene.
- **`pl-d1`** PREREQUISITE_DIAGNOSTIC · PRE_LESSON · scaffold NONE · REHEARSED context · KEYED · prerequisite[1] · objectives `ll-g7-lit-evidence-support`
  - Prompt: Mark each sentence F (fact) or O (opinion): (1) The Saint Paul River flows into the Atlantic Ocean. (2) Rice is the best food in the world. (3) Our school has two classrooms for Grade 7. (4) Football is more fun than kickball.
  - Key: 1 F, 2 O, 3 F (checkable for the learner's own school), 4 O
  - If missing: Mini-lesson on the question 'Can it be checked?' with four more classroom sentences before the evidence scene.
- **`pl-d2`** PREREQUISITE_DIAGNOSTIC · PRE_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · prerequisite[2] · objectives `ll-g7-lit-argument-build`
  - Prompt: Should our school have a longer lunch break? Write one reason someone might say yes and one reason someone might say no.
  - Scoring: 0: No reason given. · 1: Two reasons on the same side, or one side only. · 2: Two distinct reasons on opposite sides.
  - If missing: Pair talk with the sentence starters 'Some people think … because …' and 'Others think … because …' before the intro scene.

### Reasoning and production evidence

- **`pl-p1`** ORIGINAL_WRITING · IN_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-essay-structure`, `ll-g7-lit-argument-build`, `ll-g7-lit-evidence-support`
  - Prompt: After peer review, write a second thesis and PEEL paragraph on the other topic from your plan, this time without hints or the model plan.
  - Note: Formative. Gives every objective unscaffolded practice before the mastery task; the candidate's own writing tasks keep hints (scaffold PARTIAL/MINIMAL).
- **`pl-w1`** ORIGINAL_WRITING · END_OF_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-essay-structure`, `ll-g7-lit-argument-build`, `ll-g7-lit-evidence-support`
  - Prompt: Should students be allowed to bring mobile phones to school? Write a thesis statement with your claim and two reasons. Then write one PEEL paragraph that argues your first reason with real evidence, explains it and links it back to your claim (120 to 200 words). Work alone, without hints, the model plan or a partner.
  - Scoring: writingRubric: thesis, point, evidence, explain-link (0-2 each, 8 points)
  - Targets: `mc-topic-not-thesis`, `mc-opinion-as-evidence`, `mc-circular-reasoning`, `mc-irrelevant-evidence`
- **`pl-r1`** EXTENDED_REASONING · END_OF_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-argument-build`, `ll-g7-lit-evidence-support`
  - Prompt: Read this paragraph: 'Our school library should open on Saturdays. The library is good because it is good for students. Everyone knows reading is important. If it opens, more students will read.' Name two problems with the reasons or evidence and explain why each one weakens the argument. Then rewrite one sentence so it gives real evidence and says where the evidence comes from.
  - Scoring: 0: No valid problem named. · 1: A problem is named without explanation. · 2: One problem named and explained; rewrite adequate or missing. · 3: Both problems named, one explanation thin, rewrite adequate. · 4: Names circular reasoning (sentence 2) and opinion used as evidence (sentence 3), explains why each fails, and rewrites one with specific, checkable evidence and its source.
  - Targets: `mc-circular-reasoning`, `mc-opinion-as-evidence`
- **`pl-r2`** EXTENDED_REASONING · END_OF_LESSON · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-argument-build`
  - Prompt: Claim: 'Every Grade 7 class should plant trees on the school compound.' Write the strongest objection someone could raise, then write two sentences that answer it.
  - Scoring: writingRubric criterion counterargument (0-2)
  - Targets: `mc-ignore-counterargument`

### Retention (delayed retrieval)

- **`pl-dr1`** DELAYED_RETRIEVAL · DELAYED 7 days · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-essay-structure`, `ll-g7-lit-argument-build`, `ll-g7-lit-evidence-support`
  - Prompt: Without notes: write a thesis statement with two reasons for 'Should every student learn to swim?', then write a PEEL paragraph for one of the reasons.
  - Scoring: writingRubric (8 points)
- **`pl-dr2`** DELAYED_RETRIEVAL · DELAYED 21 days · scaffold NONE · REHEARSED context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-essay-structure`, `ll-g7-lit-argument-build`, `ll-g7-lit-evidence-support`
  - Prompt: Choose a question about your school or community. Write a thesis, one PEEL paragraph, one sentence answering an objection, and a two-sentence conclusion that adds no new reason.
  - Scoring: writingRubric (8 points) + counterargument (2) + conclusion adds no new reason (0/1)
  - Targets: `mc-conclusion-new-idea`, `mc-ignore-counterargument`

### Transfer

- **`pl-t1`** TRANSFER_TASK · END_OF_LESSON · scaffold NONE · NEW context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-argument-build`, `ll-g7-lit-evidence-support`
  - Prompt: Write a short letter (80 to 150 words) to your town chief or community leader asking for one change at the market, such as lights or a clean water point. Make your claim, give one reason with real evidence, and answer one objection the leader might have.
  - Scoring: writingRubric: thesis (as claim), evidence, explain-link, counterargument (0-2 each)
  - Note: New genre and a real audience: the lesson only rehearses school essays.

### Advanced extension (optional)

- **`pl-x1`** EXTENSION · END_OF_LESSON · scaffold NONE · NEW context · ANALYTIC_RUBRIC · objectives `ll-g7-lit-essay-structure`, `ll-g7-lit-argument-build`, `ll-g7-lit-evidence-support`
  - Prompt: Write a full five-paragraph argumentative essay (introduction, two reasons, one paragraph answering the other side, conclusion) on a question you care about. Then write two sentences explaining which of your reasons is strongest and why.
  - Scoring: writingRubric applied per paragraph + counterargument + a reasoned self-evaluation
  - Note: Optional and non-gating; argumentative essays are MOE Grade 9 scope (grade-scope decision pending in PR #191).

## Misconception-mapping corrections (proposed)

Catalogue additions:

- `mc-explain-restates-evidence` (ll-g7-lit-evidence-support): Thinks the Explain step means repeating the evidence, so never says how the evidence proves the point. Response: Ask 'so what?' after the evidence and answer it with a sentence that starts 'This shows that…'.
- `mc-thesis-placement` (ll-g7-lit-essay-structure): Places the thesis only in the conclusion or the title, so the reader meets the reasons before the claim. Response: Show the reader's view: the introduction ends with the claim so every body paragraph can be read as support for it. Condition: Add only if classroom evidence shows the error is common; otherwise leave g7-essay-exit-1 option 3 unmapped.

| Item | Option | From | To | Rationale |
| --- | --- | --- | --- | --- |
| `g7-essay-exit-1` | 3 | `mc-conclusion-new-idea` | unmapped | Thesis placement, not a new reason in the conclusion. Map to mc-thesis-placement only under its condition. |
| `g7-essay-exit-5` | 3 | `mc-irrelevant-evidence` | `mc-explain-restates-evidence` |  |

- Make `mc-circular-reasoning` diagnosable through `pl-r1`: Taught in evidence-check and plan-argument but not detectable in any exit item; pl-r1 asks the learner to find it.

## National mapping kept explicit

- MOE: objectives remain LiberiaLearn candidates with MOE relationships, not bindings; the open decisions are recorded in PR #191 (MOE_OBJECTIVE_UNBOUND, MOE_SOURCE_STRUCTURING_DEFECT, MOE_GRADE_SCOPE_REVIEW). This report does not bind or rebind anything.
- WAEC: LJHSCE (Grade 9), then WASSCE; WAEC English Language: Essay & Continuous Writing; evidence specificity SUBJECT_LEVEL. Grade 7 is not examined by WAEC. WAEC English Language papers include continuous (essay) writing, which is original writing; that is why selected-response evidence cannot stand in for it. Relevance is forward preparation only, and no WAEC approval is claimed.

## Required before any use

1. A qualified human confirms or rejects each AI judgment finding against this exact revision.
2. Independent review (not this reviewer, not its model family where possible) of the proposed plan and corrections.
3. The curriculum decisions already blocking the package in PR #191.
4. Pilot measurement under the Learning outcome standard before any claim that the lesson works.
