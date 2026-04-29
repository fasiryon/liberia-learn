import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getAudioQueueStatus } from "@/lib/audio/audioGenerationQueue";
import { getCronRunSummary, isAutoModeEnabled } from "@/lib/automation/cronRunLog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const gradeParam = searchParams.get("grade");
    const subjectParam = searchParams.get("subject");

    const [status, cron] = await Promise.all([
      getAudioQueueStatus({
      grade: gradeParam ? Number(gradeParam) : undefined,
      subject: subjectParam ?? undefined,
      }),
      getCronRunSummary("audio"),
    ]);

    return NextResponse.json({ ...status, autoModeEnabled: isAutoModeEnabled(), cron });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Status fetch failed" },
      { status: error?.status ?? 500 }
    );
  }
}
