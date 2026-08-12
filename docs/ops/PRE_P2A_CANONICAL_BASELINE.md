# Pre-P2-A canonical baseline

Status: implemented and verified locally on 2026-08-11. No persistent database cutover is authorized.

## Safety scope

This implementation follows approved Option C. Production project `bnphuinpvgpmebcsvmsp` was used only for PostgreSQL 17 schema and catalog reads. Staging project `yonpfzjczoffhrgibxkz` was not connected to or modified. The production and staging Prisma ledgers were not changed. No P2-A migration was executed.

The active clean-bootstrap path starts from observed production schema reality. It does not replay the broken legacy history and does not infer a database from `schema.prisma`.

## Frozen legacy history

`prisma/legacy-migration-manifest.json` freezes all 128 repository migrations from `20260213_222830_baseline_from_existing_db` through `20260728_000002_teaching_turn_sequence`. Every entry records repository order, byte count, encoding, SHA-256, Git blob SHA when available, and known production ledger evidence. The manifest also retains 18 production ledger migration names whose files are absent from the repository.

The focused test reads every frozen file and fails if its bytes or length differ. In particular, the initial UTF-16 LE file remains unchanged. The historical files stay under `prisma/migrations` as audit evidence. They are not the active root for a new database.

## Secure production schema capture

The source artifact was captured with `pg_dump (PostgreSQL) 17.10` against production PostgreSQL 17.6 using the authenticated port 5432 session endpoint already available in the local secret environment. The connection value was passed only as a process environment variable. It was not printed or written into an artifact.

Capture settings were:

- schema-only;
- public schema only;
- no owner statements;
- no privilege statements;
- no row data;
- PostgreSQL 17 client;
- fixed production project identity check;
- transaction-pooler port 6543 rejected.

Artifacts:

| Artifact | SHA-256 |
| --- | --- |
| `prisma/canonical/source/production-public-schema.raw.sql` | `377e2145a9d4a3dc1fc32e0fc78f4727ce1cd941241a464327dd136f2e373866` |
| `prisma/canonical/migrations/20260728_000003_canonical_production_state_baseline/migration.sql` | `53a20e408463eb7ead872d820c137b2c0420bf969229c776011d573ed16a73f8` |
| `prisma/canonical/catalog-manifest.json` | `d0725f2b90d8af4ddab8fd159618696c465497ffe77dedb8430a7d3a28e7f96a` |
| `prisma/canonical/migrations/20260803_000001_privileged_identity_hardening/migration.sql` | `1d313776b8e54cb4812425f5438ccff4637b245cf4b74574489371fd2140b211` |
| `prisma/canonical/post-hardening-catalog-manifest.json` | `eb2b793ef8a196b0c09edfcf1e6d24450cb8d15f335f395e338d3c14640576d7` |
| `prisma/canonical/seeds/20260811_000001_essential_reference_v1.sql` | `afdef5c1fd6e87c64ad7515eed735842a930e0bd461d73cb2c2f37a058d817e6` |

The capture contains 197 production public tables including `_prisma_migrations`. The canonical application catalog contains 196 tables because the environment-specific Prisma ledger is intentionally excluded.

## Production to canonical normalization

The normalized baseline preserves application-owned public schema objects and records every deliberate change in `prisma/canonical/normalization-manifest.json`.

Preserved:

- all 196 application tables, including `TrendSnapshot` and `_SkillToStandard`;
- 19 production enum types with production label order;
- visible columns, types, defaults, nullability, generated and identity attributes;
- 702 indexes, including two IVFFLAT vector indexes and all expression or partial definitions;
- 430 application constraints after excluding the Prisma ledger primary key;
- public application functions and both `AuditLog` immutability triggers;
- sequences, views, materialized views, RLS flags, and policies captured by the catalog contract;
- the `vector` extension at production version 0.8.0;
- `User.welcomeCompletedAt` and production physical column reality.

Normalized or excluded:

- randomized pg_dump restrict tokens and generated header/footer text;
- owner and privilege statements;
- provider-created `public` schema ownership, replaced by deterministic `CREATE SCHEMA IF NOT EXISTS public`;
- `_prisma_migrations`, which Prisma creates and owns per environment;
- provider-managed extensions `pg_stat_statements` and `supabase_vault`;
- installed but unused public DDL dependencies `pgcrypto` and `uuid-ossp`;
- provider schemas such as `auth`, `storage`, and Supabase operational metadata, because they are provider-managed and outside the application-owned public baseline;
- physical dropped-column `attnum` gaps in `Homework`, `HomeworkSubmission`, `TeacherAssignment`, and `Timetable`. The contract uses logical visible-column order because a schema-only restore correctly compacts those storage-history gaps.

