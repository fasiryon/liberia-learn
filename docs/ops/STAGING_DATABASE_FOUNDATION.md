# LiberiaLearn Staging Database Foundation

Status: BLOCKED on external staging project and deployment configuration

This document defines the environment boundary required before P2-A may return
to Gate 0. It does not authorize or execute P2-A migrations.

## 1. Current environment audit

### Confirmed production identity

- Supabase production project reference: `bnphuinpvgpmebcsvmsp`.
- Production direct endpoint convention:
  `db.bnphuinpvgpmebcsvmsp.supabase.co:5432/postgres`.
- Production runtime uses the shared Supavisor pooler. Repository snapshots
  include both port 6543 transaction-pooler URLs and older port 5432 variants.
- Vercel project metadata identifies one linked application project named
  `liberia-learn`, project ID `prj_gr1ksFqzN4MXaqxxj7vmkJFitTxf`.
- A read-only live Vercel metadata audit on 2026-08-11 found only the default
  Production, Preview, and Development targets. No custom staging target
  exists. Preview has an encrypted `DATABASE_URL` created 259 days earlier,
  but no Preview `DIRECT_URL` or `STAGING_SUPABASE_PROJECT_REF`. The same
  encrypted OpenAI and Groq variable entries are scoped to both Production and
  Preview, so those provider credentials are not isolated either.

### Confirmed non-production state

- No independent staging Supabase project reference was found in repository,
  ignored environment snapshots, process variables, CI, or operations docs.
- Ignored Preview snapshots select the same production Supabase project.
- `lib/environment.ts` historically labeled every Vercel Preview deployment as
  staging even though its database was not isolated.
- No current `P2A_STAGING_DATABASE_URL` exists.
- No current staging backup or restore-point evidence exists.
- CI uses a local placeholder PostgreSQL URL for build and test jobs. The
  scheduled eval workflow uses generic repository secrets and is not a staging
  deployment mechanism.
- The linked Vercel application can create Preview deployments, but no stable
  staging deployment with an independently identified database is proven.

### Inheritance risk

Vercel Preview variables currently allow non-production deployments to inherit
production database credentials. Prisma loads `.env` and `.env.local` when
process variables are absent, so an operator command can also fall back to an
ignored local production snapshot. Gate 0 must always use explicit process
variables and the executable preflight. Never infer staging from a filename or
from `VERCEL_ENV=preview` alone.

Application cold starts now require `STAGING_SUPABASE_PROJECT_REF` in Preview
or a custom `staging` environment and reject a runtime, direct, or Supabase API
URL that resolves to the known production project.

## 2. Smallest safe target architecture

Create a dedicated Supabase project for staging in the same AWS region as the
application, expected `us-east-1`. Do not use a schema inside production.

Use this topology:

| Purpose | Endpoint | Secret location |
| --- | --- | --- |
| Vercel runtime | Supavisor transaction mode, port 6543, `pgbouncer=true` | Vercel staging or Preview environment only |
| Prisma migration and native DDL | Direct `db.<staging-ref>.supabase.co`, port 5432 | Operator secret store and process environment only |
| Supabase server API and Storage | Staging project URL plus staging service-role key | Vercel staging server environment only |
| Supabase public API, if used | Staging project URL plus staging anon key | Vercel staging client-safe environment only |

The production and staging project references must differ. Credentials, Auth
users, Storage objects, API keys, and database contents are separate.

Supabase Branching creates isolated instances and credentials, and persistent
branches are intended for staging. It is not the smallest choice for the
current free-plan stack because Branching is not included on Free. A dedicated
second Free project is acceptable if an active-project slot is available, but
it pauses after inactivity and has no provider-managed automatic backup. A
paid persistent project avoids pausing and adds daily backups. No purchase or
plan change is authorized by this document.

Provider references:

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/deployment/branching
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/pricing

## 3. Environment variable contract

