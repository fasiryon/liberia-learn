# F1/F2 assessment integrity: final readiness report

**Date:** 2026-10-19.
**Scope:** remove the two verified assessment-independence defects (F1, F2) before any production
learning-evidence bridge is built.
**Activation stays off.** Production persistence, migrations, evidence writes and SLM bridge activation remain disabled:
- `ASSISTANCE_LEDGER_PRODUCTION_ENABLED`, `ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED` and `SLM_ASSESSMENT_BRIDGE_WRITES_ENABLED` are literal `false`.
- No migration was written or run.

**Nothing pushed or merged.** All branches are local. Pushing starts Vercel preview deployments, so it
waits for the preconditions below.

## Verdict

| Branch | Verdict | Reason |
|---|---|---|
| `fix/assessment-integrity-f1-f2` (into #193) | **APPROVE**, activation off | Full suite and build pass on the exact code SHA. The independent reviewer approved after five passes, and every finding that affects assessment or mastery integrity is repaired. |
| `fix/records-v2-unverified-compat` (into #194) | **APPROVE** | Type widening plus a test. Runtime behaviour is unchanged and already fails closed. |
| Learning Loop V1 compatibility (`b9d3f42b`) | **APPROVE as a follow-on** | It needs the #193 fix underneath, so it lands after #193 and #194 (see the integration plan). |
| **Activation** of persistence, evidence writes or the SLM bridge | **BLOCK** | Open blockers: SYNC-2, R1–R3, R5–R12 and OPS-1 (see `docs/architecture/assessment/ASSESSMENT_INTEGRITY_FOLLOWUPS.md`). |

## Exact SHAs

**Bases**

| Name | SHA |
|---|---|
| #193 base (`origin/feat/assessment-architecture-v2`) | `dd8568500` |
| #194 base (`origin/feat/academic-records-promotion-v2`) | `6e7840be5` (the owner pushed it after `0d924723`) |
| Learning Loop base (`feat/learning-loop-integration-v1`, local) | `bd8d2ed6c` (stack: #190, #191, #193 @ `dd856850`, #194 @ `0d924723`) |

**F1/F2 fix commits (`fix/assessment-integrity-f1-f2`, off `dd8568500`), oldest first**

| SHA | Change |
|---|---|
| `d6c75ac9c` | F1 server-attested independence; F2 purpose-based gating |
| `ca216d71f` | Review fixes: forged appends, channel minimum, device binding, release binding |
| `89bcbf81d` | Hash-bound independence decisions; bounded conflicts |
| `1bf878664` | P2-5: final records; capture-time validation |
| `fafffb4e3` | Refuse every append once a record is final |
| `b84450a54` | SYNC-1: per-device sync acknowledgements |
| `d9897c98b` | Mixed online/offline attempts fail closed. **This is the validated code SHA.** |
| The commit adding this report | Comment fix (`evidence.ts` doc comment) and docs only; verifiable with `git diff d9897c98b HEAD`. |

**Compatibility commits**

| SHA | Branch | Change |
|---|---|---|
| `d7a421a47` | `fix/records-v2-unverified-compat`, off `6e7840be5` | Records V2 accepts `UNVERIFIED` |
| `b9d3f42b3` | `integration/assessment-integrity-f1-f2` | Learning Loop V1 adopts contract 1.1.0 |

**Integration proof:** `integration/assessment-integrity-f1-f2` at `6ca26e532`. It is the Learning Loop stack plus the fix at `d9897c98`, the Records compatibility at `d7a421a4` (including #194 `6e7840be`) and the Learning Loop compatibility commit.

`lib/academic-policy/llAep001.ts` is unchanged, so the cross-branch digest test still holds.

## Test evidence

**Method.** Each run used vitest's `--shard=N/10 --maxWorkers=1`, with shards run one after another in the
foreground. Free memory was about 1.3 GB, and an earlier background run had been stopped for low memory.
The test configuration was not changed. Each build was a foreground `next build`.

| Exact commit | Full suite | `tsc` | `next build` |
|---|---|---|---|
| `89bcbf81d` (requested) | 769 files passed, 2 skipped; **7,566 passed, 0 failed**, 8 skipped | pass | pass (315 s) |
| `fafffb4e3` | **7,569 passed, 0 failed**, 8 skipped | pass | pass (270 s) |
| `d9897c98b` (fix head) | 769 files passed, 2 skipped; **7,572 passed, 0 failed**, 8 skipped | pass | pass (285 s) |
| `0fae9d26b` (integration before #194 `6e7840be`) | **7,893 passed, 0 failed**, 8 skipped | pass | pass (485 s) |
| `955bcf7d0` (integration with #194 `6e7840be`) | **7,917 passed, 0 failed**, 8 skipped | pass | pass (298 s) |
| `6ca26e532` (final integration) | 798 files passed, 2 skipped; **7,920 passed, 0 failed**, 8 skipped | pass | pass (397 s) |
| `d7a421a47` (Records compatibility) | academic-records-v2 and academics suites: 89 passed | pass | covered by the integration build |

**Build warnings.** Every build reports the same third-party warning
(`node_modules/require-in-the-middle`). The "API handler error … Dynamic server usage" lines come from
static-generation probes of dynamic routes and are pre-existing.

**Lint:** `eslint` is clean on every changed file.

**Red phase:** 37 of 38 new F1/F2 tests failed at `dd856850` before the fix.

## Independent review evidence

A read-only `security-auditor` agent made five passes over the diffs.

| Pass | Commit | Result |
|---|---|---|
| 1 | `d6c75ac9` | Confirmed P1: forged appends, an empty channel list, unbound offline devices, unbound purpose and release in projection. P2: stale consumers, conflict growth, kind relabelling, exported item projection. |
| 2 | `ca216d71` | P1-1, P1-2, P1-3 fixed. P1-4 and P2-6 partial (release hash; free-form purpose in the hint and disclosure functions). |
| 3 | `89bcbf81` | P1-4 and P2-6 fixed. "F1 and F2 are closed at the domain layer." |
| 4 | `1bf87866` | P2-5 partial (online-only records could still take `FINALIZED`). Fixed in `fafffb4e`, confirmed in the next pass. It then found the premature-finalize gap, fixed as SYNC-1 in `b84450a5`. |
| 5 | `b84450a5` → `d9897c98` | Mixed-delivery bypass closed. No other path by which missing or client-falsified assistance reaches INDEPENDENT VERIFIED or ADMITTED evidence. **Verdict: APPROVE** merging into #193 with activation off. |

The one comment nit from pass 5 is fixed in this report's commit.

## What is enforced (domain layer)

- **Independence comes only from the server record.** A client's declaration can only weaken evidence, and omitting it is refused.
- **What a record must be to attest INDEPENDENT:**
  - chain-valid and final;
  - free of conflicts;
  - fully instrumented, with no assistance;
  - opened for this delivery type;
  - bound to the attempt, session, release and learner;
  - for an offline response, covered by the device's sync acknowledgement and received before finalization.
- **What happens otherwise:**
  - missing or unsealed records give UNVERIFIED;
  - contradictions are flagged for integrity review;
  - ASSISTED is never upgraded.
- **Appends and admission re-check the record.** Admission and appends of VERIFIED or ADMITTED evidence re-read the record and refuse a stale or forged attestation. A final record accepts no further appends.
- **F2: purpose-based restrictions are bound to the release.**
  - Hint access and disclosure accept only an `IndependenceDecision` issued from a hash-verified release, form and definition. That decision is tighten-only.
  - Disclosure checks the server's attempt status.
  - Independent diagnostic, summative, retention and transfer deliveries, official or not, plus official formative, block hints, the tutor and early explanations or keys, online and offline. Unofficial formative practice keeps its hints and post-response explanations.

## Tracked follow-ups

See `docs/architecture/assessment/ASSESSMENT_INTEGRITY_FOLLOWUPS.md`.

| Item | Status |
|---|---|
| P2-5 | **fixed** |
| NIT-1 (timestamp validation) | **fixed** |
| SYNC-1 | **fixed** |
| P2-8 (exported `projectItemForLearner`; hint count only, no key or mastery effect) | open, tracked |
| SYNC-2 (sync-protocol duties; offline activation blocker) | open |
| R1–R3, R5–R12 (migration design) | open |
| OPS-1 (verify offline attempts only after `FINALIZED`) | open |

GitHub writes from this session return 403, so the owners file these as issues.

## Safe PR integration plan

**Preconditions before any push** (a push starts Vercel preview deployments):
1. Confirm Vercel preview deployment protection is on. On 2026-10-17 previews answered a public 200, and pushes were held for that reason.
2. The #193 and #194 owners accept these compatibility changes.
3. Codex and other sessions share this repository. Re-run `git fetch` and check that the base branches have not moved.

**Order:**
1. **#193:** PR `fix/assessment-integrity-f1-f2` into `feat/assessment-architecture-v2`. It fast-forwards `dd856850`.
2. **#194:** PR `fix/records-v2-unverified-compat` into `feat/academic-records-promotion-v2`. It fast-forwards `6e7840be`. It is independent of step 1 and safe to merge in either order, because it only widens a type.
3. **Learning Loop V1:** after steps 1 and 2 land on their branches, rebase `feat/learning-loop-integration-v1` onto the refreshed stack and cherry-pick `b9d3f42b3`. Re-run the loop and integration suites.
4. **Into `main`:** keep the existing order #190 → #191 → #193 → #194. Then require exact-head CI and a human review on each PR.
5. **`integration/assessment-integrity-f1-f2`** is verification evidence only. Do not open a PR from it.

**Commands.** Run these from `C:\liberia-learn` once the preconditions hold:

```sh
git fetch origin
git merge-base --is-ancestor origin/feat/assessment-architecture-v2 fix/assessment-integrity-f1-f2 && echo ok-193
git merge-base --is-ancestor origin/feat/academic-records-promotion-v2 fix/records-v2-unverified-compat && echo ok-194
git push origin fix/assessment-integrity-f1-f2
git push origin fix/records-v2-unverified-compat
```

Then open the pull requests in the browser:

- https://github.com/fasiryon/liberia-learn/compare/feat/assessment-architecture-v2...fix/assessment-integrity-f1-f2
- https://github.com/fasiryon/liberia-learn/compare/feat/academic-records-promotion-v2...fix/records-v2-unverified-compat
