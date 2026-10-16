# Library Modernization V1 data

Machine-readable inventory, audit, tracker and ledger for the whole production lesson catalog. Generated; do not hand-edit (except the ledger, which only ever grows through `appendEvents`).

| File | Content |
|---|---|
| `inventory.json` | One record per live lesson: ids, exact revision and hash, publication/lifecycle, source class, objectives and alignment claims, format, assessment, media, accessibility, dependency **counts**, indicators, Cleanup Plan V1 actions, candidate, audit summary, provisional track |
| `audit/grade-NN.json` | Per-lesson audit against Curriculum Excellence V1: 18 areas, findings `[id, code, severity, kind, area, where, evidence]`, metrics, MOE objective leads, audit digest |
| `audit/finding-catalogue.json` | Issue and proposed correction for each finding code and severity |
| `tracker.json` | Per-lesson status line: live revision, outcome, track, priority, proposed wave, ledger stage, candidate, learning-outcome status |
| `waves.json` | Proposed order of work (priority with grade/subject coverage). A proposal, not a schedule |
| `ledger/events.jsonl` | The modernization ledger (append-only, hash-chained). See `docs/curriculum/modernization/MODERNIZATION_LEDGER_V1.md` |
| `ledger/state.json` | Ledger head and the six answers |
| `DASHBOARD.md` | Human-readable answers from the ledger |

## Reproduce

```sh
# 1. Read-only extraction (needs DATABASE_URL; one SET TRANSACTION READ ONLY transaction; writes only the git-ignored local extract)
LIBRARY_ENV_FILE=<path to env file> npx tsx scripts/extract-library-modernization-inventory.ts
# 2. Offline build (deterministic; re-running against an unchanged extract appends no ledger events)
npx tsx scripts/build-library-modernization.ts
# 3. Verify the ledger without a database
npx tsx scripts/verify-library-modernization-ledger.ts
npx vitest run __tests__/library-modernization
```

The extract (`artifacts/library-modernization-v1/extract/`, about 63 MB of lesson bodies) is git-ignored. Its SHA-256 is recorded in `inventory.json` and in every `LIVE_OBSERVED` event, and the builder refuses an extract whose bytes no longer match its manifest.

## Boundaries

Production catalog only; repository fixtures, demos and candidates are listed separately in `inventory.json → repositorySources`. No learner, user, author or school identifiers; dependencies are counts. Mechanical audit results and provisional tracks are design evidence. They are not reviews, approvals or learning evidence.
