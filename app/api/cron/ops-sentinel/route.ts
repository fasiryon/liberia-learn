/**
 * POST /api/cron/ops-sentinel  (Vercel cron)
 *
 * Runs the deterministic Ops Sentinel sweep (docs/agents/OPS_SENTINEL.md):
 * cron misses, migration drift, error spikes, cost cap breaches. Tier 1
 * (cron-miss retry, cache clear) auto-executes; everything else proposes a
 * fix via the existing EscalationQueue, never auto-applies. CRON_SECRET +
 * AGENT_OPS_SENTINEL_ENABLED gated, same conventions as every other agent
 * platform cron (app/api/cron/agents/tick).
 */
import { NextResponse } from "next/server";
import "@/lib/agents/bootstrap";
import { resolveAgentEnabled } from "@/lib/agents/control";
import { runOpsSentinelSweep } from "@/lib/agents/opsSentinel/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await resolveAgentEnabled("ops-sentinel", "AGENT_OPS_SENTINEL_ENABLED");
  if (!enabled) {
    return NextResponse.json({ skipped: true, reason: "feature_disabled" });
  }

  const result = await runOpsSentinelSweep();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
