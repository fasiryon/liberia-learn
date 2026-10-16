# Library Curriculum Quality Baseline V1

Every lesson in the production catalog (1105) audited at its exact current revision against Curriculum Excellence Standard V1 (`lib/curriculum/excellence/standard.ts`), extract captured 2026-10-16T18:44:42.884Z. Per-lesson findings with revision id, content hash, section pointer, evidence and proposed correction: `curriculum/modernization/v1/audit/grade-NN.json`; finding texts: `audit/finding-catalogue.json`.

## How to read this baseline

- **Mechanical findings** are reproducible from the revision bytes (structure, counts, arithmetic, keys, alt text, alignment ids). **Judgment indicators** are mechanical signals that need an expert (possible mislabel, unsourced statistic, reading level). **Governance findings** are missing authority (no MOE source, ownership, lifecycle).
- Areas needing expert judgment (accuracy of explanations, conceptual depth, grade fit, cultural accuracy, alignment decisions) are `AWAITING_INDEPENDENT_REVIEW` for every lesson: no qualified human has reviewed any of these revisions against Excellence V1.
- The auditor is automated tooling. It is not a reviewer, and its output is never an independent review. Published or APPROVED status is **not** treated as evidence of educational effectiveness: no lesson in the catalog has learning-outcome evidence.
- Tracks are **provisional** (mechanical basis). A curriculum reviewer confirms each track in the ledger (`TRACK_CONFIRMED`).

## Review outcomes

| Outcome | Lessons | Share |
| --- | ---: | ---: |
| PASS_MECHANICAL_CHECKS | 0 | 0% |
| REVISE | 701 | 63.4% |
| REBUILD_REQUIRED | 51 | 4.6% |
| BLOCKED_SOURCE_OR_AUTHORITY | 353 | 31.9% |
| AWAITING_INDEPENDENT_REVIEW (judgment areas) | 1105 | 100% |

No lesson passes the mechanical checks: every legacy revision lacks misconception-specific feedback, delayed retention and transfer evidence, which Excellence V1 requires (LM-CON-1, LM-ASM-3, GE-TRN-1).

## Modernization tracks (provisional)

| Track | Lessons | Share |
| --- | ---: | ---: |
| A_TARGETED_REPAIR | 356 | 32.2% |
| B_INSTRUCTIONAL_REDESIGN | 345 | 31.2% |
| C_FULL_REPLACEMENT | 51 | 4.6% |
| D_GOVERNANCE_HOLD | 353 | 31.9% |

| Held lessons: track once the hold is resolved | Lessons |
| --- | ---: |
| A_TARGETED_REPAIR | 255 |
| B_INSTRUCTIONAL_REDESIGN | 81 |
| C_FULL_REPLACEMENT | 17 |

### Track by subject

| Subject | A | B | C | D | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| ENGLISH | 139 | 50 | 0 | 0 | 189 |
| COMPUTER_SCIENCE | 0 | 0 | 0 | 177 | 177 |
| ENGINEERING_FOUNDATIONS | 0 | 0 | 0 | 163 | 163 |
| CIVICS | 33 | 90 | 9 | 1 | 133 |
| SCIENCE | 46 | 80 | 1 | 1 | 128 |
| LITERACY | 74 | 34 | 1 | 1 | 110 |
| MATH | 54 | 40 | 1 | 6 | 101 |
| SOCIAL_STUDIES | 10 | 51 | 0 | 0 | 61 |
| HISTORY | 0 | 0 | 39 | 0 | 39 |
| ENGINEERING | 0 | 0 | 0 | 4 | 4 |

### Track by grade

| Grade | A | B | C | D | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 13 | 9 | 22 | 44 |
| 2 | 0 | 21 | 0 | 25 | 46 |
| 3 | 0 | 16 | 0 | 27 | 43 |
| 4 | 6 | 0 | 0 | 20 | 26 |
| 5 | 63 | 49 | 0 | 40 | 152 |
| 6 | 19 | 24 | 0 | 25 | 68 |
| 7 | 203 | 154 | 3 | 25 | 385 |
| 8 | 22 | 15 | 0 | 23 | 60 |
| 9 | 11 | 1 | 0 | 24 | 36 |
| 10 | 12 | 2 | 13 | 36 | 63 |
| 11 | 10 | 0 | 13 | 43 | 66 |
| 12 | 10 | 50 | 13 | 43 | 116 |

