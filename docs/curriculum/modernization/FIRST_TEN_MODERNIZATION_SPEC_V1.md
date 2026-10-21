# First Ten Lessons: Modernization Specification V1

Contract `liberialearn-first-ten-modernization-contract/1.0.0` · status **READY_FOR_OWNER_APPROVAL** · machine-readable source [`curriculum/modernization/v1/first-ten/spec.json`](../../../curriculum/modernization/v1/first-ten/spec.json) · acceptance rubric [`FIRST_TEN_ACCEPTANCE_RUBRIC_V1.md`](FIRST_TEN_ACCEPTANCE_RUBRIC_V1.md)

This specification fixes the first 10 live legacy lessons to modernise after the 6 pilot candidates already under review, and defines what each modernised lesson must achieve. **It approves, publishes and changes nothing.** No production lesson, ledger event, learner record, grade or mastery value is touched. The specification author may not review their own work: every defect still needs confirmation by a qualified human reviewer, and the AI advisory reviews recorded here do not count as independent review. Bulk rewriting does not start until the owner approves this contract.

Generated from `spec.json` by `npx tsx scripts/render-first-ten-modernization-spec.ts`. Edit the JSON, not this file.

## Basis

- Repository commit `3e4ba71df9f462d273fe3be1e1bb585aea30c8c0` (PR #195 head, stacked on PR #191).
- Inventory `liberialearn-library-inventory/1.0.0`, read-only extract `7d5e25cb2a6e…` captured 2026-10-16T18:44:42.884Z (1105 lessons).
- Ledger head `6a346b9bfc93…` (3702 events). This specification appends **no** events.
- Standards: `liberialearn-curriculum-excellence/1.0.0`; `liberialearn-curriculum-excellence-rubric/1.0.0`; `liberialearn-assessment-blueprint/1.0.0`; docs/agents/CORE_AGENT_RULES.md learning outcome standard (branch docs/learning-success-rule).
- Assessment entries map 1:1 onto Content Factory V2 unitBlueprintSchema.assessmentPlan (timing, scaffold, context REHEARSED|NEW, scoring KEYED|ANALYTIC_RUBRIC) and onto the pilot spec format liberialearn-modernization-spec/1.0.0.

## Subject policy

- **CIVICS:** A distinct LiberiaLearn subject. MOE Social Studies objectives are recorded only as cross-references (relation CROSS_REFERENCE_ONLY), never as the authority or as direct MOE alignment.
- Decided by: Curriculum Excellence owner direction, 2026-10-17.

## How the ten were chosen

The author read the full learner text of 13 high-exposure eligible lessons (all with scheduled work or learner history) and selected on: (1) a factual, mathematical or scientific error confirmed by reading or recomputation; (2) current assignment and learner history; (3) foundational status; (4) subject coverage (Math 3, Literacy/English 2, Science 2, Civics 3); (5) grade-band coverage (G2, G5, G7). Lessons on governance hold (Track D) and the 6 lessons already awaiting review were excluded.

- 7 of 10 are Grade 7 because the catalogue (481 of 1,105 lessons in G7-9) and its learner history are concentrated there. G1 civics and G6 math/literacy already have pilot candidates.
- Four lessons come from the same wk_mca7a weekly series, each scheduled in exactly one class at one school. The inventory holds counts only, so whether this is the same class must be verified before one coordinated correction notice is planned.
- Excluded because they already have candidates awaiting review: `civics-g1-1-rules-rights-and-duties-foundations`, `wk_pcs6a_wed_p2`, `wk_pcs6a_mon_p1`, `hero-literacy-g7-essay-writing-structure-and-argumentation`, `math-g7-1-number-sense-and-place-value-foundations`, `science-g7-1-observation-and-scientific-thinking-foundations`.

## Shortlist

| # | Lesson (exact contentId) | Grade · subject | Track · wave | Scheduled work / progress / learning events | Most serious defect (author-identified; reviewer confirms) |
|---:|---|---|---|---|---|
| 1 | `wk_mca7a_fri_p4`<br>Exploring the Counties and Capitals of Liberia | G7 Civics | A · w2 | 1 / 13 / 3 | The capital of Nimba County is Sanniquellie. Ganta is Nimba's largest commercial town. Every answer key, worked example and error-analysis item that p… |
| 2 | `wk_mca7a_wed_p4`<br>The Founding of Liberia: Historical Context and Significance | G7 Civics | A · w3 | 1 / 13 / 0 | Joseph Jenkins Roberts was born free in Norfolk, Virginia (1809) and emigrated in 1829. He became the Commonwealth's first Black governor (1841) and L… |
| 3 | `hero-civics-g7-democracy-and-representation-in-liberia`<br>Understanding Democracy and Representation in Liberia | G7 Civics | A · w1 | 55 / 1 / 14 | Liberia's House of Representatives has 73 members, each elected from a single-member electoral district by plurality. The Senate has two senators per … |
| 4 | `wk_mca7a_fri_p3`<br>Understanding States of Matter Through Real-Life Examples | G7 Science | A · w1 | 1 / 13 / 0 | Cooling 300 g of juice to 0 °C releases at most 31,350 J, less than the 33,400 J needed to melt 100 g of ice. So about 93.9 g melts, about 6.1 g of ic… |
| 5 | `science-g5-plants`<br>Understanding Photosynthesis through Traditional Liberian Cooking | G5 Science | A · w1 | 2 / 0 / 51 | Every practice and assessment item rests on invented, unlabelled glucose rates and is plain multiplication. Replace them with science tasks, and label… |
| 6 | `hero-math-g7-geometry-area-and-perimeter-of-polygons`<br>Calculating Area and Perimeter of Polygons for Real-World Applications | G7 Math | A · w1 | 42 / 7 / 44 | 90 × 45 = 4,050 m², as §7 shows. The 'alternative method' produces 4,500 m², and the text leaves the contradiction unresolved. |
| 7 | `lesson_mca_1`<br>Understanding and Representing Fractions in Real-Life Contexts | G7 Math | A · w1 | 4 / 12 / 19 | Fractions can equal whole numbers (4/4 = 1; 12/4 = 3, both in this lesson) and can be greater than 1. Define a fraction as a number that names equal p… |
| 8 | `hero-math-g2-place-value-tens-and-ones`<br>Understanding Place Value through Real-Life Money Management | G2 Math | B · w2 | 1 / 1 / 13 | Emergent readers need picture-led, narrated scenes. The budget is 1,200 words or fewer at a Grade 1–2 readability band. |
| 9 | `wk_mca7a_mon_p2`<br>Reading Comprehension: Main Idea | G7 Literacy | B · w2 | 1 / 13 / 0 | One revision holds two different learner lessons, so what a learner sees depends on the format. The candidate must have a single learner text, and the… |
| 10 | `hero-english-g7-vocabulary-in-context-reading-west-african-texts`<br>Understanding Vocabulary in Context Through West African Stories | G7 English | B · w5 | 27 / 1 / 1 | Tigers are not native to Africa, and foxes are not animals of Liberia's forests. 'Cobblestone streets' is European imagery. Use authentic or carefully… |

Coverage: Math 3 (G2, G7, G7), Civics 3, Science 2 (G5, G7), Literacy 1 and English 1. Correction notices are recommended for 8 lessons whose learners were taught false answers (see each lesson).

### Alternates

- `hero-science-g7-ecosystems-food-chains-and-biodiversity` (G7 Science, A): First alternate (science). 41 scheduled-work rows and 33 learning events. It teaches that energy flows in a cycle ('cyclical flow of energy and nutrients'), places toucans in Nimba (toucans are Neotropical; Liberia has hornbills), says cassava harvests depend on pollinators (cassava is grown from cuttings), and leaves its check-for-understanding answers blank.
- `draft-phase6-g7-math-w27-d3-core` (G7 Math, A): Alternate (math). Dense arithmetic errors: 2 kg of rice + 3 kg of cassava costed as 90 LD (it is 105), 40×4 given as 120, '13 tons of rice', bottles counted as kilograms. Its objectives are speaking and listening skills mislabelled as Math. Low exposure: 1 learning event, no scheduled work.
- `wk_pcs6a_thu_p5` (G6 Literacy, B): Alternate (literacy). Defines present tense as 'happening now' while every example is habitual, and never teaches irregular past forms. 7 learners in progress. It has a duplicate-title sibling (an elite variant) to resolve in the mapping plan.

## Shared lesson contract

Every modernised lesson implements these stages, in this order where they apply. The learning loop and teacher view consume them as declared stages:

`prerequisiteDiagnostic`, `concept`, `visualOrLab`, `workedExample`, `guidedPractice`, `independentPractice`, `endOfLessonCheck`, `misconceptionProbes`, `retentionProbe`, `transferItem`, `extension`, `teacherView`.

- Mastery evidence counts only if collected END_OF_LESSON or DELAYED at scaffold NONE, with hints, worked examples, AI help and answer feedback withheld, and assistance recorded (LM-ASM-2).
- Every objective is assessed at the end of the lesson, and every objective has a delayed retrieval item at least 7 days later.
- Selected response is at most 60% of end-of-lesson mastery evidence (50% where original writing is central). It is used for misconception diagnosis, never as the only reasoning evidence.
- Every distractor maps to a catalogued misconception with corrective feedback.
- The transfer item uses a context, representation or genre the lesson did not rehearse.
- Answer keys live only in the protected teacher/reviewer projection.
- Every interactive element has an objective-preserving offline or text fallback.
- Completion, time on task, and exposure are delivery evidence, never learning evidence.

Lesson contract version `liberialearn-first-ten-lesson-contract/1.0.0` (pin it as `contractRef.version`). Every lesson carries `stageBindings` for each learner stage (Lesson Player V2 `sceneIds`, Assessment V2 `assessmentDefinitionId`, `required`, `fallback`), null until built. End-of-lesson tasks are SUMMATIVE, retention is RETENTION and transfer is TRANSFER/NEW. `misconceptionId` is the stable catalog id that Assessment V2 must emit.
Retention policy: `ll-aep-001-retention-pilot@1.0.0` (APPROVED; git:f1db1d26:lib/assessment/v2/retention.ts (feat/learning-loop-integration-v1, unmerged)), intervals 7 and 21 days, minimum delay 7 days. A lesson cannot override it.
Misconception catalog `liberialearn-first-ten-misconceptions@1.0.0`: misconceptions[].misconceptionId is the stable catalog id (e.g. mc-civics-largest-town-is-capital). Assessment V2 ProtectedScoringSpec.misconceptionSignals[].misconceptionId and AssessmentItemV2.misconceptionIds MUST emit it byte-identically. misconceptions[].id (e.g. ft01-m1) is a local key only.

Defect verification values: `MECHANICAL_AUDIT_CONFIRMED`: Also reported by the committed mechanical audit at this revision.; `AUTHOR_COMPUTED`: Recomputed by the specification author; mechanically re-checkable. The reviewer re-runs the computation.; `ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED`: Found by the blind advisory reviewer, then checked against the legacy text by the specification author. A qualified reviewer still confirms it.; `AUTHOR_VERIFIED_CORRECTING_MECHANICAL_AUDIT`: The committed mechanical audit finding was wrong at this revision; the author re-read the structured data and restated the defect.; `AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM`: Found by reading and backed by the cited sources in defect.evidence. A qualified reviewer still confirms it.; `AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM`: Found by reading. A qualified subject reviewer must confirm it against cited sources before it is treated as established.

## Content Factory V2 compatibility

Target: Content Factory V2 feat/content-factory-ten-candidates @ d1f1826cb6ca94da9aa1a0e0e5df7c99ac1be277 (batch factory-ten-candidates/1.0.0, unit-blueprint/2.0.0). **Verdict: COMPATIBLE_WITH_BLOCKERS.**

| Check | Result |
|---|---|
| Contract pin satisfies exactPinSchema {id, version, sha256 of raw bytes, sourceRef} | PASS |
| Ten source bindings satisfy batchContract lessons[].source (strict) | PASS |
| Binding identities unique (batch_duplicate_identity) | PASS |
| Bindings equal spec identities; all 10 snapshot hashes recomputed with the shared hashCurriculumSnapshot (identical file at 3e4ba71d and d1f1826cb) | PASS |
| assessmentPurpose and itemContext use Assessment V2 enums | PASS |
| Misconception ids unique across the cohort | PASS |
| Batch evidence ACCEPTED_READ_ONLY_EXPORT can be satisfied from the #195 extract | FAIL: the extract is not a factory-production-capture/1.0.0 export and carries no operator attestations |
| Per-lesson UnitBlueprint, section dispositions and generation drafts exist | NOT_YET_AUTHORED (gated on owner approval) |

Interface rules:

- curriculumContract = {id: 'liberialearn-first-ten-modernization-contract', version: '1.0.0', sha256: SHA-256 of the raw bytes of spec.json at the approved commit, sourceRef: 'git:<commit>:curriculum/modernization/v1/first-ten/spec.json'}.
- lessons[].source = source-bindings.json bindings[].source, verbatim. Candidate ids must not reuse any source id.
- Objective layer to blueprint objective kind: NATIONAL_FOUNDATION → NATIONAL, LIBERIALEARN_MASTERY → LIBERIALEARN_MASTERY, GLOBAL_EXCELLENCE → GLOBAL_EXCELLENCE (requires unit-blueprint/2.1.0).
- Civics exception: ft01–ft03 objectives keep subjectAuthority LIBERIALEARN_CIVICS. A Civics objective's sourceId points to this contract, never to an MOE Social Studies document. The MOE cross-reference travels as a note, not as objective authority. The factory owner confirms or adds an explicit authority field.
- Purposes: end-of-lesson tasks SUMMATIVE; retention RETENTION (itemContext NEAR); transfer TRANSFER (itemContext NEW). These are Assessment V2 ASSESSMENT_PURPOSES values.
- Assessment tasks map to blueprint assessmentPlan with scaffold NONE, timing END_OF_LESSON (retention: DELAYED with delayDays from the retention policy), scoring verbatim. The blueprint context enum has no NEAR: map NEAR to REHEARSED and keep itemContext on the Assessment V2 item.
- Blueprint misconceptions[].id = misconceptionId; Assessment V2 misconceptionSignals emit the same ids.

Blockers before real candidate authoring:

- B-CF1: No accepted read-only export. The factory requires a factory-production-capture/1.0.0 export with authorization, target/role, visibility and privacy-review references. That needs an owner-authorized operator capture; this work does not connect to production.
- B-CF2: Per-lesson UnitBlueprints, legacy section dispositions and generation drafts are not authored yet (gated on owner approval of this contract).
- B-CF3: unit-blueprint/2.1.0 objective kinds exist only as uncommitted work in the factory worktree, and the Civics authority mapping needs the factory owner's confirmation.
- B-CF4: The factory's uncommitted first-ten-baseline.json pins contract 0.1.0 (spec sha 9b0128d7…). It must be re-pinned to the approved 1.0.0 bytes.

Source bindings: [`curriculum/modernization/v1/first-ten/source-bindings.json`](../../../curriculum/modernization/v1/first-ten/source-bindings.json) (sha256 `7c056189ea91dd76…`, Content Factory V2 batchContract lessons[].source; NOT_AN_ACCEPTED_READ_ONLY_EXPORT).

## 1. Exploring the Counties and Capitals of Liberia

`wk_mca7a_fri_p4` · revision `cmss8ptit002jvo540275dfvw` · hash `c7a1257c9520d452…` · G7 CIVICS · no unit · APPROVED · A_TARGETED_REPAIR · audit REVISE (0 blocking, 8 major)

Dependencies (counts): scheduledWork 1, scheduledWorkClasses 1, scheduledWorkSchools 1, studentProgress 13, learningEvents 3, lessonPlans 1. Selection: CONFIRMED_FACTUAL_ERROR, ASSIGNED_TO_STUDENTS, LEARNER_HISTORY, LJHSCE_SOCIAL_STUDIES. Learners are drilled to memorise a wrong capital: every worked example, guided problem and printed answer gives Ganta as Nimba's capital. 13 learners have progress on it, and the class has it on its schedule.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · FACTUAL | delivery.body §4, §5, §7, §9, §10, §12, §13, §15 | “Nimba County ... The capital city, Ganta” | The capital of Nimba County is Sanniquellie. Ganta is Nimba's largest commercial town. Every answer key, worked example and error-analysis item that pairs Nimba with Ganta must change. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-WP-NIMBA: Infobox: capital Sanniquellie; largest city Ganta.<br>SRC-WP-COUNTIES: Table: Nimba — Sanniquellie. |
| D2 | BLOCKING · FACTUAL | delivery.body §7, §10, §15 (the vocabulary sentence 'Montserrado County is where our capital, Monrovia, is located' is true and stays) | “Montserrado - Monrovia” | Monrovia is the national capital. The seat of Montserrado County is Bensonville (also called Bentol). Teach national capital and county seat as separate ideas, and replace every 'Montserrado – Monrovia' pairing. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-WP-BENSONVILLE: Bensonville, also known as Bentol (Bentol City), is the capital of Montserrado County, about 32 km from Monrovia.<br>SRC-WP-COUNTIES: Table: Montserrado — Bensonville. |
| D3 | MAJOR · FACTUAL | delivery.body §8 step 5 | “For Maryland County, situate it adjacent to Sinoe” | Grand Kru lies between Sinoe and Maryland. Maryland borders Grand Kru, River Gee and Côte d'Ivoire (along the Cavalla River). | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-WP-GRANDKRU: Grand Kru is 'bordered by River Gee County to the northeast, Sinoe County to the northwest, and Maryland County to the southeast', so it lies between Sinoe and Maryland on the coast. |
| D4 | MAJOR · COVERAGE | objectives[0] vs whole body | “Identify and name all 15 counties” | Only 10 counties are taught. Gbarpolu (Bopolu), Grand Gedeh (Zwedru), Grand Kru (Barclayville), River Cess (Cestos City) and River Gee (Fish Town) never appear. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-WP-COUNTIES: 15 counties; Gbarpolu created 2001 and River Gee 2000; capitals Bopolu, Zwedru, Barclayville, River Cess (Cestos City), Fish Town. |
| D5 | MAJOR · CONCEPTUAL | delivery.body §5 | “Each county in Liberia corresponds uniquely to a capital city that governs it” | A capital does not govern its county. Liberia is a unitary state, and county administration is led by a superintendent whom the President appoints with the consent of the Senate (Art. 54) and who serves at the President's pleasure (Art. 56). Unsourced economic claims (Nimba 'contributing significantly to the country's GDP', 'tourism in Bong') must be sourced or removed. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-LR-CONST-1986: Art. 54: the President nominates and, with Senate consent, appoints 'superintendents, other county officials'. Art. 56: such officials 'hold their offices at the pleasure of the President'. |
| D6 | MAJOR · ASSESSMENT | delivery.body §13–§15, §17 | “Answer: The capital of Lofa County is Voinjama.” | Every independent item prints its answer, and the exit ticket has no key. A geography objective is never assessed with a map. | MECHANICAL_AUDIT_CONFIRMED | — |
| D7 | MINOR · ASSESSMENT | delivery.body §14 Tier 2 Problem 2; §1 hook | “What county is Bomi's capital located in, and what is the name of that capital?; avoid the traffic near St. Paul River [on deliveries to Buchanan]” | The Tier 2 item is circular (it names the county it asks for). The hook's St. Paul River route to Buchanan makes no geographic sense (the St. Paul is north of Monrovia; Buchanan is south-east). | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |

