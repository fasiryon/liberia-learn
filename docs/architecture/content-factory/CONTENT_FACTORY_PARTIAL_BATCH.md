# Governed authored subsets of the first ten

This extends the accepted `934ec7cc` template handoff on the existing `feat/content-factory-ten-candidates` branch. It adds no branch, shortlist, lesson content, database write, grade, release, migration or deployment.

The authoritative manifest remains `curriculum/factory-v2/first-ten-baseline.json`, with the same ten IDs, revision IDs and snapshot hashes from `9628d97f6932ae4c0c399ec15455230e3f76607e`. Neither the manifest nor the source specification is rewritten. Subset selection is an explicit submission parameter, not a replacement manifest.

## Processing contract

The CLI loads the exact pinned specification and existing read-only export through `loadFirstTenSources`. It independently recomputes source hashes and verifies the whole ten-lesson source set. The authoring validator now accepts requirements derived from that same full specification, allowing later 10-of-10 processing through the same path. The existing first-three template validators keep their default pinned requirements.

An explicit, nonempty selection must contain 1–10 unique pinned content IDs. Supplied authored files must match that selection exactly. Unknown IDs, duplicates, extra/missing packages, altered primary/logical IDs, revisions, hashes, subject or grade are rejected. The runner canonicalizes selected IDs to original manifest order, so input argument order does not change hashes.

Every supplied package must be `AUTHORED_DRAFT`, DRAFT, reviewer-only, unapproved, unpublished and unreleased. All selected packages are fully parsed and checked in memory before any review-package write. Checks reuse the strict lesson/assessment/activity parsers, protected key/rubric closure, item and assessment mappings, misconception bindings, retention coverage/delay, media bytes/provenance/licensing declarations, accessibility/fallbacks, package validation and orchestrator dependency checks. A missing key, rubric, mapping or required media causes rejection. No empty resource or content is added to make a package pass.

This is the local draft-review path. It preserves local export evidence as `LOCAL_READ_ONLY_EXPORT_UNATTESTED`, including full captured dependency counts and original source snapshots. Exported live-row assertions, production currentness, operator authority, full dependency-store coverage and privacy acceptance are not promoted to independently proven facts. Accepted production-inventory and release gates remain blockers.

Required media cannot be silently downgraded. Unsupported SVG bytes, unresolved governed runtime bindings, and fallback-only declarations whose primary requirement still needs review cause preflight rejection. The existing SVG and interactive-media adapter gaps remain explicit. Curriculum Excellence must supply compatible complete media and bindings; this runner does not synthesize them or authorize substitution.

## Immutability and state

The existing immutable package sink and audit hashing are shared with the original full-batch implementation. This path invokes only the static, already-authored resource inputs. It never calls a paid author/model provider. Its new `authoringOnly` orchestration stop records `REVIEW_PENDING`; independent-review and release executors are not invoked. Review and qualified human approval remain pending.

Each selected lesson receives one immutable versioned DRAFT review package under `packages/<candidate-slot>/`, including original authored bytes, preserved source snapshot/dependency counts, raw role outputs, artifacts, comparison index, protected assessments, quality report and chained journal. There is no package directory, asset, empty assessment or lesson body for an unselected ID.

The immutable receipt under `submissions/<submission-hash>.json` lists all ten source identities. Selected lessons have `AWAITING_HUMAN_REVIEW` and package hashes. Unselected lessons have `NOT_STARTED` and null package hashes. These statuses describe **this submission**, not a destructive rewrite of previous submission history. All earlier receipts and packages remain intact.

A 3-of-10 receipt reports seven `NOT_STARTED` entries and `PARTIAL_DRAFT_SUBMISSION`. A 10-of-10 receipt reports `FULL_COHORT_DRAFT_SUBMISSION`. Both retain `fullCohortReady: false`, `readiness: NOT_EVALUATED`, DRAFT, unpublished and unreleased. Complete draft coverage is never interpreted as content readiness, review acceptance, release authorization or learning success.

Per-lesson input hashes bind the full pinned manifest fingerprint, specification/export pins, exact source identity, exact authored file bytes and source requirements. They do not bind unrelated selected lessons. Consequently a later 10-of-10 submission reuses the original three unchanged package hashes. Editing bytes at an existing candidate ID/version is refused; author a new version deliberately. Identical reruns verify package-file hashes, audit evidence and receipt equality without rewriting completed outputs. Partial filesystem attempts remain blocked for evidence-led recovery.

## Process the three completed packages

Run from the existing worktree. Set `$completedAuthoring` to Curriculum Excellence's restricted delivery directory. The files below are completed authored inputs, not the repository's empty `.input-template.json` files. Keep the output outside the repository and other agents' worktrees.

```powershell
Set-Location C:\liberia-learn\.task-worktrees\content-factory-ten
node -e "require('esbuild').buildSync({entryPoints:['scripts/content-factory-v2-partial.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:'artifacts/content-factory-v2/ten-partial-runner.cjs'});"
$env:CONTENT_FACTORY_TEN_CANDIDATES = '1'
$completedAuthoring = 'C:\restricted-authoring\completed'

node artifacts/content-factory-v2/ten-partial-runner.cjs `
  --select 'wk_mca7a_fri_p4,wk_mca7a_fri_p3,lesson_mca_1' `
  --extract 'C:\liberia-learn\.worktrees\library-modernization-v1\artifacts\library-modernization-v1\extract' `
  --output "$env:TEMP\liberia-first-three-review" `
  "$completedAuthoring\wk_mca7a_fri_p4.authored.json" `
  "$completedAuthoring\wk_mca7a_fri_p3.authored.json" `
  "$completedAuthoring\lesson_mca_1.authored.json"
```

Run that same command again for idempotent verification. No generated role-map file, placeholders for seven lessons or new cohort manifest is required. The script takes complete authoring envelopes directly. `--spec <exact-spec.json>` is available if the pinned Git object is unavailable; the original exact-byte specification hash is still mandatory. There is no override for the pinned cohort manifest or source IDs.

If the installed tsx launcher works, the equivalent entry point is `node node_modules/tsx/dist/cli.mjs scripts/content-factory-v2-partial.ts` with the same arguments. The bundled command avoids the known local Windows user-info launcher failure. Neither route installs dependencies or connects to production.

Exit zero means the selected authored packages were validated and retained as draft review packages. It does not mean approved, released or full-cohort ready. Incomplete source/authoring/media inputs exit nonzero before output writes. An interrupted filesystem operation may retain incomplete attempt evidence; the writer refuses to overwrite or automatically retry that candidate slot.

## Validation

Regression fixtures reuse existing deterministic synthetic lessons and synthetic source IDs. No placeholder candidate is generated for any real pinned lesson. Coverage includes 3-of-10, 10-of-10, identical reruns, request reordering, three-to-ten extension, full-manifest immutability, invalid/duplicate subsets and packages, source revision/hash mismatches, unknown IDs, key/rubric/mapping/media gaps, required-primary-media enforcement, feature disablement, immutable versions, file tampering, chained audit hashes, pending independent review and release safety.

Validation passed: 194 tests across 15 files in the factory, assessment and curriculum suites, including 22 partial-batch tests; the scoped TypeScript check; and `npm.cmd run validate:changed -- --no-types` (22 direct and 81 related tests, plus API policy audit). A CLI smoke test using the actual pinned export and the three empty input templates failed with `partial_authoring_incomplete` before creating the review output directory. The authoritative manifest was byte-identical to commit `934ec7cc` (SHA-256 `df374decf615a66d2fc5a92b0530b9bb798a9d1d17190f414b2668144e272b8a`).
