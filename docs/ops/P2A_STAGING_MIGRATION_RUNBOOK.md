# P2-A Staging Migration Execution Runbook

Status: Prepared, execution awaits final runbook review
Scope: Staging database only
Production execution: Prohibited

## 1. Preconditions

1. Obtain explicit final approval for this runbook.
2. Confirm the target is the staging PostgreSQL database by recording
   `current_database()`, `current_user`, `inet_server_addr()`, and server
   version. Stop if the endpoint, project, or database name could be
   production.
3. Use a direct PostgreSQL connection for DDL. Do not use the pooled port
   6543 connection for migration execution.
4. Confirm there are no provenance writers in the deployed application.
   P2-A Step 1 contains no writer implementation, feature flag, generation
   change, approval change, reader change, or backfill.
5. Confirm the Git worktree is clean and the four reviewed migration commits
   are available locally.
6. Take the normal staging backup or restore-point evidence required by the
   database owner.
7. Keep a second read-only PostgreSQL session available for lock and index
   monitoring.

Set the staging URL only in the current PowerShell process. Do not print it:

```powershell
$env:P2A_STAGING_DATABASE_URL = '<approved direct staging URL>'
```

Record and review the target identity:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, inet_server_addr(), current_setting(''server_version'');'
```

Stop if that output has not been positively identified as staging.

## 2. Reviewed commit sequence

Apply the migrations by checking out the exact reviewed commit that first
contains each migration group. This allows verification between A/B and C.

1. Formatter proof:
   `246a608fddf4f47e0733cb4b6c598fe44490fe59`
2. Migration A:
   `5bd881efbb54210ac46fd53548eacfd8674da4ab`
3. Migrations B1 and B2:
   `6c6223db5b743dbc070b519b2c471d3b3d315058`
4. Migration C:
   `52c2fe9abaa0deedf08633bf29bc062c885b5f07`

Do not run `prisma migrate deploy` from a later commit before the preceding
verification step is complete.

Approved migration SHA-256 hashes:

| Migration | SHA-256 |
| --- | --- |
| A | `8F523E5CF2CF6A9D14B0236BEB081267CD7F92121AFD6FEFE3E4C1F5DBEED5B2` |
| B1 | `1A39B5CC74747B01D8BC37F570BD05A7F957B3B9F49A5A47CACE71DCEB4F6232` |
| B2 | `372A60C0CC25A693992FDB94C1953D4BCC34001915ABB64F713C02E98039CADB` |
| C | `29F04F76657BE6F1B45AB33C9B5AF8B782C70216CE3B1B57257128BA3B57CD17` |

At each detached commit, verify the migration files present there match the
corresponding approved hashes before running Prisma:

```powershell
Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000001_p2a_curriculum_provenance_core/migration.sql
Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000002_p2a_ai_generation_correlation/migration.sql
Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000003_p2a_ai_generation_correlation_index/migration.sql
Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000004_p2a_curriculum_provenance_immutability/migration.sql
```

Only files that exist at the current sequencing commit are expected to hash.

## 3. Migration A

```powershell
git switch --detach 5bd881efbb54210ac46fd53548eacfd8674da4ab
$env:DATABASE_URL = $env:P2A_STAGING_DATABASE_URL
npx prisma migrate status
npx prisma migrate deploy
```

Expected newly applied migration:

`20260810_000001_p2a_curriculum_provenance_core`

Run the database invariant assertion. It creates test rows inside a
transaction and always rolls back:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/verification/p2a-risk-reasons-null-rejection.sql
```

Pass criteria:

- `DO` completes without error.
- The final command is `ROLLBACK`.
- `CurriculumGovernanceEvent.riskReasons` reports `is_nullable = NO`.
- Its default is an empty `TEXT[]`.
- All 14 approved enums and all four provenance tables exist.

Do not continue if the assertion fails.

## 4. Migrations B1 and B2

Check out the exact B commit:

```powershell
git switch --detach 6c6223db5b743dbc070b519b2c471d3b3d315058
npx prisma migrate status
```

Before deployment, inspect any pre-existing index artifact:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT c.relname, i.indisready, i.indisvalid FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid WHERE c.relname = ''AIInteraction_generationCorrelationId_createdAt_idx'';'
```

Expected before a first attempt: zero rows. If a row exists and either
`indisready` or `indisvalid` is false, follow section 4.2 before deploying.

Check for long-running transactions that could delay the concurrent-index
snapshot wait:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT pid, usename, application_name, state, wait_event_type, wait_event, now() - xact_start AS transaction_age FROM pg_stat_activity WHERE datname = current_database() AND xact_start IS NOT NULL ORDER BY xact_start;'
```

Stop for database-owner review if an unexplained transaction is older than 15
minutes. Do not terminate another session automatically.

### 4.1 Normal B1/B2 execution

