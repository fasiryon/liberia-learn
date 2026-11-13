import { NextRequest, NextResponse } from "next/server";
import { releaseStaleAIGrades } from "@/lib/ai/staleGradeReleaser";
import {previewAutomationDisabled} from "@/lib/previewSideEffects";

// route-policy: auth=cron; scope=none; authority=legacy-optional-secret; rationale=Preview refuses all work; outside Preview the existing optional CRON_SECRET comparison remains unchanged.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if(previewAutomationDisabled())return NextResponse.json({error:"Preview automation is disabled"},{status:401});
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && secret !== expected && secret !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { released } = await releaseStaleAIGrades();
    return NextResponse.json({ ok: true, released });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to release stale grades";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
