# Paused Cron Jobs (restore when on Vercel Pro)

These crons were removed from `vercel.json` because high-frequency schedules are not
supported on the Vercel Hobby plan. Re-add them to the `crons` array in `vercel.json`
after upgrading to Vercel Pro.

## Audio Generation

```json
{
  "path": "/api/cron/process-audio-generation",
  "schedule": "*/10 * * * *"
}
```

Every 10 minutes.

## Textbook Generation

```json
{
  "path": "/api/cron/process-textbook-generation",
  "schedule": "*/15 * * * *"
}
```

Every 15 minutes.

## Autonomous — Stale Approvals

```json
{
  "path": "/api/cron/autonomous/stale-approvals",
  "schedule": "*/15 * * * *"
}
```

Every 15 minutes.

## Autonomous — Evaluation Windows

```json
{
  "path": "/api/cron/autonomous/evaluation-windows",
  "schedule": "0 * * * *"
}
```

Every hour (on the hour).

## Autonomous — Workflow Recovery

```json
{
  "path": "/api/cron/autonomous/workflow-recovery",
  "schedule": "*/10 * * * *"
}
```

Every 10 minutes.

## Autonomous — Runtime Health

```json
{
  "path": "/api/cron/autonomous/runtime-health",
  "schedule": "*/5 * * * *"
}
```

Every 5 minutes.

## Autonomous — Dead Letter Inspection

```json
{
  "path": "/api/cron/autonomous/dead-letter-inspection",
  "schedule": "0 */6 * * *"
}
```

Every 6 hours (on the hour).
