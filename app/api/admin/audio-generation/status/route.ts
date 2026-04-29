import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getAudioQueueStatus } from "@/lib/audio/audioGenerationQueue";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const gradeParam = searchParams.get("grade");
    const subjectParam = searchParams.get("subject");

    const status = await getAudioQueueStatus({
      grade: gradeParam ? Number(gradeParam) : undefined,
      subject: subjectParam ?? undefined,
    });

    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Status fetch failed" },
      { status: error?.status ?? 500 }
    );
  }
}
