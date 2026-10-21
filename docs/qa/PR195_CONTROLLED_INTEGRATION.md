# PR #195 controlled integration and first-three QA

Review date: 2026-10-19. Academic outcome: **BLOCKED FOR ACADEMIC APPROVAL**. No qualified human reviewer has been confirmed. AI findings are advisory and cannot satisfy academic acceptance.

## Branch reconciliation

GitHub readback confirmed PR #195 is an open draft at `3e4ba71df9f462d273fe3be1e1bb585aea30c8c0`, based on `feat/g7-native-curriculum-v1`. PR #191 is merged through `ac5e86b6024a876df8afb0ecc85c78a4d987534f`. The tested local main baseline is `ebfdc2a07aa955553a172e99e41e65d6a9f67f66`, including #190, #191, #193 and #194.

Only four commits from #195 are absent from that main. They replayed cleanly in isolated branch `review/pr195-main-candidate`, worktree `C:/liberia-learn/.task-worktrees/pr195-controlled-integration`:

| Original modernization commit | Local integration commit |
| --- | --- |
| `7a9039ed9` | `e360661d2` |
| `17ea2c976` | `703c82556` |
| `0d6a02510` | `f6ee66752` |
| `3e4ba71df` | `7256bbe31755b542355a64f65296a9e7760ee7cf` |

Recommendation: retarget #195 to `main`. The original branch already shares its old base with main, so retargeting needs no history rewrite or unrelated curriculum commits. Validate the eventual merge result with the current main before merging. The local replay is an integration test candidate, not a force-push proposal. No remote base, branch or PR was changed.

`git diff 3e4ba71 HEAD -- curriculum/modernization lib/curriculum/modernization` is empty on the tested integration. Lesson IDs, source revision pins, mapping plans, ledger events and holds are preserved. There are no schema, migration, student-record or grade changes in #195's diff against main.

## Inventory and provenance

The offline extract was captured on 2026-10-16 at `2026-10-16T18:44:42.884Z`, digest `7d5e25cb2a6e2d26e5dc6327c8d2caebeb5882c278d0e9c8c430502de1a7c4ca`. This review made no live database connection and does not attest the current production catalog or the original operator's permissions.

All 1,105 distinct lessons have matching recomputed revision hashes. Stored live-equality assertions match those hashes; identical live snapshots were omitted from the export, so their equality remains an export assertion. Re-running the audit and classifier reproduces every committed audit digest and track, with zero differences:

| Classification | Verified count |
| --- | ---: |
| A_TARGETED_REPAIR | 356 |
| B_INSTRUCTIONAL_REDESIGN | 345 |
| REVISE, A plus B | 701 |
| C_FULL_REPLACEMENT, rebuild required | 51 |
| D_GOVERNANCE_HOLD | 353 |
| Total | 1,105 |

These remain mechanical, provisional classifications. Reproduction does not establish academic correctness. The contract handoff separately identifies an ft08 problem-set-key calibration concern; qualified review and any subsequent audit correction must be versioned without rewriting historical ledger events.

Ledger replay passed with 3,702 events, six candidates awaiting independent review, 353 holds, and zero accepted reviews, release authorizations or releases. The append-only guard reports `AUTOMATED_APPEND_ONLY`, no escalations, and `mayAutoMerge:false`. Both existing G7 native candidate hashes still match the ledger after integration.

Evidence: `artifacts/pr195-review/recomputed-inventory.json`, `ledger.log`, `ledger-diff.log`, and `contract-inventory.json` in the isolated worktree. Raw export content was not copied into the review report.

## First-ten contract

The authoritative contract is `liberialearn-first-ten-modernization-contract/1.0.0` at `ac196397cb13bd6866879c9f5c24503e5195c61d`. The raw manifest digest is `4cb6fb5588f5f840fe8b702f181a051a5838b093c1db82b0ea14d9c4b64ea549`; spec digest is `648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b`. All 29 manifest-pinned files and advisory review files match their Git-object hashes.

