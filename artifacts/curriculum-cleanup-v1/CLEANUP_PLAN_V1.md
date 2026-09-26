# Curriculum cleanup plan V1

- **Snapshot:** production `postgres` read at 2026-09-26T09:07:15.873Z (`SET TRANSACTION READ ONLY`). Nothing has been written.
- **Plan validation:** PASS. Rollback simulation restores the snapshot exactly: **yes**.
- **Status:** plan only. Production mutation needs explicit human authorization. See "Execution gate" below.

## Defects before and after (simulated)

| Defect | Before | After plan |
|---|---:|---:|
| Status/payload governance conflicts | 268 | 0 |
| Learner-visible duplicate lesson rows | 83 | 0 |
| Dangling prerequisite edges | 3642 | 0 |
| Orphaned lesson variants | 169 | 0 |
| Dangling unit links (after: retained on purpose / unaccounted) | 495 | 495 / 0 |
| Forward bindings to retired lessons | 0 | 0 |

## Actions

| Action | Count | Mechanism |
|---|---:|---|
| SUPERSEDE_DUPLICATE | 58 | Governance event SUPERSEDED (replacement = survivor revision). The row is kept. |
| REPOINT_REFERENCE | 0 | Forward bindings only (lesson plans, timetable, teacher assignments, learning path, shares). |
| RETURN_FOR_REVIEW | 224 | Governance event RETURNED_FOR_REVIEW; status NEEDS_REVIEW. |
| DELETE_DANGLING_PREREQUISITE | 3642 | Delete edge; full row kept in plan for restore. |
| REPOINT_PREREQUISITE | 7 | Edge moves from retired duplicate to survivor. |
| DELETE_DUPLICATE_PREREQUISITE | 1 | Self-loop or duplicate after repoint. |
| DELETE_ORPHAN_VARIANT | 169 | Delete; full row (body included) kept in plan for restore. |
| REPAIR_UNIT_LINK | 0 | Exactly one unit matches grade + subject + sequence and shares a title word. |
| RETAIN_UNIT_KEY | 495 | No verified match. No write: `unitId` is also the adaptive mastery grouping key (`lib/adaptive/updateMastery.ts`), so clearing it would regroup learner mastery. Proper repair = governed units for these topic keys (decision below). |

Dangling prerequisite edges by missing side: lesson+prerequisite=3194, lesson=230, prerequisite=218.
Dangling unit key shapes: `phaseN-gN-english`=98, `phaseN-gN-civics`=73, `phaseN-gN-science`=58, `phaseN-gN-social_studies`=41, `phaseN-gN-literacy`=35, `phaseN-gN-pe`=29, `phaseN-gN-math`=15, `history-gN-uN-settlement-colonization-and-the-republic-N-N`=12, `history-gN-uN-independent-liberia-governance-and-society-N-N`=12, `history-gN-uN-world-history-revolution-empire-and-independence`=9, `civics-gN-N-rules-rights-and-duties`=6, `civics-gN-N-citizenship-and-participation`=6, `history-gN-uN-historical-sources-evidence-and-waec-preparation`=6, `civics-gN-N-institutions-and-leadership`=5, `computer_science-gN-uN-coding-basics-sequences-and-step-by-step-instructions`=5, `computer_science-gN-uN-computing-for-school-life-research-writing-and-sharing`=5, `math-gN-N-patterns-algebra-and-functions`=4, `math-gN-fractions-and-equivalence`=3, `science-gN-animal-systems-and-habitats`=3, `science-gN-earth-weather-and-water`=3, `civics-gN-N-conflict-resolution-and-dialogue`=3, `computer_science-gN-uN-digital-citizenship-and-responsible-technology-use`=3, `math-gN-N-fractions-decimals-and-ratios`=3, `math-gN-measurement-and-estimation`=2, `science-gN-living-things-and-their-needs`=2, `science-gN-plant-systems-and-food-making`=2, `science-gN-scientific-problem-solving`=2, `math-gN-problem-solving-in-context`=2, `english-gN-argument-and-evidence`=2, `english-gN-literary-response`=2, `science-gN-scientific-observation-and-investigation`=2, `science-gN-energy-light-and-sound`=2, `science-gN-human-body-and-health`=2, `literacy-gN-N-listening-and-speaking`=2, `math-gN-N-number-sense-and-place-value`=2, `science-gN-N-science-review-and-application`=2, `science-gN-N-environment-and-sustainability`=2, `social_studies-gN-N-liberia-and-local-life`=2, `science-gN-plants-light-food`=1, `literacy-gN-main-idea-summary`=1, `literacy-gN-listening-speaking-and-story-language`=1, `literacy-gN-story-sequencing-and-retelling`=1, `literacy-gN-inference-and-clues`=1, `literacy-gN-reading-confidence-and-reflection`=1, `math-gN-addition-and-subtraction-reasoning`=1, `math-gN-multiplication-and-division-strategies`=1, `math-gN-decimals-and-percentages`=1, `math-gN-ratio-and-proportion`=1, `math-gN-geometry-and-spatial-reasoning`=1, `math-gN-data-representation-and-interpretation`=1, `math-gN-algebraic-patterns-and-expressions`=1, `math-gN-exam-strategy-and-mathematical-communication`=1, `english-gN-vocabulary-in-context`=1, `english-gN-sentence-and-paragraph-craft`=1, `english-gN-waec-style-reading-and-writing`=1, `science-gN-data-in-science`=1, `science-gN-N-observation-and-scientific-thinking`=1, `math-gN-N-geometry-and-spatial-thinking`=1, `science-gN-N-earth-water-and-weather`=1, `literacy-gN-N-comprehension-and-inference`=1, `literacy-gN-N-paragraphs-and-text-structure`=1, `literacy-gN-N-writing-and-sentence-craft`=1, `social_studies-gN-N-culture-and-heritage`=1, `science-gN-N-human-body-and-health`=1, `science-gN-N-living-things`=1, `literacy-gN-N-vocabulary-and-language`=1.

