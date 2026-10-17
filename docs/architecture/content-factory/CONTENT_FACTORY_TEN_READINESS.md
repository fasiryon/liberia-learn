# Content Factory V2 ten-lesson readiness

Date: 2026-10-17. Branch: `feat/content-factory-ten-candidates`. Worktree: `.task-worktrees/content-factory-ten`.

Update: the user subsequently supplied the exact cohort at `9628d97f6932ae4c0c399ec15455230e3f76607e`. Its local export is now verified and source-bound planning blueprints are available. See [the fixed-cohort intake handoff](CONTENT_FACTORY_FIRST_TEN_INTAKE.md). The missing-selection statements below describe the initial `d1f1826cb` checkpoint, not the current handoff.

## Outcome

The existing factory now has an offline adapter for exactly ten source-bound candidate versions. It reuses the V2 orchestrator, UnitBlueprint, inventory and production capture validators, Curriculum V2 parser and deliverability checks, Assessment V2 parser and validators, Excellence blueprint checks, and chained factory events. It adds no database schema, publishing path or alternative lesson format.

Local capacity is demonstrated with ten synthetic sources, producing 180 resource artifacts, including 20 lesson candidates and 40 assessment packages. These exercise batch capacity and orchestration. They are repeated deterministic decimal templates, not ten real modernized lessons or evidence of instructional excellence. Every package is DRAFT, unapproved, unreleased, and pending independent review.

Actual legacy processing remains gated by the exact ten-lesson selection and source evidence. No production connection, migration, database write, paid generation, automatic approval, deployment, or external communication occurred.

## Located foundations and contract adoption

| Foundation | Location and evidence |
| --- | --- |
| Previous V2 branch | `feat/content-factory-v2`, implementation `1fcf9d4329e1f2e8fb1f1355aba44a7474686854`, handoff `d5f7e75b1` |
| Prior handoff and limitations | `docs/architecture/content-factory/CONTENT_FACTORY_V2_HANDOFF.md` |
| Production inventory procedure | `docs/ops/CONTENT_FACTORY_V2_READ_ONLY_PRODUCTION_INVENTORY.md`, `scripts/content-factory-v2/production-inventory.sql`, `productionInventory.ts` |
| Existing curriculum manifests | `curriculum/factory-v2/pilot-leads.json`, `curriculum/sources/raw/source-manifest.json`, `curriculum/sources/repository-source-inventory.json` |
| Modernization source requested by user | `docs/modernization-first-ten-spec-v1` at `3e4ba71df9f462d273fe3be1e1bb585aea30c8c0` |
| Adopted modernization guidance | That branch's `docs/curriculum/modernization/MODERNIZATION_PIPELINE_V1.md` and `lib/curriculum/modernization/pipeline.ts`. Exact hashes and adopted requirements are in `curriculum/factory-v2/modernization-ten-adoption.json`. |
| Modernization inventory and sequencing | That branch's `curriculum/modernization/v1/{inventory,tracker,waves}.json` and four-lesson `pilot/` |
| Validators | Existing `quality.ts`, `inventory.ts`, `productionInventory.ts`, `lib/curriculum/v2/{parse,deliverability}.ts`, `lib/assessment/v2/{parse,validator}.ts` |

The named modernization branch has a four-lesson pilot and national wave planner. At inspection its committed and working files contain no authoritative ten-lesson selection. The user directed use of this branch as the handoff source. This adapter adopts its safety and immutability requirements, while keeping that missing selection explicit. No claim of approval or contact with a separate Curriculum Excellence Lead is made.

The modernization `ModernizationSpec` and ledger remain owned by that branch. This change does not copy or fork them. Its transport contract wraps the existing V2 UnitBlueprint. Translating section dispositions and registering packages in the modernization ledger remain integration work for those owners. Current comparison files explicitly say `NOT_EVALUATED`.

## Pipeline behavior

| Requirement | Implementation |
| --- | --- |
| Read-only ingestion | Accept local exports only. Production mode recomputes the existing capture validator, exact manifest bytes, inventory hash, session completeness, current projection/revision consistency, and selected-row gaps. Operator attestations remain external human evidence. |
| Source preservation | Bind database ID, logical ID, revision ID, revision number and snapshot hash. Preserve the full source snapshot and relationship baseline in restricted `input.json`; originals are untouched. Reject missing bodies, duplicate sources, reused source identities and stale bindings. |
| Standards mapping | Pin the curriculum contract and objective-source document bytes; resolve every objective JSON pointer. Reuse blueprint objective/resource/assessment closure. Proposed mappings remain release blockers. Source pinning alone grants no MOE approval. |
| Generation | File-backed author adapter plus a source-aware executor seam into `runFactory`. Generation bytes, exact pins and actor identities are inputs. One attempt per role per candidate version, with rejected source bytes retained. No provider calls. |
| Visual assets | Hash actual bytes, check canonical encoding and basic image signatures, pin provenance and licensing declarations, require exact media/scene references, matching alt text and objective-preserving fallbacks. Check runtime deliverability and byte budgets. Actual licensed asset generation and visual inspection remain human/provider work. |
| Assessments and rubrics | Existing Assessment V2 generation interfaces and strict parsers, item/form/hash closure, protected keys, analytic rubric checks, diagnostic/independent/reasoning/retention/transfer blueprint validation, and learner-secret checks. Static author files must provide lesson-specific content. |
| Review packages | Full artifacts, source/contract/generation evidence, assets, protected assessment content, deterministic quality report, comparison index, reviewer instructions, summary, manifest and chained event files. The entire directory is restricted reviewer material. |
| Deterministic validation | Preflight all ten sources, document pins and generation-file hashes before authoring; existing per-resource and package validators plus media, age-band and delivery checks. Failures produce FAILED or REVISION_REQUIRED packages. |
| Independent review | Always `PENDING_INDEPENDENT_REVIEW`. Orchestrator reviewer identity checks are advisory identity checks, not completed content review. Every Excellence criterion remains unevaluated unless the existing owner separately reviews it. |
| Audit and blocking | Exclusive attempt directories, preserved raw generation inputs, event chains, hashed artifacts and manifest file closure. Literal `DRAFT`, `approved:false`, `released:false`; independent and qualified human review, source comparison and release authorization remain blockers. No release function exists. |

