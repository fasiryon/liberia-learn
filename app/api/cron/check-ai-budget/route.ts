import { NextResponse } from "next/server";
import { getAISpend } from "@/lib/ops/aiSpend";
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

  const spend = await getAISpend();
  const alerts: string[] = [];

  if (spend.dailyPct >= 90) {
    alerts.push(
      `Daily AI budget at ${spend.dailyPct}% ($${spend.todayUsd.toFixed(4)} of $${spend.dailyCap})`
    );
    const topFeature = spend.byFeature[0];
    const body = [
      `Daily AI budget is at ${spend.dailyPct}% of cap.`,
      `Used: $${spend.todayUsd.toFixed(4)} / Daily cap: $${spend.dailyCap}`,
      topFeature
        ? `Largest consumer today: ${topFeature.feature} ($${topFeature.costUsd.toFixed(4)})`
        : "",
      ``,
      `To investigate: /admin/ops/health (Panel 3)`,
      `To throttle: disable the relevant cron or reduce per-feature caps in Vercel env vars.`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendOpsAlert({
      subject: `AI budget at ${spend.dailyPct}% — consider throttling`,
      body,
      channel: "email",
    });
  }

  if (spend.monthlyPct >= 80) {
    alerts.push(
      `Monthly AI budget at ${spend.monthlyPct}% ($${spend.mtdUsd.toFixed(2)} of $${spend.monthlyCap})`
    );
    await sendOpsAlert({
      subject: `Monthly AI budget at ${spend.monthlyPct}% — review usage`,
      body: [
        `Monthly AI budget is at ${spend.monthlyPct}% of cap.`,
        `Used: $${spend.mtdUsd.toFixed(2)} / Monthly cap: $${spend.monthlyCap}`,
        ``,
        `To investigate: /admin/ops/health (Panel 3)`,
      ].join("\n"),
      channel: "email",
    });
  }

  await recordCronHeartbeat("check-ai-budget").catch(() => {}); // best-effort, never fail the cron on a heartbeat write

  return NextResponse.json({
    checked: true,
    dailyPct: spend.dailyPct,
    monthlyPct: spend.monthlyPct,
    alerts,
  });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
