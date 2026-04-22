import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { processPendingLessonAudio } from "@/lib/lessons/audioGeneration";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(5, Math.max(1, Number(body?.limit ?? 1)));
    const results = await processPendingLessonAudio(limit);
    return NextResponse.json({ processed: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Audio processing failed" }, { status: error?.status ?? 500 });
  }
}