Completed reruns verify all file hashes and reuse the same package without author calls or new events. A changed contract, source, generation pin or actor identity under an existing candidate ID/version is refused. An interrupted attempt is retained and blocked for recovery, preventing duplicate uncertain author calls. New candidate versions may be used after inspecting the partial evidence. There is no automatic crash resume or paid retry.

Increment `BATCH_VERSION` whenever pipeline behavior changes. The version is included in input and package hashes. Cross-process exclusive directory creation prevents two workers from authoring the same candidate version concurrently. These local files provide integrity checks, not external signatures, durable distributed jobs or tamper-proof production audit storage.

## Local operation

The batch feature is off unless `CONTENT_FACTORY_TEN_CANDIDATES=1`. No application or public endpoint is added.

```powershell
# Creates a new, explicitly synthetic input directory. Do not reuse an existing directory.
node node_modules/tsx/dist/cli.mjs scripts/content-factory-v2-ten-fixture.ts artifacts/content-factory-v2/ten-fixture
$env:CONTENT_FACTORY_TEN_CANDIDATES = '1'
node node_modules/tsx/dist/cli.mjs scripts/content-factory-v2-ten.ts artifacts/content-factory-v2/ten-fixture/config.json
# Run the same batch command again to verify completed-package reuse.
```

If the known Windows tsx launcher fails before application code, bundle the two entry points with installed esbuild and run Node:

```powershell
node -e "require('esbuild').buildSync({entryPoints:['scripts/content-factory-v2-ten-fixture.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:'artifacts/content-factory-v2/ten-fixture-runner.cjs'}); require('esbuild').buildSync({entryPoints:['scripts/content-factory-v2-ten.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:'artifacts/content-factory-v2/ten-runner.cjs'});"
node artifacts/content-factory-v2/ten-fixture-runner.cjs artifacts/content-factory-v2/ten-fixture
$env:CONTENT_FACTORY_TEN_CANDIDATES = '1'
node artifacts/content-factory-v2/ten-runner.cjs artifacts/content-factory-v2/ten-fixture/config.json
```

`config.json` specifies `contractFile`, `inventoryFile`, `outputRoot`, all eight `actors`, and a `generationFiles` map keyed by candidate ID. Generation files are JSON maps of every factory role to draft arrays. Pins hash the exact file bytes. The executable contract schema is `batchContract.ts`; use the generated synthetic config as a structural example, never as real lesson content.

For actual sources, use the prepared inventory procedure and its separately authorized, accepted read-only export. Set evidence to `ACCEPTED_READ_ONLY_EXPORT` with exact manifest SHA-256, authorization, target/role, visibility and privacy references. Supply `productionCapture` in config with `jsonlFile`, `manifestFile` and the original validator `provenance`. Use the validator-produced `inventory.json`, not a hand-reconstructed extract. Production-shaped outputs must be outside the repository. Keep exports, raw rejected content and review packages in restricted storage. Run this step only with the authorized operator evidence; it does not itself connect to production.

## Validation and remaining gates

Validation performed:

- `node node_modules/typescript/bin/tsc -p tsconfig.content-factory-v2.json --pretty false` passed.
- Factory, Assessment V2 and Curriculum Excellence suites passed 144 tests across 12 files. The factory suite includes 11 new batch regressions and the existing 27 tests. Cases cover exact bindings, incomplete exports, production-shaped synthetic capture, feature disablement, protected authority fields, immutable versions, file tampering, crash recovery, concurrent workers, self-review blocking, source document hashes, media provenance and accessibility.
- The final bundled CLI processed ten synthetic sources into 180 resources, including 20 lesson candidates and 40 assessment packages, with 160 chained audit events. A second CLI run returned identical package hashes. All manifest file hashes were independently recomputed. Machine receipt: [ten-capacity.json](evidence/ten-capacity.json). Full ignored local packages are in `artifacts/content-factory-v2/ten-fixture/final/packages/`.
- `git diff --check` passed.
- `npm.cmd run validate:changed -- --no-types` passed its API policy audit, 18 direct changed tests and 31 related tests. Type checking was performed separately with the focused project above. Related-graph inspection emitted pre-existing mock-hoisting and dynamic-import warnings in unrelated suites.

The prior V2 handoff's repository-wide Prisma-client limitation remains outside this task. Merge certification, full build and deployment gates have not been claimed.

Before processing the real ten lessons, the Curriculum Excellence owner must supply the ten exact selected bindings, a versioned contract pinned to its exact document bytes, per-lesson UnitBlueprints, reviewed curriculum mappings, source comparison dispositions, lesson-specific generation drafts and author identities. The accepted production capture, privacy/visibility attestations and any licensed visual assets must also be available. No source IDs may be inferred from titles or planner order.

After generation, an independent reviewer and qualified curriculum humans must review each exact package, including protected keys/rubrics, factual correctness, licensing, accessibility, offline delivery, source-section dispositions and mapping authority. Only existing governance owners can record review and any future release authorization. Every candidate produced here remains unreleased.
