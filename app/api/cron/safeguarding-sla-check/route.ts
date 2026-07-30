/**
 * POST /api/cron/safeguarding-sla-check  (Vercel cron)
 *
 * NR-9.5: escalates safeguarding EscalationQueue items that have sat open
 * past a defined SLA window (4h re-notify, 24h platform-fallback escalation
 * - see lib/agents/safeguarding/slaCheck.ts). Not gated behind an agent
 * feature flag: this is a safety-net sweep over already-existing
 * EscalationQueue data, not a new agent capability, and must run regardless
 * of which source agent (guardian SMS, content-QA video review) created the
 * underlying escalation. CRON_SECRET gated, same convention as every other
 * cron in this repo.
 */
import { NextResponse } from "next/server";
import { runSafeguardingSlaCheck } from "@/lib/agents/safeguarding/slaCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSafeguardingSlaCheck();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
