# Assessment integrity F1/F2: tracked follow-ups

This is the tracker for items left open or deferred by the F1/F2 remediation on branch
`fix/assessment-integrity-f1-f2`. GitHub writes from the working session return 403, so the owners file
these as issues. Each item names its owner and what it blocks.

**Activation stays off.** Persistence, migrations, evidence writes and SLM bridge activation remain
disabled; the code flags stay literal `false`.

## Status

| ID | Severity | Item | Owner | Status | Blocks activation? |
|---|---|---|---|---|---|
| P2-5 | P1 for mastery integrity | Consumers read `independence` on VERIFIED evidence without re-checking the record. A late offline replay could have left an INDEPENDENT label stale, and Records V2 `masterySummaryFromEvidence` counts VERIFIED official INDEPENDENT evidence toward LL-AEP-001 mastery. | Assessment V2 (#193) | **Fixed.** Records that accept offline devices are not final until `FINALIZED`; until then they attest UNVERIFIED; a final record refuses every append. Tests: "P2-5: …" in `__tests__/assessment-v2/assistance-integrity.test.ts`. | No longer |
| NIT-1 | P2 | A conflicting offline delivery's `capturedAt` was not validated as an ISO timestamp, so `NaN` slipped past the after-seal comparison. This failed safe. | Assessment V2 (#193) | **Fixed.** Now validated with `assertIsoTimestamp`; test "a conflicting offline delivery with an invalid capture time is refused". | No |
| P2-8 | P2 | `projectItemForLearner` is still exported with a caller-set `independent` boolean. A caller can show a hint *count* for an item; hint text and any explanation or key still require an issued `IndependenceDecision`. | Assessment V2 (#193) | **Open, tracked.** Fix: accept `{ decision }` or the literal `independent: true` only, and keep a private helper for `projectFormForLearner`. | No (no key, hint text or mastery effect) |
| X-194 | Type compatibility | Records V2 `AssessmentEvidenceForRecords.independence` must include `"UNVERIFIED"`. Its runtime checks are already `!== "INDEPENDENT"`. | Records V2 (#194) | Compatibility branch prepared (see the readiness report). | Yes, for the integration build |
| X-LL | Type compatibility | The Learning Loop V1 prototype must accept `"UNVERIFIED"` and contract 1.1.0 envelopes. | Learning Loop V1 | Compatibility branch prepared (see the readiness report). | Yes, for the integration build |
| R1–R3 | P1 (design) | Migration design: tenant columns on entries; no cascading FK into immutable rows; a partial offline index scoped to `ASSISTANCE` rows. | Assessment V2 + platform | Open; see `ASSISTANCE_RECORD_MIGRATION_REVIEW_V1.md`. | Yes (persistence) |
| R5–R12 | P2 (design) | Migration hardening: TRUNCATE triggers, grants, seal and attempt-status constraint, concurrency, rollback, Prisma drift checks, audit in the same transaction. | Assessment V2 + platform | Open. | Yes (persistence) |
| OPS-1 | Operational | Offline-capable attempts must be verified only after the sync service writes `FINALIZED`. Earlier verification is recorded as UNVERIFIED and cannot be re-recorded under the same key. | Assessment V2 + sync owner | Open (route design). | Yes (persistence) |
