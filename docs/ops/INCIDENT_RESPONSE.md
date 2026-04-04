# Incident Response

## Severity Definitions

- `P0`: complete outage, tenant-boundary risk, security event, or data-integrity threat
- `P1`: critical workflow outage for many users such as login, sync, exports, or database reachability
- `P2`: partial degradation with workaround, elevated latency, worker lag, or AI instability
- `P3`: minor issue, isolated edge case, or operator-only tooling problem

## Response Times

| Severity | Acknowledge | First operator action | Update cadence |
|---|---:|---:|---:|
| P0 | 15 minutes | 15 minutes | every 30 minutes |
| P1 | 30 minutes | 30 minutes | every 60 minutes |
| P2 | 4 hours | same business day | every 4 hours |
| P3 | next business day | planned backlog | daily or as needed |

## General Response Flow

1. Confirm the scope: all users, one role, one school, or one subsystem.
2. Capture timestamp, failing route, latest deploy, and active feature flags.
3. Decide whether to degrade gracefully, disable a feature flag, restart a subsystem, or roll back.
4. Preserve logs, audit evidence, and queue state before destructive recovery actions.
5. Communicate the current status and next checkpoint.

## Login Fails For All Users

Likely signals:
- widespread `401` or auth callback failures
- missing `NEXTAUTH_SECRET` or `NEXTAUTH_URL`
- deployment/config regression

Immediate actions:
1. Check the latest deployment and env-var changes.
2. Verify `/api/healthz` and `/api/health`.
3. Confirm auth env vars are present in the deployment target.
4. If the failure started with the latest deploy, use the rollback procedure below.

## AI Tutor Returns Errors

Likely signals:
- routed AI failures across tutor or teacher assist
- budget cap exhaustion
- provider outage or timeout spike

Immediate actions:
1. Check AI budget/admin surfaces for caps or alerts.
2. Confirm provider env vars remain present.
3. Verify fallback paths still return safe responses.
4. Disable non-critical AI features via flags if necessary while keeping core learning flows online.

## MOE Exports Fail

Likely signals:
- governance or export endpoints returning `500`
- long-running export queries timing out
- PDF/export generation failures

Immediate actions:
1. Identify whether the failure is all exports or one export type.
2. Check database latency and worker health if export generation is async-backed.
3. Retry only after confirming the underlying error is transient.
4. If interactive admin traffic is impacted, pause heavy export generation first.

## Offline Sync Stops

Likely signals:
- increased sync backlog
- repeated sync errors from student clients
- successful login but stale student progress

Immediate actions:
1. Verify `/api/student/sync` health and recent deploys.
2. Check database and queue pressure.
3. Confirm no schema mismatch or auth regression blocks sync writes.
4. If needed, place non-critical background work behind flags until sync stabilizes.

## Database Unreachable

Likely signals:
- Prisma initialization failures
- widespread route `500`s
- connection timeout or saturation errors

Immediate actions:
1. Confirm `DATABASE_URL` and provider health.
2. Check whether runtime is using pooled or direct connections.
3. Reduce pressure from exports, AI, and worker consumers if possible.
4. If the incident began with a deploy or env change, roll back fast.

## Worker Stops Processing

Likely signals:
- queue backlog rising
- no recent `/ecs/liberialearn-worker` logs
- SQS messages aging without completion

Immediate actions:
1. Check ECS task count and CloudWatch logs.
2. Confirm `SQS_QUEUE_URL` and optional `SQS_DLQ_URL`.
3. Force a new ECS deployment if the task is unhealthy.
4. If backlog is growing faster than one worker can drain, scale worker count temporarily.

Reference:
- [`docs/ops/WORKER_DEPLOYMENT.md`](C:\Users\fasir\liberia-learn\docs\ops\WORKER_DEPLOYMENT.md)

## Vercel Deployment Fails

Likely signals:
- build failure
- missing env vars
- Next.js config/runtime validation regression

Immediate actions:
1. Inspect build logs for the first real failure, not downstream noise.
2. Confirm required env vars for the target environment.
3. If the prior deployment is healthy, promote it immediately.
4. Fix on a branch; do not patch `main` blind during an active incident.

## Emergency Rollback Procedure

Option A - revert the last commit:

```bash
git revert HEAD --no-edit
git push origin main
```

Option B - promote the last healthy Vercel deployment:

1. Open `vercel.com`
2. Select the LiberiaLearn project
3. Open `Deployments`
4. Select the previous healthy deployment
5. Click `Promote`

Option C - pin to a known good commit:

```bash
git checkout <good-sha>
git checkout -b emergency-fix
git push origin emergency-fix
```

## Contacts

Named production contacts are intentionally not stored in the repository.

Maintain an external roster with these roles:
- on-call application operator
- deployment owner / repository maintainer
- database / infrastructure owner
- ministry or pilot operations contact

## Post-Incident Requirements

- root cause summary
- user and school impact statement
- mitigation and permanent fix
- tests added or updated
- docs and runbooks updated