**Learning objectives**

- `ft01-o1` (NF) Locate each of Liberia's 15 counties on an outline map and name its capital.
- `ft01-o2` (LM) Explain the difference between a county capital (the seat of county administration) and a county's largest or best-known town, and between the national capital and a county capital, using Nimba (Sanniquellie/Ganta) and Montserrado as examples.
- `ft01-o3` (GE) Use a county map to reason about location: name the counties crossed, and the capitals passed, on a route between two county capitals, and justify the answer from the map.

**Prerequisite diagnostics**

- Reads compass directions and a map key. Diagnostic: On a simple map of the school compound, point to north and name the place east of the gate. Fallback: A 4-minute directions mini-scene (sun rises in the east; the map key) before the county map.
- Knows that a country is divided into smaller administrative areas. Diagnostic: Which is bigger: Liberia, Nimba County, or Ganta? Fallback: A nested-boxes visual: Liberia → county → district → town, using the learner's own county.

**Conceptual depth and progression:** Diagnose directions and map key → Liberia's outline with the coast and its three land neighbours → Coastal counties west to east → Interior counties → Capital versus largest town (Nimba contrast card) → Fading: labelled map → partially labelled map → blank map → Independent map task → Route-reasoning transfer.

**Academic vocabulary:** county, county capital (county seat), national capital, superintendent, district, border / boundary, coastal, interior, unitary state.

**Liberian examples:** All 15 counties and capitals, checked against a current official source; Ganta as Nimba's trade hub on the road to Guinea, contrasted with Sanniquellie as the county seat; The Mano River border with Sierra Leone and the Cavalla River border with Côte d'Ivoire; Kakata (Margibi) and Buchanan (Grand Bassa) as familiar road destinations.

**Visual and interactive teaching**

- An accessible county map (SVG): each county labelled on focus, keyboard-navigable, with a text table grouping counties as coastal and interior, west to east. Offline: A printable A4 outline map and a two-column county/capital table.
- Place-the-capital interaction: drag or select the capital into its county, with immediate, misconception-specific feedback (e.g. choosing Ganta for Nimba). Offline: Paper cut-out capital cards placed on the printed map; a teacher answer sheet.
- A 'capital versus largest town' contrast card for Nimba and Montserrado. Offline: The same card as a text box in the printable pack.

