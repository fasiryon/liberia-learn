/**
 * POST /api/cron/content-qa-sweep  (Vercel cron)
 *
 * Runs the Content QA sweep (Sprint 6.2, lib/agents/contentqa/sweep.ts):
 * reviews newly-submitted lesson content, teacher video uploads, and
 * freshly-graded essay/code submissions. Every output is advisory
 * (ContentQaReview rows + existing review-queue notifications) — nothing
 * here publishes, approves, or overwrites an existing grade.
 * CRON_SECRET + AGENT_CONTENT_QA_ENABLED gated, same conventions as every
 * other agent platform cron.
 */
import { NextResponse } from "next/server";
import "@/lib/agents/bootstrap";
import { resolveAgentEnabled } from "@/lib/agents/control";
import { runContentQaSweep } from "@/lib/agents/contentqa/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await resolveAgentEnabled("content-qa", "AGENT_CONTENT_QA_ENABLED");
  if (!enabled) {
    return NextResponse.json({ skipped: true, reason: "feature_disabled" });
  }

  const result = await runContentQaSweep();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