Production had RLS disabled on all captured application tables and no public policies in the captured contract. The baseline preserves that observed state. It does not assert that client roles can read every table and does not enable RLS. The separate P0 RLS audit remains required.

## Catalog equivalence contract

`scripts/pre-p2a-canonical-catalog.sql` produces deterministic JSON for schemas, tables, columns, enum order, indexes, constraints, extensions, functions, triggers, views, materialized views, sequences, RLS state, and policies.

A disposable `pgvector/pgvector:0.8.0-pg17` database restored from the canonical baseline produced SHA-256 `d0725f2b90d8af4ddab8fd159618696c465497ffe77dedb8430a7d3a28e7f96a`, exactly matching the production-derived canonical manifest. There were no unexplained catalog differences.

## Active migration root

The clean-environment migration root is `prisma/canonical/migrations`, paired with the minimal datasource file `prisma/canonical/schema.prisma`.

It currently contains exactly:

1. `20260728_000003_canonical_production_state_baseline`;
2. `20260803_000001_privileged_identity_hardening`.

For a brand-new, positively identified empty database, the operator path is:

```powershell
npx prisma migrate deploy --schema prisma/canonical/schema.prisma
```

Prisma creates the new environment's `_prisma_migrations` ledger and records exactly those two migrations. The permanent local/CI gate proves this behavior.

Future reviewed migrations must be added after the cutover in this canonical root. When a reviewed file also exists in the historical repository root, its canonical copy must be byte-identical and hash-checked. P2-A files are not copied into the active root and remain unauthorized.

Existing databases must never run this root until a separately reviewed cutover procedure has proven catalog compatibility and backup readiness. The eventual production procedure is expected to mark the canonical baseline as applied using Prisma's supported baseline mechanism, then apply only approved forward migrations. That future procedure requires explicit authorization, before/after ledger evidence, a tested rollback plan, and a production maintenance decision. No marker or `migrate resolve` operation occurred in this sprint.

Empty staging will later use the same clean-environment path. That staging operation is also outside this sprint.

## Privileged identity forward hardening

The canonical copy of `20260803_000001_privileged_identity_hardening` is byte-identical to the reviewed repository file. On the disposable production-state baseline it added only:

- `PrivilegedIdentity`;
- `PrivilegedSessionAssurance`;
- two foreign keys;
- two primary keys and their implicit indexes;
- seven declared unique or lookup indexes.

It removed or changed no baseline objects. The deterministic delta is stored in `prisma/canonical/forward/20260803_000001_catalog-delta.json`.

Contrary to earlier schema-level assumptions, this migration does not create `PolicyConfig`, `PolicyOverride`, `PolicyScope`, `MOE_SUPER_ADMIN`, or `MOE_DISTRICT_ADMIN`. Those objects remain outside the canonical pre-hardening baseline and outside this reviewed forward delta.

## MOE roles and policy objects

`MOE_SUPER_ADMIN`, `MOE_DISTRICT_ADMIN`, `PolicyConfig`, `PolicyOverride`, and `PolicyScope` first appear in schema history in commit `ffef78dc3685b525a95ae1531955b02aa7677297`, dated 2026-04-13, with equivalent history copies `9da2c899b6b8d19a19a1f6a2613828042d139500` and `9e686c430820398aa3a250f6878adcacefab7ba5`.

No repository migration introduces either MOE role or the policy objects. Production `Role` contains only `TEACHER`, `STUDENT`, `GUARDIAN`, `ADMIN`, `DISTRICT_ADMIN`, and `MOE_OFFICIAL`. Static search found role dependencies in 33 application, library, test, schema, and documentation files. Production can read its existing roles, but an attempted database write of either missing enum value would fail until a reviewed enum migration is applied. P2-A A/B1/B2/C do not reference either role.

`prisma/canonical/proposals/20260811_000001_role_enum_expansion.proposed.sql` is deliberately outside the active migration root. It is proposal evidence only and has not been executed. Recommendation: review and authorize that enum-only forward delta before enabling assignment or persistence of the two roles. Review the policy models as a separate forward migration because `lib/policy/policyEngine.ts` already has compatibility behavior for their absence, but the observed production schema does not contain them.

## Production-only objects

`TrendSnapshot` is preserved. Static search found no live route, job, script, or test that reads or writes it. The only runtime-tree occurrence is a future-use comment in `lib/metrics/impact/impactEngine.ts`. A generated, non-active historical SQL file proposed dropping it, but no applied repository migration does so. It therefore appears historical or currently orphaned, but removal requires a separate usage and data-retention audit.

