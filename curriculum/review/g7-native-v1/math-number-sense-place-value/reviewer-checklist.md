# Reviewer checklist — Number Sense and Place Value: Millions to Thousandths

Candidate `cv2-cand-g7-math-number-sense-place-value` v0.3.0, candidate hash `c68b1a37f1852458cd3765643a43c59d6cc1d80ea0ef6f0ab9d67b7860d2ca95`.

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

- [ ] Every number, place name, expanded form and word form in the scenes is correct.
- [ ] Every formative item has exactly one defensible expected option, and every option's feedback is accurate.
- [ ] Every exit-ticket key in assessment-review.md is correct and each distractor is plausible but clearly wrong.
- [ ] Machine verifications passed (see the test) and the reviewer agrees with the word-form convention used ("and twenty-seven hundredths" / "point two seven").
- [ ] Explanations are no longer than needed and the sequence moves from modelled to guided to independent work.

## Curriculum Excellence V1 corrections (independent review required)

The v0.3.0 corrections were written by an AI agent. That agent may not review or certify them; an independent qualified reviewer decides each one. Gap reports: curriculum/excellence/.

- [ ] Confirm or reject each misconception-catalogue addition and each exit-item remapping (assessment-review.md shows the mappings).
- [ ] Review every candidate assessment definition in assessment-review.md: prompts, keys, scoring guides, prerequisite routes, retention timing and transfer contexts.
- [ ] Check the new reasoning scene (reason-it-out) and the optional challenge for correctness and level.
- [ ] Confirm the optional challenge is labelled optional and never gates progress.

## Accessibility

- [ ] Each scene's text alternative teaches the same idea without the diagram.
- [ ] Each diagram's alt text matches the diagram exactly (assets listed in scene-manifest.json).
- [ ] All interactions work with keyboard only and with a screen reader; declared-but-unrendered interactions have a usable written fallback.
- [ ] Reading level suits Grade 7 learners, including those still building English fluency.
- [ ] Screens were checked at phone width (390 px) and desktop width (see artifacts/g7-native-curriculum-v1/screenshots).

## Liberian relevance

- [ ] The library fund in Liberian dollars, market weights and cocoa cooperative contexts are realistic and respectful.
- [ ] Names, places and money are used correctly; no context stereotypes a county, group or gender.
- [ ] Activities work in a classroom with no devices (paper chart, counters, teacher-read questions).

## Legacy comparison

- [ ] Confirm the section-by-section comparison with legacy revision `cmss8t4hz00unvo54epnfst66` in legacy-comparison.md (or correct it).
- [ ] Decide every recommendation: R-M4, R-M5 (not applied), and confirm the applied ones (R-M1, R-M2, R-M3).
- [ ] Confirm that no legacy concern (L-…) is re-introduced, and decide each candidate concern (C-…).

## Curriculum-mapping decisions

Each decision is recorded through governed curriculum review. Until every box is decided, the lesson stays **candidate-only** with publication disabled. No MOE objective, template cell or release is bound by this package.

### Lesson-level decisions

- [ ] Objective basis: accept the 3 candidate objectives as a LiberiaLearn extension (with the MOE relationships below), or rebind the lesson to an existing MOE objective (name it).
- [ ] Unit placement: `math-g7-1-number-sense-and-place-value` is a LiberiaLearn unit with no verified MOE match. Confirm it, or name the MOE Grade 7 period this lesson belongs to.
- [ ] Scope: confirm that extending place value to the thousandths serves the MOE Grade 7 decimals, percents and fractions period (Math 7-9 p.10), or limit the lesson to whole numbers.
- [ ] Alignment decision A-M1: choose an option in legacy-comparison.md (evidence and consequences listed there).
- [ ] Scope extension `ext-g7-math-whole-numbers-millions` (Reading, writing, valuing and comparing whole numbers in the millions (the millions period).) is a proposed LiberiaLearn extension: approve it, or apply its fallback (Limit whole numbers to hundred thousands (or mark the millions material as optional enrichment), and revise or withdraw exit items g7-pv-exit-1, g7-pv-exit-3 and g7-pv-exit-6 (legacy comparison A-M1, option B).).

### Objective-by-objective mapping

