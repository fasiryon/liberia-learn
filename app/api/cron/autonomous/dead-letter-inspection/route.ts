import { NextResponse } from "next/server";
import { runDeadLetterInspection } from "@/lib/autonomous/runtime/deadLetterInspectionService";
import { logAutonomousCronRun } from "@/lib/autonomous/runtime/autonomousCronLog";
import { isAutonomousCronEnabled, isDeadLetterInspectionCronEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAutonomousCronEnabled()) {
    return NextResponse.json({ skipped: true, reason: "autonomous_cron_disabled" });
  }
  if (!isDeadLetterInspectionCronEnabled()) {
    return NextResponse.json({ skipped: true, reason: "dead_letter_inspection_cron_disabled" });
  }

  const start = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runDeadLetterInspection({ dryRun: body?.dryRun === true });
    const durationMs = Date.now() - start;

    await logAutonomousCronRun({
      pipeline: "autonomous.dead_letter_inspection",
      status: "ok",
      processed: result.inspected,
      failed: 0,
      durationMs,
    });

    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (error: any) {
    const durationMs = Date.now() - start;
    await logAutonomousCronRun({
      pipeline: "autonomous.dead_letter_inspection",
      status: "error",
      processed: 0,
      failed: 1,
      durationMs,
      error: error?.message ?? "Unknown error",
    }).catch(() => {});
    return NextResponse.json(
      { error: error?.message ?? "Cron dead-letter-inspection failed" },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
