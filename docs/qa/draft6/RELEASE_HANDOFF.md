# Draft.6 academic release handoff

All six packages are `4.0.0-draft.6` review candidates. They are sealed for exact-version academic review, not approved for publication. Student preview remains disabled. No official academic records, published lesson rows or production configuration were changed.

Factory implementation commit: `36d2ca665de6e76f7abe00383158e7286ee40f85` on local branch `feat/content-factory-draft6`, based on accepted main `e5d89c34f421f028428cf9e4230ab3d40ff45536`. The branch has not been pushed or merged.

## Review export

- Complete human-readable packet: [complete-academic-packet.md](../../../curriculum/factory-v4/drafts/4.0.0-draft.6/review/complete-academic-packet.md).
- Complete machine packet: [complete-academic-packet.json](../../../curriculum/factory-v4/drafts/4.0.0-draft.6/review/complete-academic-packet.json).
- Independent Chief of Staff AI review: [INDEPENDENT_AI_REVIEW.md](INDEPENDENT_AI_REVIEW.md).
- T1 factory-side contract: [DRAFT6_T1_HANDOFF.md](../../architecture/content-factory/DRAFT6_T1_HANDOFF.md).
- Portable archive: `artifacts/draft6-academic-review/4.0.0-draft.6-academic-review.zip`; its checksum and inventory are in the adjacent export receipt.

The packet contains full student-visible scenes and projections, every formative question/option/key, worked steps, explanations, feedback, acceptable open-response and writing reasoning, objectives with task bindings, accessible/paper text, exact SVG source, source references and candidate/package/file hashes. Protected Assessment V2 questions and scoring specifications are absent. No human subject-expert review, MOE alignment approval, ontology approval or copyright clearance is claimed.

## Academic changes

| Lesson | Revision |
| --- | --- |
| Geometry | Separate worked/guided values; valid labelled triangles; diagnostic area, boundary, height and unit feedback; doorway transfer distinguishes length from area. |
| Fractions | Exact rational primary representation, equivalent unreduced answers and exact finite decimals; separate explicit rounding; area/number-line practice at and beyond one; like/related operations, ordering and task-specific diagnostics. |
| Multiplication | Genuine two-digit by two-digit worked, guided and independent practice; both-factor area splits, four partial products, place-value and omitted-cross-product feedback; equal groups/arrays/repeated addition practised. |
| Science | Energy-axis curve with correctly ordered warming/phase plateaus; latent heat, evaporation below boiling, freezing/condensation energy directions, complete state properties and a reversible-change transfer task. Original diagram independently inspected. |
| Civics | Coordinate-derived, attributed county outlines with clear interior labels; all fifteen county-capital pairs checked against PCGN; recall separated from geographic reasoning; no unsupported road or capital-point claim. Accessible runtime geography remains pending. |
| English | Informational explanatory passage, contextual vocabulary production, precise family-action evidence selection, separate consequence claim, defensible alternatives in comprehension and writing/revision. |

New factory policy/validators reject the demonstrated regression patterns and export concrete objective-to-task evidence. New versioned recipes preserve the old draft.4/draft.5 generation behavior. A small shared builder extension permits the correct draft.6 input-manifest reference without changing older outputs. Schema/test success does not establish academic quality or release authority.

## Exact package identities

| Lesson key | Package SHA-256 |
| --- | --- |
| g7-math-area-perimeter | `86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254` |
| g7-math-fractions | `ffaafcbb124def71114178a07736acf7c3609aa1debf36e413b4bdf1a5aae69a` |
| math-multiplication-models | `7a469baccfb5d7d1e932942baf013e1848579c4efa9077a949dcebb7542d75ce` |
| g7-science-states-of-matter | `7863152eba2e51b818a1b304fa0b240f7b0ac0d2656406947488fbc93ae912f9` |
| g7-civics-counties-capitals | `2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb` |
| g7-english-reading-evidence | `fa54d6f4d508a81020bcf18c906a948a8c1c0e74ec1f384aa9c088acb289be19` |

Candidate semantic hashes and every file-byte digest are recorded in the generation receipt and each manifest. These identities have different meanings and must not be interchanged.

## Validation evidence

- `npm run validate:changed` passed: API route-policy audit, 31 draft.6 tests, 107 related tests across four files, and TypeScript. A separate direct `tsc --noEmit` also passed.
- Independent AI verification reran all 31 focused tests and recomputed input pins, receipt/package file digests, candidate semantic hashes and domain-separated package hashes with zero mismatches.
- Two independent builds per candidate produced identical bytes. Disk reruns retained mtimes. Tests rebuilt all draft.4 and draft.5 outputs byte for byte.
- Independent diagram review checked the science curve against energy intervals and inspected the actual geographic outlines/labels. All fifteen county-capital pairs were checked against the government PCGN table. Rights release review remains pending.
- Independent access tests passed 29 assertions across the review-loader and reviewer-access suites. Live anonymous review index and lesson requests returned private/no-store 404 responses. Authenticated production access was not attempted.
- Production deployment `dpl_4izp3gLVQibvKHck14RKadjLvM8F` was independently confirmed READY on exact accepted main `e5d89c34f421f028428cf9e4230ab3d40ff45536`. At 2026-10-22T16:42:24-25Z both health endpoints returned HTTP 200 with healthy DB checks. No deployment was performed.

Prior immutable package tree hashes from the generation receipt:

- draft.4: `2683fd453e8f56c177075a489884b5b741dbc18efd2070260ef24593af390d3b`
- draft.5: `3f9a434196acd5689e251dfe43a308972cbdc346d925b609de8525159896fba9`

## Remaining gates and next owners

The founder's academic reviewer receives this packet and makes evidence-based recommendations for each exact revision. Those recommendations are not fabricated here. The release authority must authorize each exact package before any student access or publication. All six remain reviewer-only and unpublished.

T1 owns any frontend work. It must coordinate geographic asset integration, accessible spatial alternatives and runtime/offline QA, plus any typed-rational integration, using the precise handoff. No T1-owned frontend files were changed. A capital-name list cannot substitute for spatial access or establish geographic mastery.

Content, rights, access, accessibility and safety reviews must pass before the controlled preview allowlist can contain any hash. Its current eligible list is empty; record writes and replacement of published lessons are prohibited. The synthetic multiplication candidate also retains its unresolved curriculum/source binding. Official curriculum promotion additionally retains existing MOE/ontology, legacy comparison and governed assessment requirements.

The independent verifier is an AI agent, not a human subject expert. Content corrections are verified, but accessible geographic delivery remains an explicit blocker. No claim is made that T1 runtime work, screen-reader review or exact-version release authorization occurred.

Uncommitted preflight packages were retained locally under `artifacts/draft6-preseal/` for QA traceability; they are not release candidates and are excluded from the portable final archive. Final exported draft.6 identities are only those in the table above. Local dependency caches are likewise excluded.
