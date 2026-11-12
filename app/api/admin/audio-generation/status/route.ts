// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=global content and cost operations require a canonical platform ADMIN before domain work
import { NextResponse } from "next/server";
import { requirePlatformContentAdmin } from "@/lib/auth/platformContentAuthority";
import { getAudioQueueStatus } from "@/lib/audio/audioGenerationQueue";
import { getCronRunSummary, isAutoModeEnabled } from "@/lib/automation/cronRunLog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requirePlatformContentAdmin();
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
