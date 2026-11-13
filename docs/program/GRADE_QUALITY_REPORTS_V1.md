# Per-Grade Academic Quality Reports V1

Generated from the CoS G3 audit (`curriculum/program/stem-v1/g3-audit.json`, `scripts/cos-stem/g3-audit.cjs`), the independent academic reviews (`curriculum/program/stem-v1/reviews/`) and the day plans. G3 is mechanical evidence; academic review is AI-assisted and internal; **no human subject-expert approval is claimed for any lesson.**

## Grade K: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G00-P1-ENGLISH-U1`, `GO-G00-P2-MATH-U1`, `GO-G00-P3-SCIENCE-U1`, `GO-G00-P4-ENGINEERING-U1`, `GO-G00-P5-COMPUTING-U1`, `GO-G00-P6-SOCIAL_STUDIES-U1`, `GO-G00-SUPPORT`, `GO-G00-EOD`.

## Grade 1: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G01-P1-ENGLISH-U1`, `GO-G01-P2-MATH-U1`, `GO-G01-P3-SCIENCE-U1`, `GO-G01-P4-ENGINEERING-U1`, `GO-G01-P5-COMPUTING-U1`, `GO-G01-P6-SOCIAL_STUDIES-U1`, `GO-G01-SUPPORT`, `GO-G01-EOD`.

## Grade 2: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G02-P1-ENGLISH-U1`, `GO-G02-P2-MATH-U1`, `GO-G02-P3-SCIENCE-U1`, `GO-G02-P4-ENGINEERING-U1`, `GO-G02-P5-COMPUTING-U1`, `GO-G02-P6-SOCIAL_STUDIES-U1`, `GO-G02-SUPPORT`, `GO-G02-EOD`.

## Grade 3: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G03-P1-MATH-U1`, `GO-G03-P2-SCIENCE-U1`, `GO-G03-P3-ENGLISH-U1`, `GO-G03-P4-SOCIAL_STUDIES-U1`, `GO-G03-P5-COMPUTING-U1`, `GO-G03-P6-ENGINEERING-U1`, `GO-G03-SUPPORT`, `GO-G03-EOD`.

## Grade 4: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G04-P1-MATH-U1`, `GO-G04-P2-SCIENCE-U1`, `GO-G04-P3-ENGLISH-U1`, `GO-G04-P4-SOCIAL_STUDIES-U1`, `GO-G04-P5-COMPUTING-U1`, `GO-G04-P6-ENGINEERING-U1`, `GO-G04-SUPPORT`, `GO-G04-EOD`.

## Grade 5: DAY_PARTIAL (G3 0 pass / 7 fail)

### `4.0.0-schoolday.1-draft.2@g5-civics-shared-water-decisions` (SOCIAL_STUDIES): G3_REVISE

Package `212048cede33fb7ef2854441210b557b8cbce973f4d847119daa4f538b2013f5`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |

### `4.0.0-schoolday.1-draft.2@g5-computing-garden-counting-rules` (COMPUTING): G3_REVISE

Package `a5b0aa1d98fce3750572258b0ca6f2ca31ee7c982c97ae0d60bc65193de491f4`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (2 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| SUBJECT_RECORDED_WRONG | MAJOR | Record the course's subject code (course COMPUTING expects COMPUTER_SCIENCE, package records SCIENCE). |
| PATTERN_MISMATCH | MAJOR | Restructure the scenes to the family pattern (COMPUTING: PREDICT > DECOMPOSE > DEMONSTRATE > BUILD_WITH_SUPPORT > BUILD_INDEPENDENTLY > TEST > DEBUG > APPLY; package has PREDICT > EXPERIMENT > OBSERVE > EXPLAIN > APPLY). |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 6 lessons in other courses (SCIENCE, ENGINEERING)). |

### `4.0.0-schoolday.1-draft.2@g5-english-garden-water-report` (ENGLISH): G3_REVISE

