# Excellence gap report: Understanding Essay Writing: Structure and Argument

Grade 7 LITERACY · candidate `cv2-cand-g7-literacy-essay-structure-argument@0.3.0` · liberialearn-curriculum-excellence/1.0.0

> **CANDIDATE ONLY. Automated checks, not a review.** These are the deterministic checks of the Curriculum Excellence Standard (blueprint, prerequisites, misconception catalogue, distractor error models, assistance on mastery items). They approve, publish, release and certify nothing, and they claim no human qualification or MOE/WAEC approval. Approval of native curriculum requires an identified, qualified human reviewing the exact revision (`lib/curriculum/v2/governance.ts`). A design rubric is not learning evidence: a lesson succeeds only when students independently show they learned, retained and can apply it (pilot plan).

> **No AI judgment review of this revision.** An AI judgment review by claude-code:curriculum-excellence-v1 (AI, anthropic-claude) was refused (`SELF_REVIEW_PROHIBITED`): that agent wrote the corrections in this revision and may not review them. Judgment criteria and every correction need an independent reviewer.

## Exact revision

- Source: this tree (PR #191 integration), pinned by the candidate hash below; regenerated whenever the candidate changes
- Candidate: `curriculum/v2/g7/candidates/literacy-essay-structure-argument.json` sha256 `0f275a880588aa8e9451a0ea368bf0fa18bee6cbd826bb1c15d86c4fdc952828`
- Assessment (reviewer only): `curriculum/review/g7-native-v1/literacy-essay-structure-argument/assessment-review.json` sha256 `9af3f09b453c5fbdf133aeed894a6940c6f4ad65cc021eb5bbd01cfb11cfa8b6`
- Report sha256: `faa77789ecb7965e4e01c7a7dc2d6c653d6243344d7d1613c223ce59f6ad7299` (void for any other revision; see `assertReportMatchesRevision`)

## Summary

- Reviewer outcome: **READY_FOR_QUALIFIED_HUMAN_REVIEW** (the reviewer has no approve outcome)
- Findings: 0 blocking, 0 major, 9 minor (9 deterministic, 0 AI judgment needing human confirmation)
- Selected response share of end-of-lesson mastery evidence: 43%
- Blueprint blocking gaps: none
- Existing package gaps from PR #191 (unchanged here): MOE_OBJECTIVE_UNBOUND, MOE_SOURCE_STRUCTURING_DEFECT, MOE_GRADE_SCOPE_REVIEW, TEMPLATE_CELL_MISSING, ONTOLOGY_RELEASE_MISSING, LEGACY_COMPARISON_SIGNOFF, ASSESSMENT_ITEMS_PENDING

## Three layers

| Layer | Attained as is | Blocking criteria not yet met |
| --- | --- | --- |
| National Foundation | no | NF-ALN-1, NF-ALN-2, NF-ALN-3, NF-ACC-1, NF-ACC-2, NF-ACS-1 |
| LiberiaLearn Mastery | no | LM-CON-1, LM-ASM-2 |
| Global Excellence | no | GE-RSN-1, GE-ASM-1, GE-ACC-1 |

Layer attainment is cumulative and design-only (`isLearningEvidence: false`). Automated checks can rate only deterministic criteria MET; judgment and HUMAN_REQUIRED criteria stay NOT_EVALUATED until an independent reviewer rates them, so no layer can be attained from this report.

### National Foundation

| Criterion | Blocking | Status | Basis |
| --- | --- | --- | --- |
| `NF-ALN-1` Every lesson objective is bound to a structured MOE objective, or is recorded as a named LiberiaLearn scope extension that a curriculum owner has decided. | yes | NOT_EVALUATED | Requires a qualified human reviewer. |
| `NF-ALN-2` Where an examination applies (LJHSCE, WASSCE) the lesson is mapped to the WAEC baseline competency it prepares for, with the evidence specificity stated and no WAEC approval claimed. | yes | NOT_EVALUATED | No AI finding; advisory judgment is not a MET rating. |
| `NF-ALN-3` Content above the MOE grade scope is labelled as extension and is never required for the grade's mastery decision. | yes | NOT_EVALUATED | Requires a qualified human reviewer. |
| `NF-ACC-1` Every keyed item has exactly one defensible correct response, verified mechanically where the domain allows. | yes | NOT_EVALUATED | No deterministic check covers this criterion yet. |
| `NF-ACC-2` Explanations, worked examples and Liberian facts are correct, checked by an identified subject expert. | yes | NOT_EVALUATED | Requires a qualified human reviewer. |
| `NF-PRG-1` Every stated prerequisite is diagnosed before instruction depends on it, with a route for learners who lack it. | yes | MET | blueprint:BP-PREREQUISITE-DIAGNOSTIC |
| `NF-ASM-1` Every objective is assessed by at least one item or task at the end of the lesson. | yes | MET | blueprint:BP-COVERAGE |
| `NF-ACS-1` Every scene has a text alternative and keyboard path, and every non-renderable interaction has an objective-preserving offline fallback. | yes | NOT_EVALUATED | No deterministic check covers this criterion yet. |
| `NF-REL-1` Liberian contexts are accurate, respectful and not stereotyped; invented data is labelled as invented. | no | NOT_EVALUATED | Requires a qualified human reviewer. |

### LiberiaLearn Mastery

| Criterion | Blocking | Status | Basis |
| --- | --- | --- | --- |
| `LM-PRG-1` Support fades from modelled to guided to independent: every objective reaches unscaffolded (NONE) practice before mastery evidence is collected. | yes | MET | blueprint:BP-INDEPENDENT-PRACTICE |
| `LM-CON-1` Every catalogued misconception is taught against and is diagnosable in assessment through a correctly mapped distractor or response pattern. | yes | PARTIALLY_MET | det-unmapped-g7-essay-exit-1-1, det-unmapped-g7-essay-exit-1-2, det-unmapped-g7-essay-exit-1-3, det-unmapped-g7-essay-exit-4-2, det-unmapped-g7-essay-exit-4-3, det-unmapped-g7-essay-exit-5-1, det-unmapped-g7-essay-exit-5-2, det-unmapped-g7-essay-exit-6-3 |
| `LM-CON-2` Each objective is evidenced in more than one form (e.g. recognise and produce; explain and apply). | no | NOT_EVALUATED | No deterministic check covers this criterion yet. |
| `LM-RSN-1` Where reasoning is central, the learner must produce a justification or explanation without scaffolds; selection of a correct option is not accepted as reasoning evidence. | yes | MET | blueprint:BP-REASONING |
| `LM-ASM-1` The subject assessment blueprint is satisfied (assessmentBlueprint.ts). | yes | MET | blueprint:BP-PRODUCTION, blueprint:BP-SELECTED-SHARE |
| `LM-ASM-2` Mastery evidence is independent: collected with hints, worked examples, AI help and answer feedback withheld, and any assistance recorded. | yes | PARTIALLY_MET | det-mastery-assistance |
| `LM-ASM-3` Retention is planned: each mastery objective has spaced, delayed retrieval at least 7 days after the lesson. | yes | MET | blueprint:BP-RETENTION |
| `LM-ACS-1` Language load suits the age band, with support for emerging readers that does not lower the mathematical or literary demand. | no | NOT_EVALUATED | Requires a qualified human reviewer. |
| `LM-REL-1` At least one task applies the objective to an authentic Liberian situation the learner could meet. | no | NOT_EVALUATED | No AI finding; advisory judgment is not a MET rating. |

### Global Excellence

| Criterion | Blocking | Status | Basis |
| --- | --- | --- | --- |
| `GE-RSN-1` Includes a non-routine problem or argument at the reasoning level of strong international frameworks (e.g. TIMSS reasoning domain, PISA proficiency levels). | yes | NOT_EVALUATED | No AI finding; advisory judgment is not a MET rating. |
| `GE-TRN-1` Transfer is assessed in a context, representation or genre the lesson did not rehearse. | yes | MET | blueprint:BP-TRANSFER |
| `GE-EXT-1` An optional extension path goes beyond grade scope for ready learners without gating anyone's progress. | yes | MET | blueprint:BP-EXTENSION |
| `GE-ASM-1` Performance is independently comparable: some outcome measures are scored blind or by an external, independently developed instrument. | yes | NOT_EVALUATED | Requires a qualified human reviewer. |
| `GE-ACC-1` A second, independent subject expert has checked the reasoning and extension tasks. | yes | NOT_EVALUATED | Requires a qualified human reviewer. |

## Assessment blueprint

Subject family LITERACY, liberialearn-assessment-blueprint/1.0.0.

| Rule | Criterion | Requirement | Status |
| --- | --- | --- | --- |
| BP-COVERAGE | NF-ASM-1 | Every objective has end-of-lesson mastery evidence at scaffold NONE. | met |
| BP-PREREQUISITE-DIAGNOSTIC | NF-PRG-1 | Every stated prerequisite has a diagnostic task with a fallback route. | met |
| BP-INDEPENDENT-PRACTICE | LM-PRG-1 | Every objective reaches unscaffolded practice before mastery evidence. | met |
| BP-PRODUCTION | LM-ASM-1 | Every objective has mastery evidence that is original unscaffolded writing scored with an analytic rubric. | met |
| BP-REASONING | LM-RSN-1 | At least one unscaffolded, rubric-scored reasoning or justification task. | met |
| BP-SELECTED-SHARE | LM-ASM-1 | Selected response is at most 50% of end-of-lesson mastery evidence. | met |
| BP-RETENTION | LM-ASM-3 | Every objective has delayed retrieval at least 7 days after the lesson. | met |
| BP-TRANSFER | GE-TRN-1 | At least one unscaffolded transfer task in a context the lesson did not rehearse. | met |
| BP-EXTENSION | GE-EXT-1 | An optional, non-gating extension task. | met |

## Findings on the previous revision

How every finding on the previous revision stands now. NOT_REPRODUCED means a deterministic check no longer fires; it is not a verdict that the issue is resolved. The corrections were written by an AI agent and need independent review.

| Finding | Severity | Method | Status | Change |
| --- | --- | --- | --- | --- |
| `det-bp-independent-practice` BLUEPRINT_INDEPENDENT_PRACTICE_UNMET | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-bp-production` BLUEPRINT_PRODUCTION_UNMET | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-bp-reasoning` BLUEPRINT_REASONING_UNMET | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-bp-selected-share` BLUEPRINT_SELECTED_SHARE_UNMET | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-bp-retention` BLUEPRINT_RETENTION_UNMET | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-bp-transfer` BLUEPRINT_TRANSFER_UNMET | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-bp-extension` BLUEPRINT_EXTENSION_UNMET | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-prereq-0` PREREQUISITE_NOT_DIAGNOSED | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-prereq-1` PREREQUISITE_NOT_DIAGNOSED | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-prereq-2` PREREQUISITE_NOT_DIAGNOSED | BLOCKING | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-mc-unassessed-mc-circular-reasoning` MISCONCEPTION_NOT_DIAGNOSABLE | MAJOR | DETERMINISTIC | NOT_REPRODUCED_BY_AUTOMATED_CHECKS | The deterministic check no longer fires on this revision. |
| `det-unmapped-g7-essay-exit-1-1` DISTRACTOR_UNMAPPED | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `det-unmapped-g7-essay-exit-1-2` DISTRACTOR_UNMAPPED | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `det-unmapped-g7-essay-exit-4-2` DISTRACTOR_UNMAPPED | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `det-unmapped-g7-essay-exit-4-3` DISTRACTOR_UNMAPPED | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `det-unmapped-g7-essay-exit-5-1` DISTRACTOR_UNMAPPED | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `det-unmapped-g7-essay-exit-5-2` DISTRACTOR_UNMAPPED | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `det-unmapped-g7-essay-exit-6-3` DISTRACTOR_UNMAPPED | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `det-mastery-assistance` MASTERY_ITEMS_CARRY_ASSISTANCE | MINOR | DETERMINISTIC | STILL_PRESENT | The same deterministic check still fires on this revision. |
| `ai-l1-writing-objectives-evidenced-by-selection` WRITING_MASTERY_WITHOUT_WRITING | BLOCKING | AI_JUDGMENT | CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW | Added definition pl-w1: original, unscaffolded argumentative writing on a new question at the end of the lesson, scored with the candidate rubric. Selected-response items remain as diagnostic support. The in-lesson writing is still formative. |
| `ai-l2-exit-items-recall-dominated` EXIT_ITEMS_RECALL_DOMINATED | MAJOR | AI_JUDGMENT | CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW | g7-essay-exit-1, -4 and -5 are marked diagnostic-only (asked, not counted as mastery evidence). Definitions pl-r1 and pl-r2 ask the learner to judge, repair and answer an argument. |
| `ai-l3-exit1-distractor-mismapped` MISCONCEPTION_MAPPING_INCONSISTENT | MAJOR | AI_JUDGMENT | CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW | g7-essay-exit-1 option 3 is now unmapped. mc-thesis-placement was not added; it waits for classroom evidence. |
| `ai-l4-exit5-distractor-mismapped` MISCONCEPTION_MAPPING_INCONSISTENT | MAJOR | AI_JUDGMENT | CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW | Added mc-explain-restates-evidence, taught it in the peel scene, remapped g7-essay-exit-5 option 3 to it, and named it in the rubric's explain-link descriptor. |
| `ai-l5-paragraph-prerequisite-checked-by-recognition` PRODUCTION_PREREQUISITE_CHECKED_BY_RECOGNITION | MAJOR | AI_JUDGMENT | CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW | Added the readiness-writing scene: the paragraph and two-sides prerequisites are diagnosed by production, with fallback routes in definitions pl-d0 and pl-d2. |
| `ai-l6-conclusion-task-supplies-the-argument` TASK_SUPPLIES_THE_ARGUMENT | MINOR | AI_JUDGMENT | CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW | write-conclusion stays practice. Conclusion evidence is counted only in definition pl-dr2, where the learner writes the argument the conclusion closes. |

## Findings

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

### MINOR · DISTRACTOR_UNMAPPED · `det-unmapped-g7-essay-exit-1-3`

Distractor 3 of g7-essay-exit-1 is not mapped to any misconception, so choosing it gives no diagnostic information.

- Criterion: `LM-CON-1` (LiberiaLearn Mastery, CONCEPTUAL_MASTERY)
- Method: DETERMINISTIC
- Recommendation: Map it to a catalogued misconception or replace it with a distractor that represents one.
- Evidence: ASSESSMENT `/items/0/item/options/3` (value sha256 `d3d0a871e4c7…`)

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

## National mapping kept explicit

- MOE: objectives remain LiberiaLearn candidates with MOE relationships, not bindings; the open decisions are recorded in PR #191 (MOE_OBJECTIVE_UNBOUND, MOE_SOURCE_STRUCTURING_DEFECT, MOE_GRADE_SCOPE_REVIEW). This report does not bind or rebind anything.
- WAEC: LJHSCE (Grade 9), then WASSCE; WAEC English Language: Essay & Continuous Writing; evidence specificity SUBJECT_LEVEL. Grade 7 is not examined by WAEC. WAEC English Language papers include continuous (essay) writing, which is original writing; that is why selected-response evidence cannot stand in for it. Relevance is forward preparation only, and no WAEC approval is claimed.

## Required before any use

1. An independent reviewer (not the agent that wrote the corrections, and not its model family where possible) reviews this exact revision against the judgment and human criteria, and confirms or rejects each correction.
2. A qualified human approves or revises the candidate assessment definitions and rubric before any of them is used as mastery evidence.
3. The curriculum decisions already blocking the package in PR #191.
4. Pilot measurement under the Learning outcome standard before any claim that the lesson works.
