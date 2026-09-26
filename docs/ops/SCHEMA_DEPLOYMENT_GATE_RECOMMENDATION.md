# Schema-Dependent Deployment Gate — Finding and Recommendation

Status: Recommendation only. No Vercel or CI policy was changed.
Date: 2026-09-26

## Finding

On 2026-09-25 the merge of PR #146 (`e774e1b5`) to `main` was deployed to
production automatically by the Vercel Git integration
(`dpl_AYa4og9F2gz83J4tEwGeCv6PyJmu`, aliased to `liberia-learn.vercel.app`).
At that moment the production database was 8 canonical migrations behind the
code:

- `20260820_000001` … `20260820_000003` (P2-A/B/C, held since 2026-08-21)
- `20260826_000001`, `20260901_000001`, `20260901_000002`
- `20260924_000001_server_authoritative_placement`
- `20260925_000001_learning_evidence_integrity`

The deployed Prisma client modelled columns and tables that did not exist
(`StudentProgress.*EffectAt`, `Placement*`, `AIInteraction.legacyLogRequired`,
`AiInteractionLog.aiInteractionId`, `InterventionRecommendation.updatedAt`).
Prisma selects every scalar column by default, so reads of those models would
fail with `P2022`. Production traffic in the log window was cron-only, so no
learner-facing failure was observed before the migrations were applied at
2026-09-26T03:47Z.

Two further gaps let this go unnoticed:

1. `/api/health` reports `migrations: "ok"` when canonical migrations are
   pending. It counts only in-flight `_prisma_migrations` rows
   (`finished_at IS NULL AND rolled_back_at IS NULL`); a migration that was
   never started has no row and is invisible.
2. Nothing in the release path compares the build's canonical migration
   inventory with the target database ledger.

## Recommended gate

Goal: application code that requires a schema can never be served in
production before that schema is applied and certified.

### 1. Build-time ledger gate (smallest effective control)

Add a `prebuild` step, active only when `VERCEL_ENV=production`, that:

1. Lists `prisma/canonical/migrations/*` in the build checkout.
2. Reads `_prisma_migrations` from the production database through a
   dedicated **read-only** role (SELECT on `_prisma_migrations` only).
3. Fails the build if any canonical migration lacks a finished,
   non-rolled-back ledger row, or if any applied checksum differs from the
   canonical file.

A failed build never becomes `READY`, so the production alias stays on the
previous deployment. This needs no change to Vercel deployment policy.

### 2. Migration-first release workflow

For releases that touch `prisma/canonical/migrations` or `prisma/schema.prisma`:

1. Merge to `main` builds as usual; the build gate in (1) fails it in
   production while migrations are pending.
2. A GitHub Actions `migrate-production` job, bound to a protected
   GitHub Environment with required human reviewers, runs the existing
   preflight: database identity, byte-identical files, ledger with no
   in-flight rows, no long transactions, and a connection
   `options=-c lock_timeout=5s`.
3. It runs `prisma migrate deploy --schema prisma/canonical/schema.prisma`
   once, then certifies: ledger and checksums, `scripts/verify-rls-invariant.ts`,
   and the schema-authority diff (`scripts/verify-schema-authority-diff.ts`
   against `prisma/schema.prisma`).
4. Only then is the production deployment redeployed or promoted.

### 3. Truthful runtime health

Change `/api/health` `checkMigrations()` to compare the ledger with a
canonical migration inventory embedded at build time and report `pending`
when any expected migration is absent. Keep `/api/healthz` as the cheap
liveness probe.

### 4. Expand/contract discipline

Schema changes ship additive-first (expand), are applied, and only then does
code that depends on them merge. Destructive (contract) changes ship in a
later release after no deployed code references the old shape.

## Evidence

`artifacts/prod-migration-20260926/` (untracked): pre-migration export of the
16 `AssessmentBaselineCompetency` rows, the `migrate deploy` log, and the
production schema-authority diff and report.