**`ll-g7-math-place-value-read-write`**: Read and write numbers from the millions to the thousandths in standard form, word form and expanded form.

- [ ] Statement: accept as worded / revise (give wording) / remove.
- [ ] BUILDS_ON: `moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1`, G4 p.38: "Read and write whole numbers up to hundred thousand" — accept or reject this relationship.
- [ ] BUILDS_ON: `moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli-obj7`, G4 p.45: "Read and write decimal numerals up to hundredths place." — accept or reject this relationship.
- [ ] PREREQUISITE_FOR: `moe-math-g7-s1-p3-decimals-percents-and-fractions-obj1`, G7 p.10: "Convert from decimal to percent/fraction and vice versa" — accept or reject this relationship.
- [ ] Proposed concept `g7-math-place-value-read-write`: accept, rename, or map to an existing concept.

**`ll-g7-math-place-value-digit-value`**: Explain the value of a digit from its place, using the ten-times relationship between neighbouring places from the thousandths to the millions.

- [ ] Statement: accept as worded / revise (give wording) / remove.
- [ ] BUILDS_ON: `moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1`, G4 p.38: "Read and write whole numbers up to hundred thousand" — accept or reject this relationship.
- [ ] BUILDS_ON: `moe-math-g6-s1-p3-operations-obj2`, G6 p.67: "Round off decimals to the nearest tenth, hundredths and thousandths" — accept or reject this relationship.
- [ ] PREREQUISITE_FOR: `moe-math-g7-s1-p3-decimals-percents-and-fractions-obj1`, G7 p.10: "Convert from decimal to percent/fraction and vice versa" — accept or reject this relationship.
- [ ] Proposed concept `g7-math-place-value-digit-value`: accept, rename, or map to an existing concept.

**`ll-g7-math-place-value-compare`**: Compare and order whole numbers and decimals to the thousandths by comparing place values from the left.

- [ ] Statement: accept as worded / revise (give wording) / remove.
- [ ] BUILDS_ON: `moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj2`, G4 p.38: "Compare and order whole numbers to hundred thousand" — accept or reject this relationship.
- [ ] BUILDS_ON: `moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli-obj8`, G4 p.45: "Compare and order decimal numerals up to hundredths place." — accept or reject this relationship.
- [ ] PREREQUISITE_FOR: `moe-math-g7-s1-p3-decimals-percents-and-fractions-obj2`, G7 p.10: "Apply decimal and percent to the solution of problems involving commissions, discounts, taxes, interest, profits and losses and rayolty" — accept or reject this relationship.
- [ ] Proposed concept `g7-math-place-value-compare`: accept, rename, or map to an existing concept.

### Release-binding decisions (for the future Grade 7 release)

- [ ] Release authority: name who authorizes the Grade 7 release (the candidate manifest says UNKNOWN; MOE approval is NOT CLAIMED).
- [ ] Standard, skill and learning-target codes for each exit-ticket item (all marked REQUIRED_FROM_AUTHORITY in ../release-binding.json).
- [ ] Exit-ticket evidence context: governed items allow DIAGNOSTIC or PRACTICE; candidates use PRACTICE pending this decision.
- [ ] Tool policy: confirm the proposed instruction tools and the exit-ticket prohibitions in ../release-binding.json.
- [ ] Publication: stays DISABLED until approval, template cell, ontology release and registration in curriculum/releases/k12-scope.json are all complete.

## Reviewer sign-off

Valid only when recorded through governed curriculum review (HUMAN_REVIEW) against candidate hash `c68b1a37f1852458cd3765643a43c59d6cc1d80ea0ef6f0ab9d67b7860d2ca95`. Filling in this table records nothing.

| Field | Entry |
| --- | --- |
| Reviewer name | |
| Qualification (subject, grade band) | |
| Organisation / role | |
| Date | |
| Governed review record id | |
| Decision (APPROVE / REVISE / REJECT) | |
| Notes | |

## Decision (recorded only in governed review)

- APPROVE requires: all boxes above, closed BLOCKING gaps, a Grade 7 template cell and ontology release, released exit-ticket items.
- REVISE: list scene ids and changes; the author edits the candidate and the package is regenerated with new hashes.
- REJECT: state why; the legacy row remains as it is.
