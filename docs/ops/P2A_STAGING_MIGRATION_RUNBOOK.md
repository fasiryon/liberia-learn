# P2-A Staging Migration Execution Runbook

Status: BLOCKED pending canonical-staging Gate 0 and a reviewed runbook rewrite
Scope: Staging database only
Production execution: Prohibited

> STOP: Sections 2 through 6 below preserve the previously reviewed P2-A DDL
> sequence, but their Git checkout and `prisma migrate deploy` commands target
> the legacy migration root. That root is not replayable and must not be used
> on canonical staging. First complete the separately authorized canonical
> staging bootstrap, reference seed, synthetic fixtures, PostgreSQL 17 backup
> and restore proof, and Gate 0. Then rewrite this runbook to deploy byte-exact
> copies of A/B1/B2/C from `prisma/canonical/migrations` and obtain a separate
> founder/advisor authorization. No command in sections 2 through 6 is
> currently authorized for execution.

## 1. Preconditions

1. Complete `docs/ops/STAGING_DATABASE_FOUNDATION.md`, obtain explicit final
   approval for this runbook, and run `npm run p2a:staging:preflight`. Stop if
   the executable preflight does not print `P2-A STAGING GATE 0 PREFLIGHT:
   PASS`.
2. Confirm the target is the staging PostgreSQL database by recording
   `current_database()`, `current_user`, `inet_server_addr()`, and server
   version. Stop if the endpoint, project, or database name could be
   production.
3. Prefer the Supabase direct PostgreSQL endpoint for migrations, `pg_dump`,
   `pg_restore`, and native PostgreSQL tooling. When the operator environment
   cannot reach the project's IPv6 direct endpoint, the approved fallback is
   Supavisor session mode on port 5432. Transaction mode on port 6543 remains
   prohibited for migration/native DDL operations.
4. Confirm there are no provenance writers in the deployed application.
   P2-A Step 1 contains no writer implementation, feature flag, generation
   change, approval change, reader change, or backfill.
5. Confirm the Git worktree is clean and the four reviewed migration commits
   are available locally.
6. Take the normal staging backup or restore-point evidence required by the
   database owner.
7. Keep a second read-only PostgreSQL session available for lock and index
   monitoring.

### Timeout policy

The timeout settings are embedded in each migration file so they apply to the
same PostgreSQL session Prisma uses for the DDL:

| Migration | `lock_timeout` | `statement_timeout` | Reason |
| --- | --- | --- | --- |
| A | `5s` | `5min` | Additive catalog work must fail promptly on metadata-lock contention and must not run unbounded. |
| B1 | `5s` | `5min` | The live-table nullable column addition should be brief and must stop on contention. |
| B2 | `5s` | `0` | Lock acquisition fails promptly, while concurrent index construction has no short statement deadline and uses dedicated progress monitoring. |
| C | `5s` | `5min` | Trigger/function installation must fail promptly on metadata-lock contention and must not run unbounded. |

Successful migrations reset both session settings. If a statement fails, the
migration connection closes, so its session-local settings do not persist.

PostgreSQL lock timeout (`SQLSTATE 55P03`) or statement cancellation/timeout
(`SQLSTATE 57014`) is a mandatory STOP condition. Record the migration row,
server identity, blocking sessions, locks, and error text. Do not retry or mark
the migration applied until the blocker and any partial state are understood
and a reviewer explicitly authorizes the next attempt.

Set the staging URLs and evidence paths only in the current PowerShell process.
Do not print them or load ignored production environment files:

```powershell
$env:P2A_STAGING_DATABASE_URL = '<approved direct or port-5432 session URL>'
$env:DIRECT_URL = $env:P2A_STAGING_DATABASE_URL
$env:DATABASE_URL = '<approved pooled staging runtime URL>'
$env:P2A_DIRECT_ENDPOINT_UNREACHABLE = 'true' # session fallback only
$env:P2A_STAGING_PROJECT_REF = '<approved staging project reference>'
$env:P2A_STAGING_APP_URL = '<stable staging application URL>'
$env:P2A_STAGING_DEPLOYMENT_ENV_FILE = '<secure Vercel staging environment pull>'
$env:P2A_BACKUP_EVIDENCE_PATH = '<verified backup evidence JSON>'
$env:P2A_PROVENANCE_WRITERS_DISABLED = 'true'
npm run p2a:staging:preflight
```

This staging run uses the fallback because the direct endpoint is unavailable
from the current Docker/operator environment: the Supabase direct host resolves
IPv6-only, so the approved Supavisor session-mode IPv4 path on port 5432 is
selected. The preflight reports `session-pooler` and proves SSL, staging project
routing, and session persistence. It rejects port 6543 for migration use.

Record and review the target identity:

```powershell
.\scripts\p2a-psql.ps1 -Command 'SELECT current_database(), current_user, inet_server_addr(), current_setting(''server_version''), (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid());'
```

