# Block 29 — Disaster Recovery Plan

**Date:** 2026-03-01
**Status:** ACCEPTED
**Test files:** `__tests__/dr/healthCheck.test.ts`
**Total new tests:** 21
**Suite total after Block 29:** 921 / 921 PASS

---

## 1. Overview

Block 29 delivers the LiberiaLearn Disaster Recovery (DR) framework: a runnable health check script, a structured rollback plan library, and the full operational runbook. Together these enable platform operators to detect system degradation and execute a safe, step-by-step rollback for any released block.

---

## 2. Scripts

### 2.1 `scripts/dr/healthCheck.ts`

Executable health check that runs five parallel checks against all critical platform dependencies.

```
npx ts-node scripts/dr/healthCheck.ts
npx ts-node scripts/dr/healthCheck.ts --json
```

**Checks:**

| Check | Passes When |
|-------|-------------|
| `env_vars` | `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` are set |
| `prisma_client` | `@prisma/client` importable (client is generated) |
| `database` | `prisma.$queryRaw\`SELECT 1\`` succeeds |
| `migrations` | Latest migration in `_prisma_migrations` is `finished_at != null` |
| `feature_flags` | No circuit breakers tripped; MOE portal has allowlist if enabled |

**Exit codes:**
- `0` — all checks `ok` (overall: healthy)
- `0` — one or more checks `degraded` (overall: degraded — warnings only)
- `1` — one or more checks `down` (overall: unhealthy)

**Exported functions:** `checkDatabase`, `checkPrismaClient`, `checkEnvVars`, `checkFeatureFlags`, `checkMigrations`, `runHealthChecks`

### 2.2 `scripts/dr/rollbackPlan.ts`

Structured rollback plan library with CLI interface.

```
npx ts-node scripts/dr/rollbackPlan.ts --list
npx ts-node scripts/dr/rollbackPlan.ts --block 28
```

**Exported functions:** `getRollbackPlan(block)`, `listRollbackBlocks()`, `validateRollback(block)`

---

## 3. Rollback Plans

### Block 28 — MOE Access Portal

**Data risk:** low | **Safe to rollback:** yes

| Step | Category | Action | Reversible |
|------|----------|--------|-----------|
| 1 | flag | Disable `ENABLE_MOE_PORTAL` | ✅ |
| 2 | code | `git revert 708c403 --no-edit` | ✅ |
| 3 | schema | Note: MOE_OFFICIAL enum value cannot be dropped from PostgreSQL | ❌ |
| 4 | verify | `npx ts-node scripts/dr/healthCheck.ts` | ✅ |
| 5 | verify | `npx vitest run` (expect 871 passing) | ✅ |

**Note on step 3:** PostgreSQL does not support `DROP VALUE` on enums. The `MOE_OFFICIAL` value is safe to leave in the database — it is unused, and no data migration is required unless admin tooling explicitly assigned it to users.

### Block 27 — Load Acceptance Harness

**Data risk:** none | **Safe to rollback:** yes (test-only changes, no production impact)

### Block 26 — Performance Hardening

**Data risk:** none | **Safe to rollback:** yes (index drops are non-destructive)

---

## 4. Test Coverage (`__tests__/dr/healthCheck.test.ts` — 21 tests)

| Describe block | Tests | Coverage |
|----------------|-------|----------|
| `checkEnvVars` | 4 | ok, missing DATABASE_URL, missing NEXTAUTH_SECRET, all missing |
| `checkFeatureFlags` | 4 | ok, GOV_CIRCUIT_BREAKER tripped, MOE portal without allowlist, MOE portal with allowlist |
| `checkPrismaClient` | 1 | ok when @prisma/client importable |
| `runHealthChecks` | 5 | healthy, unhealthy on missing env, degraded on flag warning, all 5 check names present, unhealthy on DB down |
| `rollbackPlan utilities` | 7 | block 28 plan exists, unknown block undefined, list has entries, validate block 28 (low risk), validate block 27 (no risk), unknown block safe=false, all steps have required fields |

**All 21 tests pass.**

---

## 5. Operational Runbook

See `docs/rollout/ROLLBACK_RUNBOOK.md` for the full step-by-step operator runbook.

---

## 6. DR Readiness Statement

> LiberiaLearn Block 29 delivers a complete operational DR toolkit:
>
> 1. **Health check CLI** — 5 parallel checks covering env, Prisma client, DB connectivity, migration state, and feature flag configuration
> 2. **Structured rollback plans** — typed, ordered steps for Blocks 26, 27, and 28 with data risk ratings and reversibility annotations
> 3. **Rollback runbook** — full operator documentation for flag-first rollback, git revert procedure, and verification sequence
>
> All health checks pass in 21/21 unit test scenarios. The flag-first rollback pattern (step 1 of every Block 28+ rollback) ensures zero-downtime incident response for new feature deployments.
>
> **Block 29 — ACCEPTED**
