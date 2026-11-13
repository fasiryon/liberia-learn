// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=global content and cost operations require a canonical platform ADMIN before domain work
import { NextResponse } from "next/server";
import { requirePlatformContentAdmin } from "@/lib/auth/platformContentAuthority";
import { processPendingLessonAudio } from "@/lib/lessons/audioGeneration";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requirePlatformContentAdmin();
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(5, Math.max(1, Number(body?.limit ?? 1)));
    const results = await processPendingLessonAudio(limit);
    return NextResponse.json({ processed: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Audio processing failed" }, { status: error?.status ?? 500 });
  }
}
