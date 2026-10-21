# Library Modernization Ledger V1

The ledger is the authoritative record of every lesson's modernization state. For hundreds or thousands of lessons it answers, at any moment and from one replayable file:

| Question | Where the answer comes from |
|---|---|
| What is live? | `LIVE_OBSERVED`: the exact live revision id, content hash and status, from a read-only extraction |
| What is deficient? | `AUDIT_RECORDED` for that exact revision (stale as soon as the live revision changes), with the provisional track |
| What is being rebuilt? | `WAVE_SCHEDULED`, `WORK_STARTED`, `CANDIDATE_REGISTERED`, each bound to the legacy revision it replaces |
| What awaits independent review? | `REVIEW_REQUESTED` on one exact candidate hash |
| What is approved? | Human `REVIEW_RECORDED` acceptances on that hash, then `RELEASE_AUTHORIZED`, then `RELEASED` |
| What has demonstrated learning? | `OUTCOME_EVIDENCE_RECORDED` bound to the released content hash, classified by `classifyLessonOutcome` (Pilot Measurement Plan V1) |

Code: `lib/curriculum/modernization/ledger.ts`. File: `curriculum/modernization/v1/ledger/events.jsonl`. Current answers: `curriculum/modernization/v1/DASHBOARD.md`.

## Integrity

- **Append-only, hash-chained.** Each event carries `prevHash` and its own `hash` (SHA-256 of the canonical event). Replay rejects an edited event (`EVENT_TAMPERED`), a re-signed edit (`CHAIN_BROKEN`), and a deleted or reordered event (`SEQUENCE_BROKEN`).
- **Authority re-checked on replay.** Every event is validated against the state built from all earlier events, both when appended and when the file is replayed. A forged but well-chained approval still fails (`INDEPENDENT_ACCEPTANCE_MISSING`, `SELF_REVIEW_PROHIBITED`, ...).
- **Exact hashes.** Audits bind to the live revision hash, candidates to the live legacy hash, reviews and release to the current candidate hash, outcomes to the released content hash. Any change makes the dependent record stale instead of silently carrying over.
- **Verification:** `npx tsx scripts/verify-library-modernization-ledger.ts` (no database needed) and `__tests__/library-modernization/committed-baseline.test.ts`.

## Roles and what each may record

| Role | Kind | May record |
|---|---|---|
| INVENTORY_TOOL | automated | LIVE_OBSERVED, AUDIT_RECORDED, TRACK_PROPOSED, HOLD_PLACED, WAVE_SCHEDULED (proposal), STALE_DETECTED |
| MERGEOPS | automated | LIVE_OBSERVED, STALE_DETECTED. Nothing else |
| CANDIDATE_AUTHOR | AI agent or human | WORK_STARTED, CANDIDATE_REGISTERED, REVIEW_REQUESTED |
| AI_REVIEWER | AI agent | REVIEW_RECORDED, kept as **advisory**: it never counts toward acceptance |
| CURRICULUM_REVIEWER | human | REVIEW_RECORDED (counts if independent of the authors), TRACK_CONFIRMED |
| GOVERNANCE_OWNER | human | TRACK_CONFIRMED, HOLD_PLACED, HOLD_RESOLVED (with a decision reference), WAVE_SCHEDULED, REVIEW_REQUESTED |
| CURRICULUM_AUTHORITY | human | RELEASE_AUTHORIZED |
| RELEASE_SYSTEM | automated | RELEASED, only under an authorization for the same hash |
| MEASUREMENT_LEAD | human | OUTCOME_EVIDENCE_RECORDED |

## Rules enforced

1. A candidate author can never review its own candidate (`SELF_REVIEW_PROHIBITED`). An AI reviewer from the same model family as an AI author is recorded as non-independent.
2. Acceptance requires **human, independent** `ACCEPT` decisions on the `ACADEMIC` and `ASSESSMENT` scopes for one exact candidate hash. A new candidate version discards earlier reviews.
3. Release authorization needs that acceptance, a legacy mapping plan digest, and `historyPolicy: PRESERVE_HISTORICAL_PINS`. It cannot come from the candidate's author.
4. `RELEASED` is a record of a release performed by the governed release mechanism. The ledger never publishes, replaces a historical revision, writes learner state, scores or admits mastery evidence.
5. A lesson on hold accepts no candidate work, scheduling or release until a human governance owner resolves the hold with a decision reference.
6. Learning outcomes are recorded only against the released content hash. Delivery evidence (release, completion) never lifts a lesson above `DELIVERED`. `LEARNING_SUCCESS_DEMONSTRATED` requires unassisted baseline, immediate, delayed-retention (≥14 days), transfer and independently comparable gains with ≥30 matched learners, per Pilot Measurement Plan V1.

## Stages

`NOT_OBSERVED → LIVE_UNAUDITED → AUDITED → SCHEDULED → IN_PROGRESS → CANDIDATE_READY → AWAITING_INDEPENDENT_REVIEW → (CHANGES_REQUESTED ↔) REVIEW_ACCEPTED → RELEASE_AUTHORIZED → RELEASED`, with `ON_HOLD` overriding everything before release. The outcome classification is a separate axis, so a released lesson stays `DELIVERED` until measured evidence says otherwise.

## Scale path

V1 stores the ledger as a committed JSONL file. That suits the program's current write rate (baseline plus candidate work, a few events per lesson) and gives git review of every governance event. Once human reviewers record decisions through the product, the same event model moves into an append-only database table with the same hash chain, the same `applyEvent` checks run server-side under RBAC, and the file becomes an export. That move needs its own schema review and migration authorization; it is not part of this change.
