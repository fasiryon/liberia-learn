# P2-C Infrastructure-Invariant Closure — Completion Record

Date: 2026-08-19. Branch `codex/p2c-waec-baseline-alignment`, on top of the
blocker-closure commits (`4870b06e`). PR
https://github.com/fasiryon/liberia-learn/pull/86 (open, not merged).
Staging project `yonpfzjczoffhrgibxkz`. Production project
`bnphuinpvgpmebcsvmsp` was not touched.

## Why

The blocker-closure pass fixed the AI-telemetry double-write with a
per-process mutex and correctly stopped, rather than bulk-rewriting, a
larger-than-expected (38 of 128 entries) legacy-manifest defect. The
founder explicitly authorized two follow-on engineering actions: replace
the process-local mutex with a real, database-enforced, distributed
idempotency invariant, and correct the 38 manifest entries using canonical
git-blob evidence now that the full scope was known and the numbers had
been independently re-verified.

## Distributed telemetry idempotency

`AIInteraction.dedupeKey` is now `@unique` (migration
`20260819_000001_p2c_ai_interaction_dedupekey_unique`, applied to staging).
It was already the caller-supplied idempotency key for offline-sync dedup
on this exact table; a provider invocation's `dedupeKey` now defaults to
its `generationCorrelationId` only when the caller hasn't already supplied
one for that other purpose, so the same column and constraint serve both
use cases without a third identifier.

`logAIInteraction()` (`lib/ai/interactionLog.ts`) tries `create()` directly;
if Postgres reports a real unique-constraint violation, it fetches and
reuses the row the database says already exists. This is atomic at the
database engine level -- correct across any number of concurrent
processes, not just within one -- and the in-process mutex from the prior
pass is removed entirely rather than kept alongside it.

Proven live against staging, genuinely cross-process (two separate `npx
tsx` OS processes racing the same key, not two promises in one event
loop), $0 spent (fixture-shaped writes, no real provider call needed to
prove a database constraint): `docs/ops/P2C_DISTRIBUTED_DEDUP_PROOF.json`.
Writer A's `create()` won; Writer B's `create()` received Postgres's own
`Unique constraint failed on the fields: (dedupeKey)` and resolved to
Writer A's row; Writer C's distinct key produced its own row.
`AIInteraction`/`AiInteractionLog` delta: +2/+2 across three writer
processes (not +3/+3).

## Legacy manifest canonicalization

Re-ran the full 128-entry precheck before writing anything: exactly 90
MATCH / 38 PLATFORM_NORMALIZATION_MISMATCH / 0 of every other category --
matching the authorized numbers exactly. `scripts/verify-legacy-manifest-canonical-bytes.ts`
then rewrote only `fileBytes`/`sha256` on those 38 entries to their
canonical git-blob values; every other field (migration SQL, name, path,
`gitBlobSha`, ordering, production ledger data) is untouched, confirmed by
a post-write recheck landing at exactly 128/128 MATCH.
`__tests__/pre-p2a.canonical-baseline.test.ts` no longer reads the
checked-out worktree file for this assertion -- it reads the same
canonical git blob bytes (batched into one `git cat-file --batch` call for
speed) the verifier does, so it behaves identically on Windows, Linux, and
macOS.

## AI telemetry accounting, fully reconciled

The apparent discrepancy between the original report's "~12 calls /
~$0.004" and the confirmation audit's "8 invocations / $0.0052" is now
arithmetically explained, not just described (`docs/ops/P2C_AI_TELEMETRY_RECONCILIATION.json`'s
`priorAuditAccountingReconciliation`): the audit's query window
(15:15-15:25 UTC) captured 2 of the 3 real runs (missing the earliest,
2026-08-18 19:35 UTC) -- that is the entire 8-vs-12 count gap. Separately,
its cost figure summed all 16 raw (duplicated) rows in that window rather
than the 8 distinct invocations: `2 * (0.00128025 + 0.00133965) =
0.0052398`, matching its reported "≈$0.0052" almost exactly, versus the
correctly deduplicated `0.00128025 + 0.00133965 = 0.0026199` for that same
window. The true, full-session, fully-deduplicated total is
`0.00133125 + 0.00128025 + 0.00133965 = 0.00395115` across all 12 distinct
invocations -- the number now recorded as the artifact's real spend.

## Staging health

P2-A (4/4 tables), P2-B (11/11 tables) reverified present, queryable, and
unchanged. P2-C: 16 `AssessmentBaselineCompetency` rows still
`SUBJECT_LEVEL`, 5 frameworks, RLS/grants on the 13 P2-C tables unchanged
(0 anon/authenticated grants); the single `CurriculumBaselineAlignment` row
is the pre-existing, legitimately seeded Math-pilot row from the original
P2-C work (2026-08-17), not new AI-generated output -- no rows created in
any curriculum acceptance table by this pass. No production project
accessed for any mutation; a single read-only confirmation query re-ran at
the end.

## Remaining blocker

CI must be re-run against the new HEAD to confirm both `CI/build` and
`clean-bootstrap-pg17` are green now that the manifest is corrected -- see
the final infrastructure-closure report for the exact run IDs and results.
