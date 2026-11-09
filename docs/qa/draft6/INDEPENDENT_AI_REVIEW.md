# Independent AI review of draft.6

Review date: 2026-10-22. Reviewer: independent Chief of Staff AI agent, separate from the revising executor. No human subject-expert review occurred. This report recommends corrections and records evidence. It grants no academic approval, rights clearance, MOE alignment, ontology approval, or release authority.

## Review scope and initial findings

Read all six candidates, academic-review sidecars, objective bindings, numerical keys, feedback, complete packet structure, source references, preview plan, and factory validators. Rasterized and visually inspected the science and civics SVGs independently. No package files were edited by this reviewer.

These findings apply to the initial uncommitted preseal bytes identified below. The executor was notified before sealing; any corrected bytes require a separate exact-hash follow-up.

| ID | Finding | Required response |
| --- | --- | --- |
| SCI-1 | Science objective ft04-o1 promises arrangement, movement, shape and volume for all three states. Initial instruction does not explain gas motion or gas shape/volume and does not teach fixed solid/liquid volume. The state-properties check tests only solid/liquid shape. | Teach the complete comparison and require a learner response covering the missing properties. Reference those actual tasks in objective coverage. |
| SCI-2 | Objective ft04-o2 includes freezing. Its energy direction is stated but no task requires applying it. | Add practice requiring energy release during freezing, including its relationship to melting. |
| FRA-1 | The 0.42-exact distractor receives the generic prefix that the learner changed piece size. The error here is confusing rounded approximation with exact equality. | Give a rounding-specific diagnosis and correction. |
| CIV-1 | Maryland label 10 touches its western boundary in the rendered SVG. The fallback label algorithm chooses a polygon vertex if the vertex mean is outside. | Choose an interior location with clearance from the boundary, then inspect both map copies. |
| ENG-1 | The closed evidence question asks for forms of help and actions without explicitly specifying families. A distractor also names pupil actions. Earlier prose supplies context, but the closed question can be more precise. | Explicitly ask which sentence names the different ways families help. |
| UX-1 | Initial student-visible fraction/civics prose describes frontend contracts, T1 integration and the old schematic. These are review concerns, not instruction. | Move implementation status to reviewer sidecars and the handoff. |
| ACC-1 | The generic county-map SVG description names no relative county positions or coastal relationships. A county register is not a spatial equivalent for a nonvisual learner. | Require an accessible spatial alternative and runtime review in the T1 handoff. Do not infer geographic mastery from recall or an inaccessible image. |

The automated objective validator verifies referenced IDs exist; it cannot establish that every clause of an objective is taught and practised. SCI-1 and SCI-2 are concrete counterexamples to interpreting a passing binding check as academic coverage certification. Per-scene tagging of every objective also inflates practice totals; the explicit content bindings and task wording should guide academic decisions.

## Academic checks that passed inspection

