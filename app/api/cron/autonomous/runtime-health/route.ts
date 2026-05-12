import { NextResponse } from "next/server";
import { getRuntimeHealthSummary } from "@/lib/autonomous/runtime/runtimeHealthService";
import { logAutonomousCronRun } from "@/lib/autonomous/runtime/autonomousCronLog";
import { logAudit } from "@/lib/audit";
import { isAutonomousCronEnabled, isRuntimeHealthCronEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAutonomousCronEnabled()) {
    return NextResponse.json({ skipped: true, reason: "autonomous_cron_disabled" });
  }
  if (!isRuntimeHealthCronEnabled()) {
    return NextResponse.json({ skipped: true, reason: "runtime_health_cron_disabled" });
  }

  const start = Date.now();
  try {
    const health = await getRuntimeHealthSummary();
    const durationMs = Date.now() - start;

    await logAudit({
      action: "autonomous.runtime.health.snapshot",
      resourceType: "autonomous_runtime",
      resourceId: "runtime_health",
      details: {
        status: health.status,
        signals: health.signals,
        stuckWorkflows: health.stuckWorkflows,
        deadLetterCount: health.deadLetterCount,
        activeExecutions: health.activeExecutions,
        backpressureActive: health.backpressureActive,
        timestamp: health.timestamp,
      },
    });

    await logAutonomousCronRun({
      pipeline: "autonomous.runtime_health",
      status: "ok",
      processed: 1,
      failed: 0,
      durationMs,
    });

    return NextResponse.json({ ok: true, durationMs, health });
  } catch (error: any) {
    const durationMs = Date.now() - start;
    await logAutonomousCronRun({
      pipeline: "autonomous.runtime_health",
      status: "error",
      processed: 0,
      failed: 1,
      durationMs,
      error: error?.message ?? "Unknown error",
    }).catch(() => {});
    return NextResponse.json(
      { error: error?.message ?? "Cron runtime-health failed" },
      { status: 500 }
    );
  }
}