## The 18 audit areas

| Area | Excellence criteria | MET | PARTIAL | NOT_MET | AWAITING_REVIEW | N/A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1. SUBJECT_ACCURACY | NF-ACC-1, NF-ACC-2 | 0 | 0 | 128 | 977 | 0 |
| 2. CONCEPTUAL_DEPTH | LM-CON-2, NF-ACC-2 | 0 | 0 | 78 | 1027 | 0 |
| 3. GRADE_APPROPRIATENESS | NF-ALN-3, LM-ACS-1 | 0 | 0 | 524 | 581 | 0 |
| 4. PREREQUISITE_DIAGNOSTIC | NF-PRG-1 | 0 | 0 | 1105 | 0 | 0 |
| 5. SEQUENCE_WORKED_EXAMPLES | LM-PRG-1 | 741 | 141 | 223 | 0 | 0 |
| 6. COGNITIVE_LOAD | LM-ACS-1 | 755 | 272 | 78 | 0 | 0 |
| 7. MISCONCEPTION_FEEDBACK | LM-CON-1 | 0 | 0 | 1105 | 0 | 0 |
| 8. GUIDED_INDEPENDENT_PRACTICE | LM-PRG-1 | 931 | 0 | 174 | 0 | 0 |
| 9. AUTHENTIC_PERFORMANCE_REASONING | LM-RSN-1, GE-RSN-1 | 0 | 822 | 283 | 0 | 0 |
| 10. ASSESSMENT_VALIDITY | NF-ASM-1, NF-ACC-1, LM-ASM-1, LM-ASM-2 | 174 | 2 | 929 | 0 | 0 |
| 11. DELAYED_RETENTION | LM-ASM-3 | 39 | 0 | 1066 | 0 | 0 |
| 12. TRANSFER | GE-TRN-1 | 3 | 0 | 1102 | 0 | 0 |
| 13. ACCESSIBILITY_OFFLINE | NF-ACS-1 | 989 | 116 | 0 | 0 | 0 |
| 14. LIBERIAN_CONTEXT_EVIDENCE | NF-REL-1, LM-REL-1 | 0 | 0 | 87 | 1018 | 0 |
| 15. MOE_TRACEABILITY | NF-ALN-1 | 0 | 0 | 1105 | 0 | 0 |
| 16. WAEC_ALIGNMENT | NF-ALN-2 | 0 | 0 | 726 | 0 | 379 |
| 17. ADVANCED_ENRICHMENT | GE-EXT-1 | 122 | 983 | 0 | 0 | 0 |
| 18. STUDENT_EXPERIENCE_V3 | NF-ACS-1 | 652 | 201 | 252 | 0 | 0 |

## Findings by code

