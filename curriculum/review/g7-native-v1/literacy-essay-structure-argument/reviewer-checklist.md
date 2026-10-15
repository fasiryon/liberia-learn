# Reviewer checklist — Understanding Essay Writing: Structure and Argument

Candidate `cv2-cand-g7-literacy-essay-structure-argument` v0.1.0, candidate hash `e875feab4d8d9742f421ba98c4c8c59f753e613a3d67526a77409cdd6019f786`.

| Field | Value |
| --- | --- |
| Status | CANDIDATE ONLY |
| Qualified review | NOT STARTED (no reviewer assigned) |
| Approval | NONE |
| MOE approval | NOT CLAIMED |
| Publication | DISABLED |
| Release | NONE (candidate manifest only, see ../release-binding.json) |

A qualified reviewer completes this list through governed curriculum review. Ticking boxes in this file records nothing.

## Instructional correctness

- [ ] Every model sentence, thesis and PEEL paragraph is grammatical and models the skill it claims to model.
- [ ] Every formative item has exactly one defensible expected option, and every option's feedback is accurate.
- [ ] Every exit-ticket key in assessment-review.md is correct and each distractor is plausible but clearly wrong.
- [ ] Evidence examples are framed as examples and no statement presents an unverified fact or figure as true.
- [ ] Explanations are no longer than needed and the sequence moves from modelled to guided to independent work.

## Accessibility

- [ ] Each scene's text alternative teaches the same idea without the diagram.
- [ ] Each diagram's alt text matches the diagram exactly (assets listed in scene-manifest.json).
- [ ] All interactions work with keyboard only and with a screen reader; declared-but-unrendered interactions have a usable written fallback.
- [ ] Reading level suits Grade 7 learners, including those still building English fluency.
- [ ] Screens were checked at phone width (390 px) and desktop width (see artifacts/g7-native-curriculum-v1/screenshots).

## Liberian relevance

- [ ] The school-garden, PTA, library and reading-time contexts are realistic for Liberian schools and communities.
- [ ] Names, places and money are used correctly; no context stereotypes a county, group or gender.
- [ ] Activities work in a classroom with no devices (paper chart, counters, teacher-read questions).

## Curriculum-mapping decisions

Each decision is recorded through governed curriculum review. Until every box is decided, the lesson stays **candidate-only** with publication disabled. No MOE objective, template cell or release is bound by this package.

### Lesson-level decisions

- [ ] Objective basis: accept the 3 candidate objectives as a LiberiaLearn extension (with the MOE relationships below), or rebind the lesson to an existing MOE objective (name it).
- [ ] Unit placement: `literacy-g7-6-paragraphs-and-text-structure` is a LiberiaLearn unit with no verified MOE match. Confirm it, or name the MOE Grade 7 period this lesson belongs to.
- [ ] Grade scope: the MOE places argumentative composition ("develop and defend a point of view") in Grade 9 (English 7-9 p.32). Choose one: keep as a Grade 7 introduction, rescope to Grade 7 paragraph writing, or move the lesson to Grade 8/9.
- [ ] Source structuring defect: the Grade 7 paragraph-writing objectives (English 7-9 p.4) are filed as ACTIVITY items under period I. Request correction through the source-structuring process (needed before any Grade 7 writing objective can bind).
- [ ] Legacy comparison: compare with legacy revision `cmss94dmc03b7vo54ryf3hqk1` (`hero-literacy-g7-essay-writing-structure-and-argumentation`) and list any correct legacy material to restore.

### Objective-by-objective mapping

**`ll-g7-lit-essay-structure`**: Identify and explain the parts of an argumentative essay: an introduction that ends with a thesis statement, body paragraphs that each begin with a topic sentence, and a conclusion.

- [ ] Statement: accept as worded / revise (give wording) / remove.
- [ ] SOURCE_TEXT_UNSTRUCTURED: OCR text only (no structured item), G7 p.4: "1. Construct paragraphs using subject and verb agreement, capitalization, punctuations etc." — accept or reject this relationship.
- [ ] SOURCE_TEXT_UNSTRUCTURED: OCR text only (no structured item), G7 p.4: "2. Writing kinds of paragraphs E.g.) descriptive, narrative etc." — accept or reject this relationship.
- [ ] BUILDS_ON: `moe-english-g6-s1-a-subject-verb-agreement-b-using-verbs-in-senten-obj2`, G6 p.119: "Construct different types of paragraphs" — accept or reject this relationship.
- [ ] LATER_GRADE_SCOPE: `moe-english-g8-s2-composition-literature-and-reading-comprehension-obj3`, G8 p.18: "Develop composition on issues such as social norms, peer influences, decision making, etc." — accept or reject this relationship.
- [ ] Proposed concept `g7-lit-essay-structure`: accept, rename, or map to an existing concept.

**`ll-g7-lit-argument-build`**: Build an argument by writing an arguable thesis statement with reasons and answering a counterargument.

- [ ] Statement: accept as worded / revise (give wording) / remove.
- [ ] LATER_GRADE_SCOPE: `moe-english-g8-s2-composition-literature-and-reading-comprehension-obj3`, G8 p.18: "Develop composition on issues such as social norms, peer influences, decision making, etc." — accept or reject this relationship.
- [ ] LATER_GRADE_SCOPE: `moe-english-g9-s2-composition-literature-reading-comprehension-sem-obj3`, G9 p.32: "Develop and defend a points of view in composition" — accept or reject this relationship.
- [ ] Proposed concept `g7-lit-argument-build`: accept, rename, or map to an existing concept.

**`ll-g7-lit-evidence-support`**: Choose true, relevant and specific evidence for a reason and explain how it supports the claim in a PEEL paragraph.

- [ ] Statement: accept as worded / revise (give wording) / remove.
- [ ] SOURCE_TEXT_UNSTRUCTURED: OCR text only (no structured item), G7 p.4: "1. Construct paragraphs using subject and verb agreement, capitalization, punctuations etc." — accept or reject this relationship.
- [ ] LATER_GRADE_SCOPE: `moe-english-g9-s2-composition-literature-reading-comprehension-sem-obj3`, G9 p.32: "Develop and defend a points of view in composition" — accept or reject this relationship.
- [ ] Proposed concept `g7-lit-evidence-support`: accept, rename, or map to an existing concept.

### Release-binding decisions (for the future Grade 7 release)

- [ ] Release authority: name who authorizes the Grade 7 release (the candidate manifest says UNKNOWN; MOE approval is NOT CLAIMED).
- [ ] Standard, skill and learning-target codes for each exit-ticket item (all marked REQUIRED_FROM_AUTHORITY in ../release-binding.json).
- [ ] Exit-ticket evidence context: governed items allow DIAGNOSTIC or PRACTICE; candidates use PRACTICE pending this decision.
- [ ] Tool policy: confirm the proposed instruction tools and the exit-ticket prohibitions in ../release-binding.json.
- [ ] Writing evidence: accept teacher-marked formative writing (rubric in assessment-review.md), since Assessment Player V2 has no constructed-response item type.
- [ ] Publication: stays DISABLED until approval, template cell, ontology release and registration in curriculum/releases/k12-scope.json are all complete.

## Decision (recorded only in governed review)

- APPROVE requires: all boxes above, closed BLOCKING gaps, a Grade 7 template cell and ontology release, released exit-ticket items.
- REVISE: list scene ids and changes; the author edits the candidate and the package is regenerated with new hashes.
- REJECT: state why; the legacy row remains as it is.
