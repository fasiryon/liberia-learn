# MergeOps history report

Generated 2026-10-19T20:45:06Z · repository fasiryon/liberia-learn · automation: merge OFF, repair OFF · nothing was merged, repaired, deleted or deployed.

## Readiness

| PR | Head | Status | Required checks (exact head) | Blockers and review requirements |
| --- | --- | --- | --- | --- |
| #190 | `49e06b8a` | blocked (GitHub: unknown) | build: success<br>runtime-gate: missing<br>safety: missing<br>GitGuardian Security Checks: success | not-clean-mergeable<br>incomplete-evidence<br>check:runtime-gate<br>check:safety<br>two independent approvals of exact head 49e06b8abba4 from configured reviewers (configured: 0; current-head approvals: 0; stale approvals: 0)<br>founder review through the protected normal process (high risk: diff-budget×1, incomplete-or-structural×365, unclassified×350, protected×214) |
| #191 | `6ec1435c` | blocked (GitHub: unknown) | build: success<br>runtime-gate: missing<br>safety: missing<br>GitGuardian Security Checks: success | not-clean-mergeable<br>incomplete-evidence<br>check:runtime-gate<br>check:safety<br>depends-on-open:#190<br>two independent approvals of exact head 6ec1435c9ecd from configured reviewers (configured: 0; current-head approvals: 0; stale approvals: 0)<br>founder review through the protected normal process (high risk: diff-budget×1, incomplete-or-structural×479, unclassified×461, protected×281)<br>candidate-content owner process; outside MergeOps authority, never auto-merged or repaired<br>academic-release owner process; outside MergeOps authority, never auto-merged or repaired |
| #193 | `eea31523` | blocked (GitHub: unknown) | build: success<br>runtime-gate: missing<br>safety: missing<br>GitGuardian Security Checks: success | not-clean-mergeable<br>incomplete-evidence<br>check:runtime-gate<br>check:safety<br>two independent approvals of exact head eea315230d22 from configured reviewers (configured: 0; current-head approvals: 0; stale approvals: 0)<br>founder review through the protected normal process (high risk: diff-budget×1, incomplete-or-structural×40, unclassified×35, protected×10)<br>student-records owner process; outside MergeOps authority, never auto-merged or repaired |
| #194 | `d7a421a4` | blocked (GitHub: unknown) | build: success<br>runtime-gate: missing<br>safety: missing<br>GitGuardian Security Checks: success | not-clean-mergeable<br>incomplete-evidence<br>check:runtime-gate<br>check:safety<br>two independent approvals of exact head d7a421a47d5f from configured reviewers (configured: 0; current-head approvals: 0; stale approvals: 0)<br>founder review through the protected normal process (high risk: diff-budget×1, protected×19, incomplete-or-structural×46, unclassified×40)<br>student-records owner process; outside MergeOps authority, never auto-merged or repaired |

## Recommended merge order (recommendation only)

1. #190
2. #191 (after #190) — revalidate after #190 — shared-history:#190:15-commits
3. #193
4. #194 — revalidate after #193

After each merge, every remaining PR must be updated to the new base and pass exact-head CI and reviews again.

## Evidence notes

- Historical replay of merged PRs #190, #191, #193 and #194 as they stood immediately before merge. Mergeability, branch protection and full patches at merge time are not recoverable after the fact and are treated as unknown (fail closed). No current PR or deployment state is inferred.
- #191: last required CI 2026-10-17T20:40:19.000Z; base advanced by #190 before merge at 2026-10-19T20:27:47Z; strict protection would have required a fresh exact-head run.
- #193: last required CI 2026-10-19T19:00:30.000Z; base advanced by #190, #191 before merge at 2026-10-19T20:28:16Z; strict protection would have required a fresh exact-head run.
- #194: last required CI 2026-10-19T19:03:17.000Z; base advanced by #190, #191, #193 before merge at 2026-10-19T20:28:25Z; strict protection would have required a fresh exact-head run.