| Code | Severity | Kind | Area | Lessons |
| --- | ---: | ---: | ---: | ---: |
| NO_MISCONCEPTION_SPECIFIC_FEEDBACK | MAJOR | MECHANICAL | MISCONCEPTION_FEEDBACK | 1105 |
| NO_TRANSFER_TASK | MAJOR | MECHANICAL | TRANSFER | 1102 |
| NO_DELAYED_RETRIEVAL | MAJOR | MECHANICAL | DELAYED_RETENTION | 1066 |
| NO_EXTENSION_PATH | MINOR | MECHANICAL | ADVANCED_ENRICHMENT | 983 |
| REASONING_TASK_WITHOUT_RUBRIC | MINOR | MECHANICAL | AUTHENTIC_PERFORMANCE_REASONING | 822 |
| UNKEYED_ASSESSMENT_ITEMS | MAJOR | MECHANICAL | ASSESSMENT_VALIDITY | 745 |
| NO_WAEC_BASELINE_MAPPING | MAJOR | GOVERNANCE | WAEC_ALIGNMENT | 657 |
| NO_FALLBACK_ROUTE | MAJOR | MECHANICAL | PREREQUISITE_DIAGNOSTIC | 624 |
| READING_LEVEL_ABOVE_GRADE | MAJOR | JUDGMENT_INDICATOR | GRADE_APPROPRIATENESS | 523 |
| UNVERIFIED_ALIGNMENT_CODES | MAJOR | MECHANICAL | MOE_TRACEABILITY | 427 |
| NO_PREREQUISITE_CHECK | MAJOR | MECHANICAL | PREREQUISITE_DIAGNOSTIC | 375 |
| NO_MISCONCEPTION_TEACHING | MAJOR | MECHANICAL | MISCONCEPTION_FEEDBACK | 374 |
| NO_MOE_SOURCE_FOR_SUBJECT | BLOCKING | GOVERNANCE | MOE_TRACEABILITY | 344 |
| NO_MOE_MAPPING | MAJOR | MECHANICAL | MOE_TRACEABILITY | 334 |
| READING_LEVEL_ABOVE_GRADE | MINOR | JUDGMENT_INDICATOR | GRADE_APPROPRIATENESS | 330 |
| NO_REASONING_TASK | MAJOR | MECHANICAL | AUTHENTIC_PERFORMANCE_REASONING | 283 |
| OBJECTIVES_UNDER_ASSESSED | MINOR | MECHANICAL | ASSESSMENT_VALIDITY | 267 |
| DENSE_SECTION | MINOR | MECHANICAL | COGNITIVE_LOAD | 266 |
| NO_WORKED_EXAMPLE | MAJOR | MECHANICAL | SEQUENCE_WORKED_EXAMPLES | 223 |
| NO_GUIDED_PRACTICE | MAJOR | MECHANICAL | GUIDED_INDEPENDENT_PRACTICE | 174 |
| NO_INDEPENDENT_PRACTICE | MAJOR | MECHANICAL | GUIDED_INDEPENDENT_PRACTICE | 174 |
| TOO_MANY_SCENES | MINOR | MECHANICAL | STUDENT_EXPERIENCE_V3 | 174 |
| NO_SCENE_STRUCTURE | MAJOR | MECHANICAL | STUDENT_EXPERIENCE_V3 | 156 |
| PROXY_SUBJECT_DECISION_REQUIRED | MAJOR | GOVERNANCE | MOE_TRACEABILITY | 133 |
| NO_END_OF_LESSON_ASSESSMENT | MAJOR | MECHANICAL | ASSESSMENT_VALIDITY | 128 |
| POSSIBLE_SUBJECT_MISLABEL | MAJOR | JUDGMENT_INDICATOR | SUBJECT_ACCURACY | 124 |
| LAB_WITHOUT_OFFLINE_FALLBACK | MINOR | MECHANICAL | ACCESSIBILITY_OFFLINE | 116 |
| TEXT_LOAD_EXCEEDS_EMERGENT_READER_BUDGET | MAJOR | MECHANICAL | GRADE_APPROPRIATENESS | 114 |
| PRIOR_KNOWLEDGE_NOT_DIAGNOSTIC | MAJOR | MECHANICAL | PREREQUISITE_DIAGNOSTIC | 106 |
| NO_SCENE_STRUCTURE | MINOR | MECHANICAL | STUDENT_EXPERIENCE_V3 | 95 |
| WORKED_EXAMPLE_WITHOUT_STEPS | MINOR | MECHANICAL | SEQUENCE_WORKED_EXAMPLES | 89 |
| UNSOURCED_CLAIM:CITED_STUDY_OR_REPORT | MAJOR | JUDGMENT_INDICATOR | LIBERIAN_CONTEXT_EVIDENCE | 85 |
| DUPLICATE_TITLE | MINOR | MECHANICAL | STUDENT_EXPERIENCE_V3 | 81 |
| SEQUENCE_OUT_OF_ORDER | MINOR | MECHANICAL | SEQUENCE_WORKED_EXAMPLES | 81 |
| SERIALIZATION_ARTIFACT | MAJOR | MECHANICAL | STUDENT_EXPERIENCE_V3 | 79 |
| DENSE_SECTION | MAJOR | MECHANICAL | COGNITIVE_LOAD | 78 |
| WAEC_TAGS_UNVERIFIED | MAJOR | GOVERNANCE | WAEC_ALIGNMENT | 69 |
| ANSWER_KEY_IN_LEARNER_TEXT | MAJOR | MECHANICAL | ASSESSMENT_VALIDITY | 68 |
| THIN_CONCEPT_EXPLANATION | MAJOR | MECHANICAL | CONCEPTUAL_DEPTH | 66 |
| TEMPLATE_SHELL | BLOCKING | MECHANICAL | CONCEPTUAL_DEPTH | 44 |
| PLACEHOLDER_CONTENT | BLOCKING | MECHANICAL | CONCEPTUAL_DEPTH | 40 |
| NO_LIBERIAN_CONTEXT | MINOR | MECHANICAL | LIBERIAN_CONTEXT_EVIDENCE | 30 |
| LONG_PARAGRAPHS | MINOR | MECHANICAL | COGNITIVE_LOAD | 15 |
| DEMO_OR_TEST_FIXTURE_IN_CATALOG | BLOCKING | GOVERNANCE | STUDENT_EXPERIENCE_V3 | 10 |
| DUPLICATE_LEARNER_TEXT | MAJOR | MECHANICAL | STUDENT_EXPERIENCE_V3 | 8 |
| TEMPLATE_SHELL | MAJOR | MECHANICAL | CONCEPTUAL_DEPTH | 8 |
| ARITHMETIC_ERROR | MAJOR | MECHANICAL | SUBJECT_ACCURACY | 3 |
| STUB_CONTENT | BLOCKING | MECHANICAL | CONCEPTUAL_DEPTH | 3 |
| RAW_HTML_IN_LEARNER_TEXT | MINOR | MECHANICAL | STUDENT_EXPERIENCE_V3 | 2 |
| UNSOURCED_CLAIM:INSTITUTIONAL_ATTRIBUTION | MAJOR | JUDGMENT_INDICATOR | LIBERIAN_CONTEXT_EVIDENCE | 2 |
| ARITHMETIC_ERROR | BLOCKING | MECHANICAL | SUBJECT_ACCURACY | 1 |
| REVOKED_CONTENT | BLOCKING | GOVERNANCE | STUDENT_EXPERIENCE_V3 | 1 |
| SCHOOL_OR_TEACHER_OWNED | BLOCKING | GOVERNANCE | MOE_TRACEABILITY | 1 |
| UNSOURCED_CLAIM:DATED_STATISTIC | MAJOR | JUDGMENT_INDICATOR | LIBERIAN_CONTEXT_EVIDENCE | 1 |
| WIDE_TABLE | MINOR | MECHANICAL | ACCESSIBILITY_OFFLINE | 1 |

