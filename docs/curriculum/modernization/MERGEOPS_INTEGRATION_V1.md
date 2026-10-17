# Modernization × MergeOps integration V1

MergeOps V1 (PR #192, `feat/mergeops-v1`, unmerged) already escalates every curriculum, migration and student-evidence path, and keeps autonomous repair and merge **off**. This design adds what modernization needs from engineering automation without giving it curriculum authority.

## MergeOps may

| Duty | Mechanism |
|---|---|
| Verify deterministic tests | `npx vitest run __tests__/library-modernization` (committed baseline, packages, ledger and pipeline rules); `npx tsx scripts/verify-library-modernization-ledger.ts` |
| Report stale manifests | The committed-baseline test fails when any package file no longer matches its manifest hash; record `STALE_DETECTED` in the ledger as role `MERGEOPS` |
| Guard the ledger | `npx tsx scripts/check-modernization-ledger-diff.ts <base>`: exit 0 for automated append-only changes, 2 to escalate human or authority events, 1 to reject rewritten or deleted history |
| Track candidate readiness | Read `tracker.json` and `ledger/state.json` and report stage counts on the PR |
| Identify safe repair opportunities | Report only, such as a regenerated baseline after an unchanged extract (expected: 0 appended events). It may not commit repairs while repair is disabled |
| Produce audit evidence | Attach the guard report and test output to its evidence bundle |

## MergeOps must not, and how that is enforced

| Prohibited | Enforcement |
|---|---|
| Approve its own or any academic content | The ledger refuses `REVIEW_RECORDED` from any role except CURRICULUM_REVIEWER (human) or AI_REVIEWER (advisory, never counted); MERGEOPS may only record LIVE_OBSERVED and STALE_DETECTED (`ROLE_NOT_PERMITTED`) |
| Forge teacher or curriculum-authority decisions | The diff guard escalates every appended human or authority event for that person's own PR approval. In V1 a git file cannot authenticate a person; the DB ledger (scale-out gate G4) moves these decisions behind authenticated RBAC |
| Publish lessons | Only RELEASE_SYSTEM records RELEASED, and only under a RELEASE_AUTHORIZED for the same hash; the pipeline has no publish path |
| Replace historical student references | Mapping plans fix PRESERVE_HISTORICAL_PINS; the ledger refuses release authorization without it |
| Override curriculum review | Acceptance needs human independent ACCEPT on ACADEMIC and ASSESSMENT; replay re-checks it, so a forged but well-chained approval fails |
| Activate scoring or mastery | Assessment definitions are REVIEWER_ONLY; projections carry no governed items; nothing writes evidence |
| Run production migrations | Extraction is read-only (`SET TRANSACTION READ ONLY`, aborts otherwise); no migration is included |

Automatic merge and repair stay disabled until the separate MergeOps operational safety review authorizes them. The guard report always carries `mayAutoMerge: false`.

## Current state

Run on this branch against `origin/main`: verdict `AUTOMATED_APPEND_ONLY`, 3,702 appended events (LIVE_OBSERVED 1,105, AUDIT_RECORDED 1,114, TRACK_PROPOSED 1,114, HOLD_PLACED 353, WORK_STARTED 4, CANDIDATE_REGISTERED 6, REVIEW_REQUESTED 6), no escalations, no problems. No human decision is recorded yet.