**Guided practice (fading):** Coastal counties with a word bank and the map labelled; Interior counties with the map partly labelled and capitals withheld; Nimba and Montserrado contrast questions answered with feedback; One adjacency question (which county lies between Sinoe and Maryland?) with a hint available.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft01-a1` [ft01-o1] CONSTRUCTED · KEYED: Blank map: write the capital of each of the 15 counties (key: the reviewer-confirmed list).
- `ft01-a2` [ft01-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: A classmate writes 'Ganta is the capital of Nimba because it is the biggest town.' Explain the error and correct it.
- `ft01-a3` [ft01-o1, ft01-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M4.
- `ft01-a4` [ft01-o3] REASONING_TASK · ANALYTIC_RUBRIC: On the lesson's county map, name the counties a traveller crosses going by the coast from Buchanan to Greenville, and justify the order from the map.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft01-m1<br>`mc-civics-largest-town-is-capital` | The largest or best-known town is the capital (Ganta for Nimba). | Distractor 'Ganta' on the Nimba item | Ganta is Nimba's biggest trading town, but the county is administered from Sanniquellie. |
| ft01-m2<br>`mc-civics-national-capital-is-county-seat` | Monrovia is the capital of Montserrado as well as of Liberia, or the national capital is also every county's capital. | Two-part item: national capital, then Montserrado's county seat | Liberia's capital and Montserrado's county seat are different roles. |
| ft01-m3<br>`mc-civics-list-order-is-map-adjacency` | Counties that are next to each other in a list are next to each other on the map (Maryland and Sinoe). | Adjacency item | Look at the map: Grand Kru lies between them. |
| ft01-m4<br>`mc-civics-grand-counties-confused` | Confusing the four 'Grand' counties (Bassa, Cape Mount, Gedeh, Kru) and their capitals. | Matching item with all four | A position cue: Cape Mount far west, Bassa central coast, Kru south-east coast, Gedeh east interior. |
| ft01-m5<br>`mc-civics-capital-governs-county` | The capital governs the county, or the county elects its own government. | Constructed item ft01-a2 and a true/false item | The capital is where the county administration sits. The superintendent is appointed by the President. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): Five county–capital pairs drawn at random, always including Nimba and one of the five counties the legacy lesson omitted; Locate two counties on a blank map; One capital-versus-largest-town explanation.

**Transfer** (NEW context, ANALYTIC_RUBRIC): On a road map not used in the lesson, plan a trip from Voinjama to Harper. List the counties crossed and the capitals passed or near the route, and explain one reason the route is long.

**Optional extension** (non-gating): Why were River Gee and Gbarpolu created as new counties around 2000–2001? (Sources differ on Gbarpolu's year.) Find out from an adult or a source, and record the source.

**Teacher review criteria**

- Every county–capital pair matches a current official source (cite the source and its date in the review record).
- The Nimba and Montserrado corrections appear wherever the legacy lesson used them.
- Map boundaries and adjacency are correct, and the map is not a copyrighted image without permission.
- No economic or cultural claim about a county is left unsourced, and none stereotypes its people.
- The correction notice to the class that used the legacy lesson is drafted and approved.

**MOE / WAEC:** Civics is a distinct LiberiaLearn subject (owner direction, 2026-10-17). MOE Social Studies Grade 7 is recorded as a CROSS-REFERENCE only: no MOE Civics alignment is claimed, and no Social Studies objective is treated as the authority for this lesson. LJHSCE Social Studies applies at Grade 7. The repository's WAEC map is aggregator-sourced, so evidence specificity is LOW until the official syllabus is registered. Ceiling: Objectives 2–3 go beyond recall and are not limited by exam scope.

**Correction notice:** recommended. Learners memorised Ganta as Nimba's capital (it is Sanniquellie) and Monrovia as Montserrado's county seat (it is Bensonville/Bentol). (The class(es) with scheduled work or progress on the legacy lesson.)

**Open decisions:** `OD-FT01-MONTSERRADO` (RESOLVED_BY_OWNER_AND_SOURCES): Is Bensonville (Bentol) Montserrado's county seat? *Author recommends:* Yes. The owner's direction and the cited sources agree. A reviewer attaches an official Government of Liberia list when one is obtained. `OD-FT01-CIVICS-SUBJECT` (RESOLVED_BY_OWNER_2026-10-17): How does Civics relate to MOE curriculum authority? *Author recommends:* Civics stays a distinct LiberiaLearn subject; MOE Social Studies is a cross-reference only.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 6. Adopted into this version: D2 location narrowed (vocabulary sentence is true); D5 adds Senate consent (Art. 54) and Art. 56; D7 circular item and hook geography; Extension: Gbarpolu creation-year conflict noted. Reviewer says a correction notice is warranted: yes.

## 2. The Founding of Liberia: Historical Context and Significance

`wk_mca7a_wed_p4` · revision `cmss8poxb001fvo544mp6ebop` · hash `744f8d1f1dee6ce0…` · G7 CIVICS · no unit · APPROVED · A_TARGETED_REPAIR · audit REVISE (0 blocking, 10 major)

Dependencies (counts): scheduledWork 1, scheduledWorkClasses 1, scheduledWorkSchools 1, studentProgress 13, lessonPlans 1. Selection: CONFIRMED_FACTUAL_ERROR, OFF_OBJECTIVE_PRACTICE, ASSIGNED_TO_STUDENTS, LEARNER_HISTORY, LJHSCE_SOCIAL_STUDIES. Core national history is taught with wrong facts about founders and places. All of its practice is Liberian-dollar subtraction, so none of the three history objectives is practised or assessed.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · FACTUAL | delivery.body §4 | “Joseph Jenkins Roberts, a freed slave who became one of the first governors” | Joseph Jenkins Roberts was born free in Norfolk, Virginia (1809) and emigrated in 1829. He became the Commonwealth's first Black governor (1841) and Liberia's first President (1848). | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-LVA-ROBERTS: 'born on March 15, 1809, in Norfolk, Virginia' to 'free Black parents'; emigrated 1829; 'first Black governor of Liberia in 1841'; first President of the Republic, 1847. |
| D2 | BLOCKING · FACTUAL | delivery.body §4 | “Cuffe worked with the ACS ... and he helped to recruit settlers for the new colony” | Paul Cuffe died in 1817. His 1815–16 voyage took 38 emigrants to Sierra Leone. He corresponded with ACS founders, but he did not recruit settlers for Liberia, which began in 1822. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-EBSCO-CUFFE: 'Cuffe returned to West Africa in 1815 with thirty-eight African American emigrants'; 'Cuffe died peacefully at his home in Westport in 1817.' |
| D3 | MAJOR · FACTUAL | delivery.body §1, §4 | “arrived on the shores of the St. Paul River in the early 19th century; In 1822, the ACS established the colony of Liberia, which was named after ...” | The first ACS emigrants (the Elizabeth, 1820) landed at Sherbro Island in present-day Sierra Leone. The settlement at Cape Mesurado (Providence Island) began in 1822, and the name 'Liberia' was adopted in 1824. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-US-OOH-LIBERIA: 1816 ACS founded; in 1820 settlers 'sailed for Sierra Leone' and sheltered on Sherbro ('Scherbo') Island; 1821 a site was obtained when Lt. Robert Stockton coerced a local ruler; in 1824 'the settlement was named Liberia and its capital Monrovia'.<br>SRC-WP-MONROVIA: 'On 7 January 1822, a ship took these settlers to Dazoe Island (now called Providence Island)'; 'In 1824, the city was renamed Monrovia after James Monroe'. |
| D4 | MINOR · FACTUAL | delivery.body §3 warm-up answer | “The river that runs through the city of Monrovia is the St. Paul River.” | Monrovia lies on the Cape Mesurado peninsula between the Atlantic and the Mesurado River; the St. Paul River lies directly north and borders Greater Monrovia (Bushrod Island). The key's 'runs through the city' is imprecise. Accept the Mesurado as the founding river, and the St. Paul as the northern boundary. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-WP-MONROVIA: 'Monrovia lies along the Cape Mesurado peninsula, between the Atlantic Ocean and the Mesurado River'; 'The Saint Paul River lies directly north of the city and forms the northern boundary of Bushrod Island'.<br>SRC-ENCYC-MONROVIA: Main entry: 'at the mouth of the Mesurado River' on 'the promontory of Cape Mesurado'. CONFLICT: its Oxford entry places the city 'on the estuary of the River St Paul'. The St. Paul borders Greater Monrovia, so the legacy key is imprecise rather than simply false. |
| D5 | BLOCKING · OFF_OBJECTIVE | delivery.body §7–§15 | “If Pewee ... traveled to Liberia in 1822 with 50 LD in his pocket ...” | Every worked example and practice item is money subtraction and is unrelated to the history objectives. The amounts are also anachronistic: the Liberian dollar was first issued in 1847, and before independence the colony used US money and ACS-issued notes. Replace all of it with historical-thinking tasks. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-BANKNOTEWORLD-LRD: The first Liberian dollar was issued in 1847; before independence the ACS issued its own notes and coins. A low-authority source, so the reviewer should confirm it with a numismatic or central-bank source. |
| D6 | MAJOR · PERSPECTIVE | delivery.body §1, §4–§6 | “conflict with local tribes; Civilization: the idea that Western culture is superior” | Indigenous peoples appear only as an obstacle; Dei, Bassa, Vai and other communities already living on the coast need their own perspective, with sources. 'Civilization' is mis-defined as an ideology: teach the ACS 'civilising mission' as the historical ideology and keep the ordinary meaning of the word separate. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D7 | MINOR · FACTUAL | delivery.body §17 next-lesson teaser | “the country's struggle for independence and its experiences during the colonial era” | Liberia declared independence on 26 July 1847 and was not colonised by a European power. Present the ACS-administered settlement period accurately. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-US-OOH-LIBERIA: 'in 1847, Liberia declared independence from the American Colonization Society'; 'The United States finally established diplomatic relations with Liberia in 1862'. |
| D8 | MAJOR · PERSPECTIVE | delivery.body §4–§5 | “the ACS believed that Africa was the natural home of people of African descent ... provide a new home for freed slaves” | The ACS is presented as purely benevolent. The US Office of the Historian records that it was founded amid the politics of slavery and race, to deal with the 'problem' of free Black people, and that its members included slaveholders. Teach its mixed motives with that source. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |

**Learning objectives**

- `ft02-o1` (NF) Place the key events of Liberia's founding (ACS 1816; Sherbro 1820; Cape Mesurado 1822; the name Liberia 1824; independence 26 July 1847) in order on a timeline and describe each in one sentence.
- `ft02-o2` (LM) Explain the different motives and experiences of three groups (ACS supporters, Black American emigrants, and the Indigenous communities already living on the coast), using evidence from at least two short sources.
- `ft02-o3` (GE) Evaluate a historical claim about the founding (e.g. 'Liberia was an American colony') by weighing evidence for and against it.

**Prerequisite diagnostics**

- Reads a timeline (earlier/later; decades). Diagnostic: Which came first, 1822 or 1847? How many years apart are they? Fallback: A timeline warm-up using the learner's own school years.
- Knows the difference between a fact and an opinion. Diagnostic: Two-item sort: 'The ACS was founded in 1816' / 'The settlers were brave'. Fallback: A fact/opinion sorting scene with feedback.

**Conceptual depth and progression:** Diagnose timeline and fact/opinion → Story of the places: Sherbro → Cape Mesurado → Monrovia (map) → Timeline built step by step → Three groups, three perspectives, with short source cards → Guided source questions with fading → Independent claim-evaluation → Transfer to Freetown's founding.

**Academic vocabulary:** American Colonization Society (ACS), emigrant / settler, Indigenous, colony / commonwealth / republic, independence, primary source, perspective, evidence, anachronism.

**Liberian examples:** Providence Island and Cape Mesurado; The 1847 Declaration of Independence (public-domain text); Indigenous communities of the Mesurado coast; Monrovia's name and its history as the capital.

**Visual and interactive teaching**

- An interactive timeline (1816–1862) whose events reveal one at a time, with an accessible list view. Offline: A printed timeline strip with event cards to place.
- A coastal map showing Sherbro Island, Cape Mesurado and Providence Island. Offline: A labelled printed map.
- Source cards: short excerpts from public-domain primary sources (e.g. the 1847 Declaration) and a sourced secondary summary of Indigenous perspectives, each with citation. Offline: The same cards printed.

**Guided practice (fading):** Order 5 events with dates shown; Order events with dates withheld; Match each motive statement to a group, with feedback; Answer one source question with a sentence starter.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft02-a1` [ft02-o1] CONSTRUCTED · KEYED: Put six events in order and add a one-sentence description to two of them.
- `ft02-a2` [ft02-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: Using source cards A and B, explain how an emigrant and a member of an Indigenous community might have seen the 1822 settlement differently.
- `ft02-a3` [ft02-o1, ft02-o3] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft02-m1<br>`mc-history-liberia-us-government-colony` | Liberia was a colony of the United States government. | Claim-evaluation item | The ACS was a private society, not the US government. The US did give public money, a US government agent and Navy ships to help, but it did not rule the settlement, and it recognised Liberia only in 1862. |
| ft02-m2<br>`mc-history-all-settlers-formerly-enslaved` | All the settlers had been enslaved. | True/false item about J. J. Roberts | Many emigrants, Roberts among them, were born free. |
| ft02-m3<br>`mc-history-land-was-empty` | The land was empty when the settlers arrived. | Source item | Dei, Bassa, Vai and other peoples already lived and traded on this coast. |
| ft02-m4<br>`mc-history-liberia-colonised-or-granted-independence` | Liberia was colonised by Europe like its neighbours, or was granted independence. | Two-choice item | Liberia declared its own independence in 1847. |
| ft02-m5<br>`mc-history-1822-1847-confused` | Confusing 1822 (settlement) with 1847 (independence). | Timeline item | 1822: the settlement begins. 1847: the Republic is declared. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): Order four founding events; Name one person whose story the legacy lesson told wrongly and correct it; One perspective sentence.

**Transfer** (NEW context, ANALYTIC_RUBRIC): Read a short sourced account of Freetown's founding (1787/1792). Name one similarity to and one difference from Liberia's founding, using evidence.

**Optional extension** (non-gating): Compare two later accounts of 1822 written for different audiences, and explain why they differ.

**Teacher review criteria**

- Every date and name is checked against two reputable sources, cited in the review record.
- Indigenous and settler perspectives are represented fairly; no group is stereotyped or presented only as an obstacle.
- Sources are public domain or licensed, and excerpts are short.
- No practice item is off-objective (no unrelated arithmetic).
- The correction notice about Roberts, Cuffe and the landing place is drafted.

**MOE / WAEC:** Civics is a distinct LiberiaLearn subject (owner direction, 2026-10-17). MOE Social Studies Grade 7 is recorded as a CROSS-REFERENCE only: no MOE Civics alignment is claimed, and no Social Studies objective is treated as the authority for this lesson. The legacy codes LR-CIV-G7_9-01/02 are unverified and are not carried forward. LJHSCE Social Studies (evidence specificity LOW until the official syllabus is registered). Ceiling: The source-based perspective and claim-evaluation tasks are LiberiaLearn mastery and Global Excellence, beyond recall.

**Correction notice:** recommended. Wrong facts about J. J. Roberts, Paul Cuffe and the landing site were taught as answers. (The class(es) with scheduled work or progress on the legacy lesson.)

**Open decisions:** `OD-FT02-SENSITIVITY` (OPEN): Who reviews historical sensitivity (settler/Indigenous relations) in addition to the subject reviewer? *Author recommends:* A second reviewer with Liberian history expertise, recorded as GE-ACC-1. `OD-FT02-SOURCES` (OPEN): Which primary-source excerpts are licensed for learner use? *Author recommends:* Public-domain 19th-century texts only, until a licensing decision covers others.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 7. Adopted into this version: D5 reworded: Liberian dollar first issued 1847 (ACS notes and tokens existed earlier); D8 ACS presented as purely benevolent; m1 feedback acknowledges US public funding, agent and Navy. Reviewer says a correction notice is warranted: yes.

## 3. Understanding Democracy and Representation in Liberia

`hero-civics-g7-democracy-and-representation-in-liberia` · revision `cmss94h3z03bzvo54hj7c7z8t` · hash `cca4566947348a5d…` · G7 CIVICS · unit `civics-g7-2-citizenship-and-participation` · published · A_TARGETED_REPAIR · audit REVISE (0 blocking, 10 major)

Dependencies (counts): scheduledWork 55, scheduledWorkClasses 2, scheduledWorkSchools 1, studentProgress 1, learningEvents 14. Selection: CONFIRMED_FACTUAL_ERROR, CONFIRMED_ARITHMETIC_ERROR, HIGHEST_SCHEDULED_WORK_IN_SHORTLIST, PUBLISHED_HERO, LJHSCE_SOCIAL_STUDIES. The most-scheduled lesson in the shortlist (55 scheduled-work rows across 2 classes). It implies that Liberia elects its legislature by proportional representation, and its own seat allocation adds up to 11 of 10 seats.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · FACTUAL | delivery.body §7, §8, Key Takeaways | “Elections and proportional representation are mechanisms that ensure diverse and fair governance ... allowing minority voices from areas like rural Nimba” | Liberia's House of Representatives has 73 members, each elected from a single-member electoral district by plurality. The Senate has two senators per county (30), equal for every county regardless of population. Proportional allocation may appear only as a labelled comparison model, never as Liberia's system. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-LR-CONST-1986: Art. 45: 'Each county shall elect two Senators'; Art. 48: Representatives elected by the voters 'in each of the legislative constituencies'; Art. 80: constituencies of approximately equal population.<br>SRC-WP-LEGISLATURE: 'The House of Representatives contains 73 seats'; each member 'represents an electoral district', elected by 'a plurality of the vote'; 'The Senate has 30 members', two per county. |
| D2 | BLOCKING · MATHEMATICAL | delivery.body §8 step 2 | “Community A ... ~ 3; B ~ 2; C ~ 1; D ~ 1; E ~ 4 (10 representatives total)” | The rounded allocation totals 3+2+1+1+4 = 11 seats, not 10. The mechanical auditor cannot detect this. Any apportionment example must state its method (e.g. largest remainder) and sum correctly. | AUTHOR_COMPUTED | — |
| D3 | MAJOR · CONCEPTUAL | delivery.body §7 step 1 vs 'What Do You Notice' | “Regardless of the differences in population size, each community's voice should resonate with equal significance ... This method illustrates equality ... through proportional representation” | This contradicts itself: equal representation per unit (like the Senate) and population-proportional representation (like the House principle) are different ideas. Teach the contrast explicitly. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D4 | MAJOR · FACTUAL | delivery.body §1 | “Gbanyan, our Superintendent ... This is representation” | County superintendents are appointed by the President, not elected. Teach elected versus appointed offices. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-LR-CONST-1986: Art. 54 and Art. 56: superintendents are appointed by the President and serve at the President's pleasure. |
| D5 | MAJOR · FACTUAL | delivery.body §6 memory tips; §4 | “"Legis-late" – laws ... take time ("late"); "stituency" can refer to state; Each LD$ possesses intrinsic value” | The etymologies are false: legislative comes from Latin lex/legis 'law' + latio 'proposing'. Paper currency has no intrinsic value; remove the analogy. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D6 | MAJOR · COVERAGE | objectives[1] vs body | “Identify the roles of key representatives such as the President, Senators, and House of Representatives members” | Roles, terms of office (President 6 years; Senators 9; Representatives 6, per the 1986 Constitution as reviewer-confirmed) and the three branches are not taught. Worked examples are arithmetic apportionment, not civics. | AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM | SRC-LR-CONST-1986: Art. 45/46: senators nine years; Art. 48: representatives six years; Art. 50: President six years, at most two terms. |
| D7 | MAJOR · GRADE_FIT | delivery.body | “Flesch-Kincaid grade 13.9; 6 sections over 300 words” | Rewrite to the Grade 7 band, one idea per scene. | MECHANICAL_AUDIT_CONFIRMED | — |
| D8 | MAJOR · MATHEMATICAL | assessment.problemSets gp2, gp3; delivery.body §15 | “District A ... approximately 3; B ... approximately 3; C ... 5; D ... 1; E ... 2 [for 15 representatives]; gp3 answerKey ''” | The gp2 key allocates 3+3+5+1+2 = 14 of 15 seats; largest remainder gives A4 B3 C5 D1 E2. gp3 has an empty key. Tier 3 items weight seats by 'importance', which is not a democratic apportionment principle. | AUTHOR_COMPUTED | — |

