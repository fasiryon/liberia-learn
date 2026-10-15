# Legacy comparison — Understanding Essay Writing: Structure and Argument

**REVIEWER ONLY. CANDIDATE ONLY.** This compares the DRAFT candidate with the live legacy revision it may later replace. It records evidence and recommendations; it approves, publishes and changes nothing. Recommendations marked _reviewer decides_ are **not** applied to the candidate.

## Source and revision evidence

| Field | Value |
| --- | --- |
| Legacy content | `hero-literacy-g7-essay-writing-structure-and-argumentation` (pk `cmpyjp25s00cqvorwisg1rhyn`) |
| Revision compared | `cmss94dmc03b7vo54ryf3hqk1` (BACKFILL_SNAPSHOT, origin LEGACY_UNKNOWN, backfill `p2a-production-backfill-20260814`) |
| Current revision of the row | yes (1 revision in total) |
| Provenance | `cmss94dk403b5vo54w0tpmhh9`: lifecycle APPROVED, completeness UNVERIFIED |
| Stored content hash | `3809f98290bae0a5b8364e4bc2faf8c257111f0c21e3c383acd45310fc236ba6` |
| Recomputed from extract | `3809f98290bae0a5b8364e4bc2faf8c257111f0c21e3c383acd45310fc236ba6` (match) |
| Live row equals revision at capture | yes |
| Extract | `artifacts/g7-native-curriculum-v1/legacy/literacy-essay-structure-argument.json` (sha256 `d66a646f3748b2b1cfe9a83ab855e52039dac2e57044fbbd91190cc9250738f7`) |
| Captured | 2026-10-15T19:09:16.876Z, transaction_read_only = on; lesson content only, no learner or user data |
| Candidate first compared | hash `e875feab4d8d9742f421ba98c4c8c59f753e613a3d67526a77409cdd6019f786` at commit `4fdd897c` (the production evidence above is unchanged since) |
| Candidate now | `cv2-cand-g7-literacy-essay-structure-argument` v0.2.0, hash `80b9592641effbdae8f5868323289873a8c1a6e547676241e09ab8ee5db060b1`; recommendations marked "applied" below are in this revision |

## The legacy lesson

- The legacy body (34,044 characters, model metadata "gpt-4o+gpt-4o-mini", generated 2026-06-03) has 16 numbered sections (section 5 is missing). `delivery.body`, `bodyBlock` and `bodyStandard` are identical.
- It teaches the three-part essay through an extended story (Boima comparing two market stalls at Waterside Market) and a jollof-rice metaphor, with market revenue calculations inside the core concept.
- Worked examples are single paragraphs on cassava ("standard method") and palm oil ("brainstorm first"). Guided and independent practice are nine writing prompts whose model answers sit in `assessment.problemSets` (answerKey per prompt).
- The exit ticket is two open questions with model answers (parts of an essay and their roles; how structure makes an argument persuasive). There is no rubric and no keyed item.
- Objectives: (1) identify and explain essay structure; (2) develop and articulate a clear, logical argument supported by evidence; (3) apply critical thinking to evaluate the strength of arguments "preparing them for future careers and civic engagements".
- Standards: keyword alignment (confidence low) to LiberiaLearn code LR-LIT-G7_9-02, "Write persuasive and argumentative essays with evidence and reasoning" (a Grade 7-9 band code, not an MOE item).

## Section-by-section comparison

Disposition: PRESERVED (kept in substance) · IMPROVED (kept, made more precise or correct) · REORGANIZED (kept, moved or split) · REPLACED (same job, new material) · OMITTED (not carried over) · NOT_RESTORED (deliberately excluded).

