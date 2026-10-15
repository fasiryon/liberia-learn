# MergeOps V1 local evidence

Base: `a1508ceaf7d89a338de624e9f63c9c4c592ca28c`.

- `safety-tests.txt`: 74 passing native Node safety tests, including a real temporary shallow clone and mocked GitHub side effects.
- `runtime-gate.txt`: existing final-gate and permission tests, 3 files / 50 tests passing.
- `validate-changed.txt`: repository changed-file validation passing; native MergeOps tests run separately because Vitest intentionally includes only `__tests__` TypeScript files.
- `report.json`, `demo-output.txt`: offline lifecycle replay. The exact historical PR #190 fixture failure produces a bounded repair proposal; the PR #188 migration scenario escalates. Zero external writes; merge and repair disabled.
- `mission.jsonl`: redacted, hash-chained replay decisions and proposal. Historical source provenance is in `tools/mergeops/fixtures/`.

The replay uses a fixture-only projection of PR #190, not its complete application
diff. It does not claim either historical PR is automatically safe. The historical
failure and later different failure are distinguished in `docs/ops/MERGEOPS_V1.md`.

No live App installation, permission change, merge, deployment, hosted migration,
paid provider invocation or infrastructure change was performed. Live monthly
Vercel measurements are unavailable; no monthly consumption total is invented.

Full application type/build/browser gates run in the existing PR CI. These local
logs do not claim a new full application build. Exact PR head and CI run links are
reported in the delivery handoff.