Stop if that output has not been positively identified as staging.

## 2. Reviewed commit sequence

Apply the migrations by checking out the exact reviewed commit that first
contains each migration group. This allows verification between A/B and C.

1. Formatter proof:
   `246a608fddf4f47e0733cb4b6c598fe44490fe59`
2. Migration A:
   `e4ce9a42aa5e49c0bca909bde9887d13acce162b`
3. Migrations B1 and B2:
   `09b53365f5194d5cc3988ed663f847339891b5dc`
4. Migration C:
   `6888ed6c23f42107aa1e39b4fadc959f2c529f3b`

Do not run `prisma migrate deploy` from a later commit before the preceding
verification step is complete.

Approved migration SHA-256 hashes:

| Migration | SHA-256 |
| --- | --- |
| A | `D4AB65C9D577A75C1B37D96525971B928EF985926D9AF9CFBA21B5C0DF48C7F7` |
| B1 | `48C3C49F0F32026D815EC4135D886DE7B7A3D10A80E0CCDDBB3100162C6C7AB7` |
| B2 | `234B635D51D628A46C24F140C5EF186DB045986FD21594EEE63F6029F4427AE6` |
| C | `90BE560EB65FB6B5EFBB1AFE15599BB475CD05E38119A21B2808693C0B844097` |

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
git switch --detach e4ce9a42aa5e49c0bca909bde9887d13acce162b
$env:DATABASE_URL = $env:P2A_STAGING_DATABASE_URL
npx prisma migrate status
npx prisma migrate deploy
```

Migration A executes with `lock_timeout = '5s'` and
`statement_timeout = '5min'`. Any timeout stops this runbook. Inspect the
database and `_prisma_migrations` state before considering a reviewed retry.

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
git switch --detach 09b53365f5194d5cc3988ed663f847339891b5dc
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
the nullable column with no default and no backfill, using a 5-second lock
timeout and 5-minute statement timeout. If B1 times out, Prisma must stop
before B2 and the operator must stop this runbook. B2 contains no explicit
transaction statement, uses a 5-second lock timeout, explicitly disables the
statement timeout, and executes `CREATE INDEX CONCURRENTLY`.

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

If B2 fails or times out, stop for review and do not use
`prisma migrate resolve --applied`.

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

5. Only after the blocker and partial state are understood and a reviewer
   authorizes a retry, and only when the B2 migration row is failed with
   `finished_at IS NULL`, mark that failed attempt rolled back:

```powershell
npx prisma migrate resolve --rolled-back 20260810_000003_p2a_ai_generation_correlation_index
```

6. Rerun `npx prisma migrate deploy` only under that explicit retry approval,
   then repeat the validity query.

If Prisma reports B2 as successfully finished while the index is absent or
invalid, stop and escalate. Do not mark, edit, or reconcile the migration row
manually. A reviewed forward repair is required.

## 5. A/B staging verification gate

Before Migration C, rerun the rollback-only A invariant assertion:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/verification/p2a-risk-reasons-null-rejection.sql
```

Verify the B1 column, B2 index, and A/B migration rows without expecting the C
triggers yet:

```powershell
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT table_schema, table_name, column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''AIInteraction'' AND column_name = ''generationCorrelationId'';'
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT c.relname, i.indisready, i.indisvalid, pg_get_indexdef(i.indexrelid) FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ''public'' AND c.relname = ''AIInteraction_generationCorrelationId_createdAt_idx'';'
psql "$env:P2A_STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM "_prisma_migrations" WHERE migration_name IN (''20260810_000001_p2a_curriculum_provenance_core'', ''20260810_000002_p2a_ai_generation_correlation'', ''20260810_000003_p2a_ai_generation_correlation_index'') ORDER BY migration_name;'
```

At this point the Migration C row and triggers are expected to be absent. The
B1 column must be nullable with no default, the B2 index must be ready and
valid, and all three A/B migration rows must be finished with no rollback. All
A/B checks must pass before continuing.

## 6. Migration C

Migration C must be active before any provenance writer is enabled.

```powershell
git switch --detach 6888ed6c23f42107aa1e39b4fadc959f2c529f3b
npx prisma migrate status
npx prisma migrate deploy
```

Migration C executes with `lock_timeout = '5s'` and
`statement_timeout = '5min'`. Any timeout is a STOP condition. Do not retry
until the blocker and any partial trigger/function state are understood and a
reviewer explicitly authorizes the next attempt.

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
4. Leave curriculum readers, generation flows, and approval flows unchanged.
5. Do not run a backfill or perform a canonical provenance cutover.
6. Do not run any production migration.
7. Record the command output, timestamps, database identity, migration rows,
   index validity, and guard-suite result in the staging execution report.
8. Stop for the next approval gate. Do not proceed to writers, readers,
   generation changes, approval changes, backfill, or production migration.
