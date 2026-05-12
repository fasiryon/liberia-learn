# Autonomous OS — Runtime Operations

## Overview

This runbook covers the production runtime for the Autonomous OS. Phase 9 wires durable cron entrypoints, worker services, queue management, health snapshots, and recovery automation. All cron routes are secured behind CRON_SECRET, gated by feature flags, and idempotent.

---

## Required Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CRON_SECRET` | — | **Required.** Shared secret for all cron endpoints. Min 32 chars recommended. |
| `ENABLE_AUTONOMOUS_CRON` | `false` | Master gate for all autonomous cron endpoints. |
| `ENABLE_WORKFLOW_RECOVERY_CRON` | `false` | Enables stuck workflow detection and recovery. |
| `ENABLE_DEAD_LETTER_INSPECTION_CRON` | `false` | Enables dead-letter inspection audit writes. |
| `ENABLE_RUNTIME_HEALTH_CRON` | `false` | Enables runtime health snapshot writes to AuditLog. |
| `ENABLE_APPROVAL_EXPIRATION_WORKER` | `false` | Enables stale approval expiration cron. |
| `ENABLE_IMPLEMENTATION_WORKFLOW` | `false` | Enables evaluation window processing cron. |
| `ENABLE_RUNTIME_DASHBOARD` | `true` | Controls /admin/ops/runtime dashboard visibility. |
| `AUTONOMOUS_STUCK_WORKFLOW_MINUTES` | `45` | Minutes before a running/executing workflow is considered stuck. |
| `AUTONOMOUS_ACTIVE_EXECUTION_LIMIT` | `100` | Global concurrency ceiling for action executions. |
| `AUTONOMOUS_TENANT_ACTIVE_EXECUTION_LIMIT` | `15` | Per-tenant concurrency ceiling. |
| `AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT` | `200` | Pending workflow count that activates backpressure. |
| `AUTONOMOUS_DAILY_RETRY_BUDGET` | `500` | Max workflow retry attempts counted per 24h window. |
| `AUTONOMOUS_EMERGENCY_SHUTDOWN` | `false` | Kill switch — halts all execution immediately when `true`. |

---

## Cron Endpoints

All cron endpoints require `Authorization: Bearer <CRON_SECRET>` and accept `POST`. Body is optional JSON.

| Endpoint | Schedule | Feature Flags Required |
|---|---|---|
| `POST /api/cron/autonomous/stale-approvals` | `*/15 * * * *` | `ENABLE_AUTONOMOUS_CRON`, `ENABLE_APPROVAL_EXPIRATION_WORKER` |
| `POST /api/cron/autonomous/evaluation-windows` | `0 * * * *` | `ENABLE_AUTONOMOUS_CRON`, `ENABLE_IMPLEMENTATION_WORKFLOW` |
| `POST /api/cron/autonomous/workflow-recovery` | `*/10 * * * *` | `ENABLE_AUTONOMOUS_CRON`, `ENABLE_WORKFLOW_RECOVERY_CRON` |
| `POST /api/cron/autonomous/runtime-health` | `*/5 * * * *` | `ENABLE_AUTONOMOUS_CRON`, `ENABLE_RUNTIME_HEALTH_CRON` |
| `POST /api/cron/autonomous/dead-letter-inspection` | `0 */6 * * *` | `ENABLE_AUTONOMOUS_CRON`, `ENABLE_DEAD_LETTER_INSPECTION_CRON` |

Vercel Cron fires these automatically per the schedule in `vercel.json`. Each cron invocation writes a run record to AuditLog (action `cron.autonomous.<pipeline>.run`).

All cron routes are:
- **Idempotent** — repeated invocations do not duplicate side effects.
- **Replay-safe** — skipped items remain in their current state.
- **Feature-flagged** — return `{ skipped: true }` when flags are off.
- **Secure** — CRON_SECRET mismatch returns 401.

---

## Worker Deployment Model

This project runs on Vercel Serverless Functions (Fluid Compute). There are no persistent workers. All "worker" operations happen inside short-lived cron invocations.

Each cron invocation:
1. Checks feature flags and CRON_SECRET.
2. Acquires a scoped query over the DB (e.g., stuck workflows).
3. Processes up to `limit` items (default varies per cron).
4. Writes audit and cron log records.
5. Returns a summary response.

For SQS-based workflow dispatch (`AUTONOMOUS_WORKFLOW_RUN` job type): the cron routes re-enqueue failed workflows into SQS. Workers processing SQS messages are external (not Vercel). If SQS is not configured, `isQueueConfigured()` returns false and workflow recovery falls back to DB-state resets only.

---

## Production Setup (Vercel + Supabase)

### Step 1: Set Environment Variables

In Vercel Settings → Environment Variables, set:
```
CRON_SECRET=<generate with: openssl rand -hex 32>
ENABLE_AUTONOMOUS_CRON=true
ENABLE_WORKFLOW_RECOVERY_CRON=true
ENABLE_RUNTIME_HEALTH_CRON=true
ENABLE_APPROVAL_EXPIRATION_WORKER=true  # only if action governance is enabled
ENABLE_IMPLEMENTATION_WORKFLOW=true      # only if optimization workflow is enabled
ENABLE_DEAD_LETTER_INSPECTION_CRON=true
```

### Step 2: Verify Cron Config

`vercel.json` contains all 5 autonomous cron schedules plus the existing audio/textbook crons. Confirm the file is committed and deployed.

### Step 3: Verify Health Endpoint

After deploy, check:
```
GET /api/admin/ops/runtime/health  (as platform admin)
```
Should return `{ ok: true, health: { status: "healthy" } }`.

