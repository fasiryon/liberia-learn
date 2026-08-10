# P2-A Step 1 Schema Approval Package

Date: 2026-08-10
Scope: Prisma schema and unapplied migration preparation only
Status: Corrected and committed locally, staging execution awaits final runbook review

## 1. Exact schema diff

The authoritative proposed Prisma schema is `prisma/schema.prisma`. The substantive diff is:

- Add 14 P2-A enums:
  - `CurriculumProvenanceCompleteness`: `VERIFIED`, `PARTIAL`, `UNVERIFIED`
  - `CurriculumLifecycleState`: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REVOKED`, `SUPERSEDED`
  - `CurriculumRevisionKind`: `ORIGINAL_GENERATION`, `IMPORT`, `HUMAN_CREATE`, `HUMAN_EDIT`, `FORK`, `AI_REGENERATION`, `AI_UPGRADE`, `AI_ENRICHMENT`, `DETERMINISTIC_ENRICHMENT`, `ALIGNMENT_CHANGE`, `METADATA_CHANGE`, `BACKFILL_SNAPSHOT`
  - `CurriculumOriginKind`: `AI_GENERATED`, `DETERMINISTIC_GENERATED`, `IMPORTED`, `HUMAN_AUTHORED`, `FORKED`, `AI_UPGRADED`, `LEGACY_UNKNOWN`
  - `CurriculumGovernanceEventType`: `SUBMITTED`, `RISK_ASSESSED`, `APPROVED`, `REJECTED`, `RETURNED_FOR_REVIEW`, `REAPPROVED`, `REVOKED`, `REINSTATED`, `SUPERSEDED`
  - `CurriculumGovernanceActorType`: `USER`, `SYSTEM`, `LEGACY_UNKNOWN`
  - `CurriculumApprovalBasis`: `HUMAN_REVIEW`, `AUTOMATED_RISK_POLICY`, `ROLE_POLICY`, `SCHOOL_POLICY`, `IMPORT_POLICY`, `LEGACY_UNKNOWN`
  - `CurriculumReviewAuthority`: `MOE`, `SCHOOL`, `PLATFORM`, `SYSTEM`, `UNKNOWN`
  - `CurriculumFutureAssignmentPolicy`: `BLOCK_NEW`, `REPLACE_WITH_SUCCESSOR`
  - `CurriculumExistingAssignmentPolicy`: `KEEP_EXISTING`, `WITHDRAW_EXISTING`, `REPLACE_WITH_SUCCESSOR`
  - `CurriculumOfflineCachePolicy`: `NO_INVALIDATION`, `INVALIDATE_ON_NEXT_REFRESH`, `URGENT_INVALIDATE_ON_NEXT_REFRESH`
  - `CurriculumEvidenceType`: `URL`, `DOCUMENT`, `CURRICULUM_STANDARD`, `TEXTBOOK`, `REVIEWER_NOTE`, `EXTERNAL_REFERENCE`
  - `CurriculumEvidencePurpose`: `FACTUAL_SUPPORT`, `CURRICULUM_AUTHORITY`, `SOURCE_MATERIAL`, `IMPORT_ORIGIN`, `REVIEW_SUPPORT`
  - `CurriculumEvidenceStatus`: `ACTIVE`, `WITHDRAWN`
- Add exactly four models:
  - `CurriculumProvenance`: small mutable projection root with one-to-one content identity, explicit completeness and lifecycle, and nullable unique current revision pointer.
  - `CurriculumContentRevision`: immutable, sequenced, versioned JSON snapshot and hash with optional origin-appropriate authorship, generator, AI, prompt, correlation, lineage, idempotency, and backfill metadata.
  - `CurriculumGovernanceEvent`: immutable, sequenced domain event targeting an exact revision, with optional event-specific approval, authority, risk, reviewer extension, replacement, revocation consequence, audit, idempotency, and backfill metadata.
  - `CurriculumEvidence`: immutable evidence metadata targeting an exact revision, separating evidence type from purpose and supporting supersession.
- Add nullable `AIInteraction.generationCorrelationId` and composite index `(generationCorrelationId, createdAt)`.
- Add relation-only back-relations listed in section 3.
- Keep `CurriculumContent.moeAlignments` unchanged as the operational alignment source. No `CurriculumStandardAlignment` model is introduced.

`npx prisma format` normalized legacy alignment throughout `schema.prisma`, producing a raw diff of 1,161 insertions and 907 deletions. Whitespace-ignoring review is 255 insertions and 1 deletion. The apparent one-line deletion is relocation of an existing `Timetable` unique declaration by the formatter, not a semantic deletion.

## 2. Exact physical database changes

### Migration A

- Create the 14 enum types above.
- Create `CurriculumProvenance`, `CurriculumContentRevision`, `CurriculumGovernanceEvent`, and `CurriculumEvidence`.
- Create 12 foreign keys, all with `ON DELETE RESTRICT` and `ON UPDATE CASCADE`.
- Create primary keys, sequence uniqueness within each provenance root, idempotency uniqueness, exact-revision/provenance composite integrity, current-revision uniqueness, evidence supersession uniqueness, and query-supporting indexes.
- `CurriculumProvenance.curriculumContentId` references the existing `CurriculumContent.id`; the existing table is not altered.
- Governance author/actor/evidence-adder deletion is restricted as approved.

### Migration B1

- Add one nullable `TEXT` column, without a default, to `AIInteraction`.

### Migration B2

- Create `AIInteraction_generationCorrelationId_createdAt_idx` concurrently on the live table.

### Migration C

- Add PostgreSQL trigger functions and triggers that reject update, delete, or truncate of the three append-only history tables.
- Reject delete or truncate of provenance roots.
- Reject updates to provenance identity fields while permitting lifecycle projection updates.
- Validate that `currentRevisionId` belongs to the same provenance root.

There is no physical column, index, default, rewrite, or table rebuild on `CurriculumContent`.

## 3. Exact Prisma-only relation changes

These declarations add no columns to the named existing tables:

- `CurriculumContent.provenance`
- `User.curriculumRevisionsAuthored`
- `User.curriculumGovernanceEvents`
- `User.curriculumEvidenceAdded`
- `AuditLog.curriculumGovernanceEvent`

Back-relations within the four new models are also Prisma navigation declarations. Their owning foreign-key columns are created only on the new table identified by each relation.

## 4. Migration A SQL summary and inspection

File: `prisma/migrations/20260810_000001_p2a_curriculum_provenance_core/migration.sql`

The file is additive: `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, and `ALTER TABLE ... ADD CONSTRAINT` statements only. The approved schema contains 14 P2-A enums. Prisma's empty-to-target SQL and Migration A have the same 58-statement topology. One statement intentionally differs: the `CurriculumGovernanceEvent` table definition strengthens Prisma's generated `riskReasons` column from `TEXT[] DEFAULT ARRAY[]::TEXT[]` to `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`.

