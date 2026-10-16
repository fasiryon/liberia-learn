# Modernization review package: Cause and effect: reading for why things happen

- **Lesson:** `wk_pcs6a_wed_p2`, grade 6 LITERACY, track A_TARGETED_REPAIR
- **Replaces (if released):** legacy revision `cmss8qbwg006rvo54f0zx9ppr` (hash `66b4986ad4fff6877f5cbe23aea7debd980c99808dd935f2b7d6286fcdcc5a80`). The legacy revision is preserved; historical references keep pointing at it.
- **Candidate:** `lmv1-g6-literacy-cause-effect@0.1.0`, hash `af6722bf1c73227516d8944ae23cc298f3244acc179381d11066a29f98856834`
- **Author:** AI_AGENT `claude-code:library-modernization-v1` (anthropic-claude). The author may not review this candidate.
- **Pipeline status:** READY_FOR_INDEPENDENT_REVIEW (mechanical readiness only; not a review, not an approval).
- **Legacy audit outcome:** REVISE (9 findings).

## What successful independent performance looks like

- **ll-g6-lit-cause-effect-identify:** Reading an unseen short text on their own, the learner writes a correct cause-and-effect pair the right way round in a full sentence with a linking word, and does so again one week later.
- **ll-g6-lit-cause-effect-explain:** Without help, the learner writes a three-step chain from an unseen text using its evidence, states when a text only suggests a cause, and predicts plausible effects for an unfamiliar text type such as a school notice.

## Three layers

- **National Foundation:** Finding causes and effects in short texts as part of MOE Grade 6 text analysis.
- **LiberiaLearn Mastery:** Written explanation of causal chains, implicit causes and careful claims, with misconception-specific feedback and a 7-day retrieval.
- **Global Excellence:** Transfer to an unfamiliar genre (a school notice) by predicting effects, and an optional causal-chain story.

## Readiness checks

| Check | Result | Blocking | Detail |
|---|---|---|---|
| V2-PARSE | pass | yes | Strict Curriculum V2 parse (authority and secret keys refused). |
| V2-CONTEXT | pass | yes | 0 errors; 0 review gap(s): none |
| SPEC-OBJECTIVES | pass | yes | Candidate scenes teach exactly the spec objectives. |
| SPEC-SUCCESS-CRITERIA | pass | yes | Every objective defines successful independent performance. |
| SPEC-PREREQUISITES | pass | yes | Spec prerequisites equal the candidate's prerequisite assumptions. |
| SPEC-AGE-BAND | pass | yes | Candidate age band UPPER_PRIMARY; grade 6 → UPPER_PRIMARY. |
| LEGACY-DISPOSITION-COMPLETE | pass | yes | All 17 legacy sections have a disposition. |
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
| SX-PAGINATION | pass | yes | 12 scenes (contract 3-20); one scene per slide. |
| SX-NO-MASTERY-CLAIM | pass | yes | No learner-facing claim of mastery or completion success. |
| SX-FULLSCREEN-SLIDES-V2 | **fail** | no | Fullscreen Slides V2 layout contracts are not on this base (feat/fullscreen-slides-v2 is unmerged); checked against Lesson Player V2 only. |

## Automated Excellence checks (AUTOMATED reviewer; not a review)

Outcome: READY_FOR_QUALIFIED_HUMAN_REVIEW. Blueprint blocking gaps: none. Findings: 0.


## Decisions for humans

- **OD-LEGACY-HEALTH-CLAIM:** The live lesson tells learners that playing in rain caused a cold. Should the class that used it receive a correction? Author recommendation: Yes, through the teacher, independent of whether this candidate is released.
- **OD-STORY-WRITING:** The legacy lesson promised story writing. Accept moving it to the next lesson? Author recommendation: Accept; the extension keeps a non-gating path.

## What the reviewer must do

1. Academic review (subject expert): accuracy of every explanation, example, key and Liberian context, against the exact candidate hash above.
2. Assessment review: keys, rubrics, misconception mappings, retention and transfer tasks in `assessment-definitions.json`.
3. Accessibility and localization review.
4. Record each decision as a `REVIEW_RECORDED` ledger event bound to this candidate hash. Acceptance needs human, independent ACCEPT on the ACADEMIC and ASSESSMENT scopes.