Use `.env.staging.example` as the name and classification contract. Never
commit populated values.

| Variable | Scope | Classification | Requirement |
| --- | --- | --- | --- |
| `STAGING_SUPABASE_PROJECT_REF` | deployed app | server-only, non-secret | Required; differs from production |
| `P2A_STAGING_PROJECT_REF` | migration operator | non-secret | Required; equals staging project |
| `DATABASE_URL` | app runtime and Gate 0 runtime probe | server-only secret | Port 6543 transaction pooler |
| `DIRECT_URL` | Prisma migration | migration-only secret | Direct staging endpoint on 5432 |
| `P2A_STAGING_DATABASE_URL` | P2-A native DDL and verification | migration-only secret | Exactly equals `DIRECT_URL` in the migration session |
| `SUPABASE_URL` | server Storage/API | server-only, non-secret URL | Staging project only |
| `SUPABASE_SERVICE_ROLE_KEY` | server Storage/API | server-only secret | Staging key only; never client-visible |
| `SUPABASE_ANON_KEY` | server fallback | server-only secret | Staging key only |
| `NEXT_PUBLIC_SUPABASE_URL` | browser, if used | client-safe URL | Staging project only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser, if used | client-safe key | Staging anon key only |
| `P2A_STAGING_APP_URL` | Gate 0 | non-secret | Stable HTTPS staging URL |
| `P2A_STAGING_DEPLOYMENT_ENV_FILE` | Gate 0 | local path | Secure Vercel environment pull; ignored by Git |
| `P2A_BACKUP_EVIDENCE_PATH` | Gate 0 | local path | Valid recovery evidence JSON |
| `P2A_PROVENANCE_WRITERS_DISABLED` | Gate 0 | non-secret assertion | Must be `true` |

Staging must also have an independent `NEXTAUTH_SECRET`. OAuth callback URLs,
webhook endpoints, email, SMS, Blob, Redis, AI providers, queues, and storage
must use staging or sandbox credentials. Disable the corresponding feature when
a staging credential is unavailable. Never copy a production service-role key,
OAuth secret, webhook secret, queue URL, or provider write credential.

## 4. Stable staging application

The minimum model is one persistent Vercel staging deployment attached to the
dedicated staging Supabase project.

Preferred order:

1. If the verified Vercel team has a Pro custom-environment slot, create a
   custom environment named `staging`, track a dedicated `staging` branch, and
   attach a stable domain.
2. Otherwise, use the existing Vercel Preview environment with branch-specific
   variables for a dedicated `staging` branch and its stable branch URL.
3. Remove production database and Supabase credentials from the default
   Preview scope. Either make all Preview deployments intentionally share the
   non-production staging project or leave generic previews without database
   credentials so they fail closed.

Vercel custom environments are currently available on Pro and Enterprise.
Branch-specific Preview variables are supported independently. The repository
does not have working live Vercel credentials, so the current Vercel plan and
custom-environment availability must be verified by a team owner.

After configuration, securely pull the exact staging environment to the path
named by `P2A_STAGING_DEPLOYMENT_ENV_FILE`. The Gate 0 preflight parses it but
never prints values. Deploy the reviewed branch, then require `/api/health` to
return HTTP 200 with `checks.database = "ok"`.

Provider references:

- https://vercel.com/docs/deployments/environments
- https://vercel.com/docs/environment-variables/manage-across-environments

## 5. Staging data policy

Use synthetic data only for the current P2-A gate. Do not copy production
students, users, guardians, authentication records, audit logs, provider
tokens, phone numbers, email addresses, or child data.

The immediate P2-A verification requires at least two `CurriculumContent` rows
without provenance. After all pre-P2-A repository migrations are applied to
the dedicated staging project and Gate 0 foundation checks pass, apply:

```powershell
.\scripts\p2a-psql.ps1 -File prisma/seeds/p2a-staging-curriculum.sql
```