Package `38dc0f11753617f63994154f5d042fedce23b60d1e84b23dda294898aee81630`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (10 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Revise and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Revise and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Practical procedure and accessible participation", "No graded assessment supplied". |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |

### `4.0.0-schoolday.1-draft.2@g5-science-garden-evidence-review` (SCIENCE): G3_REVISE

Package `d51839168799f056b2926cd0ccb7a58324c74ddeb9c0cda8ff8d991c3db46194`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (7 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 4 lessons in other courses (ENGINEERING, COMPUTING)). |

### `4.0.0-schoolday.1-draft.2@g5-science-water-change-investigation` (SCIENCE): G3_REVISE

Package `ff47e58eae777c5e7e164821bb2b09a0045670f169ba4f7a139bcd845f73e838`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (4 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 4 lessons in other courses (ENGINEERING, COMPUTING)). |

### `4.0.0-schoolday.1-draft.2@g5-stem-paper-channel-design` (ENGINEERING): G3_REVISE

Package `be1561ca2176bffcad9b59482bfb879d9af07b039393569cb9c5f7edbf0f3886`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (10 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| SUBJECT_RECORDED_WRONG | MAJOR | Record the course's subject code (course ENGINEERING expects ENGINEERING_FOUNDATIONS, package records SCIENCE). |
| PATTERN_MISMATCH | MAJOR | Restructure the scenes to the family pattern (ENGINEERING: DEFINE > RESEARCH_CONSTRAINTS > DESIGN > BUILD_OR_MODEL > TEST > REFINE > COMMUNICATE; package has PREDICT > EXPERIMENT > OBSERVE > EXPLAIN > APPLY). |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 6 lessons in other courses (SCIENCE, COMPUTING)). |

### `4.0.0-draft.6@math-multiplication-models` (MATH): G3_REVISE

Package `7a469baccfb5d7d1e932942baf013e1848579c4efa9077a949dcebb7542d75ce`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| TITLE_PREFIX | MINOR | Remove the generator prefix from the learner-facing title. |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 0 named; ids: generated-math-misconception); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Four partial products", "Fill the four rectangles". Keep independent scenes hint-free. |
| TWO_OPTION_CHECKS | MAJOR | Give choice items at least three plausible options, each wrong option tied to a misconception (3 of 3 choice items have two options). |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Split both dimensions", "Four partial products", "Fill the four rectangles", "Multiply two-digit numbers independently", "Recover the missing rectangles". |

Open generation orders: `GO-G05-P1-MATH-U1-R`, `GO-G05-P2-SCIENCE-U1-R`, `GO-G05-P3-ENGLISH-U3-R`, `GO-G05-P4-SOCIAL_STUDIES-U4-R`, `GO-G05-P5-COMPUTING-U2-R`, `GO-G05-P6-ENGINEERING-U4-R`, `GO-G05-EOD`.

## Grade 6: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G06-P1-MATH-U1`, `GO-G06-P2-SCIENCE-U1`, `GO-G06-P3-ENGLISH-U1`, `GO-G06-P4-CIVICS-U1`, `GO-G06-P5-COMPUTING-U1`, `GO-G06-P6-ENGINEERING-U1`, `GO-G06-SUPPORT`, `GO-G06-EOD`.

## Grade 7: DAY_PARTIAL (G3 0 pass / 10 fail)

### `4.0.0-draft.6@g7-civics-counties-capitals` (CIVICS): G3_REVISE

