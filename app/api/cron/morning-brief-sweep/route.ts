/**
 * POST /api/cron/morning-brief-sweep  (Vercel cron)
 *
 * Runs the Morning Brief sweep (Sprint 7.4, lib/agents/morningBrief/sweep.ts):
 * generates today's in-app digest for every teacher with at least one class
 * who does not already have one. CRON_SECRET + AGENT_MORNING_BRIEF_ENABLED
 * gated, same conventions as every other agent platform cron.
 */
import { NextResponse } from "next/server";
import "@/lib/agents/bootstrap";
import { resolveAgentEnabled } from "@/lib/agents/control";
import { runMorningBriefSweep } from "@/lib/agents/morningBrief/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await resolveAgentEnabled("morning-brief", "AGENT_MORNING_BRIEF_ENABLED");
  if (!enabled) {
    return NextResponse.json({ skipped: true, reason: "feature_disabled" });
  }

  const result = await runMorningBriefSweep();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
