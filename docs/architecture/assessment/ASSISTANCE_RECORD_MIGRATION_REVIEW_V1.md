# Migration design review: M1–M3 (assistance record and canonical evidence)

**Status: design review only.** Nothing here was run against any database. No migration is applied, and no flag
is changed: `ASSISTANCE_LEDGER_PRODUCTION_ENABLED`, `ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED` and
`SLM_ASSESSMENT_BRIDGE_WRITES_ENABLED` all stay `false`.

**What it reviews.** The proposals M1–M3 in
`docs/architecture/learning-loop/INTEGRATION_BOUNDARIES_HANDOFF_V1.md` (§A.6, §C.5; learning-loop commit `bd8d2ed6`).
It reviews them against the domain model that now exists on this branch, `lib/assessment/v2/assistance.ts`.

**Precedents in the repository:**

| Precedent | Where | What it does |
|---|---|---|
| Append-only triggers | `20260810_000004_p2a_curriculum_provenance_immutability` | `BEFORE UPDATE OR DELETE` row triggers, `BEFORE TRUNCATE` statement triggers, `lock_timeout`/`statement_timeout` guards |
| AuditLog immutability | `20260522_000001_audit_immutability` | `UPDATE` and `DELETE` triggers; no `TRUNCATE` trigger |
| Tenant model | none | There is no tenant table and no row-level security. Tenant and school scope are enforced in application code only. |
| Partial unique indexes | none | No existing migration uses `CREATE UNIQUE INDEX … WHERE`. |

## Findings

