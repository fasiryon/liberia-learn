# MergeOps live report

Generated 2026-10-19T21:12:10.509Z · repository fasiryon/liberia-learn · automation: merge OFF, repair OFF · nothing was merged, repaired, deleted or deployed.

## Readiness

| PR | Head | Status | Required checks (exact head) | Blockers and review requirements |
| --- | --- | --- | --- | --- |
| #195 | `3e4ba71d` | blocked (GitHub: clean, draft) | build: missing<br>runtime-gate: missing<br>safety: missing<br>GitGuardian Security Checks: success | repository-or-base<br>not-clean-mergeable<br>incomplete-evidence<br>check:build<br>check:runtime-gate<br>check:safety<br>two independent approvals of exact head 3e4ba71df9f4 from configured reviewers (configured: 0; current-head approvals: 0; stale approvals: 0)<br>founder review through the protected normal process (high risk: diff-byte-budget×1, diff-budget×1, unclassified×168, authority×92, incomplete-or-structural×63, protected×113)<br>academic-release owner process; outside MergeOps authority, never auto-merged or repaired<br>resolve deterministic analysis findings |
| #192 | `a5d77b5d` | awaiting-review (GitHub: clean) | build: success<br>runtime-gate: success<br>safety: success<br>GitGuardian Security Checks: success | two independent approvals of exact head a5d77b5d5ecb from configured reviewers (configured: 0; current-head approvals: 0; stale approvals: 0)<br>founder review through the protected normal process (high risk: diff-byte-budget×1, diff-budget×1, protected×23, unclassified×30, authority×15)<br>resolve deterministic analysis findings |
| #187 | `dd825e30` | blocked (GitHub: unknown) | build: success<br>runtime-gate: missing<br>safety: missing<br>GitGuardian Security Checks: success | not-clean-mergeable<br>check:runtime-gate<br>check:safety<br>two independent approvals of exact head dd825e30aa2d from configured reviewers (configured: 0; current-head approvals: 0; stale approvals: 0)<br>founder review through the protected normal process (high risk: diff-byte-budget×1, diff-budget×1, authority×4)<br>resolve deterministic analysis findings |

## Recommended merge order (recommendation only)

1. #187
2. #192
3. #195 — retarget-required:feat/g7-native-curriculum-v1-already-merged

Parked, idle beyond the staleness window (owner decision, not ordered): #129, #126, #51, #45, #44, #38, #15, #14, #5, #2, #1

After each merge, every remaining PR must be updated to the new base and pass exact-head CI and reviews again.

## Evidence notes

- CODEOWNERS unavailable on main (github:GET:404); owner requirements not derived.
- Unauthenticated public read: branch protection is not readable, so every evaluated PR carries protection-unverified.

