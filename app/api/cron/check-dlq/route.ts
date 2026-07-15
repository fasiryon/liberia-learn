import { NextResponse } from "next/server";
import { getQueueDepths } from "@/lib/ops/queueDepths";
import { sendOpsAlert } from "@/lib/ops/alerts";
import { recordCronHeartbeat } from "@/lib/ops/cronHeartbeat";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queues = await getQueueDepths();

  if (!queues.dlq.configured) {
    return NextResponse.json({ checked: true, dlqConfigured: false, dlqDepth: null });
  }

  const dlqDepth = queues.dlq.depth ?? 0;

  if (dlqDepth > 0) {
    await sendOpsAlert({
      subject: `DLQ has ${dlqDepth} message(s) — investigate worker failures`,
      body: [
        `The SQS Dead Letter Queue has ${dlqDepth} message(s).`,
        ``,
        `This means an ECS worker job failed after all retries.`,
        `DLQ messages should be rare. Every one represents a job that will not complete`,
        `unless it is manually re-queued or the failure root cause is fixed.`,
        ``,
        `To investigate:`,
        `  1. AWS Console → SQS → find the DLQ → View messages`,
        `  2. Check Sentry for worker errors in the same time window`,
        `  3. AWS Console → ECS → check task logs`,
        `  4. See docs/ops/RUNBOOK.md (ECS worker section)`,
      ].join("\n"),
      channel: "email",
    });
  }

  await recordCronHeartbeat("check-dlq").catch(() => {}); // best-effort, never fail the cron on a heartbeat write

  return NextResponse.json({
    checked: true,
    dlqConfigured: true,
    dlqDepth,
    alerted: dlqDepth > 0,
  });
}