Package `2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| TITLE_PREFIX | MINOR | Remove the generator prefix from the learner-facing title. |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 0 named; ids: generated-civics-misconception); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Learn county areas and capitals". Keep independent scenes hint-free. |
| TWO_OPTION_CHECKS | MAJOR | Give choice items at least three plausible options, each wrong option tied to a misconception (3 of 3 choice items have two options). |

### `4.0.0-schoolday.1-draft.2@g7-computing-water-monitor-algorithms` (COMPUTING): G3_REVISE

Package `50d11724521ae9bf66647c2a250b3d6c48a2c7fbbb7c648a3585bab5fe269e6e`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (2 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Question and representation", "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| SUBJECT_RECORDED_WRONG | MAJOR | Record the course's subject code (course COMPUTING expects COMPUTER_SCIENCE, package records SCIENCE). |
| PATTERN_MISMATCH | MAJOR | Restructure the scenes to the family pattern (COMPUTING: PREDICT > DECOMPOSE > DEMONSTRATE > BUILD_WITH_SUPPORT > BUILD_INDEPENDENTLY > TEST > DEBUG > APPLY; package has PREDICT > EXPERIMENT > OBSERVE > EXPLAIN > APPLY). |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 6 lessons in other courses (SCIENCE, ENGINEERING)). |
| RIGOR_BELOW_BAND | MAJOR | Raise the STEM demand to the grade band: Measure and graph, reason formally, trace and test code, design to criteria: 1 quantitative tasks, band 6-8 needs 2. |

### `4.0.0-draft.6@g7-english-reading-evidence` (ENGLISH): G3_REVISE

Package `fa54d6f4d508a81020bcf18c906a948a8c1c0e74ec1f384aa9c088acb289be19`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| TITLE_PREFIX | MINOR | Remove the generator prefix from the learner-facing title. |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 0 named; ids: generated-english-misconception); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Read for meaning and causes". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Read an informational explanation", "Write a supported paragraph". |

### `4.0.0-schoolday.1-draft.2@g7-english-water-evidence-report` (ENGLISH): G3_REVISE

Package `f0b35fbb47fbd77c56ed72e6a315699a55e7d8618144b821841e8516717410fe`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (4 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Revise and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Revise and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Practical procedure and accessible participation", "No graded assessment supplied". |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |

### `4.0.0-draft.6@g7-math-area-perimeter` (MATH): G3_REVISE

Package `86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| TITLE_PREFIX | MINOR | Remove the generator prefix from the learner-facing title. |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 0 named; ids: generated-math-misconception); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Explain both measurements", "Try both shapes with support". Keep independent scenes hint-free. |

### `4.0.0-draft.6@g7-math-fractions` (MATH): G3_REVISE

Package `ffaafcbb124def71114178a07736acf7c3609aa1debf36e413b4bdf1a5aae69a`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| TITLE_PREFIX | MINOR | Remove the generator prefix from the learner-facing title. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Rename before combining". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 0 named; ids: generated-math-misconception); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Rename before combining", "Represent and combine with support". Keep independent scenes hint-free. |
| TWO_OPTION_CHECKS | MAJOR | Give choice items at least three plausible options, each wrong option tied to a misconception (6 of 6 choice items have two options). |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Rename before combining", "Diagnose a changed fraction unit". |

### `4.0.0-schoolday.1-draft.2@g7-science-evaporation-fair-test` (SCIENCE): G3_REVISE

Package `3956be4804ec6207a39b2448a2e317c140b582662db56e6aa821c6cddc7853c2`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (6 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 4 lessons in other courses (ENGINEERING, COMPUTING)). |

### `4.0.0-draft.6@g7-science-states-of-matter` (SCIENCE): G3_REVISE

Package `7863152eba2e51b818a1b304fa0b240f7b0ac0d2656406947488fbc93ae912f9`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| TITLE_PREFIX | MINOR | Remove the generator prefix from the learner-facing title. |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 0 named; ids: generated-science-misconception); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Test the energy model on paper". Keep independent scenes hint-free. |
| TWO_OPTION_CHECKS | MAJOR | Give choice items at least three plausible options, each wrong option tied to a misconception (8 of 8 choice items have two options). |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Predict while ice melts", "Explain latent heat and evaporation". |
| UNUSED_AVAILABLE_SIMULATION | MAJOR | Use the registered PARTICLE_MODEL and PREDICT_OBSERVE blocks for the phase-change investigation. |
| RIGOR_BELOW_BAND | MAJOR | Raise the STEM demand to the grade band: Measure and graph, reason formally, trace and test code, design to criteria: 0 quantitative tasks, band 6-8 needs 2. |

### `4.0.0-schoolday.1-draft.2@g7-science-water-evidence-synthesis` (SCIENCE): G3_REVISE

Package `831dc9e578b2cfd382601a1d3262365e2c2465be40c47b7c2f0847f7532b8406`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (4 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 4 lessons in other courses (ENGINEERING, COMPUTING)). |

### `4.0.0-schoolday.1-draft.2@g7-stem-water-cover-design` (ENGINEERING): G3_REVISE

Package `ef241d39bfaabc55ab8ab06218893f7e758f044e2eec7c3f65474ad961664406`.

