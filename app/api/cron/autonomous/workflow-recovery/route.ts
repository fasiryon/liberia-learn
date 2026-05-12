import { NextResponse } from "next/server";
import { runWorkflowRecovery } from "@/lib/autonomous/runtime/workflowRecoveryService";
import { logAutonomousCronRun } from "@/lib/autonomous/runtime/autonomousCronLog";
import { isAutonomousCronEnabled, isWorkflowRecoveryCronEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAutonomousCronEnabled()) {
    return NextResponse.json({ skipped: true, reason: "autonomous_cron_disabled" });
  }
  if (!isWorkflowRecoveryCronEnabled()) {
    return NextResponse.json({ skipped: true, reason: "workflow_recovery_cron_disabled" });
  }

  const start = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runWorkflowRecovery({ dryRun: body?.dryRun === true });
    const durationMs = Date.now() - start;

    await logAutonomousCronRun({
      pipeline: "autonomous.workflow_recovery",
      status: "ok",
      processed: result.recovered + (result.requeued ?? 0),
      failed: result.quarantined,
      durationMs,
    });

    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (error: any) {
    const durationMs = Date.now() - start;
    await logAutonomousCronRun({
      pipeline: "autonomous.workflow_recovery",
      status: "error",
      processed: 0,
      failed: 1,
      durationMs,
      error: error?.message ?? "Unknown error",
    }).catch(() => {});
    return NextResponse.json(
      { error: error?.message ?? "Cron workflow-recovery failed" },
      { status: 500 }
    );
  }
}