| Legacy section | Legacy content | Candidate scenes | Disposition | Note |
| --- | --- | --- | --- | --- |
| 1. Hook — The Real-World Challenge | Boima overhears two vendors (Fatu and Kpaan) arguing whose stall is most successful and decides to write an essay comparing them. | `intro` | REPLACED | Candidate hook: a PTA disagreement about a school garden, which needs an argument rather than a comparison. Both are Liberian community settings. |
| 2. Learning Objectives | Three objectives (structure; logical argument with evidence; evaluate argument strength for careers and civic life). | `objectives` | IMPROVED | Objective 1 kept and made specific; objective 2 kept and extended with a counterargument; objective 3 narrowed to choosing and explaining evidence. See the objective comparison. |
| 3. Prior Knowledge Activation | Parts of a short story; fact versus opinion ("Liberia gained independence in 1847"); a time you persuaded someone. | `warm-up` | REORGANIZED | Fact versus opinion preserved (new example); topic sentence added. Short-story parts and the persuasion experience omitted. |
| 4. Core Concept — Concrete Foundation | Introduction (hook, thesis), body (topic sentences; pricing, customer engagement and quality paragraphs with LD$ calculations), conclusion; extra worked-example notes; checks for understanding (discussion, paragraph building, peer review, local context, role play, mathematics integration). | `essay-structure`, `model-plan`, `peel`, `peer-review` | IMPROVED | The three parts and their jobs are kept, shorter and in plain language, with a full model plan. Peer review is restored as a structured activity (R-L4). Revenue calculations, the food metaphors and role play are not restored (L-L5, L-L8). |
| 6. Key Vocabulary | Thesis, evidence, argument, each with a definition, an example and a memory tip. | `thesis`, `evidence`, `essay-structure` | REORGANIZED | Thesis and evidence are defined where they are used; "argument" is taught through the claim/reasons structure. No separate glossary. The legacy thesis example contradicts its own story (L-L4). |
| 7. Worked Example 1 — Standard Method | Paragraph on why cassava is a Liberian staple: thesis, topic sentence, evidence, conclusion. | `peel` | REPLACED | Replaced by a PEEL paragraph from the garden essay. The legacy example gives one paragraph both a thesis and a different topic sentence and mislabels its reasons (L-L1, L-L2). |
| 8. Worked Example 2 — Alternative Method | Brainstorm bullet points (palm oil), organise them, then write the paragraph. | `plan-argument` | IMPROVED | The brainstorm-then-organise method is restored as the learner's own planning step, with real evidence and its source for each reason (R-L2). The palm-oil content is not restored (L-L10). |
| 9. Error Analysis | Three errors: unrelated facts as evidence; no conclusion; misplaced topic sentence. | `evidence-check`, `thesis` | IMPROVED | Irrelevant evidence, circular reasoning and ignoring the other side are checked with feedback. The legacy error 1 example is itself wrong (L-L3) and is not restored. |
| 10. Guided Practice — Problem 1 | Write an introductory paragraph: "The Importance of Education in Rural Liberia". | `model-plan` | OMITTED | The candidate models an introduction (hook and thesis) but never asks the learner to write one (R-L3). |
| 11. Guided Practice — Problem 2 | Draft the first body paragraph: "Why Public Transportation is Essential in Monrovia". | `order-paragraph`, `write-argument` | REPLACED | Body-paragraph practice is kept as ordering a PEEL paragraph and writing one PEEL paragraph. |
| 12. Guided Practice — Problem 3 | Draft introduction and first body paragraph: "The Role of Local Markets in Strengthening Local Economies". | `write-argument` | REPLACED | Narrowed to a thesis and one PEEL paragraph. |
| 13. Independent Practice — Tier 1 | Write a conclusion (learning technology); explain the significance of a thesis. | `write-conclusion`, `exit-ticket` | IMPROVED | Conclusion writing is restored on the lesson's own garden plan, with the no-new-reasons rule the legacy model answer broke (R-L3, L-L7). Thesis knowledge is checked by exit items 1 and 2. |
| 14. Independent Practice — Tier 2 Standard | Draft an introduction (sports and unity); write a body paragraph (renewable energy). | `write-argument` | REPLACED | One body paragraph kept in the candidate's writing task; introduction writing omitted. |
| 15. Independent Practice — Tier 3 Advanced | Analyse storytelling and cultural heritage; evaluate traditional versus modern education methods. | — | OMITTED | Analytical and comparative writing is beyond this lesson's objectives. |
| 16. Group Discussion | "How does essay writing help us understand real-life issues in Liberian society?" with five discussion points. | — | OMITTED | No discussion task. The candidate's reflection is individual. Optional classroom discussion is a reviewer decision. |
| 17. Assessment, Exit Ticket, and Lesson Summary | Two open exit questions with model answers; five key takeaways; next-lesson preview (styles of essays, peer review). | `exit-ticket`, `review` | REPLACED | Exit ticket becomes six single-choice candidate items; takeaways become five plain key ideas. See the assessment comparison. |
| Problem sets (model answers) | Nine model answers (gp1-gp3, ip1a-ip3b) for the practice prompts above. | `write-argument` | NOT_RESTORED | Model answers present unsourced figures as evidence and one conclusion adds new reasons (L-L5, L-L7). The candidate uses a rubric and an expected observation instead. |
| Standards alignment (LR-LIT-G7_9-02) | Keyword alignment, confidence low: "Write persuasive and argumentative essays with evidence and reasoning". | — | NOT_RESTORED | A LiberiaLearn Grade 7-9 band code, not an MOE item; the MOE places argumentative writing in Grade 9. |