The E1 erratum is preserved in `FIRST_TEN_HANDOFF_V1.md` at `d640b6fcb9e102b0a06a9d49a136a0aca6948a8f`. It corrects retention-policy ownership to Assessment Architecture V2, `git:dd8568500:lib/assessment/v2/retention.ts`, PR #193. #193 is now merged on the tested main. E1 changes no policy ID, version, interval or lesson field. No pinned contract bytes or hashes were changed.

All ten source IDs, database IDs, revision IDs and snapshot hashes agree with the factory baseline at observed commit `3ef84628fdd03e337a4c7cf0fe92e5ce1e548242`. Full bindings are in `contract-inventory.json`.

Later factory observation: HEAD advanced to `b5e84492da1558645a4ac69ccfc26fa5a6f5e7c9` during this review, reconciling with academic main. Its first-ten baseline still pins 0.1.0. `quality.ts`, its factory test and the factory artifact ignore file were locally modified by that workstream; this review did not alter them. The later validation-only result below describes that observed worktree, not a clean-commit certification of factory code.

**Contract compatibility is blocked.** Factory `first-ten-baseline.json`, `modernization-ten-adoption.json`, first-three requirements and `firstTen.ts` still pin/accept contract `0.1.0` at `9628d97f6932ae4c0c399ec15455230e3f76607e`, digest `9b0128d725b83dc8ca6aaad818530b35c0649297fa7564b8fae8fb53a6d00964`. Factory ownership must deliver an explicit reviewed/versioned adoption or adapter for 1.0.0 and regenerate compatible requirements. Cohort identity agreement alone does not resolve this. These factory and contract branches are not included in #195.

## First-three review handoff

Terminal 1 will deliver authored inputs under `C:/restricted-authoring/completed`. Terminal 2 owns their consumption and immutable DRAFT package generation. This executor does not generate replacement content or invoke the factory. Completed inputs, protected keys and rubrics must remain in restricted storage. Repository evidence should contain hashes, statuses and findings without protected answers.

| Priority lesson | Source revision | Current evidence at the observed factory commit |
| --- | --- | --- |
| Civics, counties and capitals, `wk_mca7a_fri_p4` | `cmss8ptit002jvo540275dfvw` | Empty TEMPLATE; no authored resource payloads or candidate package |
| Science, states of matter, `wk_mca7a_fri_p3` | `cmss8pt0j002fvo54be8gcrnd` | Empty TEMPLATE; no authored resource payloads or candidate package |
| Math, fractions, `lesson_mca_1` | `cmss8mpl0000bvo1wos7i1ew4` | Empty TEMPLATE; no authored resource payloads or candidate package |

These are ft01, ft04 and ft07, not the first three ordered entries of the ten-lesson contract. The four older #195 pilots are separate lessons and cannot substitute for this review.

### Civics authored-input arrival

During this review Terminal 1 delivered `C:/restricted-authoring/completed/wk_mca7a_fri_p4.authored.json`, SHA-256 `5d27433348ad6d24ad1d168e1398544afb42b68bb707298737bba1f950441ccb`. This is an AUTHORED_DRAFT input, not an immutable factory review package. It has 18 scenes, 12 resource payloads, three embedded PNGs and no lab proposals, and retains false approval/publication/release flags. Science and Math delivery remained pending at this observation.

The candidate passes the existing Curriculum V2 parser. All three decoded PNG hashes match their declared hashes, at 51,199, 27,298 and 49,047 bytes. A read-only run of the factory's authoring validator reports `valid:true`, no missing fields and no failures, but `readyForFactoryExecution:false` and zero generated candidates. Its explicit blockers include accepted normalized inventory, explicit cohort submission, independent/qualified review, `SVG_ASSET_ADAPTER_REQUIRED:ft01-v1` and governed runtime bindings for ft01-v1 and ft01-v2. No factory generation was invoked by QA.