| Finding | Severity | Precise revision |
| --- | --- | --- |
| MOJIBAKE | BLOCKING | Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (2 occurrence(s) in the learner projection). The factory text-integrity check must run on every output file. |
| LEARNER_SEES_POLICY_TEXT | MAJOR | Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: scenes "Independent investigation", "Apply and extend", "No graded assessment supplied". |
| TEMPLATE_BODY | MAJOR | Replace the generic template body with lesson-specific teaching: scenes "Independent investigation", "Explain and diagnose", "Apply and extend". |
| SINGLE_MISCONCEPTION | MAJOR | Declare at least two named, objective-linked misconceptions (now 1 named; ids: reasoning-error); give each a diagnostic distractor or mistake analysis and targeted feedback. |
| NO_HINTS_IN_GUIDED | MAJOR | Add a meaningful hint before the answer in each guided scene: scenes "Worked reasoning and guided investigation". Keep independent scenes hint-free. |
| GENERIC_LEARNER_ACTION | MAJOR | Rewrite each learner action to say exactly what to do in this lesson: scenes "Question and representation", "Practical procedure and accessible participation", "No graded assessment supplied". |
| SUBJECT_RECORDED_WRONG | MAJOR | Record the course's subject code (course ENGINEERING expects ENGINEERING_FOUNDATIONS, package records SCIENCE). |
| PATTERN_MISMATCH | MAJOR | Restructure the scenes to the family pattern (ENGINEERING: DEFINE > RESEARCH_CONSTRAINTS > DESIGN > BUILD_OR_MODEL > TEST > REFINE > COMMUNICATE; package has PREDICT > EXPERIMENT > OBSERVE > EXPLAIN > APPLY). |
| GUIDED_WITHOUT_FEEDBACK | MAJOR | Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): scenes "Worked reasoning and guided investigation". |
| TEMPLATE_STRUCTURE | MAJOR | Design this lesson's structure for its subject rather than the shared template (same phases and blocks as 6 lessons in other courses (SCIENCE, COMPUTING)). |

Open generation orders: `GO-G07-P1-MATH-U2-R`, `GO-G07-P2-SCIENCE-U2-R`, `GO-G07-P3-ENGLISH-U1-R`, `GO-G07-P4-CIVICS-U1-R`, `GO-G07-P5-COMPUTING-U3-R`, `GO-G07-P6-ENGINEERING-U6-R`, `GO-G07-EOD`.

## Grade 8: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G08-P1-MATH-U1`, `GO-G08-P2-SCIENCE-U1`, `GO-G08-P3-ENGLISH-U1`, `GO-G08-P4-CIVICS-U1`, `GO-G08-P5-COMPUTING-U1`, `GO-G08-P6-ENGINEERING-U1`, `GO-G08-SUPPORT`, `GO-G08-EOD`.

## Grade 9: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G09-P1-MATH-U1`, `GO-G09-P2-SCIENCE-U1`, `GO-G09-P3-ENGLISH-U1`, `GO-G09-P4-CIVICS-U1`, `GO-G09-P5-COMPUTING-U1`, `GO-G09-P6-ENGINEERING-U1`, `GO-G09-SUPPORT`, `GO-G09-EOD`.

## Grade 10: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G10-P1-MATH-U1`, `GO-G10-P2-PHYSICS-U1`, `GO-G10-P3-ENGLISH-U1`, `GO-G10-P4-CHEMISTRY-U1`, `GO-G10-P5-COMPUTING-U1`, `GO-G10-P6-ENGINEERING-U1`, `GO-G10-SUPPORT`, `GO-G10-EOD`.

## Grade 11: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G11-P1-MATH-U1`, `GO-G11-P2-CHEMISTRY-U1`, `GO-G11-P3-ENGLISH-U1`, `GO-G11-P4-BIOLOGY-U1`, `GO-G11-P5-COMPUTING-U1`, `GO-G11-P6-ENGINEERING-U1`, `GO-G11-SUPPORT`, `GO-G11-EOD`.

## Grade 12: DAY_NOT_STARTED (G3 0 pass / 0 fail)

No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.

Open generation orders: `GO-G12-P1-MATH-U1`, `GO-G12-P2-BIOLOGY-U1`, `GO-G12-P3-ENGLISH-U1`, `GO-G12-P4-PHYSICS-U1`, `GO-G12-P5-COMPUTING-U1`, `GO-G12-P6-ENGINEERING-U1`, `GO-G12-SUPPORT`, `GO-G12-EOD`.