New candidate material with no legacy counterpart:
- `evidence`: Four kinds of evidence and four tests; forbids invented facts and figures.
- `reflect`: Writer self-assessment and next step.

## Learning objectives

| Legacy objective | Candidate objectives | Change |
| --- | --- | --- |
| Identify and explain the structure of a well-organized essay, including introduction, body, and conclusion. | `ll-g7-lit-essay-structure` | Kept; narrowed to the argumentative essay and made specific (thesis ends the introduction; each body paragraph opens with a topic sentence). |
| Develop and articulate a clear, logical argument supported by evidence. | `ll-g7-lit-argument-build`<br>`ll-g7-lit-evidence-support` | Split into building an arguable thesis with reasons and choosing/explaining evidence. Answering a counterargument is NEW and raises the demand toward MOE Grade 8-9 scope. |
| Apply critical thinking to evaluate the strength of arguments in various contexts, preparing them for future careers and civic engagements. | `ll-g7-lit-evidence-support` | Narrowed: the candidate evaluates evidence and reasons inside one argument; it does not ask learners to evaluate other people's arguments. The career/civic framing is dropped. |

## Questions, answers and assessment expectations

| Aspect | Legacy | Candidate | Reviewer must |
| --- | --- | --- | --- |
| Items | Two open questions with model answers; no rubric, no key. | Six single-choice candidate items (structure 2, argument 2, evidence 2) in GovernedItem shape. | Approve, revise or reject each item and key. |
| Construct | Learners explain the parts of an essay and why structure persuades (constructed response). | Recognition only in the exit ticket; production is in the formative writing task, judged by the teacher with a four-criterion rubric. | Decide whether a teacher-marked constructed exit prompt is required (R-L6). |
| Answer expectations | Model answers are long, use comparisons ("building a house in Monrovia") and include unsourced claims. | Expected observations are short descriptions of what a secure answer shows; no model answer is presented as evidence. | Confirm the rubric levels and expected observations. |
| Practice volume | Nine writing prompts across three tiers (intro, body, conclusion, analysis). | One thesis and one PEEL paragraph, plus ordering and choice items. | Decide whether the lighter writing load is right for one Grade 7 lesson (R-L3). |

## Concerns in the legacy lesson

Not restored unless a reviewer decides otherwise.

