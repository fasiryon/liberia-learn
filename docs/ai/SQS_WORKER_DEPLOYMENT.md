# SQS Worker Deployment Guide

## Overview

LiberiaLearn's Autonomous OS uses Vercel Fluid Compute for all cron-driven processing. The SQS integration is **optional**: when configured, it enables durable queue-based workflow dispatch; when absent, the system falls back to DB-state polling only.

---

## Architecture

```
Vercel Cron (*/10 min)
  └─ workflow-recovery cron
       ├─ recoverStuckWorkflows()     → marks stuck runs as failed/dead_lettered
       └─ requeueRetryableWorkflows() → if SQS configured: enqueueWorkflowRun()
                                         else: DB status reset to "pending"

SQS FIFO Queue (optional)
  └─ Consumer (external process)
       └─ processes AUTONOMOUS_WORKFLOW_RUN jobs
            └─ calls Vercel function or internal processor
```

---

## Required Environment Variables (SQS mode)

| Variable | Description |
|---|---|
| `SQS_QUEUE_URL` | FIFO queue URL. Must end in `.fifo`. |
| `AWS_REGION` | AWS region where the queue is hosted (e.g. `us-east-1`). |
| `AWS_ACCESS_KEY_ID` | IAM access key with `sqs:SendMessage` permission. |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key. |

If `SQS_QUEUE_URL` is not set, `isQueueConfigured()` returns `false` and the system skips SQS enqueue. All other autonomous OS features continue to work.

---

## Queue Configuration

### Recommended: FIFO Queue

```
Queue type: FIFO (.fifo suffix required)
Content-based deduplication: enabled OR caller sets MessageDeduplicationId
Visibility timeout: 120s (matches max cron execution window)
Message retention: 4 days
Receive message wait time: 20s (long-polling)
```

### Message Format

Each message is a `JobPayload` with `jobType: "AUTONOMOUS_WORKFLOW_RUN"`:

```json
{
  "jobType": "AUTONOMOUS_WORKFLOW_RUN",
  "workflowRunId": "clxyz...",
  "workflowType": "LESSON_QUALITY_IMPROVEMENT",
  "tenantId": "tenant_abc",
  "schoolId": "school_xyz",
  "partitionKey": "school_xyz",
  "priority": 5,
  "retryCount": 0,
  "idempotencyKey": "clxyz...::run",
  "enqueuedAt": "2026-05-12T10:00:00.000Z"
}
```

`MessageGroupId` = `partitionKey` (enables per-school FIFO ordering).  
`MessageDeduplicationId` = `idempotencyKey` (prevents duplicate processing within 5 min dedup window).

---

## IAM Policy

Minimum required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:GetQueueAttributes"],
      "Resource": "arn:aws:sqs:<region>:<account>:<queue-name>.fifo"
    }
  ]
}
```

The SQS consumer (external) also needs `sqs:ReceiveMessage`, `sqs:DeleteMessage`.

---

## Consumer Deployment

The SQS consumer is **external to Vercel**. Recommended options:

1. **AWS Lambda** triggered by SQS event source mapping.
2. **ECS/Fargate** long-running consumer process.
3. **EC2** with a Node.js consumer script.

### Consumer Logic

```typescript
// Pseudo-code — adapt to your runtime
while (true) {
  const messages = await sqs.receiveMessage({ QueueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 20 });
  for (const msg of messages.Messages ?? []) {
    const job = JSON.parse(msg.Body);
    if (job.jobType === "AUTONOMOUS_WORKFLOW_RUN") {
      await processWorkflowRun(job.workflowRunId);
    }
    await sqs.deleteMessage({ QueueUrl, ReceiptHandle: msg.ReceiptHandle });
  }
}
```

`processWorkflowRun` should call the internal Vercel route or Prisma-based processor that transitions the workflow run from `pending` → `running` → `succeeded`/`failed`.

---

## Recovery Without SQS

When SQS is not configured, `requeueRetryableWorkflows()` resets failed+retryable runs to `pending` status. The next workflow processor poll (or cron tick) picks them up. This is safe for low-throughput environments (< 50 workflow runs/day).

---

## Monitoring

- `/admin/ops/runtime/queue` — shows pending workflow count, backpressure state, SQS configuration status.
- `/admin/ops/runtime/recovery` — shows stuck count and last recovery cron run.
- AuditLog entries with `action: "workflow.requeued"` for each SQS enqueue attempt.
- If `isQueueConfigured()` returns false, a note appears in the runtime queue dashboard.

---

## Backpressure

When pending + running workflow count exceeds `AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT` (default 200), `shouldAllowNewWorkflow()` returns false. New workflow creation is blocked until the backlog drains.

For SQS environments: also monitor queue depth via CloudWatch `ApproximateNumberOfMessagesVisible`. If it exceeds `AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT`, pause new message sends by setting `ENABLE_DETECTOR_EXECUTION=false`.

---

## Troubleshooting

| Symptom | Likely Cause | Action |
|---|---|---|
| Workflow runs stuck in `pending` | SQS consumer stopped | Check consumer process; restart or redeploy |
| `sqs_send_failed` in dead-letter | IAM permission missing or queue URL wrong | Verify `SQS_QUEUE_URL` and IAM policy |
| High backpressure | Consumer lag | Scale consumer replicas; check SQS visibility timeout |
| Duplicate runs | Dedup ID collision or dedup window expired | Check `MessageDeduplicationId` is stable per run |
| Dead-lettered after SQS failure | `maxAttempts` exhausted during SQS outage | Replay via `/admin/ops/workflows/<id>/replay` after SQS is restored |

---

## Local Development

Cron routes and SQS sends are not triggered in local dev. To test the recovery cron locally:

```bash
curl -X POST http://localhost:3000/api/cron/autonomous/workflow-recovery \
  -H "Authorization: Bearer $CRON_SECRET"
```

SQS sends will be skipped silently (`isQueueConfigured()` returns false when `SQS_QUEUE_URL` is unset).