This intentional physical override preserves the required Prisma scalar-list model while enforcing one database state for no reasons: an empty array. Direct SQL `NULL` is invalid. The rollback-only integration assertion at `prisma/migrations/verification/p2a-risk-reasons-null-rejection.sql` proves PostgreSQL rejects a direct `NULL` insert and defaults an omitted value to an empty array.

Safety inspection found none of:

- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- `DELETE FROM`
- `ON DELETE CASCADE`
- `ALTER TABLE "CurriculumContent"`
- a non-concurrent index creation on `AIInteraction`

## 5. Migration B1 SQL

```sql
-- P2-A Migration B1: nullable correlation field only.
-- No default is added, so existing rows remain unchanged and unknown.

ALTER TABLE "AIInteraction"
  ADD COLUMN "generationCorrelationId" TEXT;
```

## 6. Migration B2 concurrent-index SQL

```sql
-- P2-A Migration B2: live-table index created concurrently.
-- This file must not be wrapped in BEGIN/COMMIT because PostgreSQL forbids
-- CREATE INDEX CONCURRENTLY inside a transaction block.

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "AIInteraction_generationCorrelationId_createdAt_idx"
ON "AIInteraction"("generationCorrelationId", "createdAt");
```

Migration B2 must be deployed outside an explicit transaction. The approved staging runbook invokes `npx prisma migrate deploy` directly at the exact B commit and forbids any transaction-adding wrapper. After execution it requires both `pg_index.indisready` and `pg_index.indisvalid` to be true. An interrupted invalid index is dropped concurrently before Prisma marks the failed attempt rolled back and retries. The runbook explicitly forbids `prisma migrate resolve --applied`; a migration recorded as finished while its index is absent or invalid is a stop-and-escalate condition. See `docs/ops/P2A_STAGING_MIGRATION_RUNBOOK.md`.