| Id | Severity | Category | Where | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| L-L1 | HIGH | PEDAGOGICAL | 7. Worked Example 1 | One paragraph is given both a "thesis" ("Cassava is a staple… due to its versatility and nutritional benefits") and a different "topic sentence", so thesis and topic sentence are presented as two parts of the same paragraph. | Do not restore. |
| L-L2 | MEDIUM | LINGUISTIC | 7. Worked Example 1, step 1 | Says the thesis "reflects both a cause—its versatility—and an effect—its resultant health benefits". Versatility and nutrition are two reasons, not a cause and an effect. | Do not restore. |
| L-L3 | HIGH | PEDAGOGICAL | 9. Error Analysis, mistake 1 | Calls "Cassava is a staple because it is affordable" an unrelated fact. Affordability is a relevant reason why a food is a staple, so the lesson teaches a wrong rule about relevance. | Do not restore; the candidate's irrelevant-evidence check uses a clearly unrelated example. |
| L-L4 | MEDIUM | STRUCTURAL | 6. Key Vocabulary vs 4. Core Concept | Vocabulary says Boima's thesis was that Kpaan's stall had the better strategy; the core concept argues for Fatu's stall. | Not restored. |
| L-L5 | HIGH | FACTUAL | 4. Core Concept; problem sets gp2, ip2b | Model answers present unsourced figures and claims as evidence: daily fuel about LD$500 and maintenance over LD$5,000 a month, 60 of 100 customers being regulars, schools offering evening classes "a first in many areas", small-scale wind turbines in rural Nimba. A lesson about evidence models invented evidence. | Do not restore any figure without a named, checkable source. |
| L-L6 | LOW | MATHEMATICAL | 4. Core Concept, quality paragraph | "200 tomatoes a day at 20% higher quality premium" alongside an LD$5 price difference: the 20% is unexplained and unused. The other calculations are correct (50 × 85 = 4,250; 50 × 100 = 5,000; 100 × 90 = 9,000; 80 × 100 = 8,000; 200 × 5 = 1,000). | Not restored (the arithmetic is off-objective for an English lesson). |
| L-L7 | MEDIUM | PEDAGOGICAL | Problem set ip1a (model conclusion) | The model conclusion adds new points (coding, project-based learning, online research), which contradicts the rule that a conclusion adds no new reasons. | Do not restore. |
| L-L8 | MEDIUM | LINGUISTIC | Whole body | Reading level well above Grade 7 ("elucidate", "multifarious", "irrefutable", "encapsulating"), long paragraphs and extended food metaphors that compete with the teaching point. | Not restored; the candidate uses plain language. |
| L-L9 | MEDIUM | STRUCTURAL | Sections 5, 10-15 | Section 5 is missing. Guided-practice explanations refer to model text the learner cannot see ("To expand on this explanation…"). Independent prompts have no success criteria. | Not restored. |
| L-L10 | LOW | FACTUAL | 8. Worked Example 2 | "High vitamin A content": red palm oil is rich in provitamin A carotenoids (beta-carotene), not vitamin A itself. Acceptable only as a simplification. | If palm oil is reused, say "rich in beta-carotene, which the body turns into vitamin A". |
| L-L11 | MEDIUM | ALIGNMENT | standards.moeAlignments | LR-LIT-G7_9-02 is a LiberiaLearn band code (keyword, low). The MOE Grade 7 English text has no persuasive or argumentative writing; it appears in Grade 9 (p.28, p.32). | Do not carry forward. |

## Concerns in the candidate found by the comparison

| Id | Severity | Category | Where | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| C-L1 | HIGH | PEDAGOGICAL | evidence-check (option 2), order-paragraph (sentence D), exit item g7-essay-exit-3 | Model evidence was written as the learner's own real experience ("Last term our agriculture club harvested greens and pepper…", "our school's greens and pepper were used in lunch for a whole week last term", "After our class read for 20 minutes a day for one term…"), while the lesson tells learners never to make up evidence. | Addressed by R-L1 (applied): attributed to Musu's made-up practice school, labelled as made up in the evidence scene, item g7-essay-exit-3 revised to candidate-0.2.0. |
| C-L2 | HIGH | ALIGNMENT | Objectives, essay-structure, model-plan, evidence-check q3, exit items 1, 2, 4, 6 | Full argumentative essays and counterarguments are MOE Grade 8-9 scope (p.18, p.22, p.28, p.32). The Grade 7 MOE writing objective is paragraph construction (p.4). The candidate's prerequisite also assumes Grade 7 paragraph writing is already done. | Alignment decision A-L1. |
| C-L3 | MEDIUM | PEDAGOGICAL | write-argument | Learners never planned before writing, never wrote an introduction or a conclusion, and did not evaluate anyone else's argument (legacy objective 3). | Addressed by R-L2, R-L3 and R-L4 (applied): plan-argument, write-conclusion, peer-review. Writing an introduction is still not practised (reviewer decides). |
| C-L4 | LOW | FACTUAL | Revision ledger, peel | The ledger described PEEL as "widely used in West African secondary writing" without a source. | Claim removed from the ledger; the reviewer confirms PEEL suits Liberian classrooms (R-L5). |
| C-L5 | MEDIUM | ALIGNMENT | Objective alignment table | The Grade 7 paragraph objective was labelled "OCR only (no structured item)". The structured source does hold it, misfiled as ACTIVITY moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-act1 under period I. | Corrected: the reference now names the misfiled item and the OCR column (R-L7). |