| # | Sev | Area | Finding | Required change before M2 is written |
|---|---|---|---|---|
| R1 | P1 | Tenant isolation | M2 places scope (`tenantId`, `schoolId`, `studentId`) only on the ledger header. An entry row is in scope only through `ledgerId`. A query that reads entries by `attemptId` or `deviceId` without the join has no tenant predicate, and there is no RLS to catch it. | Denormalize `tenantId`, `schoolId` and `studentId` onto every entry. Add a composite FK `(ledgerId, tenantId, schoolId, studentId)` to a matching unique key on the header, so an entry can never point at a ledger with a different scope. All reads go through one repository function that requires the session scope. |
| R2 | P1 | Append-only vs. cascades | `Student` relations in this schema routinely use `onDelete: Cascade`. If M1 or M2 add an FK to `Student` or `User`, deleting a student would try to cascade-delete immutable rows. The trigger then aborts the delete. The same happens to `AuditLog`: `userId` is `SetNull`, which issues an `UPDATE` that `audit_log_no_update` rejects. | Use no FK to `Student`/`User` (scope by id, as `LearningEvent` already does), or use `RESTRICT`. Record a privileged, audited erasure procedure for lawful deletion requests; anonymization or crypto-shredding of the scope columns is an owner decision. |
| R3 | P1 | Offline replay and conflicts | §A.6 proposes a partial unique index on `(ledgerId, deviceId, clientSequence)`. The domain model records a conflicting replay as a **separate CONFLICT entry**. If that row carries `deviceId`/`clientSequence`, the index rejects it and the conflict is lost: the attempt would look clean instead of UNVERIFIED. | Scope the index `WHERE "eventType" = 'ASSISTANCE'`. CONFLICT rows keep `deviceId` and `clientSequence` null and store the rejected payload digest. Uniqueness of the replay itself is already covered by `(ledgerId, idempotencyKey)`, since the key is derived from `deviceId:clientSequence`. |
| R4 | P1 | Offline replay after seal | A device may legitimately deliver assistance captured before the seal after the attempt was submitted. That changes the record head, and `admitToMastery` then refuses (`assessment_assistance_attestation_stale`), which is correct. But re-verifying produces a VERIFIED envelope with the **same idempotency key** and a different hash, which `appendEvidence` rejects as a conflict. The evidence cannot be re-recorded. | M1 must choose one: (a) verification of OFFLINE-runtime attempts waits until the attempt is CLOSED after the sync window, so the record is final; or (b) the verified key includes the attestation head and consumers de-duplicate by `derivedFromEvidenceId`. (a) is recommended because it is simpler and keeps one verified envelope per response. This is a #193 owner decision. |
| R5 | P2 | Append-only completeness | The proposed triggers cover `UPDATE` and `DELETE` only. `TRUNCATE` bypasses row triggers. | Add `BEFORE TRUNCATE … FOR EACH STATEMENT` triggers on both M2 tables, and on `LearningEvent` for M3, as P2-A does. |
| R6 | P2 | Trigger bypass | The table owner, or a session with `session_replication_role = replica`, can disable triggers. The hash chain does not stop a privileged writer from rebuilding a consistent chain. | The application role must not own these tables and must have only `INSERT`/`SELECT` on them. Two external anchors exist: the record head hash is copied into the evidence envelope's `assistanceAttestation`, and the audit row is written in the same transaction. Rebuilding a chain therefore also requires rewriting evidence and AuditLog rows, both of which are immutable. Document the database grants in the deployment route. |
| R7 | P2 | Seal atomicity | `SEALED` must be inserted in the same transaction as the attempt status change (§A.3). A partial unique index on `(ledgerId) WHERE eventType = 'SEALED'` stops double seals. Nothing in the database, however, stops an attempt reaching `SUBMITTED` without a seal. | Add a deferred constraint trigger on the M1 attempt table. Moving to `SUBMITTED`/`CLOSED` requires a `SEALED` entry for its ledger in the same transaction. Alternatively, route every status change through one stored procedure. |
| R8 | P2 | Concurrency | Optimistic `(ledgerId, sequence)` uniqueness with retry is sound. The retry must recompute `prevHash` from the new head and re-run the idempotency check. Without that, a concurrent identical replay could append a duplicate. | The repository append runs at `SERIALIZABLE`, or takes `SELECT … FOR UPDATE` on the header row, and re-reads the head inside the transaction. |
| R9 | P2 | Rollback safety | Prisma migrations are forward-only. M2 is additive (new tables, functions, triggers, indexes), so rolling back while the tables are **empty** is a plain drop. Once rows exist, dropping them destroys integrity evidence. | Rollback plan: keep the tables, stop the writers through the flag, and fix forward. A down-script is provided only for the empty state, and it checks `count(*) = 0` before dropping. Use `SET lock_timeout`/`statement_timeout` as P2-A does. |
| R10 | P2 | M3 scope | The proposed `LearningEvent` trigger is limited to `eventType LIKE 'learning.canonical.%'`. The only bulk mutation found is `prisma/seeds/cha-demo.ts`, which runs `deleteMany` on `source = 'seed:cha-demo'` rows whose event types are not canonical, so it is unaffected. No application code updates or deletes canonical rows. | Before applying M3, re-run the grep. Add `BEFORE TRUNCATE`, but only if the owners accept that test fixtures can no longer truncate `LearningEvent`; otherwise accept the residual risk for `TRUNCATE` and document it. |
| R11 | P2 | Partial indexes and Prisma drift | Prisma cannot express partial unique indexes. They live only in `migration.sql`, and `prisma migrate diff` will report drift. | Name the indexes explicitly and add a schema comment. Extend the existing migration verification (`prisma/migrations/verification`) to assert that they exist. |
| R12 | P2 | Audit integrity | Assistance audit events carry ids, sequence and kind only, with no tutor text or response bodies. That is correct. The insert must be in the same transaction as the entry, or a crash leaves a record without its audit row. | Write the entry and its `AuditLog` row in one transaction. `AuditLog.resourceType = "assessment_attempt"` and `resourceId = attemptId`. |

## What M1 must additionally provide for this branch's code

- **Attempt and session.** `ServerAttemptContext.attempt.sessionId` must be the delivery session that the
  assistance record is opened with, and it must never come from the client.
- **Evidence store.** Append-only, with the same trigger set as M2. `contractVersion` must be stored, and
  rows under contract `1.0.0` are never admitted.
- **Response store.** Bodies are referenced by `responseId`/`responseDigest` only. The digest is
  recomputed on the server.

## Verdict for the migration design

**REVISE before M2 is drafted:**
- **P1, must be resolved:** R1–R4.
- **P2, to be fixed while drafting:** R5–R12.

None of this blocks the pure-domain F1/F2 remediation on this branch, because nothing persists.
