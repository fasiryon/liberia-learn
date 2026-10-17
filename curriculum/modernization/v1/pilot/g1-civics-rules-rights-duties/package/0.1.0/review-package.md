# Modernization review package: Rules, rights and duties at school

- **Lesson:** `civics-g1-1-rules-rights-and-duties-foundations`, grade 1 CIVICS, track C_FULL_REPLACEMENT
- **Replaces (if released):** legacy revision `cmss8rewz00fnvo5407no2s2a` (hash `5fa778238633e82e02a2204a52d5d579c5f86c7055a60678e6e4e1006faf9cac`). The legacy revision is preserved; historical references keep pointing at it.
- **Candidate:** `lmv1-g1-civics-rules-rights-duties@0.1.0`, hash `c426bca8c72285273c8b11665340e87c79f79fe4ac3223a4bb1f6ba5bc9b11be`
- **Author:** AI_AGENT `claude-code:library-modernization-v1` (anthropic-claude). The author may not review this candidate.
- **Pipeline status:** READY_FOR_INDEPENDENT_REVIEW (mechanical readiness only; not a review, not an approval).
- **Legacy audit outcome:** REBUILD_REQUIRED (13 findings).

## What successful independent performance looks like

- **ll-g1-civ-rules:** Alone with the teacher, the child shows or names a real home or school rule and says a safety, health or fairness reason, explains why a rule matters when no one is watching, suggests a fair rule for an unfamiliar place (the market), and still names a rule and reason one week later.
- **ll-g1-civ-rights-duties:** Without prompting, the child sorts four picture cards into rights and duties correctly, says one right and one duty aloud, and a week later still calls keeping the classroom clean a duty.

## Three layers

- **National Foundation:** Safety and health rules at home and school (MOE Grade 1 Social Studies, through the Civics proxy).
- **LiberiaLearn Mastery:** Rights and duties distinguished by performance, misconception-specific feedback, teacher-recorded oral reasoning and a one-week retrieval.
- **Global Excellence:** Transfer of fairness reasoning to the market, and an optional invent-a-rule drawing.

## Readiness checks

| Check | Result | Blocking | Detail |
|---|---|---|---|
| V2-PARSE | pass | yes | Strict Curriculum V2 parse (authority and secret keys refused). |
| V2-CONTEXT | pass | yes | 0 errors; 0 review gap(s): none |
| SPEC-OBJECTIVES | pass | yes | Candidate scenes teach exactly the spec objectives. |
| SPEC-SUCCESS-CRITERIA | pass | yes | Every objective defines successful independent performance. |
| SPEC-PREREQUISITES | pass | yes | Spec prerequisites equal the candidate's prerequisite assumptions. |
| SPEC-AGE-BAND | pass | yes | Candidate age band EARLY_PRIMARY; grade 1 → EARLY_PRIMARY. |
| LEGACY-DISPOSITION-COMPLETE | pass | yes | All 13 legacy sections have a disposition. |
| AUTHORITY-NO-INVENTED-MOE | pass | yes | Every proposed MOE id exists in the structured source (proposal only). |
| DELIVERABILITY | pass | yes | Every scene deliverable (primary or fallback) in every runtime scenario. |
| BLUEPRINT | pass | yes | Assessment blueprint satisfied: coverage, diagnostics, independent practice, production, reasoning, selected share, retention, transfer, extension. |
| EXCELLENCE-AUTOMATED | pass | yes | No blocking automated findings (0 non-blocking). |
| PROTECTED-KEYS-SEPARATE | pass | yes | Mastery keys and rubrics live only in the reviewer-only assessment definitions. |
| PROJECTION-NO-REVIEWER-CONTENT | pass | yes | No keys, rubrics, expected observations or fallback routes in the learner projection. |
| PROJECTION-AUTHORITY | pass | yes | Projection authority CURRICULUM_V2_DRAFT: never APPROVED_RELEASE. |
| SX-INTRO-AND-OBJECTIVES | pass | yes | Clear introduction and stated objectives. |
| SX-TEXT-DENSITY | pass | yes | Every scene within 70 words (EARLY_PRIMARY). |
| SX-MEDIA-ALT | pass | yes | Every media item has alt text. |
| SX-KEYBOARD-SCREEN-READER | pass | yes | Every scene has a text alternative and keyboard path. |
| SX-OFFLINE | pass | yes | Packageable offline: true. |
| SX-PAGINATION | pass | yes | 12 scenes (contract 3-20); one scene per slide. |
| SX-NO-MASTERY-CLAIM | pass | yes | No learner-facing claim of mastery or completion success. |
| SX-FULLSCREEN-SLIDES-V2 | **fail** | no | Fullscreen Slides V2 layout contracts are not on this base (feat/fullscreen-slides-v2 is unmerged); checked against Lesson Player V2 only. |

## Automated Excellence checks (AUTOMATED reviewer; not a review)

Outcome: READY_FOR_QUALIFIED_HUMAN_REVIEW. Blueprint blocking gaps: none. Findings: 0.


## Decisions for humans

- **OD-CIVICS-PROXY:** Adopt MOE Social Studies as the authority for Grade 1 Civics lessons? Author recommendation: Yes, as a recorded owner decision covering all 133 Civics lessons, not decided lesson by lesson.
- **OD-RIGHTS-DUTIES-SCOPE:** Accept rights and duties as a LiberiaLearn Grade 1 objective outside the MOE list? Author recommendation: Accept as LiberiaLearn mastery, never as an MOE requirement.
- **OD-DUPLICATES:** Four live lessons (foundations, teacher-modeling, guided-application, independent-practice) carry this same learner text and 60 learners' progress each. Which one does this candidate replace? Author recommendation: Map all four to this one candidate in the legacy mapping plan (Cleanup Plan V1's survivor), keeping every historical row pinned to the revision learners actually saw.
- **OD-PICTURES:** The two IMAGE media are described but have no governed asset. Author recommendation: Commission simple line drawings; until then the teacher tells the story without pictures (media is optional).

## What the reviewer must do

1. Academic review (subject expert): accuracy of every explanation, example, key and Liberian context, against the exact candidate hash above.
2. Assessment review: keys, rubrics, misconception mappings, retention and transfer tasks in `assessment-definitions.json`.
3. Accessibility and localization review.
4. Record each decision as a `REVIEW_RECORDED` ledger event bound to this candidate hash. Acceptance needs human, independent ACCEPT on the ACADEMIC and ASSESSMENT scopes.