- Geometry uses new values for guided and independent practice. All triangle side lengths agree with the supplied perpendicular heights. Area/perimeter keys and the doorway transfer answers are correct. Feedback distinguishes boundary, coverage and perpendicular height.
- Fractions use exact fractions as primary answers, accept unreduced equivalents, distinguish finite exact decimals from rounded approximations, and explicitly request nearest-hundredth rounding for the seed task. The tasks now cover improper fractions, equal wholes, number lines, comparison, addition and subtraction. Existing choices and written responses do not purport to provide integrated typed rational marking. T1 integration remains a release blocker.
- Multiplication includes genuine two-digit by two-digit worked, guided, independent and transfer tasks. The four partial products, numeric totals, omitted-cross-product diagnostics and chair reservation answer are arithmetically correct.
- Science heat intervals independently recompute as 21, 334, 418, 2256 and 20 kJ for the declared one-kilogram model. The plot and SVG preserve proportional horizontal energy intervals and show melting and boiling plateaus at the declared fixed-pressure values. State coexistence is explained; heat and time are distinguished. The explanation preserves molecular identity, distinguishes energy used in phase changes from average kinetic energy, and explains evaporation below boiling. The diagram is an illustrative model with stated assumptions, not measured data or an unsafe heating procedure. Its physical account agrees with [OpenStax phase-change instruction](https://openstax.org/books/physics/pages/11-3-phase-change-and-latent-heat).
- Civics uses actual coordinate-derived county outlines, not an arbitrary grid. All fifteen county-capital pairs and the Bensonville/Bentol variant were checked against the [PCGN government administrative table](https://assets.publishing.service.gov.uk/media/5a81506ee5274a2e87dbcf2e/Liberia_Administrative_Divisions.pdf), pages 1–5. Spatial reasoning is separated from capital recall; the lesson does not invent roads or capital-point coordinates. The table is dated 2015, and the boundary representation is dated 2021; these are documented source dates, not claims of a new 2026 government survey.
- English uses an original informational explanation matching the stated genre. Written evidence and paragraph tasks permit defensible alternatives. Consequences may support consequence claims; the closed selection concerns explicitly stated actions. Contextual vocabulary work requires an explanation and fresh sentence rather than displaying a glossary answer.

## Source, rights and packet evidence

The [live geoBoundaries publisher metadata](https://www.geoboundaries.org/api/current/gbOpen/LBR/ADM1/) independently identifies 15 county features, represented year 2021, UNMIL/OCHA ROWCA provenance and CC BY 3.0 IGO. Local raw geometry SHA-256 is `f6f4ed18e1e29532a77325f7af84a6dacc4489d94020f2fa2a8feb12a4da9b34`, matching the documented pin. The SVG retains source attribution, license URL, modification notice and a no-endorsement statement. Independent rights release review remains pending. The LISGIS document was not independently retrieved in this review and is not needed as the sole support for the county-capital table.

The JSON packet contains each complete candidate, student-visible projection, visual teaching data, paper alternative, academic guidance, manifest and SVG text. It explicitly records no human subject-expert review. Formative answers are review material, and the packages do not include governed assessment items. The reviewer recomputed every initial manifest file hash with Node crypto and found zero mismatches across all six packages. Candidate semantic hashes and candidate file-byte hashes are distinct identities and should not be conflated.

The controlled preview plan is disabled, has no eligible hashes, permits no canonical record writes and permits no published-lesson replacements. All packages remain reviewer-only with approval/release flags false. Source/rights, access, accessibility, safety and exact-version authorization remain gates.

## Initial preseal identities

All versions in this table are `4.0.0-draft.6`. These bytes require correction and are not approved for student access.

| Lesson | Candidate semantic SHA-256 | Package hash |
| --- | --- | --- |
| Geometry | `e7680a05c7804009443063cc602beb9af5c355df132380b2a405494a01506965` | `8bb14522ec5ce0bc2dcca5a18f69f99e2d6a80fa3bb5b6f99f8dfb5fc89c6181` |
| Fractions | `4955837c3bf7f35525632dcea675bf60fdc52bfc8cf22f70c5ea268912a7652e` | `ad93d5c401c4421429405b28dae7c66f3fe78f1b0c1acca13bc566403017a957` |
| Multiplication | `ed0a518f060509276607c67910fdc00513a9793f6cf7dedadcd2dbbe5dadbe9a` | `48383081f60208f5e04abb0f1335d1f7aa353791a9bfa834f2945549d0a42ce2` |
| Science | `c9d78d446a9df5488d5c64a358399bd131b680a8cc1c94c047a2a0b1cdd19368` | `1f1a219c10b6a4465bd0b9cd37896438bf6f74b659e70b51ef1471884a2c06c3` |
| Civics | `8effddc6288c523bea7cd7ea65ba244defdf6b95a30b020576dd3189c7fe5a94` | `8f897b78526bd07612194672ebe7e99d9a1ab6fd58f6eb16808b3133872f19a8` |
| English | `83e5b97e024214519890acb19a55aecaece328e1e47114b9545edec3fd6147d2` | `2cd368f5fb798bbc9810e51ed8bf99eaf12e860f19e3e644d09c0763510058b2` |

## Accepted main deployment and access verification

Read-only Vercel inspection independently confirmed production deployment `dpl_4izp3gLVQibvKHck14RKadjLvM8F` READY with main commit `e5d89c34f421f028428cf9e4230ab3d40ff45536`, attached to `liberia-learn.vercel.app`. GitHub combined status reported Vercel success. No deploy, environment mutation, database write or promotion was performed.

At 2026-10-22T16:42:24–25Z, direct Node fetch requests returned:

| Path | Result |
| --- | --- |
| `/api/healthz` | HTTP 200; status and database ok |
| `/api/health` | HTTP 200; healthy; database and migrations ok |
| `/lab-review/v4-lessons` | HTTP 404; private, no-store; Vary Cookie |
| `/lab-review/v4-lessons/factory-g7-math-area-perimeter` | HTTP 404; private, no-store; Vary Cookie |

Source inspection confirms prototype access is disabled in production and on Vercel before session lookup. Enabled local review additionally requires national reviewer read scope. Live authenticated reviewer requests were not attempted without a session. Behavioral tests cover denial even for signed reviewers in production and on Vercel.

Independent focused rerun: `npx.cmd vitest run __tests__/security/candidate-review-access.test.ts __tests__/content-factory-v4/review-loader.test.ts --reporter=dot`. Result: two files and 29 tests passed.

## Recommendation

Repair the findings, retain preseal evidence, review the corrected exact hashes, and submit the complete packet to the founder's academic reviewer. Keep all six candidates disabled. Student access still requires the exact-version release decision and the pending rights, access, accessibility, safety and applicable T1 runtime work. This report is independent AI review only.

## Provisional correction review

The executor supplied revised preseal content for a second independent inspection. Final package hashes have not yet been checked because a source-pin reseal is pending.

- SCI-1 is closed for content: three particle-property checks teach solid, liquid and gas arrangement, movement, shape and volume, followed by an independent comparison prompt. Reviewer guidance accepts accurate alternative explanations and explicitly explains water's open ice structure.
- SCI-2 is closed: the freezing-energy check requires energy leaving the water and explains freezing as the reverse of melting.
- FRA-1 is closed: the seed-remainder distractor now specifically diagnoses treating a rounded estimate as exact equality.
- CIV-1 is closed at native SVG scale: a second independent rasterization shows Maryland 10 clearly inside its county, and the other county labels also have interior clearance. Dataset URL and pinned upstream commit are retained in SVG metadata. Small-screen legibility remains a runtime accessibility check.
- ENG-1 is closed: the evidence question explicitly asks for the different ways families help and the family actions.
- UX-1 is closed in the cited fraction/civics scenes: integration status prose has been removed from student-visible instruction.
- ACC-1 remains open for the T1 accessible spatial alternative and runtime verification. These content fixes do not authorize student access.

Provisional candidate semantic hashes observed: science `5e67edd36ec5b3e0ef29be65dee3ab2e08e1f7cccf17209e4e689492eaae2126`, fractions `78cfaf819d4f3c3d767299571d4a5238af57abc3a2b88a496044b0fc6799cd22`, civics `ea3ff95feafe3aee979e0a906581dbfdbab5044abf5c2bb742fd97fccda9215b`, English `500ab78193c6ffee7a6afdf6af7ced250d9d362abba2bcd71c14f26fdd0cb9b5`. These are observations of the corrected content, not final package certification.

Provisional focused rerun of `__tests__/content-factory-v4/draft6.test.ts` passed 30 tests and failed one source-pin assertion for `assets.ts`. This occurred during the executor's disclosed source-pin reseal. The final rerun and package review below supersede this provisional validation result.

## Final exact-version verification

After the executor announced the final seal, this reviewer independently recomputed all source/candidate input pins, all package file digests, every file digest in the batch receipt, six semantic candidate hashes and six domain-separated package hashes using Node crypto. There were zero mismatches. The candidate content hashes match the corrected content inspected above. The independent focused rerun of `npx.cmd vitest run __tests__/content-factory-v4/draft6.test.ts --reporter=dot` passed all 31 tests on 2026-10-22 at 13:03 local time. The suite includes source-pin verification, repeat-generation immutability and preservation of prior drafts.

The final reviewed identities, all version `4.0.0-draft.6`, are:

| Lesson | Candidate semantic SHA-256 | Package hash |
| --- | --- | --- |
| Geometry | `e7680a05c7804009443063cc602beb9af5c355df132380b2a405494a01506965` | `86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254` |
| Fractions | `78cfaf819d4f3c3d767299571d4a5238af57abc3a2b88a496044b0fc6799cd22` | `ffaafcbb124def71114178a07736acf7c3609aa1debf36e413b4bdf1a5aae69a` |
| Multiplication | `ed0a518f060509276607c67910fdc00513a9793f6cf7dedadcd2dbbe5dadbe9a` | `7a469baccfb5d7d1e932942baf013e1848579c4efa9077a949dcebb7542d75ce` |
| Science | `5e67edd36ec5b3e0ef29be65dee3ab2e08e1f7cccf17209e4e689492eaae2126` | `7863152eba2e51b818a1b304fa0b240f7b0ac0d2656406947488fbc93ae912f9` |
| Civics | `ea3ff95feafe3aee979e0a906581dbfdbab5044abf5c2bb742fd97fccda9215b` | `2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb` |
| English | `500ab78193c6ffee7a6afdf6af7ced250d9d362abba2bcd71c14f26fdd0cb9b5` | `fa54d6f4d508a81020bcf18c906a948a8c1c0e74ec1f384aa9c088acb289be19` |

Additional independently measured file-byte SHA-256 identities:

- Complete JSON academic packet: `8e1f3950c7500c0d15bef233ea58fd8706288a11be4e31fb37dc7154bb0bfba7`.
- Batch generation receipt: `c59d3623d3bd558398a50e30de62688bc066ca22238c3d188b2ef88c9cbe04ab`.
- Draft.6 inputs file after physical LF normalization: `bee47f5a94a1015538fbf10a048e941a93c7012bbb1602054ce1155b9711445b`.

After local commit `36d2ca665de6e76f7abe00383158e7286ee40f85`, this reviewer independently remeasured the inputs file and confirmed physical LF line endings. Its earlier pre-normalization raw byte hash was `dc54fce0df928f1c881dc695102b6c5396b967ef37722d01010baf93ee618aa1`. The raw byte identity changed because CRLF was converted to the declared UTF8_LF representation. Normalized source pins and candidate/package identities are unchanged. The complete JSON packet and batch receipt byte hashes were independently rechecked and remain exactly those listed above. No content change is implied by the inputs-file line-ending normalization.

The [T1 handoff](../../architecture/content-factory/DRAFT6_T1_HANDOFF.md) was independently read. It explicitly retains ACC-1, requires a verified accessible spatial alternative with independent response tasks, prohibits nonvisual geographic mastery claims until review, preserves standalone source/license attribution, distinguishes exact and rounded rational input, and keeps the controlled preview disabled. This is an adequate factory-side handoff; it is not evidence that T1 implementation or runtime accessibility testing has occurred.

Recommendation for these exact versions: submit the complete packet to the founder's academic reviewer for evidence-based recommendations. The corrections identified in this review are closed except ACC-1, which remains a disclosed release blocker. Rights release review, access/accessibility/safety review, applicable T1 runtime work and exact-version release authorization remain pending. All six lessons must remain unpublished and inaccessible to students until those requirements are met. This is independent AI verification. No human subject-expert review, academic approval or release authorization occurred.
