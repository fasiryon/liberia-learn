# MergeOps V1 demonstration evidence (2026-10-19)

Read-only. Nothing was merged, repaired, pushed by MergeOps, deleted or deployed.

- `history/`: offline replay of merged PRs #190, #191, #193 and #194 from
  `tools/mergeops/fixtures/history-190-194.json`. That fixture holds GitHub PR, check-run and
  review data plus local Git numstat and relations. Regenerate with
  `node tools/mergeops/cli.mjs history tools/mergeops/fixtures/history-190-194.json`.
- `live/`: unauthenticated read-only discovery of the 14 open PRs, with #192, #195 and #187
  evaluated in depth at their heads at that time. #192 was evaluated at `a5d77b5d`, before this
  round's commits. Regenerate with `node tools/mergeops/cli.mjs report --pr 192,195,187`.
- `audit.jsonl` in each folder: hash-chained, proposed-only records, one per readiness entry,
  merge-order position and hygiene proposal.
- `hygiene/` is generated locally by `cli.mjs hygiene`. It is gitignored because it contains
  workstation paths.

Key findings are summarised in `docs/ops/MERGEOPS_V1.md` under "Demonstration".
