import { NextResponse } from "next/server";
import { processDueEvaluationWindows } from "@/lib/autonomous/optimization/evaluationWindowScheduler";
import { logAutonomousCronRun } from "@/lib/autonomous/runtime/autonomousCronLog";
import { isAutonomousCronEnabled, isImplementationWorkflowEnabled } from "@/lib/serverFlags";

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
  if (!isImplementationWorkflowEnabled()) {
    return NextResponse.json({ skipped: true, reason: "implementation_workflow_disabled" });
  }

  const start = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(25, Math.max(1, Number(body?.limit ?? 10)));
    const results = await processDueEvaluationWindows({ limit });
    const closed = results.filter((r) => r.status === "closed").length;
    const durationMs = Date.now() - start;

    await logAutonomousCronRun({
      pipeline: "autonomous.evaluation_windows",
      status: "ok",
      processed: closed,
      failed: 0,
      durationMs,
    });

    return NextResponse.json({ ok: true, durationMs, total: results.length, closed, results });
  } catch (error: any) {
    const durationMs = Date.now() - start;
    await logAutonomousCronRun({
      pipeline: "autonomous.evaluation_windows",
      status: "error",
      processed: 0,
      failed: 1,
      durationMs,
      error: error?.message ?? "Unknown error",
    }).catch(() => {});
    return NextResponse.json(
      { error: error?.message ?? "Cron evaluation-windows failed" },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