Run Prisma directly. Do not wrap it in `BEGIN`, `COMMIT`, a transactional
deployment framework, or a shell that adds a transaction:

```powershell
npx prisma migrate deploy
```

Prisma applies B1 before B2 because of the migration directory names. B1 adds
the nullable column with no default and no backfill. B2 contains no explicit
transaction statement and executes `CREATE INDEX CONCURRENTLY`.

While B2 runs, use the second read-only session to monitor progress and lock
waits:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT pid, datname, relid::regclass AS table_name, index_relid::regclass AS index_name, command, phase, lockers_total, lockers_done, blocks_total, blocks_done, tuples_total, tuples_done FROM pg_stat_progress_create_index WHERE datname = current_database();'
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT activity.pid, activity.state, activity.wait_event_type, activity.wait_event, activity.query FROM pg_stat_activity activity WHERE activity.datname = current_database() AND activity.query ILIKE ''%AIInteraction_generationCorrelationId_createdAt_idx%'';'
```

If the command fails, is cancelled by the database owner, or leaves an invalid
index, use section 4.2. Never convert a failed or unverifiable B2 attempt into
an applied migration record.

Immediately verify the index:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT c.relname, i.indisready, i.indisvalid, pg_get_indexdef(i.indexrelid) FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid WHERE c.relname = ''AIInteraction_generationCorrelationId_createdAt_idx'';'
```

Pass criteria:

- Exactly one row exists.
- `indisready = true`.
- `indisvalid = true`.
- The definition covers `generationCorrelationId, createdAt`.
- `_prisma_migrations.finished_at` is non-null for B2 only after these facts
  are true.

### 4.2 Interrupted or invalid B2 handling

If B2 fails, do not use `prisma migrate resolve --applied`.

1. Query `pg_index.indisready` and `pg_index.indisvalid` using the command in
   section 4.1.
2. Query the migration record:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM "_prisma_migrations" WHERE migration_name = ''20260810_000003_p2a_ai_generation_correlation_index'';'
```

3. If the index exists but is invalid, drop only that exact invalid artifact,
   outside a transaction:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'DROP INDEX CONCURRENTLY IF EXISTS "AIInteraction_generationCorrelationId_createdAt_idx";'
```

4. Confirm `to_regclass` returns null:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT to_regclass(''public."AIInteraction_generationCorrelationId_createdAt_idx"'');'
```

5. Only when the B2 migration row is failed, with `finished_at IS NULL`, mark
   that failed attempt rolled back:

```powershell
npx prisma migrate resolve --rolled-back 20260810_000003_p2a_ai_generation_correlation_index
```

6. Rerun `npx prisma migrate deploy`, then repeat the validity query.

If Prisma reports B2 as successfully finished while the index is absent or
invalid, stop and escalate. Do not mark, edit, or reconcile the migration row
manually. A reviewed forward repair is required.

## 5. A/B staging verification gate

Before Migration C, run:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/verification/p2a-post-migration-readonly.sql
```

At this point the Migration C row and triggers are expected to be absent. All
A/B checks must pass before continuing.

## 6. Migration C

Migration C must be active before any provenance writer is enabled.

```powershell
git switch --detach 52c2fe9abaa0deedf08633bf29bc062c885b5f07
npx prisma migrate status
npx prisma migrate deploy
```

Expected newly applied migration:

`20260810_000004_p2a_curriculum_provenance_immutability`

Run the rollback-only behavioral guard suite:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/verification/p2a-immutability-and-root-guards.sql
```

Pass criteria:

- All revision, governance-event, and evidence update/delete/truncate attempts
  are rejected.
- Provenance-root delete and truncate attempts are rejected.
- Allowed lifecycle/completeness projection updates succeed.
- Provenance identity changes fail.
- A cross-root `currentRevisionId` fails.
- A same-root `currentRevisionId` succeeds.
- The script ends with `ROLLBACK`.

Then run the complete read-only verification:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/verification/p2a-post-migration-readonly.sql
```

Expected final state:

- 14 enums installed, with no missing enum.
- Four provenance tables present.
- `riskReasons` is non-null with an empty-array default.
- The AI correlation column is nullable and has no default.
- The B2 index is ready and valid.
- All 10 named P2-A triggers exist and are enabled with `tgenabled = O`.
- All four migration rows have `finished_at` set and `rolled_back_at` null.

## 7. Final staging hold

After verification:

1. Return to the review branch:

```powershell
git switch codex/p2a-provenance-step1
```

2. Remove the temporary process variables:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:P2A_STAGING_DATABASE_URL -ErrorAction SilentlyContinue
```

3. Leave every provenance writer disabled and undeployed.
4. Record the command output, timestamps, database identity, migration rows,
   index validity, and guard-suite result in the staging execution report.
5. Stop for the next approval gate. Do not proceed to writers, readers,
   generation changes, approval changes, backfill, or production migration.
