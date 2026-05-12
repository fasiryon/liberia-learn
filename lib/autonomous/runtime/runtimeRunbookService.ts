export type RunbookSection = {
  id: string;
  title: string;
  steps: string[];
};

export type RuntimeRunbook = {
  version: string;
  lastUpdated: string;
  sections: RunbookSection[];
};

export function getRuntimeRunbook(): RuntimeRunbook {
  return {
    version: "1.0.0",
    lastUpdated: "2026-05-12",
    sections: [
      {
        id: "emergency_shutdown",
        title: "Emergency Shutdown",
        steps: [
          "Set env var AUTONOMOUS_EMERGENCY_SHUTDOWN=true in Vercel (Settings → Environment Variables).",
          "Redeploy or wait for the next cold start to propagate the flag.",
          "Verify /api/admin/ops/runtime/health returns status=shutdown.",
          "All new workflow creation, action execution, and queue processing will halt.",
          "In-flight workflows remain in their current state for post-incident review.",
          "Do not delete WorkflowRun or AuditLog records during the incident.",
        ],
      },
      {
        id: "queue_saturation",
        title: "Queue Saturation Response",
        steps: [
          "Check /admin/ops/runtime/queue for pending workflow count vs threshold.",
          "If pending count > AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT (default 200), backpressure is active.",
          "Disable new detector trigger runs by setting ENABLE_DETECTOR_EXECUTION=false.",
          "Allow existing workflows to drain before re-enabling.",
          "If SQS is backed up, check AWS SQS console for ApproximateNumberOfMessagesNotVisible.",
          "Increase AUTONOMOUS_ACTIVE_EXECUTION_LIMIT only after diagnosing root cause.",
        ],
      },
      {
        id: "stuck_workflow_recovery",
        title: "Stuck Workflow Recovery",
        steps: [
          "Check /admin/ops/runtime/recovery for workflows in running/executing state older than AUTONOMOUS_STUCK_WORKFLOW_MINUTES.",
          "The workflow recovery cron (every 10 min) auto-recovers stuck workflows when ENABLE_WORKFLOW_RECOVERY_CRON=true.",
          "To manually trigger: POST /api/cron/autonomous/workflow-recovery with Authorization: Bearer <CRON_SECRET>.",
          "Workflows within retry budget are reset to failed with nextRetryAt backoff.",
          "Workflows that exhausted retries are quarantined to dead_lettered.",
          "After recovery, check /admin/ops/runtime/dead-letter for quarantined items.",
        ],
      },
      {
        id: "dead_letter_review",
        title: "Dead-Letter Review",
        steps: [
          "Check /admin/ops/runtime/dead-letter for all dead-lettered workflows.",
          "Items with replayEligible=true can be replayed via the replay API.",
          "Items with quarantined=true have been assessed as non-recoverable.",
          "For replay, use POST /api/admin/ops/workflows/<id>/replay (analysis_only mode by default).",
          "Action replay requires explicit approval. See WORKFLOW_ENGINE.md replay model.",
          "Log operator notes on quarantined items via the dead-letter detail page.",
        ],
      },
      {
        id: "degraded_mode",
        title: "Degraded Mode Handling",
        steps: [
          "Degraded mode activates when: DB is unreachable, queue is not configured, or ENABLE_AUTONOMOUS_DEGRADED_MODE=true.",
          "In degraded mode, deterministic read-only insights continue; AI-dependent agents stop.",
          "Check DB connectivity via /api/health.",
          "Check SQS via /admin/ops/runtime/queue (shows queue configured status).",
          "To force degraded mode: set ENABLE_AUTONOMOUS_DEGRADED_MODE=true.",
          "To exit degraded mode: fix root cause and set flag back to false.",
        ],
      },
      {
        id: "rollback",
        title: "Rollback Procedure",
        steps: [
          "1. Disable feature flag (ENABLE_ACTION_EXECUTION=false, ENABLE_LOW_RISK_AUTONOMY=false).",
          "2. Set AUTONOMOUS_EMERGENCY_SHUTDOWN=true to halt all execution.",
          "3. Pause Vercel cron jobs by removing them from vercel.json and redeploying.",
          "4. Stop any in-flight workflows via cancel API: PATCH /api/admin/ops/workflows/<id>/cancel.",
          "5. Review all recent AuditLog entries for autonomous.* actions.",
          "6. Apply code rollback via Vercel dashboard (Deployments → Promote previous).",
          "7. Run full validation gate before re-enabling: prisma generate → tsc → vitest → build.",
          "8. Re-enable flags one by one, starting with ENABLE_DETECTOR_EXECUTION only.",
        ],
      },
      {
        id: "stale_approval_sla",
        title: "Stale Approval SLA",
        steps: [
          "Stale approval cron runs every 15 minutes when ENABLE_APPROVAL_EXPIRATION_WORKER=true.",
          "Approvals past expiresAt are expired automatically.",
          "Overdue approvals (decidedAt past SLA window) are escalated.",
          "Check /admin/ops/stale-approvals for current stale pending count.",
          "To manually process: POST /api/admin/ops/stale-approvals/process.",
          "If SLA alerts are firing, check APPROVAL_SLA_HOURS env var (default 48h).",
        ],
      },
      {
        id: "env_vars",
        title: "Required Environment Variables",
        steps: [
          "CRON_SECRET — required for all cron endpoints (min 32 chars recommended).",
          "ENABLE_AUTONOMOUS_CRON=true — master gate for all autonomous cron jobs.",
          "ENABLE_WORKFLOW_RECOVERY_CRON=true — enables stuck workflow recovery.",
          "ENABLE_DEAD_LETTER_INSPECTION_CRON=true — enables dead-letter scanning.",
          "ENABLE_RUNTIME_HEALTH_CRON=true — enables health snapshot writes.",
          "ENABLE_APPROVAL_EXPIRATION_WORKER=true — enables stale approval cron.",
          "ENABLE_IMPLEMENTATION_WORKFLOW=true — enables evaluation window cron.",
          "AUTONOMOUS_STUCK_WORKFLOW_MINUTES=45 — minutes before a workflow is considered stuck.",
          "AUTONOMOUS_ACTIVE_EXECUTION_LIMIT=100 — global concurrency ceiling.",
          "AUTONOMOUS_TENANT_ACTIVE_EXECUTION_LIMIT=15 — per-tenant concurrency ceiling.",
          "AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT=200 — pending count that activates backpressure.",
          "AUTONOMOUS_DAILY_RETRY_BUDGET=500 — max retry attempts per day.",
          "AUTONOMOUS_EMERGENCY_SHUTDOWN=true — kills all execution immediately.",
          "Note: On Windows local dev, Prisma DLL may lock after hot-reload. Restart dev server to release.",
        ],
      },
    ],
  };
}