This seed contains two deterministic curriculum-only fixtures and no user or
student data. It does not create provenance records.

A production-derived snapshot is not approved. A future snapshot process would
require explicit authorization plus deterministic anonymization, stable
pseudonyms, removal of auth and provider secrets, replacement of all email and
phone values, child-data minimization, copy audit logs, and deletion controls.

## 6. Backup, restore, and recovery evidence

Gate 0 accepts either:

1. A provider-managed daily backup or PITR restore point bound to the staging
   project, with dashboard evidence and a completed restore test; or
2. A logical custom-format `pg_dump`, stored outside Git, hashed with SHA-256,
   and successfully restored into a disposable PostgreSQL instance.

Free Supabase projects do not currently include automatic backups or PITR.
Supabase recommends regular logical exports for Free projects. Pro includes
seven days of daily backups. PITR is a separately priced add-on and requires
paid compute. Therefore the no-purchase default is a manual logical dump and
restore test.

Evidence must follow
`docs/ops/templates/p2a-staging-backup-evidence.example.json` and include the
staging project, database, creation time, retention deadline, owner, evidence
location, method, passed restore test, and artifact hash when logical.

For P2-A, create the restore point after the pre-P2-A baseline and synthetic
fixtures are ready, immediately before Migration A. Retain it for at least
seven days after staging verification. The database owner decides whether to
restore; migration operators do not restore automatically. A logical restore
test must verify `_prisma_migrations` and both synthetic curriculum fixtures in
a disposable database before evidence is marked passed.

No staging backup or recovery evidence is currently verified.

## 7. Local validation evidence

The foundation implementation was validated on 2026-08-11 without a real
database target:

- `npx prisma generate`: PASS with explicit synthetic database URLs.
- `npx tsc --noEmit`: the default 2 GB Node heap exhausted without a type
  diagnostic; the same command with the repository's established 4 GB
  `NODE_OPTIONS` passed.
- `npx vitest run`: first complete run had five timeout-only failures with
  4,622 passing tests. All four affected files passed 57/57 in isolation. The
  second complete run passed 4,627/4,627 tests in 565 files.
- `npm run build`: the sandboxed run stopped only because Google Fonts was
  inaccessible. The network-enabled rerun remained active past the first
  15-minute tool limit. A final warm-cache run passed in 795.9 seconds with
  synthetic staging-shaped URLs. Expected failed static-generation queries
  targeted only the nonexistent synthetic project and the build still exited
  zero.
- `psql`, `pg_dump`, and `pg_restore` from `postgres:16-alpine`: version 16.14.

This validates code and tooling shape only. It does not verify a deployed
staging application, staging connectivity, backup availability, or restore.

## 8. PostgreSQL client tooling

The approved local client path is the pinned official image
`postgres:16-alpine`. Verified client output on 2026-08-11:

```text
psql (PostgreSQL) 16.14
```

Use `scripts/p2a-psql.ps1`. It passes only the selected environment-variable
name into Docker, mounts SQL files read-only, and does not place a database URL
in the Docker arguments.

Version check:

```powershell
docker run --rm postgres:16-alpine psql --version
```

The PostgreSQL 16 client supports SSL. Staging connections must use
`sslmode=require`. No local PostgreSQL server is required.

## 9. Fail-closed guard

Run:

```powershell
npm run p2a:staging:preflight
```

`scripts/p2a-staging-preflight.ts` stops when:

- a staging URL, project reference, deployment environment pull, application
  URL, backup evidence, or writer-disabled assertion is missing;
- staging matches production;
- DDL uses a pooler or runtime does not use transaction mode;
- runtime, direct, Supabase API, deployment, or backup targets disagree;
- Docker or the pinned PostgreSQL client is unavailable;
- the branch, clean-worktree rule, reviewed ancestor, migration files, or
  migration hashes differ;
