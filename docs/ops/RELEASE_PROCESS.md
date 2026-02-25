# Release Process (V2 — Block 6)

## Release Cadence
- Patch releases as needed (hotfix)
- Minor releases on a scheduled cadence (e.g., weekly/biweekly)
- Major releases only when version boundaries change (see version governance)

## Gates (Must Pass Before Release)

| Gate | Description |
|------|-------------|
| Tests green | `vitest run` passes 0 failures |
| Build/typecheck | `tsc --noEmit` passes cleanly |
| Migration check | Any new Prisma migration is idempotent and reviewed |
| Telemetry review | New events checked for PII, correct schema |
| Permissions review | Any new route has `assertPermission()` + test in `__tests__/permissions.test.ts` |
| Rollback plan | Environment variable flip documented for every new feature |

## Rollback Rules

1. **Flip flags first** — for any feature behind a flag, set the flag to its safe default before rolling back code
2. **Rollback release** — if tenant boundary, auth, or data integrity is at risk
3. **Circuit breaker** — for governance features, set `ENABLE_GOV_CIRCUIT_BREAKER=true` instantly

## Feature Flag Circuit Breakers

Circuit breakers are environment variables that disable subsystems in production
without a code deploy or restart (in environments supporting live env var updates).

### Available Circuit Breakers

| Subsystem | Circuit Breaker | Safe Default | Effect |
|-----------|----------------|--------------|--------|
| Governance | `ENABLE_GOV_CIRCUIT_BREAKER=true` | `false` (OFF) | Disables all governance exports + audit search → 503 |
| Governance exports | `ENABLE_GOV_EXPORTS=false` | `true` (ON) | Disables student performance, class summary, monthly report |
| National exports | `ENABLE_GOV_NATIONAL_EXPORT=false` | `true` (ON) | Restricts to school-scope only |
| OPS AI | `OPS_AI_EXPLANATIONS_ENABLED=false` | `false` (OFF) | Disables AI explanation endpoint |
| SMS throttle | `SMS_THROTTLE_ENABLED=false` | `true` (ON) | **CAUTION:** Disables throttle; use only for known drills |

### Runtime-Safe Flag Definition

A flag is **runtime-safe** if:
1. It is read at call-time (not module load) in the server function
2. It does not use `NEXT_PUBLIC_` prefix (which are inlined at build time)
3. Changing it does not require a server restart in serverless/edge deployments
4. Changing it does not require a database migration

All flags in `lib/serverFlags.ts` meet this definition.

**NOT runtime-safe (build-time flags):**
- `NEXT_PUBLIC_ENABLE_TRAINING_CENTER` — inlined at build time
- `NEXT_PUBLIC_ENABLE_MASTERY_ENGINE` — inlined at build time
- `NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING` — inlined at build time

These require a new build to take effect.

## Permissions Release Checklist

When adding a new admin or governance feature:

- [ ] Add `PERMISSIONS.NEW_PERM` to `lib/permissions.ts`
- [ ] Add to the correct role's set in `ROLE_PERMISSIONS`
- [ ] Update `docs/governance/PERMISSIONS_MATRIX.md`
- [ ] Add test to `__tests__/permissions.test.ts` (at minimum: allowed role + all denied roles)
- [ ] Use `assertPermission(user, PERMISSIONS.NEW_PERM)` in the route handler
- [ ] Verify tenant isolation (scoped by `user.schoolId` for non-platform admins)

## Schema Migration Checklist

For every Prisma migration:

- [ ] Migration SQL uses `ADD COLUMN IF NOT EXISTS` (idempotent)
- [ ] Migration SQL uses `CREATE INDEX IF NOT EXISTS` (idempotent)
- [ ] No destructive operations (`DROP COLUMN`, `DROP TABLE`) without explicit backup plan
- [ ] Migration file named `YYYYMMDD_NNNNNN_description/migration.sql`
- [ ] `prisma/schema.prisma` updated to match
- [ ] New fields are nullable or have defaults (backward compatible)

## Rollback Runbook (Government-Grade)

### Tier 1: Feature Flag Flip (no deploy required)
```bash
# Disable all governance exports
ENABLE_GOV_CIRCUIT_BREAKER=true

# Disable OPS AI explanations
OPS_AI_EXPLANATIONS_ENABLED=false

# Disable SMS throttle (emergency — use with caution)
SMS_THROTTLE_ENABLED=false
```

### Tier 2: Code Rollback
```bash
git revert <commit-hash>
# Or:
git checkout <previous-tag>
```

### Tier 3: Database Rollback
Schema migrations are additive only (no data loss). If a column must be removed:
1. First remove all code references (deploy)
2. Then remove the column in a subsequent migration
3. Document the delay window in the release notes