**Learning objectives**

- `ft03-o1` (NF) Describe Liberia's three branches of government and who is elected to each, and how: the President nationally, two senators per county, and one representative per electoral district.
- `ft03-o2` (LM) Explain representation and accountability, and distinguish elected offices from appointed ones (e.g. superintendent, cabinet minister) using Liberian examples.
- `ft03-o3` (GE) Compare equal representation per county (Senate) with population-based representation (House), and argue one advantage and one disadvantage of each, with reasons.

**Prerequisite diagnostics**

- Knows Liberia has 15 counties. Diagnostic: How many counties does Liberia have? Fallback: A county-map flash scene (links to ft01).
- Understands voting as choosing among options by counting votes. Diagnostic: Class vote result item: which option wins? Fallback: A class-election simulation scene.

**Conceptual depth and progression:** Diagnose counties and voting → Why representation? (class-council analogy, kept short) → Three branches with a power-sharing diagram → Who is elected, who is appointed → Senate: equal per county; House: districts by population → Guided comparison with fading → Independent argument task → Transfer to designing a school council.

**Academic vocabulary:** democracy, representation, electoral district, legislature (Senate, House of Representatives), executive, judiciary, elected / appointed, term of office, accountability, checks and balances.

**Liberian examples:** The National Legislature in Monrovia; Two senators for every county, from Bomi to Maryland; Election day at a polling place; An appointed superintendent compared with an elected representative.

**Visual and interactive teaching**

- A three-branch diagram with arrows showing checks (veto, confirmation, judicial review), each with a text description. Offline: Printed diagram with captions.
- Representation simulator: a map that shows equal seats per county (Senate) and seats per district (House) for invented, labelled populations. Offline: Two printed tables with the same data.