- application provenance writer references exist;
- any P2-A migration or provenance table already exists before Migration A;
- a transaction older than 15 minutes needs owner review;
- direct or pooled connectivity fails, SSL identity cannot be recorded, or the
  deployed application database health is not `ok`.

The guard outputs project reference, hosts, ports, database name, identity,
version, SSL state, hashes, and health only. It never outputs credentials.

## 10. External owner actions

1. Supabase owner: confirm whether a second Free project slot is available or
   approve a paid project, then create the dedicated staging project in
   `us-east-1` and record its project reference.
2. Secret owner: store the staging database password, API keys, and service
   role in the password manager. Do not reuse production values.
3. Vercel team owner: verify plan, create the stable staging target, replace
   Preview production database credentials, set staging-only values, and
   provide a secure environment pull.
4. Deployment owner: deploy the reviewed staging branch and record its stable
   URL and commit.
5. Database owner: apply only the pre-P2-A migration baseline, load the
   synthetic curriculum fixtures, create the backup, perform the disposable
   restore test, and sign the evidence.

Stop for approval before any paid plan, paid project, production data copy,
production configuration change, P2-A migration, writer activation, or
backfill.

## 11. P2-A Gate 0 resume contract

All items must exist before a new migration authorization:

- dedicated staging project reference and proof it differs from production;
- direct staging connectivity on the project endpoint, port 5432, with SSL;
- pooled runtime connectivity on transaction mode port 6543;
- stable staging app with database health `ok`;
- secure deployed staging environment pull matching the staging project;
- valid backup evidence with a passed restore test;
- pinned PostgreSQL client available;
- two synthetic curriculum fixtures present;
- clean `codex/p2a-provenance-step1` worktree containing the reviewed ancestor;
- four reviewed P2-A migration hashes unchanged;
- zero P2-A migration rows and zero P2-A provenance tables before Migration A;
- no provenance writer implementation or deployment.

Exact Gate 0 command sequence after owner actions:

```powershell
git switch codex/p2a-provenance-step1
git status -sb
git rev-parse HEAD

# Load values from the approved secret store into this process without
# displaying them. Do not source .env, .env.local, or a production snapshot.
$env:P2A_STAGING_PROJECT_REF = '<non-secret staging project ref>'
$env:STAGING_SUPABASE_PROJECT_REF = $env:P2A_STAGING_PROJECT_REF
$env:P2A_STAGING_DATABASE_URL = '<approved direct staging URL>'
$env:DIRECT_URL = $env:P2A_STAGING_DATABASE_URL
$env:DATABASE_URL = '<approved pooled staging runtime URL>'
$env:P2A_STAGING_APP_URL = '<stable HTTPS staging URL>'
$env:P2A_STAGING_DEPLOYMENT_ENV_FILE = '<secure pulled staging env path>'
$env:P2A_BACKUP_EVIDENCE_PATH = '<signed staging backup evidence JSON path>'
$env:P2A_PROVENANCE_WRITERS_DISABLED = 'true'

docker run --rm postgres:16-alpine psql --version
npm run p2a:staging:preflight

Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000001_p2a_curriculum_provenance_core/migration.sql
Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000002_p2a_ai_generation_correlation/migration.sql
Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000003_p2a_ai_generation_correlation_index/migration.sql
Get-FileHash -Algorithm SHA256 prisma/migrations/20260810_000004_p2a_curriculum_provenance_immutability/migration.sql

npx prisma migrate status
.\scripts\p2a-psql.ps1 -Command 'SELECT current_database(), current_user, inet_server_addr(), current_setting(''server_version''), (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid());'
.\scripts\p2a-psql.ps1 -Command 'SELECT pid, usename, application_name, state, wait_event_type, wait_event, now() - xact_start AS transaction_age FROM pg_stat_activity WHERE datname = current_database() AND xact_start IS NOT NULL ORDER BY xact_start;'
```

If and only if every command passes, capture the sanitized output and request
separate authorization to execute Migration A. Do not continue automatically.