## Duplicates: 25 groups, 83 rows

Survivor ranking, strongest first: human-review approval, learner/teacher activity rows attached, all reference rows, payload completeness, learner-visible status, most recent update, contentId. Every group and its reasons are in `cleanup-plan.json` → `duplicateGroups`.

Retained (not repointed) reference rows on retired duplicates: history_preserved=66, unique_binding_survivor_already_bound=11. History tables (learning events, submissions, homework, AI interactions, ledgers, audio/video) stay attached to the lesson the learner actually saw. The superseded row is never deleted, so those rows keep resolving.

## Learner impact

- Lessons leaving learner view (superseded or returned for review): **282**
- Cells that would lose every visible lesson: 10|MATH, 12|CIVICS, 12|SCIENCE, 12|SOCIAL_STUDIES
- Learner/teacher reference rows repointed: 0

## Grade 4 Math release bindings (production)

| Reference | Exists live | Repair |
|---|---|---|
| contentBinding ll-g4-math-fractions-equal-parts-2026.1 | **no** | Founder runs scripts/author-grade4-fractions-authority.ts (human review identity required); not an automated cleanup action |
| learningTargetCode LR-MATH-G4_6-02 (CurriculumLearningTarget) | **no** | No CurriculumLearningTarget rows exist for grade 4 at all; the binding's standard exists. Seed via the governed target workflow after MOE objective review, or treat standardCode as the live anchor |
| standardCode LR-MATH-G4_6-02 (Standard) | yes | none needed |
| skillId placement-skill-MATH-G4_6 (Skill) | yes | none needed |

Production has **0** Grade 4 Math lessons, 2 Grade 4 Math units (yearmap-g4-math-u01 "Data", yearmap-g4-math-u02 "Algebra"), 0 grade-4 learning targets and 0 grade-4 MoeCurriculumObjective rows.

## Rollback / recovery plan

1. **Before apply:** take a Supabase point-in-time marker and export the rows named in `cleanup-plan.json` (every action carries its before-image). Record the snapshot `capturedAt`; abort if any targeted row's `updatedAt` changed since then (optimistic check).
2. **Apply** in one transaction per action class, in plan order: supersede → repoint references → return for review → prerequisite edges → variants → unit links. Lesson state changes go through `lib/curriculum/mutations/governanceWriter.ts` so every change is a governance event, never a raw status write.
3. **Rollback:** governance changes are reversed with compensating events (REINSTATED to the prior status); repoints are reversed from `from`/`to`; deleted edges and variants are re-inserted from their before-images with original ids; repaired unit links are restored from `fromUnitId`. The validator proves apply-then-reverse reproduces the snapshot byte-for-byte.
4. **Point-in-time restore** is the last resort if a partial apply leaves an inconsistent state.

## Execution gate (not yet satisfied)

- [ ] Human review of the 25 survivor decisions and the 224 lessons leaving learner view
- [ ] Explicit production-write authorization
- [ ] Executor script built on governanceWriter, run first against staging with a fresh staging snapshot
- [ ] Fresh production snapshot re-planned immediately before apply (plan is snapshot-bound)
- [ ] Decision on the 495 retained unit keys: create governed CurriculumUnit rows for the 93 distinct topic keys, or move mastery grouping off `unitId` first
