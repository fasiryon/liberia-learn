# Library-Wide Curriculum Modernization V1

Every lesson in the live catalog is accounted for. Its quality and modernization path are recorded at its exact revision. A tested, governed pipeline can replace weak content with stronger candidates without touching learners, historical records or curriculum authority. **Nothing has been approved, released, scored or shown to work**; the ledger states exactly where each lesson stands.

| # | Deliverable | Where |
|---:|---|---|
| 1 | Complete inventory and coverage report | `LIBRARY_MODERNIZATION_INVENTORY_V1.md`; `curriculum/modernization/v1/inventory.json` |
| 2 | Baseline quality audit of the full catalog | `LIBRARY_QUALITY_BASELINE_V1.md`; `curriculum/modernization/v1/audit/` |
| 3 | Per-lesson classification and priority | `inventory.json` (track, priority), `waves.json` |
| 4 | Reusable modernization pipeline | `MODERNIZATION_PIPELINE_V1.md`; `lib/curriculum/modernization/pipeline.ts` |
| 5 | Exact-version legacy comparison | pipeline stages 1-3 and 11; each package's `legacy-revision.json`, `legacy-material.json`, `comparison.md` |
| 6 | Assessment and learner-safe projection integration | pipeline stages 8-9; `assessment-definitions.json`, `learner-projection.json` |
| 7 | Pilot modernization packages | `PILOT_BATCH_V1.md`; `curriculum/modernization/v1/pilot/` |
| 8 | Independent-review and governance requirements | `MODERNIZATION_LEDGER_V1.md`; each package's `review-package.md` |
| 9 | Modernization dashboard and tracker (the authoritative ledger) | `curriculum/modernization/v1/DASHBOARD.md`, `tracker.json`, `ledger/` |
| 10 | Nationwide scale-out plan | `NATIONAL_SCALE_OUT_PLAN_V1.md` |
| 11 | MergeOps integration | `MERGEOPS_INTEGRATION_V1.md` |
| 12 | Tests, browser evidence, validation commands | `__tests__/library-modernization/`, `artifacts/library-modernization-v1/browser/`, commands below |

## Validation commands

```sh
npx vitest run __tests__/library-modernization            # inventory, audit, ledger, pipeline, guard, committed packages
npx tsx scripts/verify-library-modernization-ledger.ts     # replay ledger, no database
npx tsx scripts/check-modernization-ledger-diff.ts origin/main
# With read-only database access (DATABASE_URL), to refresh:
npx tsx scripts/extract-library-modernization-inventory.ts
npx tsx scripts/build-library-modernization.ts             # deterministic; appends ledger events only for changes
npx tsx scripts/run-library-modernization-pilot.ts         # idempotent
# Browser evidence (dev only): LAB_REVIEW_HARNESS=1 npx next dev -p 3297
node e2e/library-modernization/capture-pilot.cjs http://localhost:3297
```
