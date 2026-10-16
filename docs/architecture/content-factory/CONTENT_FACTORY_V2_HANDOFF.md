# Content Factory V2 handoff

Completed 2026-10-16 on `feat/content-factory-v2` in `.task-worktrees/content-factory-v2`. This is a local candidate-generation prototype and prepared read-only inventory procedure. No production connection, credential retrieval, migration, publication, release, official grade/mastery/record write or remote PR update occurred. PRs #190–#194 and MergeOps were read where relevant and left unchanged.

## Commits and source evidence

| Role | Exact commit |
| --- | --- |
| Main audit baseline | `a1508ceaf7d89a338de624e9f63c9c4c592ca28c` |
| Assessment V2 draft dependency | `133a238f92559ded8bbe7942753d502e22de76ec` |
| Local Assessment dependency merge | `fbc3937199015b1f18f2b7f287ce2dc184fbf83a` |
| Curriculum Excellence V1 draft dependency | `3b51aef9afaa95711a7bf5164797c006e516d002` |
| Local Excellence dependency merge | `75ade73abe55945b0a47fba1ad799f152687b827` |
| Academic Records draft, read only | `b1403d190e29ddaef1498e32acf1e9ad7bf6f342` |
| Grade 7 draft, read only | `5650c4be8a9dbbb07cfbdb4d2f8312cf66443885` |
| Factory implementation, tests, procedure and selected synthetic package | `1fcf9d4329e1f2e8fb1f1355aba44a7474686854` |

This handoff is a subsequent documentation commit. The implementation commit above identifies the complete tested source and selected review package. Draft dependencies are integrated only on this local mission branch; their source branches and PRs were not changed.

## Deliverable index

| Requested output | Delivered location |
| --- | --- |
| Existing-system audit and reuse matrix | [Architecture and audit](CONTENT_FACTORY_V2.md), existing-system matrix |
| Content Factory V2 architecture | [Architecture](CONTENT_FACTORY_V2.md), ownership and human-authority boundaries |
| Versioned UnitBlueprint | `lib/content-factory/v2/blueprint.ts`; demonstration `unit-blueprint.json` |
| Orchestration and role dependency design | `lib/content-factory/v2/manager.ts`; architecture role table |
| End-to-end candidate prototype | `lib/content-factory/v2/demo.ts`, `scripts/content-factory-v2-demo.ts` |
| Automated consistency and safety tests | `__tests__/content-factory-v2/`, 27 tests across four files; strict Assessment V2 parser added at its existing owner |
| Legacy migration plan | [Migration plan](CONTENT_FACTORY_V2_MIGRATION.md), [inventory procedure](../../ops/CONTENT_FACTORY_V2_READ_ONLY_PRODUCTION_INVENTORY.md), prepared SELECT-only SQL and offline validators |
| Reviewer-ready demonstration | [Grade 7 review package](../../../artifacts/content-factory-v2/demo/run-1792192144091/REVIEWER_PACKAGE.md) and adjacent original artifacts, protected assessments, ContentBundle, blueprint, quality report, manifest and journal |
| Independent integration review | [Separate-agent report](CONTENT_FACTORY_V2_INDEPENDENT_REVIEW.md), six corrected required findings and final 27-test confirmation |

The demonstration contains 18 resources, including two Curriculum V2 lessons, ActivityDefinition V1 classwork/homework/practical/project, Assessment V2 diagnostic quiz/summative/retention/transfer forms, separate protected specs, teacher guide, key/rubric indexes, worksheet, accessible text and an optional extension. Candidate composition uses ContentBundle V1. The manifest labels deterministic templates and synthetic content. It is not production instructional replacement or evidence of learner attainment.

Blueprint `factory-g7-number-sense@0.1.0` has hash `a2382c06ce4ec96be3634e9f0304689f88316a39d11fa976c4a44bbbe4dce40a`. All resource envelopes pin it. Complete originals remain beside the journal; derived review projections have their own hashes. New local runs use exclusive directories and retain prior artifacts. Only the selected review run is committed; other generated runs remain local and ignored.

## Validation evidence