The current player's static delivery checker selects FALLBACK in all nine scenarios for s04 map, s09 contrast, s12 matching and s17 blank-map scenes. The intended county focus/arrow-key behavior and DRAG_DROP interaction therefore have not been demonstrated. The source contains fallback instructions, but those are not evidence that the promised interactive map and capital-placement experience renders. s16 also describes a half-labelled map without a scene media reference; verify actual staged asset delivery before claiming that scaffolding fades as described.

Instructional advisory observations: the input traces a hook and prerequisites through modelling, guided work, misconception probes, fading and review; the national/county-capital distinction is explicit. This is promising design evidence, not an academic rating. The labelled PNG was visually inspected at its original size; county numbers, capital markers, key, scale, north arrow and attribution are present. A wide raster figure and written keyboard promises require actual narrow-width and assistive-technology checks. The three asset hashes and parser results are recorded in `wk_mca7a_fri_p4-input-review.json` without protected keys or rubrics.

Source spot-checks support the county-centre corrections for Nimba and Montserrado in the cited [PCGN administrative-divisions paper](https://assets.publishing.service.gov.uk/media/5a81506ee5274a2e87dbcf2e/Liberia_Administrative_Divisions.pdf). The superintendent appointment explanation matches Articles 54 and 56 in the [Liberian Senate's Constitution copy](https://senate.gov.lr/storage/2024/08/Constitution-of-the-Republic-of-Liberia-January-6-1986.pdf). This is not a complete fact/adjacency/source audit. One source-consistency issue needs author/human review: s06 narrows newer-county creation to around 2000–2001, while its cited PCGN paper gives Gbarpolu as 2003 and explicitly documents disagreement with 2001. Remove that unnecessary range or state the uncertainty accurately. No restricted input was edited by QA.

All academic dimensions remain unrated pending qualified human review and the immutable candidate handoff. The received input still pins cohort `9628d97f...`; narrative alignment with 1.0.0 does not replace formal factory-contract adoption.

### Complete first-three input delivery

All three authored inputs subsequently arrived in the restricted directory. Terminal 2 has not supplied an immutable package designation to this executor; no packages were present at the factory's documented default output location when checked. These read-only input checks do not substitute for the forthcoming package review.

| Input | Latest reviewed SHA-256 | Structural evidence |
| --- | --- | --- |
| Civics, `wk_mca7a_fri_p4` | `5d27433348ad6d24ad1d168e1398544afb42b68bb707298737bba1f950441ccb` | 18 scenes, parser PASS, three PNG hashes PASS, factory validator valid |
| Science, `wk_mca7a_fri_p3` | `6c7928c46f8a7c25c0c026b67e5d066395d47094d5164b90645264288edab5f3` | 19 scenes, parser PASS, three PNG hashes PASS, factory validator valid |
| Math, `lesson_mca_1` | `fed1af1dadc67bfa5d17e8cc776b91fb5a8a73bd50979b3372ef196eb327416f` | 19 scenes, parser PASS, three PNG hashes PASS, factory validator valid |

The combined final authoring-validation command exits 0, while every input remains `readyForFactoryExecution:false`, DRAFT, unpublished and unreleased. All three still bind the old factory cohort commit. The documented inventory, qualified-review, explicit-submission and governed-runtime blockers remain. Science needs ft04-v1 runtime binding; Math needs ft07-v1 and ft07-v2 bindings. Neither declares a lab proposal, despite simulation/tool wording in its lesson. Current player analysis selects fallbacks for the Science model, simulation, curve and demonstration scenes and for the Math number-line, manipulative, comparison-diagram and comparison-tool scenes. No actual simulation or interactive lab has been certified.

The earlier Math input at `a11d78c474c379906522e61c3488a30a95c979a00905525d94f857195f6616ce` failed the validator's protected-string and ft07-m3 instruction/binding checks. Its bytes changed during investigation. Those flags are superseded for the current digest: a follow-up independent metadata probe resolves all five misconception instruction/assessment bindings and finds no protected-string collision using the Assessment V2 projection contract. No protected answer values were copied into repository evidence. This is why final review must pin immutable package bytes rather than a changing authoring filename.

Science advisory review: the progression explicitly teaches arrangement/motion, changes of state, evaporation versus boiling, a heating curve, guided explanation, misconceptions, a safe teacher demonstration and an unassisted handoff. The reviewed particle and heating-curve PNGs have readable labels and the curve distinguishes melting and boiling plateaus. Ask the subject reviewer to qualify s15/s19: a drink approaches the ice/water equilibrium temperature after cooling and equilibration with sufficient ice; it is not instantly at zero merely because cubes are present. This distinction is supported by [OpenStax's phase-change treatment](https://openstax.org/books/college-physics-2e/pages/14-3-phase-change-and-latent-heat). Also check whether different particle counts across the generic state panels could suggest that matter disappears, and whether the fallback preserves observation/measurement objectives.

Math advisory review: the input teaches an explicit whole, fractions equal to and above one, equivalence, related denominators, subtraction and justified comparison. The displayed worked-example arithmetic checked in prose is consistent. The zero-to-two fraction-line PNG was visually inspected. Ask the qualified reviewer to clarify s05's warning about writing a division of a two-kilogram quantity: valid arithmetic must not be described as an incorrect method merely because unit notation needs improvement. The five misconceptions, seven-day retention binding and independent-assessment separation have structural evidence; numeric keys, analytic rubric sufficiency, transfer quality and actual tool behavior still require full immutable-package review.

For all three lessons, objective coverage, instructional progression, source checks and static deliverability observations are advisory. No academic dimension is assigned a qualified-human score. Mobile rendering, screen-reader operation, assessment attempt boundaries and teacher-visible evidence remain pending the exact package and runtime registration. The academic outcome remains **BLOCKED FOR ACADEMIC APPROVAL**.

Before independent content QA, require exact candidate ID/version/hash, package manifest/hash and complete file closure, source and contract pins, authorship/provenance, protected assessment definitions and scoring specs, learner-only projection, asset bytes/licenses, legacy disposition and mapping plan, deterministic quality report, preserved audit journal and immutable receipt. Record missing deliveries as NOT_DELIVERED, never as academic failure or approval.

Qualified human reviewers must document identity, authorization, relevant subject/grade qualifications and independence from authors, and sign findings against the exact candidate and report hashes. Require human ACADEMIC and ASSESSMENT acceptance, plus ACCESSIBILITY and LOCALIZATION under the first-ten rubric. The rubric requires a second subject check for Civics/history and Global Excellence tasks. No identities are assigned by this review. No human approval event may be synthesized from AI advice.

## Prepared academic and engineering gates

Every row is pending genuine package delivery and review, not passed by template presence.

| Gate | Evidence required |
| --- | --- |
| Academic accuracy and provenance | Verify each correction and new factual claim against primary/official evidence where available; independently recompute numeric keys. Record disputed evidence. Civics retains LiberiaLearn Civics authority; any MOE Social Studies relationship needs explicit review. |
| Depth, age and objectives | Trace measurable G7 objectives through concrete examples, concepts, faded scaffolds and independent tasks. Confirm scope extensions are explicit. |
| Instructional coherence and teacher use | Walk prerequisites, diagnostics, worked examples, guided practice, misconception feedback, interventions and teacher guidance in order. Check usable teacher evidence without implying official grades. |
| Assessment quality and independence | Match tasks to objectives, verify keys/rubrics separately, test unassisted attempt boundaries, and withhold item feedback until authorized disclosure. Lesson completion is an observation, not independent mastery. |
| Retention and transfer | Verify delayed retrieval of at least seven days and genuinely new-context transfer, with explicit assistance and offline restrictions. Preserve E1. |
| Visuals and accessibility | Check diagrams against the concepts and data; meaningful alt text, text equivalents, keyboard paths, focus, labels, contrast, reading order, zoom, touch targets and no horizontal overflow. |
| Interactive lab value | Require an objective-linked action, prediction, evidence and reflection, meaningful feedback, accessible fallback and a clear teacher debrief. A decorative interaction does not pass. No candidate lab is certified here. |
| Security and evidence | Inspect learner JSON, RSC/HTML and network payloads for protected keys/rubrics; test role/tenant denial, tutor/tool denial during independent work, online-only independent assessment and teacher-visible RAW/assisted disposition. Keep the Student Learning Model write bridge and official-grade paths off. |
| Delivery and performance | Run 360, 390, 768 and 1440 px; record route status, modes, screenshots, console failures, layout, load timing and payloads. Check warm offline fallback separately from cold start; viewport resizing alone is not a mobile performance test. |

Lesson-specific rubric checks include all 15 county-capital pairs, correct Nimba and Montserrado distinctions and no invented constitutional claims for ft01; physically possible results, evaporation versus boiling, no required latent-heat calculation and safe demonstrations for ft04; fractions at and above one, an explicit whole, correct methods, comparison and consistent units for ft07. These are review requirements, not independently verified lesson findings.

## Browser and assessment-boundary preparation

The existing dev-only `/lab-review/experience/<id>` loader registers the old pilot candidates; it does not register arbitrary factory outputs. A proposed blueprint ID is not a candidate identity. Before genuine-candidate testing, Terminal 2 must hand off a learner-only projection and a reviewed adapter/registration in the existing preview, keeping protected package files server-side. No arbitrary restricted-directory static serving is authorized.

Prepared browser cases, for each priority lesson at all four widths:

1. Open the exact candidate/hash in reading mode, fullscreen slides and interactive stages. Traverse every scene, record layout, diagrams, keyboard/focus and navigation gates, then revisit earlier scenes.
2. Exercise diagnostic failure, interventions, guided examples, misconception feedback and practice. Inspect tutor/tool policies and teacher evidence classification.
3. Enter independent assessment through its governed handoff. Confirm instruction cannot mint a scored attempt, key or rubric disclosure is denied before submission, assistance cannot become unassisted evidence, unauthorized teacher/other-tenant reads fail, and offline independent submission/mastery remains blocked.
4. Verify authorized post-attempt disclosure separately; no unrestricted practice feedback should leak protected assessment keys. Confirm all attempted POST/PUT/PATCH/DELETE traffic is intercepted by synthetic fixtures.
5. Disconnect after load, inspect reading/lab fallbacks and assisted disposition, reconnect and ensure no official-grade, bridge or independent-mastery write occurs. Test cold offline availability separately if a signed offline fixture exists.

The local browser probe blocks external traffic and mutation requests. It records proposed-ID availability and an older pilot as a positive control. Its 404 results are expected missing-delivery evidence, not an authored-lesson rendering verdict. First-three reading, fullscreen, labs, assessment and teacher-evidence tests remain NOT_RUN until genuine packages and their preview registration arrive.

Availability records completed for 360 and 390 px: all six proposed-ID requests returned 404, both older-pilot controls returned 200 with zero horizontal overflow and no attempted mutation requests. Twelve screenshots were retained across 360, 390 and 768 px, including a 768 px pilot control. The run stalled during the 768 px offline/context transition; a bounded retry was stopped before the production build. No completed 1440 px result or full offline result is claimed. The visible 360 px control includes an offline-support warning, so retained DOM does not establish offline availability.

Prepared executable checks are `scripts/qa/verify-pr195-snapshot.cjs`, `scripts/qa/recompute-pr195-inventory.ts`, `scripts/qa/inspect-pr195-authored-input.ts` and `scripts/qa/probe-first-three-availability.cjs`. The last accepts an optional metadata-only handoff JSON in the observation shape, using real `firstThree[].candidateId` when supplied, and `PR195_REVIEW_BASE_URL` for the local harness. It only checks availability and a pilot control; the full QA matrix above remains required. The probe now saves each availability observation immediately and bounds offline/context cleanup waits. It never reads protected assessment payloads.

## Validation results

Production-code integration under test: `7256bbe31755b542355a64f65296a9e7760ee7cf`.

| Check | Result |
| --- | --- |
| Local Prisma generation, dummy loopback URLs | PASS, exit 0; worktree-local client, no migration/database connection |
| Modernization, Curriculum V2, security, learner-experience and provenance primitive suites | PASS, 47 files passed, 1 file skipped; 1,151 tests passed, 6 skipped; 179.69 s. Conditional PostgreSQL suite was not run against a database. |
| Offline revision/audit/classification recomputation | PASS, 1,105 hashes; zero audit/track differences |
| First-ten Git-object and factory cohort verification | PASS, 29 files and 10 source bindings; contract-version compatibility BLOCKED |
| Ledger replay and diff guard | PASS, exit 0 each |
| Curriculum release/provenance validation | PASS, exit 0; existing reported coverage/authority gaps remain, not first-three certification |
| Assessment V2 and learning-authority suites | PASS, 28 files, 246 tests, zero skips/failures, 35.88 s |
| Civics authored-input parser and embedded assets | PASS, parser accepted; three of three PNG hashes match; advisory input check, not candidate acceptance |
| Factory validation-only check of Civics input | VALID but BLOCKED FOR EXECUTION; zero generated candidates; dirty factory worktree observation |
| Final validation-only check of all three inputs | PASS, exit 0; all valid, none ready for factory execution; nine asset hashes and three candidate parsers pass. Superseded Math-input failure is recorded separately above. |
| TypeScript | PASS, `node node_modules/typescript/bin/tsc --noEmit`, exit 0. It completed before the attempted timeout cleanup; only the build was terminated. |
| Changed-file validation against main | PASS with `--no-types`: 176 PR files checked; 76 direct tests in five files and 124 related tests in seven files passed. Separate full TypeScript gate is not included in this pass. |
| Local review patch | PASS, `validate-changed --no-types`: route policy, whitespace and JavaScript syntax; TypeScript helpers additionally bundled and executed. This does not claim a second full-repository typecheck of the QA helpers. |
| Production build | INCONCLUSIVE_LOCAL_TIMEOUT. `next build` was run after local Prisma generation with dummy local service configuration; it remained at optimized compilation and was stopped after 1,027 seconds. No compiler error or successful build is claimed. |
| Four-width browser availability/control | PARTIAL: completed 360/390 px availability/control records, 768 px screenshots; 1440 px and first-three end-to-end QA NOT_RUN. See browser limitations above. |

The Windows `tsx` launcher failed before application execution with `uv_os_get_passwd` ENOMEM. The ledger and provenance scripts were bundled with installed esbuild and then passed under Node; no validation assertion was bypassed. Existing Browserslist and nested vi.mock warnings were observed. No claim is made that the full repository test suite or a live database/browser integration passed.

## Readiness and next handoff

Retargeting is structurally safe on the tested main. Engineering merge readiness remains blocked by an uncompleted production build, required exact-head full-suite CI and independent engineering review. TypeScript and changed-file validation passed for the production-code integration. First-three integration is blocked by missing immutable factory review packages, formal factory adoption of contract 1.0.0 and preview/assessment handoff evidence. Academic outcome remains **BLOCKED FOR ACADEMIC APPROVAL** until qualified human review is documented against exact candidate hashes.

Next handoff: Terminal 1 has delivered the three inputs and owns content revisions in response to advisory findings. Terminal 2 must return exact immutable DRAFT package locations and hashes, a compatible contract designation and learner-only preview artifacts with the required runtime bindings. Then independent QA can complete package-level instructional, source, security, rendering, accessibility and assessment-boundary checks. The owner must identify qualified academic reviewers and obtain a completed build/full-suite CI on the final integration. No merge, deployment, publication, migration, production write or learning-model activation was performed by this executor.