## 7. Migration C trigger and immutability SQL proposal

File: `prisma/migrations/20260810_000004_p2a_curriculum_provenance_immutability/migration.sql`

```sql
CREATE OR REPLACE FUNCTION p2a_reject_immutable_curriculum_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER curriculum_content_revision_no_update_or_delete
BEFORE UPDATE OR DELETE ON "CurriculumContentRevision"
FOR EACH ROW EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_governance_event_no_update_or_delete
BEFORE UPDATE OR DELETE ON "CurriculumGovernanceEvent"
FOR EACH ROW EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_evidence_no_update_or_delete
BEFORE UPDATE OR DELETE ON "CurriculumEvidence"
FOR EACH ROW EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_content_revision_no_truncate
BEFORE TRUNCATE ON "CurriculumContentRevision"
FOR EACH STATEMENT EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_governance_event_no_truncate
BEFORE TRUNCATE ON "CurriculumGovernanceEvent"
FOR EACH STATEMENT EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_evidence_no_truncate
BEFORE TRUNCATE ON "CurriculumEvidence"
FOR EACH STATEMENT EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE OR REPLACE FUNCTION p2a_reject_curriculum_provenance_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CurriculumProvenance is durable and cannot be deleted';
END;
$$;

CREATE TRIGGER curriculum_provenance_no_delete
BEFORE DELETE ON "CurriculumProvenance"
FOR EACH ROW EXECUTE FUNCTION p2a_reject_curriculum_provenance_delete();

CREATE TRIGGER curriculum_provenance_no_truncate
BEFORE TRUNCATE ON "CurriculumProvenance"
FOR EACH STATEMENT EXECUTE FUNCTION p2a_reject_curriculum_provenance_delete();

CREATE OR REPLACE FUNCTION p2a_guard_curriculum_provenance_identity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."curriculumContentId" IS DISTINCT FROM OLD."curriculumContentId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'CurriculumProvenance identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER curriculum_provenance_identity_no_update
BEFORE UPDATE ON "CurriculumProvenance"
FOR EACH ROW EXECUTE FUNCTION p2a_guard_curriculum_provenance_identity();

CREATE OR REPLACE FUNCTION p2a_validate_current_curriculum_revision()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."currentRevisionId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "CurriculumContentRevision" revision
    WHERE revision."id" = NEW."currentRevisionId"
      AND revision."provenanceId" = NEW."id"
  ) THEN
    RAISE EXCEPTION
      'currentRevisionId % does not belong to CurriculumProvenance %',
      NEW."currentRevisionId", NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER curriculum_provenance_current_revision_guard
BEFORE INSERT OR UPDATE OF "currentRevisionId" ON "CurriculumProvenance"
FOR EACH ROW EXECUTE FUNCTION p2a_validate_current_curriculum_revision();
```

Migration C is intentionally sequenced after table creation and should not be applied until writer behavior and rollback implications receive the next approval. Once applied, ordinary Prisma update/delete operations against the history models will fail by design.

## 8. Lock and risk analysis

| Migration | Primary lock/risk | Data rewrite | Mitigation |
| --- | --- | --- | --- |
| A | Catalog locks and locks on four new empty tables; brief locks on referenced existing tables while foreign keys are installed | None on `CurriculumContent`, `User`, or `AuditLog` | Additive tables only; schedule normally and monitor lock waits |
| B1 | Brief `ACCESS EXCLUSIVE` lock on live `AIInteraction` for `ADD COLUMN` | No heap rewrite because nullable with no default | Apply separately, with lock timeout and abort on contention |
| B2 | `CREATE INDEX CONCURRENTLY` performs multiple scans and uses a weaker lock compatible with reads/writes, but adds I/O and may leave an invalid index if interrupted | No table rewrite | Run outside transactions, monitor I/O and index validity, retry only through approved runbook |
| C | Brief trigger-definition locks on the four new provenance tables | None | Apply only before those tables become canonical and after trigger integration tests |