## Corrective recommendations

| Id | Kind | Scenes | Recommendation | Rationale | Status | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |
| R-L1 | REVISE_CANDIDATE | `peel`, `evidence`, `evidence-check`, `order-paragraph`, `write-argument`, `exit-ticket` | Attribute every illustrative experience to Musu's school and say plainly that it is a made-up practice school: the evidence scene states that Musu's school examples are not facts and that learners' own evidence must be real; evidence-check option b, order-paragraph sentence D and the PEEL evidence step name Musu's school; write-argument tells learners not to borrow those examples; exit item g7-essay-exit-3 now cites Musu's class (version candidate-0.2.0). | C-L1: the lesson must not model making up personal evidence. | applied in this package | ACCEPT / MODIFY / REJECT: |
| R-L2 | RESTORE_ADAPTED | `plan-argument`, `write-argument` | Restore the legacy brainstorm-then-organise method as a planning step before writing: brainstorm at least four reasons, choose two, and attach one piece of real evidence with its source to each. Applied as scene plan-argument; write-argument now writes from the plan. | Legacy Worked Example 2 method is sound; the candidate jumped from models to writing. | applied in this package | ACCEPT / MODIFY / REJECT: |
| R-L3 | RESTORE_ADAPTED | `write-conclusion` | Add a short task to write a three- or four-sentence conclusion for the model garden plan: restate the thesis in new words, sum up the two reasons, end with a final thought, add no new reason. Applied as scene write-conclusion. Under the paragraph-centred alternative (A-L1 option A) it moves to an extension. | Legacy practised conclusions; the candidate only modelled them. | applied in this package | ACCEPT / MODIFY / REJECT: |
| R-L4 | RESTORE_ADAPTED | `peer-review` | Restore structured peer review: partners swap PEEL paragraphs, check them against four questions (point, evidence, explain, link) and write one strength and one next step with sentence starters; a learner working alone reviews their own paragraph. Applied as scene peer-review. | Restores legacy objective 3 (evaluating arguments) and the legacy peer-review check in a form that works offline. | applied in this package | ACCEPT / MODIFY / REJECT: |
| R-L5 | REVISE_CANDIDATE | `peel` | Remove the unsourced "widely used in West African secondary writing" claim from the revision ledger. | C-L4. Reviewer-only text; no learner content changes. | applied in this package | ACCEPT / MODIFY / REJECT: |
| R-L6 | REVIEWER_DECISION | `exit-ticket` | Decide whether the exit ticket needs one teacher-marked constructed prompt (for example, "Explain what each part of an argumentative essay does") in addition to the six single-choice items. | The legacy exit ticket asked for explanation; the candidate measures recognition, and writing evidence stays formative. | reviewer decides | ACCEPT / MODIFY / REJECT: |
| R-L7 | REVISE_CANDIDATE | — | Record the Grade 7 paragraph objective reference with its misfiled structured item and its OCR column. | C-L5. Reviewer-facing alignment metadata only. | applied in this package | ACCEPT / MODIFY / REJECT: |
| R-L8 | DO_NOT_RESTORE | — | Do not restore the cassava worked example, error-analysis mistake 1, the market revenue calculations, the food metaphors, the nine legacy model answers, the Tier 3 analytical tasks or the LR-LIT-G7_9-02 alignment. | L-L1 to L-L11. | reviewer decides | ACCEPT / MODIFY / REJECT: |

## Open curriculum-alignment decisions

### A-L1. What should this lesson teach in Grade 7, given the MOE Grade 7 paragraph-writing objectives, the source-structuring defect, and the Grade 8-9 argumentative-composition objectives?

