# Modernization review package: Observation and inference: how scientists know

- **Lesson:** `science-g7-1-observation-and-scientific-thinking-foundations`, grade 7 SCIENCE, track C_FULL_REPLACEMENT
- **Replaces (if released):** legacy revision `cmss8t50a00urvo54li53jgr9` (hash `f07576ea6b222ff8431f59117c1758489eae832ba643bc0d721359c4c4ce92eb`). The legacy revision is preserved; historical references keep pointing at it.
- **Candidate:** `lmv1-g7-science-observation-inference@0.1.0`, hash `ba216cc97498ddc518f076e5ba7b60cdbb3e436734df90a5883e2ac2d44bd2fb`
- **Author:** AI_AGENT `claude-code:library-modernization-v1` (anthropic-claude). The author may not review this candidate.
- **Pipeline status:** READY_FOR_INDEPENDENT_REVIEW (mechanical readiness only; not a review, not an approval).
- **Legacy audit outcome:** REBUILD_REQUIRED (13 findings).

## What successful independent performance looks like

- **ll-g7-sci-observe-infer:** Without notes, the learner correctly sorts statements into observations and inferences, names the observations behind an inference, offers a second plausible inference and an observation that would decide between them, and does this in an unrehearsed context such as a clinic record.
- **ll-g7-sci-record-observations:** Without help, the learner rewrites vague or judgmental records as precise qualitative descriptions and measured quantitative observations with correct units, and still remembers to include units one week later.

## Three layers

- **National Foundation:** Observation, inference and measured records as the first methods of scientific knowledge in MOE Grade 7 General Science.
- **LiberiaLearn Mastery:** Rubric-scored reasoning about competing inferences and discriminating observations, misconception-specific feedback, unscaffolded recording and a 7-day retrieval.
- **Global Excellence:** Transfer to a clinic record, which separates measured, reported and inferred information, and an optional measurement-uncertainty challenge.

## Readiness checks

| Check | Result | Blocking | Detail |
|---|---|---|---|
| V2-PARSE | pass | yes | Strict Curriculum V2 parse (authority and secret keys refused). |
| V2-CONTEXT | pass | yes | 0 errors; 0 review gap(s): none |
| SPEC-OBJECTIVES | pass | yes | Candidate scenes teach exactly the spec objectives. |
| SPEC-SUCCESS-CRITERIA | pass | yes | Every objective defines successful independent performance. |
| SPEC-PREREQUISITES | pass | yes | Spec prerequisites equal the candidate's prerequisite assumptions. |
| SPEC-AGE-BAND | pass | yes | Candidate age band JUNIOR_SECONDARY; grade 7 → JUNIOR_SECONDARY. |
| LEGACY-DISPOSITION-COMPLETE | pass | yes | All 10 legacy sections have a disposition. |
| AUTHORITY-NO-INVENTED-MOE | pass | yes | Every proposed MOE id exists in the structured source (proposal only). |
| DELIVERABILITY | pass | yes | Every scene deliverable (primary or fallback) in every runtime scenario. |
| BLUEPRINT | pass | yes | Assessment blueprint satisfied: coverage, diagnostics, independent practice, production, reasoning, selected share, retention, transfer, extension. |
| EXCELLENCE-AUTOMATED | pass | yes | No blocking automated findings (0 non-blocking). |
| PROTECTED-KEYS-SEPARATE | pass | yes | Mastery keys and rubrics live only in the reviewer-only assessment definitions. |
| PROJECTION-NO-REVIEWER-CONTENT | pass | yes | No keys, rubrics, expected observations or fallback routes in the learner projection. |
| PROJECTION-AUTHORITY | pass | yes | Projection authority CURRICULUM_V2_DRAFT: never APPROVED_RELEASE. |
| SX-INTRO-AND-OBJECTIVES | pass | yes | Clear introduction and stated objectives. |
| SX-TEXT-DENSITY | pass | yes | Every scene within 200 words (JUNIOR_SECONDARY). |
| SX-MEDIA-ALT | pass | yes | Every media item has alt text. |
| SX-KEYBOARD-SCREEN-READER | pass | yes | Every scene has a text alternative and keyboard path. |
| SX-OFFLINE | pass | yes | Packageable offline: true. |
| SX-PAGINATION | pass | yes | 12 scenes (contract 3-20); one scene per slide. |
| SX-NO-MASTERY-CLAIM | pass | yes | No learner-facing claim of mastery or completion success. |
| SX-FULLSCREEN-SLIDES-V2 | **fail** | no | Fullscreen Slides V2 layout contracts are not on this base (feat/fullscreen-slides-v2 is unmerged); checked against Lesson Player V2 only. |

## Automated Excellence checks (AUTOMATED reviewer; not a review)

Outcome: READY_FOR_QUALIFIED_HUMAN_REVIEW. Blueprint blocking gaps: none. Findings: 0.


## Decisions for humans

- **OD-LEGACY-ALIGNMENT:** The legacy row is tagged LR-SCI-G7_9-01 ('chemical reactions, acids, bases and pH'), which is unrelated. Should the tag be removed from the live row now? Author recommendation: Yes, as a governed metadata correction recorded in the ledger, separate from content release.
- **OD-HEALTH-EXAMPLE:** Is the clinic-record transfer task (fever and a malaria inference) appropriate for Grade 7? Author recommendation: Keep it, subject to subject-expert review; it is common and locally relevant.

## What the reviewer must do

1. Academic review (subject expert): accuracy of every explanation, example, key and Liberian context, against the exact candidate hash above.
2. Assessment review: keys, rubrics, misconception mappings, retention and transfer tasks in `assessment-definitions.json`.
3. Accessibility and localization review.
4. Record each decision as a `REVIEW_RECORDED` ledger event bound to this candidate hash. Acceptance needs human, independent ACCEPT on the ACADEMIC and ASSESSMENT scopes.