Foreign-key delete behavior is `RESTRICT`, including governance actors/authors. This preserves attributed history but means future account deletion/de-identification must use a separately reviewed policy.

Rollback before canonical cutover is additive and straightforward in reverse dependency order. B2 can drop its index concurrently; B1 can drop the unused nullable column only under a separately approved rollback; Migration A can remove empty new tables/types only before governed history exists. After Migration C and canonical writes, rollback must be forward-fix or reader cutback, not destructive removal of historical records.

## 9. Validation results

| Check | Result |
| --- | --- |
| `npx prisma format` | PASS |
| `npx prisma validate` | PASS, schema valid |
| `npx prisma generate` | PASS, Prisma Client 6.19.3 |
| Empty-to-target schema diff | PASS for topology; 58 statements, with the one approved `riskReasons NOT NULL` physical override documented above |
| Migration destructive-pattern scan | PASS |
| `git diff --check` | PASS |
| `npx tsc --noEmit` | PASS with the exact command and default process environment |
| First `npx vitest run` | 561 files and 4,609 tests passed; 4 timeout-only failures in 3 files under full parallel load, with no assertion mismatch |
| Isolated rerun of the 3 timed-out files | PASS, 3 files and 34 tests |
| Second exact `npx vitest run` | PASS, 564 files and 4,613 tests |
| `npm run build` | PASS with exit 0; existing lint, dynamic-render, browsers-list, and observability warnings remain |
| P2-A migration artifact tests | PASS, 12 tests |
| PostgreSQL 16 `riskReasons` integration assertion | PASS in a disposable local container; direct SQL `NULL` rejected and omitted value defaulted to `[]`; transaction rolled back |
| PostgreSQL 16 `riskReasons` negative assertion | PASS; after intentionally dropping database `NOT NULL`, the verifier exited 1 with `schema permits NULL` |
| PostgreSQL 16 B1/B2 integration assertion | PASS in a disposable local container; B2 ran outside a transaction and produced `indisready = true`, `indisvalid = true` |
| PostgreSQL 16 Migration C guard suite | PASS in a disposable local container after correcting the test to reach `BEFORE TRUNCATE` triggers through foreign-key dependencies; transaction rolled back |
| PostgreSQL 16 Migration C negative assertions | PASS; a missing trigger produced nonzero `unexpectedly succeeded`, and an intentional wrong SQLSTATE/message produced nonzero `unexpected rejection` |

Final staging-precheck gate:

| Check | Result |
| --- | --- |
| `npx prisma generate` | PASS, Prisma Client 6.19.3 |
| `npx tsc --noEmit` | PASS with the exact command |
| First `npx vitest run` | 560 files and 4,613 tests passed; 4 timeout-only failures in 4 files under full parallel load, with no assertion mismatch |
| Isolated timeout rerun | PASS, 4 files and 63 tests |
| Second exact `npx vitest run` | PASS, 564 files and 4,617 tests |
| First `npm run build` attempt | Tool timeout at 10 minutes, no compiler error and no `BUILD_ID`; not counted as a pass |
| Second `npm run build` attempt | PASS with exit 0 after 762.9 seconds; `.next/BUILD_ID` `0xNoqCJHjE3MqOkxxZX0A`; existing warnings remain |

No test assertion mismatch was observed. The isolated timeout rerun covered exactly:

- `__tests__/auth/google-sso.test.ts`
- `__tests__/ops/cronGetAlias.test.ts`
- `__tests__/student.lesson-delivery.test.ts`

The final staging-precheck isolated rerun covered:

- `__tests__/auth/google-sso.test.ts`
- `__tests__/ops/cronGetAlias.test.ts`
- `__tests__/wave4d.visibility.test.ts`
- `__tests__/autonomous/phase10.replayConsole.test.ts`

## 10. Prisma-driven adjustments

Prisma accepted the proposed relation topology, including the nullable circular current-revision pointer and composite event target relation. No model or relation redesign was required.

