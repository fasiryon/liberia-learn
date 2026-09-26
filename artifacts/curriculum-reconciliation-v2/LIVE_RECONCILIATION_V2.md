# LiberiaLearn Live Curriculum Reconciliation V2

- **Read at:** 2026-09-26, production Supabase `bnphuinpvgpmebcsvmsp` (direct host, `SET TRANSACTION READ ONLY`). No writes.
- **Code base:** `main` = `672bbd8b` (PR #147 merge), live on `liberia-learn.vercel.app` (`dpl_D3C2Lotg…`, READY).
- **Machine-readable:** [`live-reconciliation-v2.json`](./live-reconciliation-v2.json) (every cell, every count) and [`cell-matrix.csv`](./cell-matrix.csv).
- **Generator:** [`scripts/live-curriculum-reconciliation-v2.ts`](../../scripts/live-curriculum-reconciliation-v2.ts), rerunnable and read-only.
- **UNKNOWN stays UNKNOWN:** where a dimension has no data model (diagnostic bindings, lab evidence), it is reported as *not modelled*, not zero.

## 1. Answer in one paragraph

Production has **1,105 lessons across 65 of the 228 cells**. None of the 228 cells is governed-executable. The single registered executable release (Grade 4 Math fractions) binds a lesson and a learning target that **do not exist in production**. Governance-wise:
- 1,089 lessons show `APPROVED`/`published` with **no governance approval record**.
- Only **1** lesson is human-reviewed by LiberiaLearn, and **0** are MOE-approved.
- 268 lessons contradict their own payload review status.

Beyond lessons:
- Assessments: 7 exam questions, and 850 embedded quiz items with free-text answers and no objective or evidence binding.
- Homework: 32 rows, none linked to a lesson.
- Textbooks: 1 job.
- Labs: **0 lessons are bound to any of the 12 engine labs**, and there is no 3D capability.

The MOE PDFs don't need re-extraction. The text is already decoded (1,060 of 1,259 pages) but has never been **structured**. OCR is needed only for 2 fully scanned PDFs (70 pages), plus 162 scattered undecoded pages in mapped subjects.

The newly acquired 3D/lab standards the mission references **are not present** in the repository or the database.

## 2. Live totals

| Record | Live | Note |
|---|---:|---|
| CurriculumContent (all `lesson`) | 1,105 | all in scope after subject mapping; 39 `HISTORY` reach SOCIAL_STUDIES only via the source-inventory map |
| — status APPROVED / published | 1,052 / 38 | |
| — governance: legacy status only (no approval event) | 1,089 | |
| — governance: LiberiaLearn human-reviewed | 1 | |
| — governance: MOE-approved | 0 | no lesson claims MOE approval either (0 payload claims) |
| — provenance UNVERIFIED / `LEGACY_UNKNOWN` origin | 1,102 / 1,102 | backfill snapshots |
| — column APPROVED but payload NEEDS_REVIEW/PENDING | 268 | self-contradicting review state |
| — AI-generated or AI-upgraded, still flagged NEEDS_REVIEW | 244 | 75 approved by `system:promotion-pass-2b` / `phase6-safe-approval` |
| Duplicate lessons (same cell + title) | 83 rows in 25 groups | e.g. 11 copies of G12 Math "Problem Solving and Review" |
| Governance events | 18 | 3 HUMAN_REVIEW approvals, 4 automated-policy approvals, 7 revocations |
| MOE curriculum objectives / learning targets | 17 / 2 | 12 cells covered |
| Standards / skills | 53 / 14 | band-level (G1_3…G10_12), 5 subjects |
| CurriculumUnit / weeks / lesson plans | 276 / 1,028 / 574 | 36 units out of scope (PE 32, ECONOMICS 4) |
| Lessons with dangling `unitId` | 495 | point at `civics-g1-1-…`-style keys; `CurriculumUnit` only has `yearmap-…` keys (0 matches) |
| Lessons with neither plan nor resolvable unit | 531 | |
| Prerequisite edges / dangling | 3,828 / 3,642 | 95% point at deleted lessons |
| Lesson variants orphaned | 169 of 177 | |
| Homework / linked to a lesson | 32 / 0 | |
| Assignments / linked to a lesson | 55 / 1 | |
| Exams / questions | 2 / 7 | G9 Math published, G7 Math draft |
| PracticeItem / WAEC practice items | 30 / 120 | WAEC items all G11 |
| Embedded quiz items / assessment questions | 850 / 1,105 | `{type, question, expectedAnswer}` only |
| Textbook generation jobs | 1 | |
| VirtualLab / LabSession / CapstoneProject | 0 / 0 / 0 | |
| PolicyConfig (ToolPolicy store) | 0 | ToolPolicies exist only in code (4, all in the G4 release) |
| CurriculumVersion | 151, all DRAFT | 78 lessons bound to a version |
| Executable releases (code registry) | 1 | stale: 2 of 4 binding references missing live |

## 3. Authority

Source provenance, LiberiaLearn review, MOE approval and executable-release status are four separate facts. Across all 1,105 lessons:

| Dimension | State |
|---|---|
| Source provenance | 1,102 `LEGACY_UNKNOWN` backfill; 1 VERIFIED, 1 PARTIAL, 1 VERIFIED-revoked |
| LiberiaLearn review | 1 human-reviewed; 4 automated-policy approvals; everything else is a legacy status with no event |
| MOE approval | **0**. The 7 MOE/WAEC authority sources and 17 MOE objectives are *source* records (VERIFIED = source verified), not approval of LiberiaLearn content |
| Executable release | 0 lessons (the only release binds a lesson that is not live) |

**Authority conflicts (20 cells).** These are cells where lessons are `APPROVED` in the column but `NEEDS_REVIEW`/`PENDING_APPROVAL` in the payload. No founder- or system-reviewed content is labelled MOE-approved.

**Subject authority conflict (code).** `lib/curriculum/subjectTaxonomy.ts` does not map HISTORY, GEOGRAPHY, BIOLOGY, CHEMISTRY, PHYSICS, ECONOMICS, LITERATURE or PE. `lib/learning-authority/repositorySourceInventory.ts` maps six of those into SCIENCE and SOCIAL_STUDIES. Two taxonomies disagree about where MOE senior-secondary subjects live.

## 4. 228-cell matrix

Legend:
- `CONF` = AUTHORITY_CONFLICT
- `RBG` = RELEASE_BINDING_GAP (live lessons, no valid executable release)
- `SRC` = SOURCE_EXISTS_NOT_IMPORTED
- `—` = NO_VERIFIED_SOURCE

The number after a code is the live lesson count.

| Subject | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 | G10 | G11 | G12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MATH | SRC | RBG 2 | SRC | RBG | CONF 15 | CONF 16 | CONF 40 | RBG 8 | CONF 3 | CONF 1 | SRC | CONF 16 |
| LITERACY | RBG 4 | RBG 7 | RBG 11 | RBG 6 | CONF 76 | CONF 18 | CONF 108 | RBG 19 | RBG 10 | RBG 12 | RBG 10 | CONF 18 |
| SCIENCE | SRC | RBG 1 | RBG 5 | SRC | CONF 22 | RBG 7 | CONF 76 | RBG 5 | SRC | RBG 1 | SRC | CONF 11 |
| SOCIAL_STUDIES | SRC | SRC | SRC | SRC | RBG 1 | SRC | CONF 53 | SRC | RBG 1 | CONF 13 | CONF 13 | CONF 19 |
| CIVICS | RBG 18 | RBG 11 | — | — | RBG 2 | RBG 5 | CONF 83 | RBG 5 | — | — | — | CONF 9 |
| COMPUTER_SCIENCE | RBG 10 | RBG 12 | RBG 12 | RBG 11 | CONF 23 | RBG 9 | RBG 13 | RBG 14 | RBG 9 | RBG 18 | RBG 22 | RBG 24 |
| DIGITAL_LITERACY | — | — | — | — | — | — | — | — | — | — | — | — |
| ENGINEERING_FOUNDATIONS | RBG 12 | RBG 13 | RBG 15 | RBG 9 | RBG 13 | RBG 13 | RBG 12 | RBG 9 | RBG 13 | RBG 18 | RBG 21 | RBG 19 |
| BUSINESS_ENTREPRENEURSHIP | — | — | — | — | — | — | — | — | — | — | — | — |
| FINANCIAL_LITERACY | — | — | — | — | — | — | — | — | — | — | — | — |
| CAREER_EXPLORATION | — | — | — | — | — | — | — | — | — | — | — | — |
| COMMUNICATION_SKILLS | — | — | — | — | — | — | — | — | — | — | — | — |
| PROBLEM_SOLVING | — | — | — | — | — | — | — | — | — | — | — | — |
| CREATIVITY_INNOVATION | — | — | — | — | — | — | — | — | — | — | — | — |
| AGRICULTURE | — | — | — | — | — | — | — | — | — | — | — | — |
| ENVIRONMENTAL_STUDIES | — | — | — | — | — | — | — | — | — | — | — | — |
| AI_LITERACY | — | — | — | — | — | — | — | — | — | — | — | — |
| DATA_LITERACY | — | — | — | — | — | — | — | — | — | — | — | — |
| ENERGY_INFRASTRUCTURE | — | — | — | — | — | — | — | — | — | — | — | — |

| Classification | Cells |
|---|---:|
| LIVE_EXECUTABLE_COMPLETE | 0 |
| LIVE_PARTIAL | 0 |
| AUTHORITY_CONFLICT | 20 |
| RELEASE_BINDING_GAP | 46 (45 live + G4 Math stale release) |
| SOURCE_EXISTS_NOT_IMPORTED | 13 |
| REPOSITORY_ONLY | 0 |
| ORPHANED_LIVE_CONTENT | 0 cells (orphans are record-level, section 8) |
| NO_VERIFIED_SOURCE | 149 |

**Important.** 12 of the 19 scope subjects (144 cells) have **no verified source anywhere**: no MOE archive, no authority record, no live content. The Liberia MOE archives cover only MATH, LITERACY, SCIENCE and SOCIAL_STUDIES (48 cells). CIVICS, COMPUTER_SCIENCE and ENGINEERING_FOUNDATIONS have live AI/legacy lessons but no verified source.

## 5. Coverage by dimension (cells out of 228)

| Dimension | Cells | Evidence quality |
|---|---:|---|
| Live lessons | 65 | legacy/AI; 1 human-reviewed |
| Governed objectives (MOE objective / learning target) | 12 | 1 objective per cell; not item-level |
| Objectives in lesson payload | 65 | unstructured, ungoverned |
| Concepts / prerequisites | UNKNOWN as governed data | 95% of prerequisite edges dangling; concepts exist only in the G4 release |
| Unit structure | 60 | two incompatible unit-key schemes |
| Lesson-plan bindings | 27 | |
| Classwork (worksheet / guided practice) | 21 | |
| Homework | 1 | 32 live rows, none lesson-linked; 170 lessons have a `homeworkSet` string |
| Practice | 56 | band-level PracticeItem (30) counted per grade; overstated |
| Quizzes / item banks | 23 | 850 free-text items, no evidence binding |
| Diagnostics | not modelled per cell | only the G4 release defines diagnostic items (not live) |
| Tests / exams | 2 | 1 published (G9 Math, 7 questions) |
| Projects / practicals | 0 | CapstoneProject 0; 116 payload "labs" are teacher-led guided walkthroughs |
| Textbooks / resources | 1 | 1 generation job; RagChunk is 2,925 retrieval chunks, not learner resources |
| Teacher resources | 17 | payload `teacherGuide` |
| Guardian-relevant outputs | 12 | payload `guardianSupport` |
| Offline behaviour | platform-level | OfflinePack 19; P5-E keeps mastery/simulation state NOT_SUPPORTED_OFFLINE |
| Evidence rules / mastery bindings | 0 live | only the G4 release defines evidence policies (not live) |
| ToolPolicies | 0 live | 4 in code, G4 only |
| Executable release | 0 valid | 1 stale |

## 6. Labs, simulations and 3D

**Lab/3D standards.** The mission asks to treat "newly acquired 3D/lab standards" as first-class inputs. **They were not found.** I searched every tracked and untracked file and the production database: no lab-standards document, manifest or table exists. The only matches are statements that 3D is future work. **Needed from you: where are they?**

**Per-objective lab requirement.** This is BLOCKED because there are no structured objectives (17 governed objectives across 12 cells). The MOE documents carry `ACTIVITIES` and `MATERIALS/RESOURCES` columns per topic. The objective-structuring pass (section 10) must capture practical requirements from them.

**What exists live:**
- 116 payload `labs` entries: all `guided_walkthrough` teacher-led classroom activities. They are physical or field activities, not interactive labs.
- 78 `labDefinitionSpecs`: all `labType: classroom` and `approved: false`, and **every one claims `threeDReady: true` with no 3D engine present**. Some are not labs at all ("Spelling Test & Review Applied Lab"). None counts as a lab or a 3D lab.
- 0 lessons reference any registered engine lab ID; VirtualLab 0; LabSession 0.

**Lab-engine compatibility (existing engine, `lib/labs/runtime`):**

| Lab | Status | Gaps |
|---|---|---|
| gravity-explorer, pendulum-lab, molecule-motion, human-heart, electric-circuit, wave-motion, cell-division, ecosystem-balance, chemical-reaction, periodic-table, weather-system, tectonic-plates | ENGINE_COMPATIBLE (typed validate/apply) | no objective binding, no governed evidence binding, no mastery binding (student route forces `masteryUpdated: false`), 2D only, simulation state not offline |
| electric-circuits, light-and-shadow, simple-machines, cell-structure, chemical-reactions, water-cycle, earthquake-waves | BESPOKE_LEGACY (bespoke page components in `LessonLabPanel`, outside the typed runtime) | missing lab definition, no evidence/mastery binding |
| Any 3D lab | NEW_ENGINE_CAPABILITY_REQUIRED | no 3D renderer dependency installed |
| Every non-science practical (agriculture, engineering, environmental) | NO_IMPLEMENTATION | missing content and definitions |

**Binding defect.** `lib/lessons/labLinks.ts` attaches labs to lessons **by subject string and grade band at runtime**, not by objective. This contradicts the release-registry rule that "runtime code never infers a binding". The engine labs cover only SCIENCE grades 7–12 (6 cells).

**Gap separation (science cells):**
- Missing lab **content**: all subjects except SCIENCE G7–12.
- Missing lab **definition**: 7 bespoke labs.
- Missing **runtime capability**: governed learn/practice/assess reuse is partial.
- Missing **3D renderer**: yes.
- Missing **evidence binding**: all labs.
- Missing **mastery binding**: all labs.
- Missing **safety/offline**: safety fields exist but aren't enforced; simulation state isn't supported offline.

## 7. Assessment, homework and classwork

- **Items:** 850 quiz items and 1,105 assessment questions are embedded in lesson payloads as `{type, question, expectedAnswer}`. There is no item id or version, no objective/concept binding, no evidence rule and no ToolPolicy. They are reusable as **authoring seeds**, not as governed assessment.
- **Relational assessment tables:** `Assessment` 0, `AssessmentItem` 0, `ExamCertification` 0, `ExamAttempt` 0.
- **Exams:** 2 exams, 7 questions total (G9 Math published; G7 Math draft).
- **WAEC practice:** 120 items, all G11, `subjectId` only.
- **Homework:** 32 rows, 0 linked to a lesson. Assignments: 55, 1 linked. Classwork appears only as payload worksheets/guided practice (21 cells).

## 8. Orphaned, duplicate and reusable content

- **Dangling prerequisite edges:** 3,642 of 3,828.
- **Orphaned lesson variants:** 169 of 177. **Orphaned AI-literacy exercises:** 20 of 38. **Orphaned code exercises:** 4 of 8.
- **Dangling unit links:** 495 lessons.
- **Duplicates:** 83 rows in 25 groups, all APPROVED/published copies of the same timestamped `-elite-` regeneration.
- **Units out of scope:** 36 (PE, ECONOMICS).
- **Reusable but not approved:** 14 lessons with objectives or activities (listed in the JSON).
- **Reusable seeds:** 850 quiz items, 170 teacher guides, 114 guardian-support sections, 116 practical walkthroughs, 12 typed engine labs, the G4 Math release model (concepts, items, evidence and tool policies) as the template.

## 9. Is more PDF extraction necessary?

Mostly **no**. Structuring is necessary; re-extraction is not.

| Fact | Value |
|---|---|
| MOE PDFs / mapped to scope subjects | 25 / 15 |
| Pages / decoded | 1,259 / 1,060 |
| Objective "candidates" / real sentences | 517 / **5** (candidates are heading fragments like "OBJECTIVES") |
| Decoded text contains full topic tables | yes: `GRADE / PERIOD / TOPIC / OUTCOMES / OBJECTIVES (numbered) / CONTENTS / ACTIVITIES / MATERIALS / ASSESSMENTS` |
| Fully scanned (OCR required) | GRADE 7–9 English (32 p), GRADE 7–9 Social Studies (38 p) |
| Undecoded pages in mapped subjects | 162 |
| Decoded but parser found nothing | GRADE 1–6 General Science (78 p) |

**Required:** OCR for 2 PDFs (70 pages) plus a targeted re-decode of 162 pages, then a **table-structure parser** over the existing decoded text. No broad re-extraction.

## 10. Smallest path to full governed coverage

The order matters because each step unblocks the next.

1. **Authority cleanup (no authoring, read/write on metadata only):**
   - Reconcile the 268 self-contradicting review states to the stricter state.
   - Collapse the 83 duplicate rows.
   - Resolve or retire 3,642 dangling prerequisite edges, 169 orphaned variants and 495 dangling unit links.
   - Unify the two subject taxonomies.
   - Decide PE, ECONOMICS, LITERATURE, FRENCH and RELIGIOUS & MORAL EDUCATION, which are MOE subjects outside the 19-subject scope.
2. **MOE objective structuring (48 source-backed cells):**
   - Parse the decoded topic tables into objectives, concepts, activities, materials and assessment references with page locators.
   - OCR 2 PDFs.
   - This is the input every later step binds to, including per-objective lab requirements.
3. **Scope decision for the 144 no-source cells (12 subjects):** each needs either a designated authority source or explicit LiberiaLearn-authored standards under founder review. Nothing can be imported for them.
4. **Governed review of reusable content:** bind the 1,105 existing lessons, the 850 embedded items and the practical walkthroughs to structured objectives, then route them through the existing review pipeline. Reuse beats authoring here.
5. **Assessment and evidence layer:**
   - Convert embedded items into versioned governed items with evidence rules and ToolPolicies, following the G4 release pattern.
   - Author diagnostics, homework and tests per cell.
6. **Labs:**
   - Bind the 12 typed labs to objectives, replacing `labLinks.ts` inference.
   - Add a governed evidence and mastery contract to the existing runtime.
   - Migrate the 7 bespoke labs into typed definitions.
   - Scope 3D only after the lab standards are located.
7. **Executable releases:** publish per-cell ontology releases. First fix the stale G4 release (its lesson and target aren't live).

## 11. Recommended next mission

**MOE Objective Structuring + Authority Cleanup V1, limited to the 48 MOE-backed cells.** It should:
- (a) Build a deterministic table-structure parser over the existing decoded MOE text, producing page-localized objective, concept, activity, material and assessment records for review, plus OCR of the 2 scanned PDFs.
- (b) Produce a reviewed plan, with no production writes until approved, to reconcile the 268 conflicting review states, 83 duplicates and the dangling graph and unit links.
- (c) Re-point the G4 Math release at live content, or seed its missing lesson and target, so one cell becomes LIVE_EXECUTABLE_COMPLETE end to end as the template for the other 47.

Decisions needed first:
1. The location of the 3D/lab standards.
2. The source authority for the 12 no-source subjects.
3. Whether the out-of-scope MOE subjects join the scope.