**Guided practice (fading):** Sort offices into elected/appointed with feedback; Match each branch to its job; A guided comparison table of Senate and House, half filled in.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft03-a1` [ft03-o1] CONSTRUCTED · KEYED: Complete a table: office, branch, how chosen, term.
- `ft03-a2` [ft03-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: Explain how a citizen can hold an elected representative accountable, and why that is harder for an appointed official.
- `ft03-a3` [ft03-o3] REASONING_TASK · ANALYTIC_RUBRIC: A small county and a large county each have two senators. Is that fair? Give a reason for and a reason against.
- `ft03-a4` [ft03-o1, ft03-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft03-m1<br>`mc-civics-all-officials-elected` | Every government official is elected. | Elected/appointed sort | Superintendents and ministers are appointed by the President. |
| ft03-m2<br>`mc-civics-liberia-proportional-representation` | Liberia uses proportional representation. | Senate seat-count item | Each county has two senators whatever its population. House members are elected one per district. |
| ft03-m3<br>`mc-civics-president-makes-laws` | The President makes the laws. | Branch-matching item | The Legislature passes laws; the President can sign or veto them. |
| ft03-m4<br>`mc-civics-representative-speaks-for-county` | A representative speaks for the whole county. | District item | A representative is elected by one electoral district; senators represent the county. |
| ft03-m5<br>`mc-civics-majority-unlimited-power` | In a democracy the majority can do anything. | Constitution item | The Constitution limits every branch and protects rights. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): How many senators per county, and why that number does not depend on population; One elected and one appointed office; Which branch passes laws.

**Transfer** (NEW context, ANALYTIC_RUBRIC): Design a student council for a school with four grades of very different sizes. Choose equal or size-based representation and justify it, naming one risk.

**Optional extension** (non-gating): Compare how Liberia's Senate and another country's upper house are composed, citing the source.

**Teacher review criteria**

- Seat numbers, terms and appointment rules match the current Constitution and electoral law (cite the version).
- The content is politically neutral, with no party or living politician presented favourably or unfavourably.
- Any apportionment arithmetic sums correctly and is labelled as a model.
- The correction notice on proportional representation is drafted.

**MOE / WAEC:** Civics is a distinct LiberiaLearn subject (owner direction, 2026-10-17). MOE Social Studies Grade 7 is recorded as a CROSS-REFERENCE only: no MOE Civics alignment is claimed, and no Social Studies objective is treated as the authority for this lesson. The legacy codes LR-CIV-G7_9-01/02 are unverified and are not carried forward. LJHSCE Social Studies (evidence specificity LOW). Ceiling: The trade-off argument (ft03-o3) is above recall-level exam scope.

**Correction notice:** recommended. Learners were told that Liberia uses proportional representation and that the superintendent is elected. (The 2 classes with 55 scheduled-work rows.)

**Open decisions:** `OD-FT03-TERMS` (RESOLVED_BY_CONSTITUTION_TEXT): Teach terms of office now, or only the composition of each branch? *Author recommends:* Teach terms: President 6 years (two-term limit, Art. 50), Senators 9 years (Art. 45/46), Representatives 6 years (Art. 48), and the veto with legislative override.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 7. Adopted into this version: D8 gp2 key sums to 14 of 15 (largest remainder A4 B3 C5 D1 E2); gp3 empty key; importance-weighted seats; OD-FT03-TERMS resolved from the constitution text. Reviewer says a correction notice is warranted: yes.

## 4. Understanding States of Matter Through Real-Life Examples

`wk_mca7a_fri_p3` · revision `cmss8pt0j002fvo54be8gcrnd` · hash `d218a3e17da67bcf…` · G7 SCIENCE · no unit · APPROVED · A_TARGETED_REPAIR · audit REVISE (0 blocking, 10 major)

Dependencies (counts): scheduledWork 1, scheduledWorkClasses 1, scheduledWorkSchools 1, studentProgress 13, lessonPlans 1. Selection: CONFIRMED_FACTUAL_ERROR, CONFIRMED_ARITHMETIC_ERROR, GRADE_FIT, ASSIGNED_TO_STUDENTS, LEARNER_HISTORY, LJHSCE_GENERAL_SCIENCE. The lesson teaches physically impossible results: ice in juice warms the mixture to 80 °C, and boiling water drops to −71.5 °C and 'boils off'. It does this with senior-secondary calorimetry while the Grade 7 particle model goes untaught.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · SCIENTIFIC | delivery.body §7 step 6 | “The final temperature of the mixture is approximately 80.0°C.” | Cooling 300 g of juice to 0 °C releases at most 31,350 J, less than the 33,400 J needed to melt 100 g of ice. So about 93.9 g melts, about 6.1 g of ice remains, and the mixture stays at 0 °C. A mixture can never end hotter than its hottest part. | AUTHOR_COMPUTED | — |
| D2 | BLOCKING · SCIENTIFIC | delivery.body §12 | “8360 + 133,600 = 142,960 ... x = 100 - 171.5 = -71.5° ... all boiled off” | 8,360 + 133,600 = 141,960. Cooling the water to 0 °C releases 83,600 J. After 8,360 J warms the ice, 75,240 J melts about 225 g, leaving about 175 g of ice at 0 °C. Nothing boils off. | MECHANICAL_AUDIT_CONFIRMED | — |
| D3 | BLOCKING · SCIENTIFIC | delivery.body §13–§15 answer keys | “Q = m * L_f = 500 g * 334 = 167,000 J; Likely between 11-15°C final; they will meet at 0-1°C” | Freezing 500 g of water from 30 °C needs 62,700 J (cooling) + 167,000 J = 229,700 J removed. 250 g of ice at −5 °C in 300 g of water at 20 °C ends at 0 °C with about 67 g melted, not 11–15 °C. Tier 2 Problem 2 is ambiguous (is the 250 g at 0 °C ice or water?). If it is ice the mixture ends near −3.75 °C with no liquid; if it is water it ends at 0 °C with about 9 g frozen. A key of '0–1 °C' is wrong either way, since nothing ends above 0 °C. The keys are vague ('likely', 'around') or wrong. | AUTHOR_COMPUTED | — |
| D4 | BLOCKING · GRADE_FIT | delivery.body §7–§15 | “Specific heat of water = 4.18 J/g·°C; Latent heat of fusion for ice = 334 J/g” | Quantitative latent-heat calorimetry is upper-secondary physics (e.g. GCSE ages 14–16 in England); the reviewer confirms against the MOE General Science syllabus. Grade 7 needs the particle model, the changes of state and the energy direction. Calculation may appear only as an optional, labelled extension. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D5 | MAJOR · CONCEPTUAL | delivery.body §1, §3, §6 | “the solid ice melts, but it also creates a reaction; This process is called evaporation [boiling]; Palm oil on a hot stove will eventually evaporate” | Melting is a physical change, not a reaction; fizzing comes from dissolved gas. Boiling and evaporation are different processes. Cooking oil smokes and breaks down rather than simply evaporating, so it is a poor example. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D6 | MAJOR · ASSESSMENT | delivery.body §17 | “What was the most surprising fact you learned” | The exit ticket does not assess any objective and has no key. | MECHANICAL_AUDIT_CONFIRMED | — |
| D7 | MAJOR · SCIENTIFIC | delivery.body §8, §11, §9 | “Following this method confirms the initial findings; Thus, ice will still remain frozen; they may declare that 'all liquids flow'; freezing water in a hot environment (like Nimba County)” | Worked Example 2 gives no final temperature and claims to confirm the impossible 80 °C. Guided Practice 2 uses an invalid method and says the ice 'remains frozen' when about 285 g melts. Error Analysis labels a true statement ('all liquids flow') as a misconception and offers a meaningless example. Tier 3 Problem 1's answer is exactly 0 °C with about 68 g of ice left. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |

**Learning objectives**

- `ft04-o1` (NF) Use the particle model to describe and compare solids, liquids and gases (arrangement, movement, shape and volume), with Liberian examples.
- `ft04-o2` (NF) Explain melting, freezing, evaporation, boiling and condensation as energy gained or lost by particles, and distinguish evaporation from boiling.
- `ft04-o3` (LM) Predict and explain, with evidence, what happens to temperature when ice melts in a drink (it stays at about 0 °C while ice remains), and recognise changes of state as reversible physical changes.

**Prerequisite diagnostics**

- Reads a thermometer in °C. Diagnostic: Read two thermometer pictures (25 °C and 0 °C). Fallback: A thermometer-reading mini-scene.
- Knows that all matter is made of tiny particles. Diagnostic: True/false: 'Air is made of nothing.' Fallback: A particles-in-air demonstration scene (the smell of cooking spreads across the room).

**Conceptual depth and progression:** Diagnose thermometer reading and the particle idea → Particle model of the three states (simulation) → Energy in/energy out for each change of state → Evaporation versus boiling → Heating curve: the plateau while ice melts → Guided prediction tasks with fading → Independent explanation → Transfer: the clay water pot.

**Academic vocabulary:** particle, solid / liquid / gas, melting point, boiling point, evaporation, condensation, freezing, physical change, reversible.

**Liberian examples:** A cold water bottle 'sweating' in Monrovia's humid air (condensation); Fish and cassava drying in the sun (evaporation); Palm oil thickening on a cool morning and flowing when warmed (reviewer to confirm the description); Boiling water for rice.

**Visual and interactive teaching**

- A particle simulation with a heat slider showing arrangement and motion in each state, with a text description of every state. Offline: A printed three-panel particle diagram and a role-play (learners as particles).
- A heating curve for water with labelled plateaus, built step by step. Offline: A printed graph with a data table.
- An optional low-cost demonstration: ice in a cup with a thermometer, read every minute (teacher-led; safety note). Offline: A recorded data table for classes without ice or a thermometer.

**Guided practice (fading):** Classify particle pictures with feedback; Name the change of state and the energy direction for five Liberian scenes; Predict the thermometer reading during melting, with a hint.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft04-a1` [ft04-o1] CONSTRUCTED · ANALYTIC_RUBRIC: Draw particles of palm oil as a liquid and as a solid, and label the differences.
- `ft04-a2` [ft04-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: Explain why wet clothes dry on a line without boiling.
- `ft04-a3` [ft04-o3] REASONING_TASK · ANALYTIC_RUBRIC: Data: a drink with ice reads 0 °C for 8 minutes, then rises. Explain the pattern using particles and energy.
- `ft04-a4` [ft04-o1, ft04-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Five items whose distractors are mapped to M1–M6.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft04-m1<br>`mc-science-boiling-bubbles-are-air` | The bubbles in boiling water are air. | Distractor | The large bubbles in boiling water are water vapour forming inside the liquid. The first tiny bubbles when you start heating are dissolved air coming out. |
| ft04-m2<br>`mc-science-temperature-rises-during-melting` | The temperature keeps rising while ice melts, or a mixture can get hotter than its hottest part. | Prediction item ft04-a3 | While ice is melting, the energy goes into changing state and the temperature stays near 0 °C. |
| ft04-m3<br>`mc-science-condensation-is-leakage` | Water on a cold bottle leaks through the plastic. | Explanation item | Water vapour from the air condenses on the cold surface. |
| ft04-m4<br>`mc-science-evaporation-only-at-boiling-point` | Evaporation only happens at 100 °C. | Drying-clothes item | Evaporation happens at the surface at any temperature; boiling happens throughout the liquid at the boiling point. |
| ft04-m5<br>`mc-science-particles-expand-or-melt` | The particles themselves expand or melt. | Particle-drawing rubric row | The particles stay the same; their spacing and motion change. |
| ft04-m6<br>`mc-science-melting-is-chemical-change` | Melting is a chemical reaction. | Two-choice item | No new substance forms, and the change reverses. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): Name the change of state in three scenes; Evaporation versus boiling; What happens to the temperature while ice melts.

**Transfer** (NEW context, ANALYTIC_RUBRIC): A clay water pot keeps drinking water cooler than a plastic bucket. Use evaporation and energy to explain why.

**Optional extension** (non-gating): Labelled 'beyond Grade 7': estimate how much ice 300 g of juice at 25 °C can melt (Q = mL), and explain why the mixture stays at 0 °C.

**Teacher review criteria**

- Every numerical claim is recomputed (no result outside physical bounds).
- The demonstration is safe and uses no open flame without supervision.
- Liberian examples are physically accurate (palm oil behaviour, harmattan dew).
- The correction notice on the impossible results is drafted.

**MOE / WAEC:** MOE General Science Grade 7: matter and its states (binding to a structured MOE objective is required; the legacy codes are unrelated cell/forces codes). LJHSCE General Science: states of matter (evidence specificity LOW). Ceiling: Quantitative calorimetry is an optional extension, so the lesson does not depend on exam scope.

**Correction notice:** recommended. Learners were shown physically impossible answers as worked solutions. (The class with progress on the legacy lesson.)

**Open decisions:** `OD-FT04-SCOPE` (OPEN): Keep any quantitative heat content at Grade 7? *Author recommends:* Only as an optional, non-gating extension.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 6. Adopted into this version: D3 ambiguity of Tier 2 Problem 2 stated; D4 grade claim given a comparator and a syllabus check; D7 WE2, GP2, error-analysis and Tier 3 defects; m1 feedback distinguishes dissolved air. Reviewer says a correction notice is warranted: yes.

## 5. Understanding Photosynthesis through Traditional Liberian Cooking

`science-g5-plants` · revision `cmss8mp3p0007vo1wqsa620v2` · hash `ba219ffc4d788a4f…` · G5 SCIENCE · no unit · APPROVED · A_TARGETED_REPAIR · audit REVISE (0 blocking, 6 major)

Dependencies (counts): scheduledWork 2, scheduledWorkClasses 2, scheduledWorkSchools 1, learningEvents 51, lessonPlans 1, videoSupplements 10. Selection: CONFIRMED_CONCEPTUAL_ERROR, INVENTED_DATA_PRESENTED_AS_FACT, HIGHEST_LEARNING_EVENTS_IN_SHORTLIST, ASSIGNED_TO_STUDENTS, GRADE_BAND_4_6. 51 learning events across 2 classes, plus 10 video supplements attached. The science has been replaced with multiplication on invented 'grams of glucose per plant per day' rates.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · INVENTED_DATA | delivery.body §7–§15 | “each plant can produce 5 grams of glucose each day” | Every practice and assessment item rests on invented, unlabelled glucose rates and is plain multiplication. Replace them with science tasks, and label any invented quantity as invented. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D2 | BLOCKING · CONCEPTUAL | delivery.body §7 final answer; Key Takeaways | “Boima will collect 350 grams of glucose; Photosynthesis is the process by which plants convert light into energy” | Glucose is not collected: the plant uses it for respiration and growth or stores it (in cassava, as starch in the roots). Light energy is changed into chemical energy; energy is not made from nothing. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D3 | MAJOR · CONCEPTUAL | delivery.body §1 vs whole lesson | “Is it just from the soil?” | The central Grade 5 misconception, that plants get their food from the soil, is raised and never addressed. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D4 | MAJOR · GRADE_FIT | delivery.body §5; objectives[0] | “This reaction makes the water absorbed by the roots split into oxygen and hydrogen ... including its stages” | Water splitting and 'stages' are beyond Grade 5 (Flesch-Kincaid 11.5). Keep the inputs, the outputs and the role of light. | MECHANICAL_AUDIT_CONFIRMED | — |
| D5 | MINOR · TERMINOLOGY | delivery.body §10, §13 | “8 palm oil plants” | The plant is the oil palm; palm oil is its product. The mnemonic 'stomata sounds like stomach' reinforces the idea that plants eat, so remove it. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D6 | MAJOR · ASSESSMENT | delivery.body §13–§15 | “**Answer**: **150 grams**” | Answers are printed beside the practice items, and the exit ticket has no key. | MECHANICAL_AUDIT_CONFIRMED | — |
| D7 | MAJOR · SCIENTIFIC | delivery.body §6 vocabulary (Carbon Dioxide example) | “Plants take in carbon dioxide to produce oxygen.” | The oxygen released in photosynthesis comes from water, not carbon dioxide; the lesson's own §5 says water splits. Teach the inputs and outputs without saying one makes the other. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |
| D8 | MAJOR · SCIENTIFIC | delivery.body §4 | “Glucose is crucial because it's how plants store energy” | Plants store food mainly as starch; cassava roots store starch. Glucose is the sugar made first, then used or converted. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |
| D9 | MINOR · FALSE_MNEMONIC | delivery.body §6 memory tips | “Chlorophyll sounds like 'chorus'; 'Glu-' sounds like 'glue'; humans exhale carbon dioxide, and plants 'breathe' it in” | Remove the false word associations (chloro- means green, gluco- sweet) and the implication that plants do not respire. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |

**Learning objectives**

- `ft05-o1` (NF) State what green plants need to make their own food (light, water, carbon dioxide from the air) and what they make (sugar and oxygen).
- `ft05-o2` (NF) Describe the jobs of leaves, roots and stems in making and moving food and water, using cassava or rice as an example.
- `ft05-o3` (LM) Use evidence from a simple fair-test investigation (light versus dark) to explain that plants need light to make food.

**Prerequisite diagnostics**

- Names the main parts of a plant. Diagnostic: Label the root, stem and leaf on a cassava picture. Fallback: A plant-parts scene with a real cassava stem and leaf.
- Knows that living things need food for energy. Diagnostic: Why do people and animals need food? Fallback: A short 'food gives energy' scene.

**Conceptual depth and progression:** Diagnose plant parts and the food-energy idea → Confront the question 'Where does a plant's food come from?' (soil or air?) → Inputs and outputs, shown as a simple picture equation in words → Leaves as food factories; roots and stems as transport → Light/dark investigation (real or recorded results) → Guided evidence reasoning with fading → Independent explanation → Transfer to shaded crops.

**Academic vocabulary:** photosynthesis, chlorophyll, carbon dioxide, oxygen, sugar (glucose), starch, stomata, fair test, evidence.

**Liberian examples:** Cassava stores food as starch in its roots; Rice seedlings in a nursery; Oil palm and plantain leaves in full sun; A farm under heavy forest shade.

**Visual and interactive teaching**

- An animated leaf: arrows for light, water and carbon dioxide in; sugar and oxygen out. Narrated (Grade 5), with a text alternative. Offline: A printed labelled diagram.
- An investigation scene: two seedlings, one under a box for 7 days, shown day by day as real or clearly labelled photos. Measure leaf colour and health, not height: a seedling in the dark can grow taller (etiolation) while turning pale, because it runs on food stored in its seed. Offline: A class investigation using two cups of seedlings and a cardboard box (7-day observation table).

**Guided practice (fading):** Sort inputs and outputs with feedback; Match each plant part to its job; Read the investigation table and answer with a sentence starter.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft05-a1` [ft05-o1] CONSTRUCTED · KEYED: Complete the word equation, then say where each input comes from.
- `ft05-a2` [ft05-o2] CONSTRUCTED · ANALYTIC_RUBRIC: Explain how water gets from the soil to a cassava leaf.
- `ft05-a3` [ft05-o3] REASONING_TASK · ANALYTIC_RUBRIC: Explain the investigation results: what changed, what stayed the same, and what that shows.
- `ft05-a4` [ft05-o1, ft05-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft05-m1<br>`mc-science-plant-food-from-soil` | Plants get their food from the soil. | 'Where does the plant's food come from?' with a soil distractor | Plants make their food in their leaves, from air and water, using light. Soil gives water and small amounts of minerals. |
| ft05-m2<br>`mc-science-plants-eat-through-leaves` | Plants eat and breathe like animals through their leaves. | Stomata item | Stomata let gases in and out. The plant makes food; it does not eat it. |
| ft05-m3<br>`mc-science-plants-need-only-light-and-water` | Plants only need sunlight and water. | Inputs item | Carbon dioxide from the air is also needed. |
| ft05-m4<br>`mc-science-plants-do-not-respire` | Plants make oxygen but do not use energy themselves. | True/false item | Plants use some of the sugar they make for their own energy. |
| ft05-m5<br>`mc-science-photosynthesis-creates-energy` | Photosynthesis makes energy from nothing. | Energy item | Light energy is changed into energy stored in sugar. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): The inputs and outputs of photosynthesis; Where does a plant's food come from?; One plant-part job.

**Transfer** (NEW context, ANALYTIC_RUBRIC): A farmer's cassava under tall trees grows small roots, while cassava in the open grows big roots. Explain why, using what you learned. The rubric also gives credit for naming competition with the tall trees for water and nutrients as a contributing reason.

**Optional extension** (non-gating): Why do leaves look green? Investigate chlorophyll by crushing a leaf on paper, and describe what you see.

**Teacher review criteria**

- No invented quantity is presented as fact.
- The narration and reading level suit Grade 5.
- The 10 attached video supplements are reviewed for the same misconceptions and either kept, flagged or detached in the mapping plan.
- The investigation is feasible without lab equipment.

**MOE / WAEC:** MOE Science Grade 5: plants and their needs (structured MOE binding required; the legacy row has no claims). Not applicable at Grade 5. Ceiling: Evidence reasoning (ft05-o3) is mastery-level.

**Correction notice:** recommended. Learners were taught retractable falsehoods: that oxygen comes from carbon dioxide, that glucose is how plants store energy, and invented glucose yields presented as fact. (Teachers and learners of the 2 scheduled classes (51 learning events).)

**Open decisions:** `OD-FT05-VIDEOS` (OPEN): Who reviews the 10 video supplements linked to the legacy row? *Author recommends:* The same subject reviewer, recorded in the mapping plan. Videos are not carried over automatically.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 6. Adopted into this version: D7 oxygen comes from water, not CO2; D8 plants store starch, not glucose; D9 false mnemonics; Correction notice now recommended; Investigation: 7 days, measure colour not height (etiolation); Transfer rubric credits competition. Reviewer says a correction notice is warranted: yes.

## 6. Calculating Area and Perimeter of Polygons for Real-World Applications

`hero-math-g7-geometry-area-and-perimeter-of-polygons` · revision `cmss9493703a7vo54xxnhxmjy` · hash `31416f12b1fc07bd…` · G7 MATH · unit `math-g7-5-geometry-and-spatial-thinking` · published · A_TARGETED_REPAIR · audit REVISE (0 blocking, 9 major)

Dependencies (counts): scheduledWork 42, scheduledWorkClasses 2, scheduledWorkSchools 1, studentProgress 7, assignments 1, learningEvents 44. Selection: CONFIRMED_MATHEMATICAL_ERROR, UNFINISHED_ASSESSMENT_ITEM, HIGHEST_MATH_EXPOSURE, PUBLISHED_HERO, LJHSCE_MATHEMATICS. The most-used math lesson: 42 scheduled-work rows, 44 learning events and 1 assignment. It gives two different areas for the same field, and its assessment item ends unsolved with a chatbot prompt.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · MATHEMATICAL | delivery.body §8 step 3 | “Total area of all rows: 10 × 450 = 4500 ... Verify again if the distribution was miscalculated” | 90 × 45 = 4,050 m², as §7 shows. The 'alternative method' produces 4,500 m², and the text leaves the contradiction unresolved. | AUTHOR_COMPUTED | — |
| D2 | BLOCKING · ASSESSMENT | delivery.body §17 Assessment 1 | “explore outside resources for real applications ... **Tell me more about whether assumptions hold.**” | The rhombus item is left unsolved, with generator residue. With side 6 m and one diagonal 8 m, the other diagonal is 2√20 ≈ 8.94 m, the area ≈ 35.8 m² and the perimeter 24 m. Either solve it within Grade 7 scope or replace it. | AUTHOR_COMPUTED | — |
| D3 | MAJOR · MATHEMATICAL | delivery.body §5 hexagon | “the height (distance from the center to a vertex) is 2.6 meters” | 2.6 m is the apothem (centre to the midpoint of a side). For a regular hexagon with side 3 m, the centre-to-vertex distance is 3 m. | AUTHOR_COMPUTED | — |
| D4 | MAJOR · CONCEPTUAL | assessment.problemSets ip2b | “the area of one of Fatu's square tiles is 16 square meters, and the perimeter is also 16 meters” | This treats 16 m² and 16 m as comparable, which reinforces the area/perimeter confusion, and a 4 m tile is unrealistic. Use 30 cm or 40 cm tiles, and contrast units explicitly. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D5 | MAJOR · ASSESSMENT | assessment.problemSets[0] | “studentPrompt: 20 × 10 ...; answerKey: 20 + 14 = 34 ... 280 square meters” | The prompt and its key describe different problems. Every key must match its prompt exactly. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D6 | MAJOR · COVERAGE | objectives[1] | “Explain the significance of choosing the appropriate polygon shape for maximizing area while minimizing the perimeter” | Never taught: there is no fixed-perimeter comparison. The trapezoid problem (GP3) does not say which sides are parallel, and no arrangement of sides 12, 14, 10 and 16 fits a height of 10 m, so the shape cannot exist. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D7 | MINOR · LEAKAGE | instruction.takeawaySummary[0] | “Area of one triangle = 1200 m² / 2 = 600 square meters” | A practice answer leaked into the summary. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D8 | MAJOR · MATHEMATICAL | assessment.problemSets gp2; delivery.body §11 | “a base of 10 meters, a height of 6 meters, and sides of 10 meters, 8 meters, and 6 meters ... Area = 30 square meters” | The data are inconsistent: sides 6-8-10 make a right triangle whose height on the base of 10 is 4.8 m, so its area is 24 m², and the key's 30 m² uses an impossible height. §5's claim that any triangle in a rectangle has half its area is overgeneralised, and the vocabulary's '-gon means sides' is false (-gon means angle). | AUTHOR_COMPUTED | — |

**Learning objectives**

- `ft06-o1` (NF) Calculate the perimeter and area of rectangles, triangles and composite rectilinear shapes, with correct linear and square units.
- `ft06-o2` (LM) Explain why area is measured in square units and perimeter in linear units, and show that shapes with the same perimeter can have different areas.
- `ft06-o3` (GE) Solve and justify a design problem with a fixed perimeter (e.g. 24 m of fencing for a garden): find the dimensions with the greatest area.

**Prerequisite diagnostics**

- Multiplies two-digit numbers. Diagnostic: Compute 12 × 8 and 45 × 6. Fallback: An area-model multiplication scene (links to place value).
- Measures length in m and cm and converts between them. Diagnostic: Convert 3 m to cm. Fallback: A metre-stick scene.

**Conceptual depth and progression:** Diagnose multiplication and units → Counting unit squares leads to the rectangle formula → Perimeter as distance around (string model) → Triangle as half a rectangle → Composite shapes by decomposition → Same perimeter, different area (grid exploration) → Guided practice with fading → Independent mixed problems → Design reasoning task → Transfer to tiling or roofing.

**Academic vocabulary:** perimeter, area, square unit (m², cm²), base, perpendicular height, composite shape, decompose, dimensions.

**Liberian examples:** Fencing a cassava or pepper garden; Floor tiles for a classroom (realistic 30–40 cm tiles); Zinc sheets for a roof (reviewer to supply realistic sheet sizes); A football pitch at a local school.

**Visual and interactive teaching**

- A grid explorer: drag the corners of a rectangle on a grid; perimeter and area update live and are announced to screen readers. Offline: Graph paper and string.
- A triangle-in-rectangle animation showing the ½ × base × height relationship. Offline: Fold and cut a paper rectangle.
- A fixed-perimeter table builder (24 m) with a learner-generated table and graph. Offline: A printed table to complete.

**Guided practice (fading):** Rectangle area by counting, then by formula; Triangle with a labelled height (not a slant side); A composite L-shape decomposed with a hint; Same perimeter, different area: compare two shapes.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft06-a1` [ft06-o1] PRODUCED_ANSWER · KEYED: Area and perimeter of a rectangle, a triangle and an L-shape, with units.
- `ft06-a2` [ft06-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: A classmate says a 4 cm square has the same area and perimeter. Explain what is wrong.
- `ft06-a3` [ft06-o3] REASONING_TASK · ANALYTIC_RUBRIC: 24 m of fence: find the whole-metre dimensions with the greatest area and justify why.
- `ft06-a4` [ft06-o1, ft06-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft06-m1<br>`mc-math-area-perimeter-same-quantity` | Area and perimeter are the same kind of quantity, or can be compared. | Units item; ft06-a2 | Perimeter is a length (m); area counts squares (m²). |
| ft06-m2<br>`mc-math-doubling-sides-doubles-area` | Doubling the side lengths doubles the area. | Scaling item | Doubling both sides makes the area 4 times bigger. |
| ft06-m3<br>`mc-math-triangle-area-omits-half-or-slant-height` | The area of a triangle is base × height (forgetting ½), or the slant side is used as the height. | Distractors 2bh and 'slant × base' | The height is perpendicular to the base, and the triangle is half the rectangle. |
| ft06-m4<br>`mc-math-same-perimeter-same-area` | Shapes with the same perimeter have the same area. | Fixed-perimeter item | A 6 × 6 garden and an 11 × 1 garden both need 24 m of fence, but their areas are 36 m² and 11 m². |
| ft06-m5<br>`mc-math-perimeter-counts-edge-squares` | Perimeter is found by counting the squares along the edge. | Grid-perimeter item | Count the edge lengths, not the squares. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): The area and perimeter of a new rectangle with units; Triangle area with a distractor height; A same-perimeter comparison.

**Transfer** (NEW context, ANALYTIC_RUBRIC): How many 40 cm × 40 cm tiles are needed for a 6 m × 4.5 m classroom floor? Explain your method and how you deal with the part-tiles.

**Optional extension** (non-gating): Of all rectangles with the same perimeter, which has the greatest area? Make a conjecture and test it with three perimeters.

**Teacher review criteria**

- Every numeric answer is recomputed, and every key matches its prompt.
- Units are present on every answer.
- Real-world dimensions are realistic.
- No generator residue or chatbot text remains in learner content.
- The correction notice on 4,050 versus 4,500 and the unsolved assessment item is drafted.

**MOE / WAEC:** MOE Mathematics Grade 7: mensuration (structured binding required; the legacy codes are unverified ratio/equation codes). LJHSCE Mathematics: mensuration (evidence specificity LOW). Ceiling: The fixed-perimeter optimisation is Global Excellence.

**Correction notice:** recommended. Contradictory worked answers and an unsolved assessment item were shown to learners in an assigned lesson. (The 2 classes with scheduled work and the 1 assignment.)

**Open decisions:** `OD-FT06-HEXAGON` (OPEN): Keep the regular-hexagon content at Grade 7? *Author recommends:* Move it to the optional extension.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 7. Adopted into this version: D6 trapezoid cannot exist; D8 gp2 inconsistent data (24 m² not 30 m²); -gon etymology; triangle-in-rectangle overgeneralisation; Transfer floor changed to 6 m × 4.5 m so part-tiles arise. Reviewer says a correction notice is warranted: yes.

## 7. Understanding and Representing Fractions in Real-Life Contexts

`lesson_mca_1` · revision `cmss8mpl0000bvo1wos7i1ew4` · hash `872222a2435f151d…` · G7 MATH · no unit · APPROVED · A_TARGETED_REPAIR · audit REVISE (0 blocking, 9 major)

Dependencies (counts): scheduledWork 4, scheduledWorkClasses 2, scheduledWorkSchools 2, studentProgress 12, learningEvents 19, lessonPlans 1, audioAssets 1. Selection: CONFIRMED_MATHEMATICAL_ERROR, TWO_SCHOOLS, LEARNER_HISTORY, FOUNDATIONAL_NUMERACY, LJHSCE_MATHEMATICS. Used in 2 schools (12 progress records and 19 learning events). It mis-defines a fraction, marks a correct method as an error, and never teaches its compare objective, the same pattern the G6 decimals pilot found.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · MATHEMATICAL | delivery.body §6 vocabulary | “Fraction: A numerical quantity that is not a whole number” | Fractions can equal whole numbers (4/4 = 1; 12/4 = 3, both in this lesson) and can be greater than 1. Define a fraction as a number that names equal parts of a whole, or a point on the number line. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D2 | BLOCKING · MATHEMATICAL | delivery.body §9 error 2 | “Incorrect Answer: (3/4)/(1/4) = 3/1 = 3 ... they omit the process of flipping the divisor” | Counting how many quarters are in three quarters is a correct method with a correct answer. Labelling it an error penalises understanding. Division of fractions is also outside the stated objectives. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D3 | MAJOR · CONCEPTUAL | delivery.body §4 | “2/1 ÷ 2 = 2/2 = 1 kg ... And he keeps the other kg: 2/2 = 1/1” | This conflates a fraction of the bag with kilograms. Half of the bag is 1/2 of 2 kg = 1 kg. Always name the whole the fraction refers to. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D4 | MAJOR · COVERAGE | objectives[2] vs body | “Compare and simplify fractions.” | Comparison is never taught. The lesson also jumps to unlike denominators and division without teaching equivalence first. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D5 | MINOR · CONTEXT | delivery.body §3–§15 | “1/2 a liter of palm oil ... a bag of palm oil that weighs 3 kilograms ... 1/4 kilogram packets” | Palm oil switches between litres and kilograms. Use one measure, consistently and realistically. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D6 | MINOR · ASSESSMENT | delivery.body §9 error 1; §17 exit ticket | “Incorrect Answer: 1/4 + 1/2 = 1/6; Boima buys 1/2 kg ... gifts 1/3 kg” | The sample error is not the common one (the typical error is 2/6). The exit ticket uses unlike denominators (1/2 − 1/3), which are outside the stated like-denominator objective. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |

**Learning objectives**

- `ft07-o1` (NF) Represent fractions, including fractions equal to or greater than 1, on area models and a number line, naming the whole each fraction refers to.
- `ft07-o2` (NF) Add and subtract fractions with like denominators, and with related denominators (e.g. halves, quarters, eighths), by using equivalent fractions.
- `ft07-o3` (LM) Compare and order fractions using benchmarks (0, 1/2, 1), common denominators and the number line, and justify each comparison.

**Prerequisite diagnostics**

- Recognises equal parts. Diagnostic: Which of these shapes shows quarters? (one unequal distractor) Fallback: A fold-and-share scene with a paper 'kanya' bar.
- Knows multiplication facts to 10 × 10. Diagnostic: Three quick facts. Fallback: A multiplication-facts practice scene.

**Conceptual depth and progression:** Diagnose equal parts and multiplication facts → Fractions of a named whole (area model) → The number line, including 1 and beyond → Equivalence by splitting parts → Adding and subtracting like denominators → Related denominators by equivalence → Comparison strategies → Guided practice with fading → Independent mixed problems → Transfer.

**Academic vocabulary:** fraction, numerator, denominator, unit fraction, equivalent fractions, improper fraction / mixed number, benchmark, number line, the whole.

**Liberian examples:** Sharing a cut of fufu or a kanya bar equally (reviewer to confirm the familiar items); Measuring rice with a standard cup; Lengths of lappa cloth in metres; A market price comparison using clearly invented prices.

**Visual and interactive teaching**

- A fraction-bar and number-line manipulative: split, shade and place fractions, and see equivalence by splitting. Offline: Paper strips folded into halves, quarters and eighths.
- A comparison tool: drag two fractions onto one number line. Offline: A printed number line from 0 to 2.

**Guided practice (fading):** Name the whole and the fraction for three pictures; Place 3/4, 4/4 and 5/4 on a number line; Add like denominators with bars; Add 1/2 + 1/4 by splitting halves; Compare with a benchmark, with a hint; Compare 3/4 and 2/3 using a common denominator, with feedback (rehearses the non-unit comparison assessed in ft07-a3).

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft07-a1` [ft07-o1] PRODUCED_ANSWER · KEYED: Place four fractions (including 1 and 5/4) on a number line.
- `ft07-a2` [ft07-o2] PRODUCED_ANSWER · KEYED: Four sums and differences, two with related denominators.
- `ft07-a3` [ft07-o3] REASONING_TASK · ANALYTIC_RUBRIC: Which is more rice: 2/3 of a cup or 3/5 of a cup? Justify in two ways.
- `ft07-a4` [ft07-o1, ft07-o2, ft07-o3] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft07-m1<br>`mc-math-fraction-add-numerators-and-denominators` | Add the numerators and the denominators (1/4 + 1/2 = 2/6). | Distractor 2/6 | The size of the parts doesn't change when you combine them. Make the parts the same size first. |
| ft07-m2<br>`mc-math-larger-denominator-larger-fraction` | A bigger denominator means a bigger fraction. | Compare 1/8 and 1/4 | More parts in the same whole means each part is smaller. |
| ft07-m3<br>`mc-math-fractions-always-less-than-one` | Fractions are always less than 1. | Number-line item including 5/4 | 5/4 is one whole and one more quarter. |
| ft07-m4<br>`mc-math-fraction-whole-not-named` | Losing track of the whole (a fraction of a bag versus kilograms). | 'Half of a 2 kg bag' item | Say what the whole is before writing the fraction. |
| ft07-m5<br>`mc-math-unequal-parts-as-fractions` | Unequal parts can be named as fractions. | Unequal-parts distractor | Fractions need equal parts. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): Place 3/2 on a number line; 1/2 + 3/8; Compare 5/6 and 7/8 with a reason.

**Transfer** (NEW context, ANALYTIC_RUBRIC): Two runners: one has finished 5/8 of a race and the other 2/3. Who is ahead? Explain using a number line.

**Optional extension** (non-gating): Find three fractions between 1/3 and 1/2 and explain the method.

**Teacher review criteria**

- The definitions are mathematically correct, and fractions ≥ 1 are included.
- No correct method is marked as an error.
- Every fraction names its whole, and units are consistent.
- The compare objective is taught and assessed.
- A correction notice is drafted for the 2 schools.

**MOE / WAEC:** MOE Mathematics Grade 7: fractions (structured binding required; the legacy code LR-MATH-G7_9-02 is unverified). LJHSCE Mathematics: number and numeration (evidence specificity LOW). Ceiling: Justified comparison and density (extension) go beyond exam procedure.

**Correction notice:** recommended. Learners were taught that fractions are never whole numbers, and that a correct method is an error. (The 2 classes in 2 schools with scheduled work.)

**Open decisions:** `OD-FT07-DIVISION` (OPEN): Remove division of fractions from this lesson? *Author recommends:* Yes. It belongs to a later lesson; keep only 'how many quarters' reasoning. `OD-FT07-BRIDGE` (OPEN): These objectives sit at about the Grade 3–5 level. Is this a Grade 7 bridge (remediation) lesson? *Author recommends:* Yes. Label it a Grade 7 bridge lesson for the fraction foundations Grade 7 work depends on, and add a Grade 7-level extension.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 5. Adopted into this version: D6 atypical sample error and out-of-scope exit item; Guided comparison of non-unit fractions added; OD-FT07-BRIDGE grade-fit decision opened. Reviewer says a correction notice is warranted: yes.

## 8. Understanding Place Value through Real-Life Money Management

`hero-math-g2-place-value-tens-and-ones` · revision `cmss946is039nvo54is10v1t4` · hash `78437ada896122fb…` · G2 MATH · unit `math-g2-1-number-sense-and-place-value` · published · B_INSTRUCTIONAL_REDESIGN · audit REVISE (0 blocking, 9 major)

Dependencies (counts): scheduledWork 1, scheduledWorkClasses 1, scheduledWorkSchools 1, studentProgress 1, learningEvents 13, audioAssets 1. Selection: GRADE_FIT_FAILURE, ILL_POSED_ITEMS, EMERGENT_NUMERACY, PUBLISHED_HERO, GRADE_BAND_1_3. The only live early-grade math lesson with scheduled work. It gives 7-year-olds 3,514 words at a Grade 10 reading level, opens with an unresolved currency conversion, and its practice items cannot be answered as written.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | BLOCKING · GRADE_FIT | delivery.body | “3514 learner-facing words; Flesch-Kincaid grade 10” | Emergent readers need picture-led, narrated scenes. The budget is 1,200 words or fewer at a Grade 1–2 readability band. | MECHANICAL_AUDIT_CONFIRMED | — |
| D2 | MAJOR · SCOPE | delivery.body §1 | “Boima had LD$250 and US$20 ... US$1 was roughly equal to LD$200” | The hook poses a four-digit currency conversion (US$20 × 200 + 250 = LD$4,250) that the lesson never resolves and that is beyond Grade 2. It also states an unlabelled, time-sensitive exchange rate. | AUTHOR_COMPUTED | — |
| D3 | MAJOR · SCOPE | delivery.body §3, §4 | “15 × 10 = 150; 14 tens × 10 kilograms = 140 kilograms; '1' in 125 designates the hundreds place” | The objectives are two-digit numbers, but the lesson uses multiplication and three-digit numbers, and calls 143 '14 tens' without teaching regrouping or the hundreds place. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D4 | MAJOR · ASSESSMENT | delivery.body §11, §15, §17 | “sells all the tens; sells half of the tens [56]; sell the equivalent of the number of tens [54]” | These items are ambiguous or ill-posed (5 tens cannot be halved into whole bundles; 'the equivalent of the number of tens' has no single reading). Every item needs exactly one defensible answer. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D5 | MINOR · AUDIENCE | delivery.body §12 | “Encourage students to consider what happens if the price changes.” | Teacher-facing prose sits in the learner text; move it to the teacher view. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D6 | MAJOR · ASSESSMENT | assessment.problemSets PLACE_VALUE; gp3 | “[ANSWER_START:PLACE_VALUE] ... inside studentPrompt; 'what is each cloth worth if the total cost in LD$ is proportional to quantity?'” | All 12 problem sets carry keys, so the committed audit's 'unkeyed' finding is wrong (an auditor calibration issue for #195). The real defects: the PLACE_VALUE answer is embedded in the learner prompt (key leakage), and gp3 is unanswerable because no price is given, so its key invents LD$1 per cloth. Keys belong only in the protected projection. | AUTHOR_VERIFIED_CORRECTING_MECHANICAL_AUDIT | — |

**Learning objectives**

- `ft08-o1` (NF) Make and read two-digit numbers (to 99) as tens and ones, using bundles of 10 sticks, a place-value mat and drawings.
- `ft08-o2` (NF) Say the value of each digit in a two-digit number (in 47 the 4 means 4 tens, or 40), and explain why 47 and 74 are different.
- `ft08-o3` (LM) Compare two two-digit numbers by looking at the tens first, and explain the choice.

**Prerequisite diagnostics**

- Counts objects to 20 with one-to-one correspondence. Diagnostic: Count 14 bottle caps in a picture (audio prompt). Fallback: A count-and-touch scene with narration.
- Recognises a group of 10. Diagnostic: Which picture shows ten sticks? Fallback: A 'make a ten' bundling scene.

**Conceptual depth and progression:** Diagnose counting and recognising ten (audio) → Bundle sticks into tens → Tens and ones on a mat → Write the number from the mat → Value of each digit → Reversal contrast (47 versus 74) → Compare using tens first → Guided practice with fading → Independent mat and picture tasks → Transfer to a new collection.

**Academic vocabulary:** ten, one, bundle, digit, tens place, ones place, more than / less than.

**Liberian examples:** Bundling broom sticks or palm-frond sticks in tens; Counting bottle caps or seeds; LD$10 notes as an optional money link only after the bundle model (reviewer to confirm the denominations in circulation).

**Visual and interactive teaching**

- A bundling animation: loose sticks gather into a ten bundle, narrated in English with text kept minimal. Offline: Real sticks with rubber bands or string.
- A tap-to-build place-value mat: add a ten or a one and the numeral updates and is read aloud. Offline: A printed tens/ones mat and counters.

**Guided practice (fading):** Build 23 on the mat with prompts; Write the number shown by bundles; Choose between 47 and 74 with audio feedback; Compare 38 and 52 with a tens-first hint.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 60%; keys never shown to learners)

- `ft08-a1` [ft08-o1] PRODUCED_ANSWER · KEYED: Show 36 on the mat, then write the number shown by a picture (5 tens and 9 ones).
- `ft08-a2` [ft08-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: Tell (spoken or drawn) what the 6 means in 61 and in 16.
- `ft08-a3` [ft08-o3] REASONING_TASK · ANALYTIC_RUBRIC: Which is more, 49 or 52? Show why using bundles.
- `ft08-a4` [ft08-o1, ft08-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four picture items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft08-m1<br>`mc-math-digit-face-value` | A digit has its face value wherever it sits (the 4 in 47 is 4). | Value item | This 4 is 4 bundles of ten, which is 40. |
| ft08-m2<br>`mc-math-two-digit-reversal` | Reversing digits (writing 74 for 47). | Reversal distractor | Tens are written first, on the left. |
| ft08-m3<br>`mc-math-number-words-written-digit-by-digit` | Writing 'forty-seven' as 407. | Write-the-number item | 4 tens and 7 ones is written 47. |
| ft08-m4<br>`mc-math-tens-count-as-value` | Saying '40 tens' for 40. | Mat item | 40 is 4 tens. |
| ft08-m5<br>`mc-math-compare-by-ones-digit` | Comparing by the ones digit (49 > 52 because 9 > 2). | Compare item | Compare the tens first: 5 tens is more than 4 tens. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): Build a two-digit number on the mat; The value of a tens digit; Compare two numbers.

**Transfer** (NEW context, KEYED): A picture of 63 seeds scattered on a mat: circle groups of ten and write how many seeds there are.

**Optional extension** (non-gating): Labelled 'next step': what happens when you have 10 bundles of ten? (introduces 100)

**Teacher review criteria**

- Learner text is 1,200 words or fewer at an emergent-reader level, narration is present for every scene, and pictures carry meaning.
- Every item has exactly one defensible answer.
- Money is used only after the bundle model, with current denominations.
- A teacher guide for running the activity with real sticks is included.

**MOE / WAEC:** MOE Mathematics Grade 2: number and place value (structured binding required; the legacy codes include an unrelated time-telling code). Not applicable. Ceiling: Reasoned comparison is mastery-level.

**Correction notice:** not required. No retractable fact. The redesign addresses grade fit. (Teacher of the scheduled class.)

**Open decisions:** `OD-FT08-LANGUAGE` (OPEN): Should narration include a Liberian English or local-language option for emergent readers? *Author recommends:* Yes, as an accessibility option, once a reviewed audio pipeline exists. It does not block acceptance.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 5, DISPUTED 1. Not confirmed: D6 (The legacy assessment.problemSets has 12 entries, and every one has a non-empty answerKey, including the two end-of-lesson items (ids '1' and '2': '2 tens and 9…). Adopted into this version: D6 restated: keys exist; key leakage in PLACE_VALUE prompt; gp3 unanswerable (corrects the mechanical audit). Reviewer says a correction notice is warranted: no.

## 9. Reading Comprehension: Main Idea

`wk_mca7a_mon_p2` · revision `cmss8pj580003vo54iiun3f8s` · hash `d1767e29c8cac4c2…` · G7 LITERACY · no unit · APPROVED · B_INSTRUCTIONAL_REDESIGN · audit REVISE (0 blocking, 11 major)

Dependencies (counts): scheduledWork 1, scheduledWorkClasses 1, scheduledWorkSchools 1, studentProgress 13, lessonPlans 1. Selection: DIVERGENT_DELIVERY_VERSIONS, INVALID_ANSWER_KEY, FOUNDATIONAL_LITERACY, ASSIGNED_TO_STUDENTS, LEARNER_HISTORY, LJHSCE_ENGLISH. A core reading-comprehension skill with 13 learners in progress. The same revision carries two different lessons (body and bodyBlock), and its key accepts a detail that does not support the main idea.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | MAJOR · DELIVERY_INTEGRITY | delivery.body vs delivery.bodyBlock | “Direct Instruction (15 minutes) vs Direct Instruction (20 minutes) + Lab or Activity + a different independent passage” | One revision holds two different learner lessons, so what a learner sees depends on the format. The candidate must have a single learner text, and the legacy mapping plan must record both variants. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D2 | MAJOR · ASSESSMENT | delivery.body Answer Key | “Main Idea: The Bomi County rainforests are important for wildlife and ecosystems. Supporting Details: Home to diverse wildlife, and conservation efforts are underway.” | 'Conservation efforts are underway' does not support the stated main idea. The key teaches the wrong idea of what a supporting detail is. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D3 | MAJOR · CONTEXT_EVIDENCE | delivery.body examples and passages | “palm oil is a major export for the country; rice production has increased significantly over the last few years” | Reading passages state unsourced claims as fact. Every passage must be either sourced or labelled as an authored example. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D4 | MAJOR · CONCEPTUAL_DEPTH | delivery.body Direct Instruction | “69 words of concept explanation; 'look for keywords and phrases'” | Topic versus main idea, implied main ideas and a test for whether a detail supports the main idea are all missing. | MECHANICAL_AUDIT_CONFIRMED | — |
| D5 | MAJOR · ASSESSMENT | delivery.body and delivery.bodyBlock Answer Keys; Closing; bodyBlock Lab (Kofi) | “For your exit ticket, write down one thing you learned today” | The answer key is printed to learners, and the exit ticket is not evidence of either objective. The lab refers to a story about 'Kofi' whose text is never supplied. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D6 | MAJOR · CONCEPTUAL | delivery.body and bodyBlock Direct Instruction; Guided Practice teacher note | “the main idea is about the significance of the river in local life; (Accept answers highlighting improved rice production techniques.)” | The legacy itself states topics where main ideas are required, teaching the topic/main-idea conflation the new lesson targets (ft09-m2). Every model main idea must be a complete claim. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |

**Learning objectives**

- `ft09-o1` (NF) Distinguish the topic from the main idea, and state the main idea of a short informational paragraph in one complete sentence.
- `ft09-o2` (NF) Choose the details that support a main idea, reject details that do not, and explain why.
- `ft09-o3` (LM) Infer an implied main idea, one that no sentence states, and justify it with two details.

**Prerequisite diagnostics**

- Reads a Grade 6-level paragraph with literal comprehension. Diagnostic: Two literal questions on a 60-word paragraph. Fallback: A read-aloud version with vocabulary support, then the same questions.
- Knows what a sentence is. Diagnostic: Is this a complete sentence? (2 items) Fallback: A short sentence/fragment scene.

**Conceptual depth and progression:** Diagnose literal comprehension → Topic (a word) versus main idea (a sentence) → The 'umbrella' test: does every detail fit under it? → Stated main idea in different positions (first, middle, last) → Implied main idea → Guided practice with fading → Independent constructed responses → Transfer to a new genre.

**Academic vocabulary:** topic, main idea, supporting detail, stated / implied, infer, evidence, paragraph.

**Liberian examples:** Authored paragraphs (labelled as such) about a Liberian market day, a community clean-up and a school sports day; A sourced short text about a Liberian place or event (reviewer-approved source).

**Visual and interactive teaching**

- An 'umbrella' organiser: drag details under or outside a main-idea umbrella, with feedback on why a detail doesn't fit. Offline: A printed organiser and detail strips.
- Highlight mode: learners highlight the evidence sentence, with keyboard and screen-reader support. Offline: Underline on paper.

**Guided practice (fading):** Topic or main idea? Sort six statements; Stated main idea in the last sentence, with a hint; Reject a non-supporting detail with feedback; Implied main idea with a sentence frame.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 50%; keys never shown to learners)

- `ft09-a1` [ft09-o1] CONSTRUCTED · ANALYTIC_RUBRIC: Write the main idea of a new 90-word paragraph in one sentence.
- `ft09-a2` [ft09-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: Two details are given; one does not support the main idea. Identify it and explain why.
- `ft09-a3` [ft09-o3] REASONING_TASK · ANALYTIC_RUBRIC: A paragraph with an implied main idea: state it and cite two details.
- `ft09-a4` [ft09-o1, ft09-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft09-m1<br>`mc-literacy-first-sentence-is-main-idea` | The first sentence is always the main idea. | A paragraph whose main idea comes last | Check every sentence against the umbrella test. |
| ft09-m2<br>`mc-literacy-main-idea-is-topic` | The main idea is the topic (one word). | Topic distractor | The main idea says something about the topic, in a sentence. |
| ft09-m3<br>`mc-literacy-vivid-detail-is-main-idea` | The most interesting detail is the main idea. | Vivid-detail distractor | A detail supports the main idea; it does not cover the whole paragraph. |
| ft09-m4<br>`mc-literacy-main-idea-lists-details` | The main idea lists every detail. | Summary-list distractor | The main idea is the one point all the details support. |
| ft09-m5<br>`mc-literacy-any-related-detail-supports` | Any related detail counts as support. | Item ft09-a2 | A supporting detail gives a reason or an example for the main idea. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): The main idea of a new paragraph; Reject a non-supporting detail; Topic versus main idea.

**Transfer** (NEW context, ANALYTIC_RUBRIC): A short community radio announcement script, a genre not rehearsed in the lesson: state its main idea and two supporting details.

**Optional extension** (non-gating): Write a 4-sentence paragraph with an implied main idea; a partner infers it.

**Teacher review criteria**

- One learner text only; the legacy variants are recorded in the mapping plan.
- Every passage is sourced or labelled as authored, and every factual claim in a passage is true.
- Every key's supporting details actually support its main idea.
- The analytic rubric has anchors for complete-sentence main ideas.

**MOE / WAEC:** MOE Language Arts Grade 7: reading comprehension (structured binding required; the legacy row has no claims). LJHSCE English Language: comprehension (evidence specificity LOW). Ceiling: Implied main idea and genre transfer go beyond literal exam comprehension.

**Correction notice:** not required. No major false fact, but teachers should be told that the key's 'supporting detail' was invalid. (Teacher of the scheduled class.)

**Open decisions:** `OD-FT09-VARIANTS` (OPEN): Which legacy variant (body or bodyBlock) did learners actually receive? *Author recommends:* Determine it from the lessonFormat and the delivery logs before writing the mapping plan; record both.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 5. Adopted into this version: D5 location: Kofi lab is in bodyBlock; D6 legacy teaches topic/main-idea conflation. Reviewer says a correction notice is warranted: no.

## 10. Understanding Vocabulary in Context Through West African Stories

`hero-english-g7-vocabulary-in-context-reading-west-african-texts` · revision `cmss94i4b03c7vo54sblilk60` · hash `d224500e4e008f50…` · G7 ENGLISH · no unit · published · B_INSTRUCTIONAL_REDESIGN · audit REVISE (0 blocking, 12 major)

Dependencies (counts): scheduledWork 27, scheduledWorkClasses 1, scheduledWorkSchools 1, studentProgress 1, learningEvents 1. Selection: CONFIRMED_CULTURAL_FACTUAL_ERROR, AUTHORING_ARTIFACTS_IN_LEARNER_TEXT, MOST_SCHEDULED_ENGLISH_LESSON, PUBLISHED_HERO, LJHSCE_ENGLISH. The only English lesson with scheduled work (27 rows). It promises West African texts but supplies none: its 'West African' tales have tigers, foxes and cobblestone streets. Authoring word-count instructions such as '(600+ words)' appear in learner headings.

**Current deficiencies and factual corrections**

| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |
|---|---|---|---|---|---|---|
| D1 | MAJOR · CULTURAL_FACTUAL | delivery.body §4, §7 | “an audacious tiger ... The cunning fox ... Liberian folktale; a 'quaint' village ... cobblestone streets” | Tigers are not native to Africa, and foxes are not animals of Liberia's forests. 'Cobblestone streets' is European imagery. Use authentic or carefully authored West African material, such as Liberian Spider trickster tales, and attribute Anansi to Akan (Ghanaian) tradition. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D2 | MAJOR · COVERAGE | objectives[0] vs body | “Identify and understand vocabulary in context within West African texts” | No West African text appears; every example is a single invented sentence. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D3 | MAJOR · AUTHORING_ARTIFACT | delivery.body headings | “## 1. Hook — The Real-World Challenge (300+ words); ## 7. Worked Example 1 — Standard Method (600+ words)” | Generator length instructions are visible to learners. The mechanical audit does not catch this; add a check. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D4 | MAJOR · CONCEPTUAL | delivery.body §8 'Try this Out' | “With fervor akin to a hunted deer” | A hunted deer suggests fear, not fervour, so the example contradicts the target meaning. The false mnemonic 'inferring — in-fuse' must also go. | AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM | — |
| D5 | MAJOR · GRADE_FIT | delivery.body | “Flesch-Kincaid grade 13.5; largest section 1671 words” | Rewrite to the Grade 7 band, one idea per scene. Choose high-utility Tier 2 target words, not low-utility ones like 'ballyhoo'. | MECHANICAL_AUDIT_CONFIRMED | — |
| D6 | BLOCKING · ASSESSMENT | assessment.problemSets (skulk, cacophony, ballyhoo, spartan, quaint, pomp) | “studentPrompt: 'Pewee should focus on the stealth implied by the word "shadows" ...'; answerKey: ''” | All 6 structured items have empty keys, and their learner prompts are the model answers. The live lesson has no valid assessment. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |
| D7 | MAJOR · STRUCTURE | delivery.body | “(body ends at '9. Error Analysis (250+ words)')” | The learner text stops after Error Analysis: there is no guided practice, independent practice, assessment or closing, and section 5 is missing. | ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED | — |

**Learning objectives**

- `ft10-o1` (NF) Use four kinds of context clue (definition or restatement, synonym, contrast, example) to infer the meaning of unfamiliar Tier 2 words in a West African passage.
- `ft10-o2` (NF) Check an inferred meaning by substituting it into the sentence and confirming it with a dictionary or glossary.
- `ft10-o3` (LM) Explain how a word's connotation shapes the meaning or tone of a passage, with evidence.

**Prerequisite diagnostics**

- Identifies nouns, verbs and adjectives in a sentence. Diagnostic: Two quick part-of-speech items. Fallback: A parts-of-speech refresher scene.
- Uses a dictionary or glossary entry. Diagnostic: Find the meaning in a glossary snippet. Fallback: A glossary-reading scene.

**Conceptual depth and progression:** Diagnose parts of speech and glossary use → Why context matters (one word, two meanings) → Clue types one at a time, each with signal words → Substitution check → Connotation (bold versus reckless) → Guided passage work with fading → Independent passage → Transfer to a new genre.

**Academic vocabulary:** context, context clue, signal word, synonym, antonym, restatement, infer, connotation, Tier 2 word.

**Liberian examples:** A Liberian Spider trickster tale (a public-domain or licensed version, or one authored and reviewed for cultural accuracy); An excerpt by a West African author, subject to the licensing decision; A notice-board text from a Liberian school (authored and labelled).

**Visual and interactive teaching**

- A clue-finder: tap the clue words in a passage and choose the clue type, with feedback naming the signal word. Offline: A printed passage; learners underline clue words and label the type.
- A substitution checker: type an inferred meaning and the sentence is reread with it, and the learner judges the fit. Offline: A partner read-aloud check.

**Guided practice (fading):** One clue type per sentence, with signal words highlighted; A short passage with highlighting removed; A connotation pair with a hint; Glossary confirmation.

**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ 50%; keys never shown to learners)

- `ft10-a1` [ft10-o1] CONSTRUCTED · KEYED: Infer the meanings of four words in a new 150-word passage and name the clue type for each.
- `ft10-a2` [ft10-o2] CONSTRUCTED_EXPLANATION · ANALYTIC_RUBRIC: Show the substitution check for one word and say whether the inferred meaning fits.
- `ft10-a3` [ft10-o3] ORIGINAL_WRITING · ANALYTIC_RUBRIC: Write 3–4 sentences explaining how replacing one word in the passage with a near-synonym changes its tone.
- `ft10-a4` [ft10-o1, ft10-o2] SELECTED_RESPONSE_DIAGNOSTIC · KEYED: Four items whose distractors are mapped to M1–M5.

**Misconception detection**

| | Misconception | Probe | Corrective feedback |
|---|---|---|---|
| ft10-m1<br>`mc-english-nearby-word-defines-target` | Any nearby word defines the target. | A distractor taken from a non-clue word | Find the signal word that links the clue to the target. |
| ft10-m2<br>`mc-english-single-clue-no-check` | One clue is enough, so there is no need to check. | Item ft10-a2 | Substitute the meaning and reread. |
| ft10-m3<br>`mc-english-context-clues-are-guessing` | Context clues are guessing. | A justification item | An inference must point to evidence in the text. |
| ft10-m4<br>`mc-english-contrast-signal-ignored` | Ignoring contrast signals ('but', 'unlike') and inferring the opposite meaning. | A contrast-sentence distractor | 'But' signals the opposite of what came before. |
| ft10-m5<br>`mc-english-synonyms-identical-connotation` | Synonyms always have exactly the same meaning and tone. | A connotation item | 'Bold' and 'reckless' are close in meaning but differ in tone. |

**Retention** (≥ 7 days, policy `ll-aep-001-retention-pilot@1.0.0`): Two words in a new sentence, each with its clue type; A contrast clue; A connotation pair.

**Transfer** (NEW context, KEYED): A health notice (authored and labelled) with three unfamiliar words: infer each meaning and say which clue helped.

**Optional extension** (non-gating): Find a word in a Liberian newspaper or radio script whose meaning you inferred from context, and record the sentence and source.

**Teacher review criteria**

- Texts are authentically West African, or authored and reviewed for cultural accuracy, and licensing is recorded.
- No authoring instructions or word-count markers remain in learner text.
- Target words are high-utility Tier 2 words with a rationale.
- Every example sentence actually supports the target meaning.

**MOE / WAEC:** MOE Language Arts Grade 7: vocabulary development (structured binding required; the legacy row has no claims). LJHSCE English Language: vocabulary in context (evidence specificity LOW). Ceiling: The connotation writing task is mastery-level.

**Correction notice:** recommended. Learners were told that tigers and foxes are characters of West African and Liberian tales, and they were given an assessment whose prompts are its answers. (Teacher of the scheduled class (27 scheduled-work rows).)

**Open decisions:** `OD-FT10-LICENSING` (OPEN): May excerpts from living West African authors be used? *Author recommends:* Not until a licensing decision is made. Until then, use public-domain or LiberiaLearn-authored texts that a Liberian reviewer has checked.

**Advisory review** (blind, AI, does not count as independent): CONFIRMED 5. Adopted into this version: D6 all 6 structured items have empty keys and answer-prompts; D7 lesson body ends at Error Analysis; Correction notice now recommended. Reviewer says a correction notice is warranted: yes.

## Source registry (accessed 2026-10-17)

| Id | Authority | Source |
|---|---|---|
| SRC-LR-CONST-1986 | HIGH · PRIMARY_LAW | [Constitution of the Republic of Liberia (1986), English text](https://www.constituteproject.org/constitution/Liberia_1986), Constitute Project |
| SRC-US-OOH-LIBERIA | HIGH · OFFICIAL_GOVERNMENT_HISTORY | [Milestones: 1830–1860 — Founding of Liberia, 1847](https://history.state.gov/milestones/1830-1860/liberia), US Department of State, Office of the Historian (archived page) |
| SRC-LVA-ROBERTS | HIGH · INSTITUTIONAL_ARCHIVE | [Joseph Jenkins Roberts](https://uncommonwealth.lva.virginia.gov/blog/2026/03/18/joseph-jenkins-roberts/), Library of Virginia, The UncommonWealth (2026-03-18) |
| SRC-EBSCO-CUFFE | MEDIUM · REFERENCE_WORK | [Paul Cuffe (Research Starters)](https://www.ebsco.com/research-starters/history/paul-cuffe/), EBSCO |
| SRC-WP-COUNTIES | MEDIUM · ENCYCLOPEDIA_SECONDARY | [Counties of Liberia](https://en.wikipedia.org/wiki/Counties_of_Liberia), Wikipedia |
| SRC-WP-NIMBA | MEDIUM · ENCYCLOPEDIA_SECONDARY | [Nimba County](https://en.wikipedia.org/wiki/Nimba_County), Wikipedia |
| SRC-WP-BENSONVILLE | MEDIUM · ENCYCLOPEDIA_SECONDARY | [Bensonville (Bentol)](https://en.wikipedia.org/wiki/Bensonville), Wikipedia |
| SRC-ENCYC-MONROVIA | MEDIUM · REFERENCE_WORK | [Monrovia](https://www.encyclopedia.com/places/africa/liberian-political-geography/monrovia), Encyclopedia.com |
| SRC-WP-MONROVIA | MEDIUM · ENCYCLOPEDIA_SECONDARY | [Monrovia](https://en.wikipedia.org/wiki/Monrovia), Wikipedia |
| SRC-BANKNOTEWORLD-LRD | LOW · COLLECTOR_SECONDARY | [Liberian banknote history](https://www.banknoteworld.com/blog/liberian-banknote-history/), Banknote World |
| SRC-WP-LEGISLATURE | MEDIUM · ENCYCLOPEDIA_SECONDARY | [Legislature of Liberia](https://en.wikipedia.org/wiki/Legislature_of_Liberia), Wikipedia |
| SRC-WP-GRANDKRU | MEDIUM · ENCYCLOPEDIA_SECONDARY | [Grand Kru County](https://en.wikipedia.org/wiki/Grand_Kru_County), Wikipedia |

Not yet obtained:

- A Government of Liberia (Ministry of Internal Affairs or LISGIS) list of county capitals. No official list was retrievable on 2026-10-17, and the county-capital corrections rest on consistent secondary sources until a reviewer attaches one.
- National Elections Commission confirmation of the current number of House electoral districts (73).

## Prohibited by this contract

Publication, approval or acceptance by the author, production lesson edits, ledger events without an authorized actor, learner-data writes, historical overwrite, official grade or mastery changes, bulk rewriting before this contract is agreed.