Evidence (repository-held MOE source; MOE source provenance is not MOE approval):
- English 7-9 p.4 (OCR; header "GRADE: 7 PERIOD: 11", the period after p.2's "PERIOD: 1" and before p.6's "PERIOD: 111", so period II): topic "PARAGRAPH WRITING/LITERATURE AND READING COMPREHENSION". Objectives column: "1. Construct paragraphs using subject and verb agreement, capitalization, punctuations etc. 2. Develop vocabulary in paragraph writing using prefixes and suffixes 3. Discuss element of short stories… 4. Learners create simple short stories." Contents column: "1. Writing paragraphs using proper grammar mechanics. 2. Writing kinds of paragraphs E.g.) descriptive, narrative etc."
- Structuring defect: those four objectives are filed as ACTIVITY items act1-act4 under period I (moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-*, confidence MEDIUM, flags CONTINUATION_PAGE_ASSIGNMENT and OCR_TEXT). Period I's real objectives (p.2) are sentences, kinds of sentences, friendly letters, folk tales, prose and poetry.
- No Grade 7 page of the English 7-9 OCR mentions essays, theses, argument or persuasion; "point of view" on p.11 is a literary term.
- Grade 6 (English 1-6 p.119): "Construct different types of paragraphs". Grade 8: "Develop paragraphs" (p.14); "Develop composition on issues such as social norms, peer influences, decision making, etc." (p.18); "Conduct research, analyze and form opinions on topics for debates" (p.22, structured as CONTENT). Grade 9: "Compose various kinds of writings" including persuasive and argumentative (p.28); "Develop and defend a points of view in composition" (p.32).
- The legacy row sits in LiberiaLearn unit literacy-g7-6-paragraphs-and-text-structure, a paragraph unit.
- The candidate's own success check and writing task are a thesis plus one PEEL paragraph, which is paragraph-level work.

| Option | Description | Consequences |
| --- | --- | --- |
| A. Rescope to Grade 7 paragraph writing | Teach the persuasive (opinion) paragraph as one of the "kinds of paragraphs" in English 7-9 p.4: a claim as topic sentence, a reason, evidence, explanation and link (PEEL). Keep the three-part essay as a brief preview; move counterarguments to an extension. | Revise objectives 1-2, essay-structure, model-plan, evidence-check q3 and exit items 1, 4 and 6; regenerate. Can bind to the p.4 objective once the structuring defect is corrected. |
| B. Keep as a Grade 7 introduction to argumentative essays | Keep the content, labelled as a LiberiaLearn extension that previews Grade 8 (p.18, p.22) and Grade 9 (p.28, p.32). | No content change. The authority must accept teaching Grade 9 MOE scope in Grade 7; no Grade 7 MOE binding is possible. |
| C. Move to Grade 8 or 9 and fill Grade 7 separately | Rebind the candidate to Grade 9 p.32 (or Grade 8 p.18/p.22) and author a separate Grade 7 paragraph lesson for the legacy slot. | Most scenes reusable at the higher grade (raise the writing demand). The Grade 7 slot needs new content, and repointing the legacy row needs a separate authorized change that respects its 42 ScheduledWork rows. |

Author's recommendation: A, because it keeps the lesson in Grade 7 without moving a Grade 9 objective down, and the candidate's practice is already paragraph-level. In every option, request correction of the p.4 structuring defect (and the p.22 objective filed as CONTENT) through the source-structuring process. This is the author's recommendation, not a decision; a qualified English reviewer and the curriculum authority decide.

#### Prepared alternative for option A: Writing a persuasive paragraph (Grade 7 paragraph-writing scope) (PREPARED_NOT_APPLIED)

The same lesson rebuilt around one persuasive (opinion) paragraph, a kind of paragraph under English 7-9 p.4. The essay becomes a short preview of where paragraphs go; counterarguments and full conclusions become an extension. Prepared so the authority can choose it; the candidate keeps its current objectives and grade scope until a decision is recorded.