The generated-SQL reconciliation deliberately overrides Prisma's nullable PostgreSQL representation for the required `riskReasons` scalar list with database-level `NOT NULL`, documented in section 4. Migration B2 intentionally differs from Prisma's ordinary generated index statement by using `CREATE INDEX CONCURRENTLY` for the live `AIInteraction` table.

## 11. Explicit confirmations

- `CurriculumContent` receives no physical provenance column.
- `CurriculumContent.moeAlignments` is unchanged.
- No fifth prompt-definition database model was introduced.
- No generation, approval, import, writer, reader, or publication behavior changed.
- No backfill was created or run.
- No staging, production, shadow, or persistent development database migration was executed.
- Migrations A, B1, B2, and C plus all final verification SQL were integration-tested only in disposable local PostgreSQL 16 containers. Behavioral test transactions rolled back and every container was removed.
- No provenance writer was implemented or enabled.

## 12. Git diff summary

Step 1 files:

- `prisma/schema.prisma`
- `prisma/migrations/20260810_000001_p2a_curriculum_provenance_core/migration.sql`
- `prisma/migrations/20260810_000002_p2a_ai_generation_correlation/migration.sql`
- `prisma/migrations/20260810_000003_p2a_ai_generation_correlation_index/migration.sql`
- `prisma/migrations/20260810_000004_p2a_curriculum_provenance_immutability/migration.sql`
- `prisma/migrations/verification/p2a-risk-reasons-null-rejection.sql`
- `prisma/migrations/verification/p2a-immutability-and-root-guards.sql`
- `prisma/migrations/verification/p2a-post-migration-readonly.sql`
- `__tests__/migrations/p2a-provenance-migrations.test.ts`
- `__tests__/fixtures/p2a-provenance-prerequisites.sql`
- `docs/P2A_STEP1_SCHEMA_APPROVAL_PACKAGE.md`
- `docs/ops/P2A_STAGING_MIGRATION_RUNBOOK.md`

The existing untracked P2-A discovery/design documents were preserved and were not rewritten as part of Step 1.

Final migration SHA-256 hashes:

| Migration | SHA-256 |
| --- | --- |
| `20260810_000001_p2a_curriculum_provenance_core` | `D4AB65C9D577A75C1B37D96525971B928EF985926D9AF9CFBA21B5C0DF48C7F7` |
| `20260810_000002_p2a_ai_generation_correlation` | `48C3C49F0F32026D815EC4135D886DE7B7A3D10A80E0CCDDBB3100162C6C7AB7` |
| `20260810_000003_p2a_ai_generation_correlation_index` | `234B635D51D628A46C24F140C5EF186DB045986FD21594EEE63F6029F4427AE6` |
| `20260810_000004_p2a_curriculum_provenance_immutability` | `90BE560EB65FB6B5EFBB1AFE15599BB475CD05E38119A21B2808693C0B844097` |

## 13. Commit structure

1. `246a608fddf4f47e0733cb4b6c598fe44490fe59` `chore(prisma): normalize existing schema formatting`
2. `e4ce9a42aa5e49c0bca909bde9887d13acce162b` `feat(prisma): add P2-A provenance core schema`
3. `09b53365f5194d5cc3988ed663f847339891b5dc` `feat(prisma): add AI generation correlation migrations`
4. `6888ed6c23f42107aa1e39b4fadc959f2c529f3b` `feat(prisma): add P2-A immutability guards`
5. `docs: add P2-A Step 1 schema approval package` recorded after the final documentation commit

The formatter-only commit was proven semantic-neutral before commit. Its only whitespace-insensitive diff was Prisma's ordering of an existing `Timetable` constraint, and `prisma migrate diff` reported an empty physical migration against the pre-format schema.

## 14. Review decision

P2-A Step 1 architecture and migration topology were approved on 2026-08-10 with two required corrections:

1. Correct the enum count to 14 without changing the approved enum set.
2. Enforce `riskReasons` as `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]` and add a direct-SQL rejection assertion.

Both corrections are complete. Migration C is sequenced after A/B staging verification and before any provenance writer activation. Production migration, provenance writers, generation changes, approval changes, readers, and backfill remain unauthorized.

**P2-A SCHEMA APPROVED  STAGING DATABASE EXECUTION AWAITS FINAL RUNBOOK REVIEW**