- Final factory suite: `node node_modules/vitest/vitest.mjs run __tests__/content-factory-v2 --maxWorkers=1`, four files and 27 tests passed. The separate reviewer independently confirmed the same 27 tests. No test is disabled in the source.
- Integration checkpoint: factory, Assessment V2 and Curriculum Excellence suites together passed 132 tests across 11 files. The subsequent metadata-only inventory regression increased the factory suite by one and passed in the final focused runs. Assessment/Excellence source was unchanged after that checkpoint.
- Final `npm.cmd run validate:changed -- --no-types` passed the API-route policy audit, changed tests and related tests. Related-test graph inspection emitted existing mock-hoisting and dynamic-import warnings in unrelated suites. Earlier attempts failed on missing worktree tool entries or an in-progress edit; the final stable run passed. Worktree-only junctions to already installed Vitest/TypeScript repaired tool discovery without changing shared dependencies.
- `node node_modules/typescript/bin/tsc -p tsconfig.content-factory-v2.json --pretty false` passed on final source. Repository-wide `tsc --noEmit` was attempted earlier and found stale shared Prisma client definitions for existing ContentBundleRecord/ContentBundleAllocation and ScheduledWork pins, plus a factory actor typing error that was corrected. The shared generated client was not overwritten. Repository-wide type certification remains pending an isolated, matching Prisma-client installation.
- The CLI generated 18 resources with status AWAITING_HUMAN_REVIEW and zero deterministic package failures. The local tsx launcher hit `uv_os_get_passwd` ENOMEM before application execution; bundling the same entry point with the installed esbuild and running it with Node succeeded. No model/provider/database call was involved.
- Saved-package verification recomputed all 18 original artifact hashes, all 16 chained audit-event hashes and all derived projection hashes. `verification.json` records success. The ContentBundle contract is also checked by the factory tests.
- `git diff --check` and staged whitespace checks passed. No app route, UI, Prisma schema or MergeOps source was added by the factory implementation commit. The inherited Assessment V2 draft contains its own pre-existing exam safety changes.

Usual reproduction is `npx tsx scripts/content-factory-v2-demo.ts`. In the affected local environment, the fallback used was:

```powershell
node -e "require('esbuild').buildSync({entryPoints:['scripts/content-factory-v2-demo.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:'artifacts/content-factory-v2/demo-runner.cjs'});"
node artifacts/content-factory-v2/demo-runner.cjs
```

## Remaining gates and integration order

1. Coordinate and integrate the exact Assessment V2 and Curriculum Excellence foundations first. Keep Academic Records downstream of authorized evidence and school policies. Re-run repository merge/CI gates with an isolated, matching generated Prisma client before any merge certification.
2. Integrate this candidate-only factory. Before operational or paid execution, adapt its executor/sink interfaces to existing agent runtime, RBAC, cost limits, invocation logging, durable jobs and immutable provenance/revision storage. The local manager is one executor with bounded retries, not a concurrent production service. Raw malformed generator outputs are not retained by the prototype; a production adapter must retain restricted candidate/invocation evidence.
3. Review the prepared production inventory procedure and its exact SQL commit/hash. Obtain the required operator/data-owner authorization, existing least-privilege role and full-visibility/target attestations. Execute only through the approved read-only mechanism, then validate and privacy-review the export. The SQL was source-reviewed and synthetically tested, not executed against any database. Schema/transport compatibility and actual production counts remain unverified.
4. Resolve the user-supplied revision leads against that accepted inventory. PR #191 carries separate row/logical IDs and claimed dated per-lesson extracts; those repository claims are not the accepted full production inventory. Select an actual Grade 7 lesson from its verified current body/revision only after qualified review. Keep the actual migration pilot PENDING_AUTHORITATIVE_PRODUCTION_INVENTORY.
5. Resolve MOE objective mappings, template cell, executable ontology/release, extension scope and retention policy. Complete exact-revision factual/key, instructional, accessibility/offline, legacy-comparison and independent reasoning reviews. Every unassessed Excellence criterion remains NOT_EVALUATED; no design attainment or learning success is claimed.
6. Route any future assessment/player/persistence integration and release through existing governance owners, with explicit human release authorization. Preserve original lesson IDs/revisions and all assignment, submission and learning history. Production migrations, releases and official academic writes remain outside this mission.