`_SkillToStandard` is preserved. It is the physical join table for the Prisma `SkillToStandard` relation declared by `Skill.standards` and `Standard.skills`. Its primary key, lookup index, and both cascading foreign keys are part of the canonical contract. It is required by current schema semantics even though application code accesses it through Prisma rather than raw SQL.

These were the only production-only application tables identified by the reconciliation. No cleanup was performed.

## Reference seed policy

The legacy audit found seven migrations containing application-data DML:

| Legacy data behavior | Classification | Canonical treatment |
| --- | --- | --- |
| training modules | essential reference data | versioned idempotent seed |
| Civics strands | essential reference data | versioned idempotent seed |
| Math strands | essential reference data | versioned idempotent seed |
| Engineering and CS standards | essential reference data | versioned idempotent seed |
| phase 2 subject reconciliation | historical/destructive backfill | never replay on clean bootstrap |
| curriculum year mapping | historical production backfill | never replay on clean bootstrap |
| video microlesson status update | historical production backfill | never replay on clean bootstrap |

`prisma/canonical/seeds/20260811_000001_essential_reference_v1.sql` contains only the four essential groups. It uses deterministic IDs for new rows, natural-key conflict handling, explicit update semantics, a fixed seed version, and one transaction. Conflict updates preserve existing primary keys and creation timestamps. It is independent from application startup and contains no users, operational records, demo fixtures, production-derived rows, or historical backfills.

Disposable PostgreSQL 17 evidence after both the first and second runs was:

- 8 teacher training modules;
- 9 Civics/Math strands;
- 10 Engineering/CS standards;
- data digest `d334a7fd3c864e761fd9fabf9d6919ab` on both runs.

## Permanent PostgreSQL 17 gate

`scripts/verify-pre-p2a-canonical-baseline.ps1` and `.github/workflows/canonical-clean-bootstrap.yml` implement the permanent gate.

The gate:

1. asserts `psql`, `pg_dump`, and `pg_restore` major version 17;
2. starts a disposable PostgreSQL 17 image with pgvector 0.8.0;
3. restores the baseline to a baseline-only database;
4. proves exact canonical catalog hash equivalence;
5. deploys the canonical Prisma root to a second clean database;
6. proves the ledger contains only baseline and privileged hardening;
7. proves the post-hardening catalog hash;
8. applies the reference seed twice and compares counts and digest;
9. verifies both AuditLog immutability triggers and both IVFFLAT indexes;
10. verifies `AIInteraction` exists and `CurriculumContent` has no physical provenance column;
11. performs a PostgreSQL 17 custom-format schema dump and restore;
12. proves the restored post-hardening catalog hash;
13. writes sanitized evidence and destroys the container.

Latest local result: PASS. Evidence is generated at `artifacts/pre-p2a-canonical/verification/verification-evidence.json`.

## P2-A compatibility

P2-A was checked statically only. The post-hardening catalog provides `CurriculumContent`, `AIInteraction`, `User`, and `AuditLog`, including the referenced primary keys and `AIInteraction.createdAt`. It contains no physical `CurriculumContent.provenance` column and no collision with `CurriculumProvenance`, `CurriculumContentRevision`, `CurriculumGovernanceEvent`, `CurriculumEvidence`, or the P2-A enum/function/trigger names. Required PostgreSQL JSONB, array, trigger, and function capabilities are available.

Frozen hashes remain:

| Migration | SHA-256 |
| --- | --- |
| A, `20260810_000001_p2a_curriculum_provenance_core` | `d4ab65c9d577a75c1b37d96525971b928ef985926d9af9cfba21b5c0df48c7f7` |
| B1, `20260810_000002_p2a_ai_generation_correlation` | `48c3c49f0f32026d815ec4135d886de7b7a3d10a80e0ccddbb3100162c6c7ab7` |
| B2, `20260810_000003_p2a_ai_generation_correlation_index` | `234b635d51d628a46c24f140c5ef186db045986fd21594eee63f6029f4427ae6` |
| C, `20260810_000004_p2a_curriculum_provenance_immutability` | `90be560eb65fb6b5efbb1afe15599bb475cd05e38119a21b2808693c0b844097` |

The four files were not edited or executed. P2-A remains behind staging baseline, synthetic fixtures, PostgreSQL 17 backup/restore evidence, and Gate 0.

## Next authorization

The next database action requires a separate founder/advisor authorization for the persistent cutover sequence. The first recommended persistent target is the approved empty staging project, not production. That dispatch must authorize canonical-root deployment to staging, essential reference seeds, synthetic P2-A fixtures, logical backup/restore proof, and Gate 0. Production baseline marking remains a separate later authorization.
