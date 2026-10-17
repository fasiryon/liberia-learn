# Fixed first-ten source intake

This continues factory engineering from `d1f1826cb`. The user supplied Curriculum Excellence commit `9628d97f6932ae4c0c399ec15455230e3f76607e` as the location of the exact ten lessons. Its ordered source IDs, revisions, hashes and subjects are unchanged. No alternates are selected. Curriculum diagnoses, factual-correction citations, qualified review and owner approval remain with their respective leads.

## Verified source evidence

| Evidence | SHA-256 |
| --- | --- |
| Exact baseline spec bytes, `curriculum/modernization/v1/first-ten/spec.json` | `9b0128d725b83dc8ca6aaad818530b35c0649297fa7564b8fae8fb53a6d00964` |
| Existing extract, `lessons.jsonl` | `7d5e25cb2a6e2d26e5dc6327c8d2caebeb5882c278d0e9c8c430502de1a7c4ca` |
| Existing extract `manifest.json` exact bytes | `0db9093f2c1280273d673deadfd63b272d097ea7fed8410aaa09ecfe296dd51f` |
| New source-intake manifest, domain-separated canonical JSON digest | `55f1d1fa6bcbafdb9cfb6d0935e743946dc32c3a8fc19e69987cec227fe28e11` |

The source directory is `C:/liberia-learn/.worktrees/library-modernization-v1/artifacts/library-modernization-v1/extract`. It contains 1,105 catalog rows. All ten selected primary IDs, logical IDs and revision IDs match the baseline. Every selected snapshot independently recomputes to its baseline hash. All ten revision sequences are 1. Complete dependency counts are preserved, including categories absent from the older factory inventory format.

The original extract says it was captured in a read-only transaction on 2026-10-16. Its live-projection equality fields are exported assertions. The adapter validates their consistency but cannot independently reconstruct the original live row when `liveSnapshot` is null. This is verified local source integrity, not proof of current production state, operator permissions or completed privacy review. No live connection was made.

## Engineering changes

`lib/content-factory/v2/firstTen.ts` reuses the existing modernization extract loader, copied unchanged from the supplied branch at `lib/curriculum/modernization/extract.ts`, and adds runtime parsing and source binding checks. `curriculum/factory-v2/first-ten-baseline.json` pins the exact cohort and order. The CLI pins the exact original spec bytes and refuses another cohort.

The original spec is not a `batchContractSchema` document. The adapter supplies explicit assessment-kind translations, resource/item planning identities, timing, scaffolding, source pointers and versioned UnitBlueprints. The original spec and kind labels remain in each restricted brief. End-of-lesson diagnostic labels stay end-of-lesson selected response; they are not silently moved to prerequisite timing. The separate prerequisite tasks come from the spec's prerequisite diagnostics.

Blueprint 2.1 preserves required `LIBERIALEARN_MASTERY` and `GLOBAL_EXCELLENCE` objectives. Neither is recast as an optional extension. Existing 2.0 blueprints and their hash domain remain supported; 2.0 documents cannot claim the new objective kinds. New candidate unit IDs are planning identities, separate from nullable source unit placement. Civics remains `CIVICS`; no source subject is renamed to Social Studies. Proposed national mappings acquire no official authority.

Transfer scoring is preserved exactly, including `KEYED` for ft08 and ft10. The other eight keep `ANALYTIC_RUBRIC`.

## Outputs and execution boundary

The restricted local output contains ten source snapshots, complete original per-lesson specifications, dependency counts, assessment crosswalks and validated planning blueprints. It says `BRIEF_ONLY_NO_CANDIDATE_OUTPUT`, candidate count zero, DRAFT, unapproved and unreleased. No candidate lesson, answer key, rubric or asset is fabricated from the synthetic demonstration.

The checked receipt is [first-ten-intake.json](evidence/first-ten-intake.json). Full bodies remain outside Git at `C:/Users/SIRYF001/AppData/Local/Temp/ll-real-first-ten-oLU2JY/intake`. An identical rerun verifies file closure/hashes and returns the same manifest without rewriting it. Changed inputs, incomplete attempts and linked outputs fail closed.

Compatibility verdict: **planning adapter compatible; candidate execution blocked**. These planning blueprints pin the raw catalog extract as their inventory source. Before passing them to `prepareBatch`, an adapter must bind the domain-separated hash of an accepted normalized factory inventory. The existing extract is not the prepared factory production capture and must not be relabelled as `ACCEPTED_READ_ONLY_EXPORT`.

Outstanding engineering inputs are lesson-specific authored drafts, protected keys and rubrics, misconception/item bindings, visual bytes and provenance, reviewed curriculum mappings, generation pins/actor identities, and the accepted factory inventory/capture with operator and privacy attestations. The factory's independent and qualified human review blockers remain. This intake neither issues correction notices nor writes grades, publishes lessons, mutates production, migrates a database or deploys.

## Reproduce

The script requires `CONTENT_FACTORY_TEN_CANDIDATES=1`. Output must be a new restricted directory outside the current worktree. It reads the pinned Git spec object, or accepts an exact-byte spec file as its optional third argument.

```powershell
$env:CONTENT_FACTORY_TEN_CANDIDATES = '1'
node node_modules/tsx/dist/cli.mjs scripts/content-factory-v2-first-ten-intake.ts <existing-extract-directory> <restricted-output-directory> [exact-spec-file]
```

If the local tsx launcher has its known Windows user-info failure, bundle this entry point with installed esbuild as in the previous readiness report and run Node. All reads are local.

Validation:

- Focused TypeScript project passed.
- `npm.cmd run validate:changed -- --no-types` passed the API policy audit, 14 direct intake tests and 52 related factory tests. Its graph inspection emitted existing unrelated mock-hoisting/dynamic-import warnings. `git diff --check` passed.
- Factory, Assessment V2 and Curriculum Excellence suites passed 158 tests across 13 files. Factory coverage is 52 tests, including 14 intake regressions. The persisted original 2.0 blueprint hash is also checked against its historical fixture.
- The real local intake and identical rerun passed, producing the same manifest hash without rewriting briefs. No source files were changed.
- Independent technical QA separately recomputed all ten source and blueprint hashes, all brief file hashes and the manifest domain hash. The [advisory technical review receipt](evidence/first-ten-technical-review.json) pins the reviewed source files and records corrected findings and remaining integration blockers.

Independent agent review does not constitute qualified human curriculum approval. It covers file-level engineering evidence; it does not claim review of curricular diagnoses or official content acceptance.
