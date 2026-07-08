/**
 * GET /api/cron/agents/tick  (Vercel cron)
 *
 * Scheduler heartbeat for the agent platform: advances every runnable AgentGoal
 * by one step (wakes due scheduled goals, continues in-progress ones).
 * CRON_SECRET-gated and behind AGENT_CRON_ENABLED (default OFF — no user-facing
 * agent ships yet). Registered in vercel.json.
 */
import { NextResponse } from "next/server";
import { isAgentCronEnabled } from "@/lib/serverFlags";
import "@/lib/agents/bootstrap"; // registers goal handlers
import { tickGoals } from "@/lib/agents/goals/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAgentCronEnabled()) {
    return NextResponse.json({ skipped: true, reason: "agent_cron_disabled" });
  }

  const start = Date.now();
  const result = await tickGoals();
  return NextResponse.json({ ok: true, durationMs: Date.now() - start, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