## Governance holds

| Hold reason | Lessons |
| --- | ---: |
| NO_MOE_SOURCE_FOR_SUBJECT | 344 |
| DEMO_OR_TEST_FIXTURE_IN_CATALOG | 10 |
| REVOKED_CONTENT | 1 |
| SCHOOL_OR_TEACHER_OWNED | 1 |

- `NO_MOE_SOURCE_FOR_SUBJECT`: Computer Science and Engineering have no MOE curriculum document in the verified archives (`curriculum/sources/raw/source-manifest.json`). Their objectives are LiberiaLearn-originated and must not be presented as MOE requirements. Unblocking needs a curriculum-owner scope decision, not more generation.
- Civics has no MOE document either; it is traced through MOE Social Studies only as a **proxy** that needs an owner decision before release (`PROXY_SUBJECT_DECISION_REQUIRED`, not a hold).
- WAEC: the repository's WAEC syllabus map comes from public aggregator sources and keyword tagging, so no lesson can claim WAEC alignment beyond "topic may be relevant" until an official syllabus is registered.

## Priority (first proposed wave)

Priority = (risk × curriculum importance + learner exposure + 2 × prerequisite dependants) / √effort. Risk weighs mechanical severity and accuracy indicators; importance weights foundational literacy and numeracy, most in early grades; exposure uses counts of progress, scheduled work, learning events, schools and assignments. Waves of 40 first take the top lesson of every uncovered grade/subject cell, then fill by score. Held lessons are not scheduled.

