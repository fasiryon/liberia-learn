import { NextRequest, NextResponse } from "next/server";
import { releaseStaleAIGrades } from "@/lib/ai/staleGradeReleaser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