### Step 4: Monitor Cron Run History

Visit `/admin/ops/runtime/cron` — runs appear after first cron tick (~5 min for health, ~10 min for recovery).

---

## SQS Notes

If using SQS for queue-driven workflow dispatch:
- Set `SQS_QUEUE_URL` to your FIFO queue URL (recommended: `.fifo` suffix).
- Set `AWS_REGION` and appropriate IAM credentials.
- FIFO queues: set `MessageGroupId` per partition key and `MessageDeduplicationId` per workflow run.
- The workflow recovery cron re-enqueues retryable failed workflows via `enqueueWorkflowRun`.

---

## Windows / Local Dev Notes

- On Windows, Prisma's native DLL (`libquery_engine-windows.dll.node`) may be locked after hot-reload in `next dev`. If you see DLL lock errors, restart the dev server.
- Cron endpoints cannot be triggered by Vercel in local dev. Use `curl -X POST http://localhost:3000/api/cron/autonomous/<pipeline> -H "Authorization: Bearer <CRON_SECRET>"` to test locally.

---

## Emergency Shutdown Procedure

1. Set `AUTONOMOUS_EMERGENCY_SHUTDOWN=true` in Vercel env vars.
2. Trigger a redeployment (or wait for next cold start).
3. Verify `/api/admin/ops/runtime/health` returns `status: "shutdown"`.
4. All execution, queue processing, and new workflow creation halts.
5. In-flight workflows remain in their current DB state for inspection.
6. Do NOT delete WorkflowRun or AuditLog records during an incident.
7. To recover: diagnose root cause, fix code/config, set `AUTONOMOUS_EMERGENCY_SHUTDOWN=false`, redeploy.

---

## Queue Saturation Response

1. Check `/admin/ops/runtime/queue` — if `backpressureActive: true`, pending workflows ≥ threshold.
2. Disable new workflow creation: `ENABLE_DETECTOR_EXECUTION=false`.
3. Allow backlog to drain (watch `/admin/ops/runtime/queue` for pending count to drop).
4. Investigate root cause: stuck workers, high failure rate, or SQS consumer lag.
5. Re-enable `ENABLE_DETECTOR_EXECUTION=true` only after pending count normalizes.

---

## Stuck Workflow Recovery

The `workflow-recovery` cron (*/10 min) automatically handles stuck workflows. Stuck = `running`/`executing` status with `updatedAt` older than `AUTONOMOUS_STUCK_WORKFLOW_MINUTES`.

Recovery logic:
- **Within retry budget** (`attempt < maxAttempts`): releases lock, transitions to `failed` with `nextRetryAt` = exponential backoff. Retryable failed workflows are re-queued in the next cron tick.
- **Exhausted** (`attempt >= maxAttempts`): transitions to `dead_lettered`. Appears in `/admin/ops/runtime/dead-letter`.

Manual recovery (platform admin only):
```
POST /api/admin/ops/runtime/recovery
{ "action": "recover", "dryRun": true }   # preview
{ "action": "recover", "dryRun": false }  # execute
```

---

## Dead-Letter Review

Dead-lettered workflows appear at `/admin/ops/runtime/dead-letter`.

- **Replay-eligible** (`replayEligible: true`): transient errors (timeout, lock conflict). Can be replayed via `POST /api/admin/ops/workflows/<id>/replay` (analysis_only by default).
- **Quarantined** (`quarantined: true`): stuck-and-exhausted workflows. Require manual investigation before replay.

Action replay requires an explicit approval request. See `docs/ai/WORKFLOW_ENGINE.md`.

---

## Rollback Procedure

1. Disable feature flags: `ENABLE_ACTION_EXECUTION=false`, `ENABLE_LOW_RISK_AUTONOMY=false`.
2. Activate emergency shutdown: `AUTONOMOUS_EMERGENCY_SHUTDOWN=true`.
3. Remove autonomous cron entries from `vercel.json` and redeploy.
4. Cancel in-flight workflows via `PATCH /api/admin/ops/workflows/<id>/cancel`.
5. Review AuditLog for all `autonomous.*` actions since the incident start.
6. Apply code rollback via Vercel dashboard → Deployments → Promote previous.
7. Run full validation: `npx prisma generate && npx tsc --noEmit && npx vitest run && npm run build`.
8. Re-enable flags incrementally: `ENABLE_DETECTOR_EXECUTION` only → monitor → expand.

---

## Approval SLA

Stale approval cron runs every 15 minutes when `ENABLE_APPROVAL_EXPIRATION_WORKER=true`.

- Approvals with `status=PENDING` and `expiresAt < now` are expired automatically.
- Overdue approvals are escalated via `escalateOverdueApprovals`.
- Check `/admin/ops/stale-approvals` for current stale pending count.
- Default SLA: controlled by `APPROVAL_SLA_HOURS` env var (see approvalSLAService).

---

## Dashboard Links

| Dashboard | URL |
|---|---|
| Runtime hub | `/admin/ops/runtime` |
| Worker & lock status | `/admin/ops/runtime/workers` |
| Queue backlog | `/admin/ops/runtime/queue` |
| Workflow recovery | `/admin/ops/runtime/recovery` |
| Dead-letter items | `/admin/ops/runtime/dead-letter` |
| Cron run history | `/admin/ops/runtime/cron` |
| Effectiveness summary | `/admin/ops/effectiveness` |
| Stale approvals | `/admin/ops/stale-approvals` |
| Evaluation windows | `/admin/ops/optimization/evaluation-windows` |