| Alternative objective | Statement | Replaces | MOE basis |
| --- | --- | --- | --- |
| `alt-g7-lit-persuasive-paragraph` | Write a persuasive paragraph that opens with a topic sentence stating a clear opinion and a reason, then gives evidence, explains it and links back (PEEL), using correct subject-verb agreement, capitalization and punctuation. | `ll-g7-lit-essay-structure` | English 7-9 p.4, period II objectives column item 1 ("Construct paragraphs using subject and verb agreement, capitalization, punctuations etc."; misfiled as ACTIVITY act1) and contents item 2 ("Writing kinds of paragraphs E.g.) descriptive, narrative etc."). Bindable only after the structuring defect is corrected. |
| `alt-g7-lit-claim-topic-sentence` | Tell an arguable opinion from a topic, a fact or an announcement, and write a topic sentence that states an opinion with a reason. | `ll-g7-lit-argument-build` | Same p.4 paragraph objective; answering a counterargument is left to Grade 8-9 (p.18, p.22, p.32). |
| `ll-g7-lit-evidence-support` | Choose true, relevant and specific evidence for a reason and explain how it supports the claim in a PEEL paragraph. | `ll-g7-lit-evidence-support` | Unchanged; supports the p.4 paragraph objective. |

| Scene | Action | Note |
| --- | --- | --- |
| `intro` | ADAPT | Same PTA garden situation; the goal becomes one convincing paragraph. |
| `objectives` | ADAPT | State the three alternative objectives. |
| `warm-up` | KEEP | Topic sentence and fact versus opinion are exactly the prior knowledge needed. |
| `essay-structure` | ADAPT | Shorten to a preview: a paragraph is one building block of an essay. |
| `model-plan` | MOVE_TO_EXTENSION | The full essay plan with an answer to the other side becomes optional extension reading. |
| `thesis` | ADAPT | Teach the opinion topic sentence; same claim-versus-topic/fact/announcement items. |
| `peel` | KEEP | Core model. |
| `evidence` | KEEP | Core; keeps the made-up-practice-school notice. |
| `evidence-check` | ADAPT | Keep questions 1-2; move question 3 (the other side) to the extension. |
| `order-paragraph` | KEEP | Core. |
| `plan-argument` | ADAPT | Plan one paragraph: opinion, one reason, real evidence and its source. |
| `write-argument` | ADAPT | Write one persuasive PEEL paragraph; add a grammar-mechanics check (subject-verb agreement, capitals, punctuation) from p.4. |
| `write-conclusion` | MOVE_TO_EXTENSION | Essay conclusions are essay-level; the paragraph's Link sentence does this job in Grade 7. |
| `peer-review` | KEEP | Add one mechanics question to the four PEEL questions. |
| `review` | ADAPT | Key ideas for a persuasive paragraph. |
| `exit-ticket` | ADAPT | See item impact. |
| `reflect` | KEEP | Ask which part of the paragraph is hardest. |

| Exit item | Action | Note |
| --- | --- | --- |
| `g7-essay-exit-1` | REVISE | Ask where the topic sentence usually appears in a paragraph. |
| `g7-essay-exit-2` | REVISE | Same item, worded as an opinion topic sentence. |
| `g7-essay-exit-3` | KEEP | Evidence choice is unchanged. |
| `g7-essay-exit-4` | REPLACE | Replace the essay-conclusion item with one on the job of the Link sentence. |
| `g7-essay-exit-5` | KEEP | The Explain sentence is unchanged. |
| `g7-essay-exit-6` | MOVE_TO_EXTENSION | Counterargument; replace with a subject-verb agreement or punctuation item from p.4. |

Binding path: No binding is made here. If option A is chosen: correct the p.4 structuring defect so the period II paragraph objective exists as a Grade 7 OBJECTIVE item, record the objective-basis decision, revise the candidate as above, regenerate the package with new hashes, and only then propose bindings in a Grade 7 release.

- [ ] Decision on A-L1 (A / B / C / other), recorded through governed curriculum review: ____

## Reviewer sign-off

Sign-off is valid only when recorded through governed curriculum review (HUMAN_REVIEW) against candidate hash `80b9592641effbdae8f5868323289873a8c1a6e547676241e09ab8ee5db060b1` and legacy revision `cmss94dmc03b7vo54ryf3hqk1`. Filling in this file records nothing.

- [ ] I compared the candidate with the legacy revision and confirm (or have corrected) the section matrix above.
- [ ] I recorded a decision on every recommendation.
- [ ] I confirm no legacy material listed under Concerns is re-introduced without correction.

| Field | Entry |
| --- | --- |
| Reviewer name | |
| Qualification (subject, grade band) | |
| Organisation / role | |
| Date | |
| Governed review record id | |
| Decision (APPROVE / REVISE / REJECT) | |
| Notes | |
