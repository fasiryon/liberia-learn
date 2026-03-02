# LiberiaLearn Rollback Runbook

**Version:** Block 29
**Date:** 2026-03-01

---

## Overview

This runbook describes how to safely roll back a LiberiaLearn feature block in response to a production incident or post-deploy regression. The general principle is **flag-first**: disable the feature flag immediately to gate users out of the affected code path, then assess and execute a code rollback if needed.

---

## 1. Incident Response Sequence

### Step 1 — Detect

Run the health check to confirm the scope of the issue:

```bash
npx ts-node scripts/dr/healthCheck.ts
```

Or for CI/monitoring integration:
```bash
npx ts-node scripts/dr/healthCheck.ts --json | jq '.overallStatus'
```

**Exit codes:**
- `0` — healthy or degraded (warnings)
- `1` — unhealthy (one or more checks `down`)

### Step 2 — Identify the affected block

Check recent commits:
```bash
git log --oneline -10
```

Look up the rollback plan:
```bash
npx ts-node scripts/dr/rollbackPlan.ts --list
npx ts-node scripts/dr/rollbackPlan.ts --block <N>
```

### Step 3 — Flag-first rollback

If the block has a feature flag, disable it immediately in the environment (Vercel dashboard, Railway env, or `.env.production`):

```bash
# Block 28 — MOE Portal
ENABLE_MOE_PORTAL=false

# Block 5 — Ops AI
OPS_AI_EXPLANATIONS_ENABLED=false

# Block 6 — Governance exports (circuit breaker)
GOV_CIRCUIT_BREAKER=tripped
```

Redeploy or restart the application to pick up the env change. This provides immediate user-facing relief without a code deploy.

### Step 4 — Verify flag rollback worked

```bash
npx ts-node scripts/dr/healthCheck.ts
```

The feature_flags check should now show the affected flag as disabled/tripped.

### Step 5 — Code rollback (if flag-first insufficient)

Get the exact commit hash from the block docs (`docs/rollout/BLOCK*_*.md` → commit field).

**Preferred: git revert** (creates a new commit, preserves history):
```bash
git revert <commit-hash> --no-edit
```

This is safe for multi-developer repos because it adds a revert commit without rewriting history.

**Emergency: git reset** (only if the commit was not yet pushed to main):
```bash
git reset --hard HEAD~1
# WARNING: destructive — confirm no other work exists on top
```

### Step 6 — Schema rollback notes

PostgreSQL schema changes have different revertibility:

| Change | Revertible? | Method |
|--------|------------|--------|
| `CREATE INDEX` | ✅ | `DROP INDEX CONCURRENTLY IF EXISTS <name>` |
| `ADD COLUMN nullable` | ✅ | `ALTER TABLE ... DROP COLUMN IF EXISTS <col>` |
| `ALTER TYPE ADD VALUE` | ❌ | Cannot drop enum values in PostgreSQL. Leave in place — unused values have no impact. |
| `CREATE TABLE` | ✅ | `DROP TABLE IF EXISTS <table>` (check for data!) |

### Step 7 — Verify

After code rollback:
```bash
npx vitest run
npx ts-node scripts/dr/healthCheck.ts
```

Expected: all tests pass, health check returns `healthy`.

---

## 2. Block-Specific Rollback Procedures

### Block 28 — MOE Access Portal

**Data risk:** low
**Estimated time:** 5–15 minutes

```
1. ENABLE_MOE_PORTAL=false  →  redeploy
2. Verify /api/moe/dashboard returns 404
3. git revert 708c403 --no-edit
4. npx vitest run  (expect 871 baseline tests)
5. npx ts-node scripts/dr/healthCheck.ts  (expect: healthy)
```

Schema note: `MOE_OFFICIAL` enum value cannot be dropped. This is safe — no users will have this role unless explicitly assigned via seed or admin tooling.

### Block 27 — Load Acceptance Harness

**Data risk:** none (test-only, no production routes)

```
1. git revert 8db0165 --no-edit
2. npx vitest run  (expect 871 tests, Block 27 harness removed)
```

### Block 26 — Performance Hardening

**Data risk:** none

```
1. git revert <block-26-commit> --no-edit
2. DROP INDEX CONCURRENTLY IF EXISTS idx_enrollment_student_class;
   DROP INDEX CONCURRENTLY IF EXISTS idx_meeting_class_date;
   DROP INDEX CONCURRENTLY IF EXISTS idx_submission_student_hw;
3. npx vitest run
```

Note: Index drops are non-destructive and require no data migration.

---

## 3. Communication Template

When initiating an incident rollback, notify the team:

```
INCIDENT ALERT — LiberiaLearn

Block affected: [Block N — Title]
Detected at: [timestamp]
Symptom: [describe the failure]
Initial action: [flag disabled / revert initiated]
Health check: [healthy / degraded / unhealthy]
ETA for full rollback: [estimate]
```

---

## 4. Post-Incident

After rollback is complete:

1. Open a GitHub issue for root cause investigation
2. Update `docs/rollout/BLOCK{N}_{TITLE}.md` with the incident note
3. Add a regression test covering the failure scenario before re-deploying
4. Re-enable the feature flag only after root cause is fixed and tests pass

---

## 5. Health Check Reference

| Check | Status Meanings |
|-------|----------------|
| `env_vars` | `down` = missing `DATABASE_URL`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL` |
| `prisma_client` | `down` = Prisma client not generated; run `npx prisma generate` |
| `database` | `down` = DB unreachable (connection refused, auth fail, etc.) |
| `migrations` | `degraded` = latest migration not finished or table not queryable |
| `feature_flags` | `degraded` = circuit breaker tripped or MOE portal misconfigured |

Overall status:
- `healthy` = all checks `ok`
- `degraded` = at least one check `degraded` (warnings; no hard failures)
- `unhealthy` = at least one check `down` (action required)