| # | Lesson | Cell | Track | Score | Why (top findings) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `draft-phase6-g7-english-w34-d4-core` | G7 ENGLISH | A | 38.6 | POSSIBLE_SUBJECT_MISLABEL, READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE |
| 2 | `english-g7-argument-and-evidence-performance` | G7 ENGLISH | A | 34.34 | POSSIBLE_SUBJECT_MISLABEL, READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE |
| 3 | `draft-phase6-g7-english-w34-d3-core` | G7 ENGLISH | A | 33.94 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 4 | `draft-phase6-g7-english-w28-d1-core` | G7 ENGLISH | A | 33.65 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 5 | `desert-english-g9-the-language-of-power-political-speeches-0b93c829` | G9 ENGLISH | A | 29.15 | NO_FALLBACK_ROUTE, DENSE_SECTION, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 6 | `hero-math-g7-geometry-area-and-perimeter-of-polygons` | G7 MATH | A | 25.11 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, DENSE_SECTION |
| 7 | `desert-english-g8-extended-essay-writing-research-and-argu-242eb828` | G8 ENGLISH | A | 24.62 | READING_LEVEL_ABOVE_GRADE, PRIOR_KNOWLEDGE_NOT_DIAGNOSTIC, DENSE_SECTION |
| 8 | `draft-phase6-g7-pe-w28-d1-core` | G7 LITERACY | A | 22.2 | PRIOR_KNOWLEDGE_NOT_DIAGNOSTIC, NO_MISCONCEPTION_SPECIFIC_FEEDBACK, UNKEYED_ASSESSMENT_ITEMS |
| 9 | `lesson_mca_1` | G7 MATH | A | 22.07 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 10 | `draft-phase6-g7-civics-w31-d4-core` | G7 CIVICS | A | 21.88 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 11 | `wk_mca7a_thu_p2` | G7 LITERACY | A | 20.09 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 12 | `wk_pcs6a_fri_p1` | G6 MATH | A | 20.05 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 13 | `hero-science-g7-ecosystems-food-chains-and-biodiversity` | G7 SCIENCE | A | 20.03 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 14 | `desert-english-g11-writing-for-publication-articles-and-ess-0d40787c` | G11 ENGLISH | A | 19.8 | PRIOR_KNOWLEDGE_NOT_DIAGNOSTIC, NO_MISCONCEPTION_SPECIFIC_FEEDBACK, NO_REASONING_TASK |
| 15 | `wk_pcs6a_wed_p2` | G6 LITERACY | A | 19.56 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 16 | `wk_mca7a_tue_p2` | G7 LITERACY | A | 19.41 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 17 | `desert-english-g12-advanced-rhetoric-and-argumentation-ab3fe2e0` | G12 ENGLISH | A | 19.24 | NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK, UNKEYED_ASSESSMENT_ITEMS |
| 18 | `wk_krs5a_wed_p1` | G5 MATH | A | 19.21 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 19 | `civics-g1-3-institutions-and-leadership-teacher-modeling` | G1 CIVICS | B | 18.7 | READING_LEVEL_ABOVE_GRADE, TEXT_LOAD_EXCEEDS_EMERGENT_READER_BUDGET, NO_FALLBACK_ROUTE |
| 20 | `draft-phase6-g7-english-w34-d2-core` | G7 ENGLISH | A | 18.54 | POSSIBLE_SUBJECT_MISLABEL, READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE |
| 21 | `draft-phase6-g7-literacy-w19-d5-core` | G7 LITERACY | A | 18.12 | READING_LEVEL_ABOVE_GRADE, NO_FALLBACK_ROUTE, NO_MISCONCEPTION_SPECIFIC_FEEDBACK |
| 22 | `civics-g1-2-citizenship-and-participation-teacher-modeling` | G1 CIVICS | B | 18.06 | READING_LEVEL_ABOVE_GRADE, TEXT_LOAD_EXCEEDS_EMERGENT_READER_BUDGET, NO_FALLBACK_ROUTE |
| 23 | `civics-g1-2-citizenship-and-participation-independent-practice` | G1 CIVICS | B | 17.85 | READING_LEVEL_ABOVE_GRADE, TEXT_LOAD_EXCEEDS_EMERGENT_READER_BUDGET, NO_FALLBACK_ROUTE |
| 24 | `wk_mca7a_mon_p1` | G7 MATH | A | 17.75 | PRIOR_KNOWLEDGE_NOT_DIAGNOSTIC, NO_MISCONCEPTION_SPECIFIC_FEEDBACK, UNKEYED_ASSESSMENT_ITEMS |
| 25 | `wk_mca7a_fri_p3` | G7 SCIENCE | A | 17.71 | ARITHMETIC_ERROR, NO_FALLBACK_ROUTE, DENSE_SECTION |

Full order: `curriculum/modernization/v1/waves.json` (752 schedulable lessons in 19 waves).
