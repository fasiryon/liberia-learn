# P7C remediation stash inventory

Prepared for the first Manager Loop phase. Source: `stash@{0}` on
`feat/p7c-pr122-remediation`, compared with its first parent on 2026-09-10.
This is repository evidence only. No database-backed mission or phase transition
has been created while Supabase is unavailable.

## Stashed file-by-file changes

The stash contains 11 tracked files and three untracked files:

- `__tests__/p7a.governed-measurement.test.ts`: four test-line updates aligned
  with the revised governed measurement behavior.
- `app/admin/ops/page.tsx`: adds a link to the unified operational-readiness
  surface.
- `app/platform/ops/page.tsx`: replaces the legacy platform cards with the
  unified snapshot/dashboard composition.
- `docs/P7C_QUALITY_OPERATIONS.md`: documentation corrections for the revised
  quality-operations contract.
- `lib/experiments/controlledExperiment.ts`: small compatibility adjustment for
  the revised quality evaluation inputs.
- `lib/experiments/qualityOperations.ts`: statistical and evidence-integrity
  fixes described below.
- `lib/measurement/governedMeasurement.ts`: measurement authority adjustment.
- `lib/quality/calibration.ts`: review-calibration compatibility adjustment.
- `lib/quality/fixtureRegistry.ts`: fixture-registry compatibility adjustment.
- `lib/quality/releaseGate.ts`: release-gate compatibility adjustment.
- `lib/quality/reviewTasks.ts`: review-task compatibility adjustment.
- Untracked `app/admin/ops/readiness/page.tsx`,
  `components/ops/UnifiedOpsDashboard.tsx`, and
  `docs/audits/AUDIT_SYNTHESIS_2026-09.md` provide the readiness route,
  dashboard component, and audit synthesis respectively.

## Statistical correctness and evidence integrity

`lib/experiments/qualityOperations.ts` changes the prior behavior in these
specific ways:

1. Multiple-comparison z-values are defined through ten comparison counts
   instead of using the old four-value approximation.
2. Comparison conclusions consult the metric registry. A lower-is-better
   metric treats a negative interval as positive improvement, reversing the
   old unconditional higher-is-better interpretation.
3. Exposure rows must be production-sourced, and invalid or unparsable dates
   are rejected instead of entering freshness calculations.
4. Outcome validation now requires an assignment and matching arm, rejects
   invalid dates, and rejects cross-arm evidence.
5. Replay detection uses assignment plus metric identity, rather than including
   the timestamp and allowing repeated evidence at different times.
6. Comparisons are produced for every primary metric, not only the first one,
   and the report records the metric IDs used.
7. Any `invalid_definition:*` reason is fatal, preserving fail-closed
   governance for invalid experiment definitions.

## Operational dashboard availability

The stashed untracked dashboard files are not present in the current working
tree, but the repository history now contains the corresponding NR-15 merge:
`36d0f132` and merge `54f3a332`. Therefore the original design note's claim
that `lib/ops/operationalSnapshot.ts` and `lib/ops/operationalSources.ts` are
absent everywhere is stale for the current repository history. The current
working tree still has no files at those paths, so a later phase must verify
which implementation was merged and whether the stashed dashboard can be
reconciled without reintroducing duplicate operational data sources.

## Audit synthesis and backlog cross-check

`docs/audits/AUDIT_SYNTHESIS_2026-09.md` is an evidence-oriented inventory of
historical audits and explicitly warns that the consolidated backlog predates
the P7-A/B/C program. The canonical backlog currently records NR-15 as valid,
with monitoring, alert delivery, on-call ownership, and an incident drill
still outstanding. The synthesis records P7-A/B/C as repository-certified but
also preserves the external operational limits. These statements are
consistent: repository implementation and certification do not imply live
monitoring ownership, alert delivery, or a completed incident drill.

## Deferred work

The next phase must apply or reconcile the statistical fixes, verify the merged
NR-15 dashboard implementation, and run the complete code gate. Those actions
require normal repository access only, but production verification and the
Manager Loop accept transition require database connectivity.
