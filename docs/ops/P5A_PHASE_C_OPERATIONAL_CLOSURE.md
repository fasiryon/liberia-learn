# P5-A Phase C Operational Closure

Status: Phase C source complete at `f4f350d6f7232014d9136f55386880c9e912a7d8`;
operational closure complete on main at
`79ad1f01be9eaea9884e0868c3035a5e2a7174ac` via PR #91.

## Scope

The Phase C consolidation contains exactly these five files:

- `lib/content-availability-manifest.ts`
- `__tests__/trust/p5a-phase-c-key-registry.test.ts`
- `scripts/p2a-production-live-manifest-smoke.ts`
- `scripts/p2a-production-post-cutover.ts`
- `__tests__/trust/p5a-production-post-cutover-signing.test.ts`

No schema, migration, OfflinePack, deployment-workflow, or production-key
files were part of the Phase C source diff.

## Supabase Preview boundary

The Supabase GitHub integration reported:

> Remote migration versions not found in local migrations directory.

This is a migration-authority mismatch, not an unexplained Phase C migration
drift. Supabase's integration compares its remote
`supabase_migrations.schema_migrations` table with `supabase/migrations`.
LiberiaLearn's live migration runbook identifies
`prisma/canonical/migrations` as the authoritative application migration
root. The repository contains one legacy `supabase/migrations` SQL file and
does not claim that directory is a complete copy of the canonical Prisma
history.

No migration was invented, copied, deleted, marked applied, or repaired, and
no remote database was contacted for mutation. Main has no branch protection,
so Supabase Preview is not a required main status for this repository. The
failed provider check is retained as an explicit NON-REQUIRED integration
limitation rather than represented as migration success.

## Security-check evidence

GitGuardian passed on PR #89 head `b72851a1a154402bc03111be170c3712b2902ba7`.
The merge commit `f4f350d6f7232014d9136f55386880c9e912a7d8` has an identical
tree, so the scanned source content is identical. GitGuardian is PR-triggered;
no separate push-main result was emitted for `f4f350d6`.

Exact-main CI on the closure merge passed TypeScript, the full Vitest run, and
the build. Runtime Gate 1 and PR Triage passed. GitGuardian, Vercel, and
Vercel Preview Comments passed on PR #91; Supabase Preview was explicitly
skipped on the PR and remains non-required on main.

## Deployment boundary

Before this closure, `Deploy ECS Images` ran on every push to `main` and
published `liberialearn-worker:<sha>` and `liberialearn-worker:latest` to ECR.
The run did not register a task definition or call `ecs update-service`.

The workflow is now `workflow_dispatch` only. Ordinary source merges can run
CI and the runtime gate without publishing a worker image. An explicit worker
image publication remains separate and does not deploy the ECS service.
Vercel's main auto-deploy remains the existing documented application policy;
the merge-created Vercel record was a preview hostname with
`production_environment=false`.

## P5-A status and next goal

- Phase A: COMPLETE as manifest-envelope contract shape; expiry, client
  version, and content entries are not yet signed or enforced.
- Phase B: COMPLETE.
- Phase C: COMPLETE.
- Production key rotation: NOT PERFORMED.
- Production database mutation: NONE during closure.
- ECS service deployment: NONE.

The next P5-A goal is a repo-first discovery/design packet for making
`expiresAt`, `minClientVersion`, and `contents` signed and verified. It is not
implemented by this closure and requires separate authorization.
