import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { enqueueLessonAudio } from "@/lib/audio/audioGenerationQueue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const { grade, subject, contentIds, limit, voice, provider } = body ?? {};

    if (!Number.isFinite(Number(grade)) || !subject?.trim()) {
      return NextResponse.json({ error: "grade (number) and subject (string) are required." }, { status: 400 });
    }

    const result = await enqueueLessonAudio({
      grade: Number(grade),
      subject: String(subject),
      contentIds: Array.isArray(contentIds) ? contentIds : undefined,
      limit: limit ? Number(limit) : undefined,
      voice: voice ? String(voice) : undefined,
      provider: provider === "openai" ? "openai" : undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Enqueue failed" },
      { status: error?.status ?? 500 }
    );
  }
}
