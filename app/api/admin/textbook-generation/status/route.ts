// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=global content and cost operations require a canonical platform ADMIN before domain work
import { NextResponse } from "next/server";
import { requirePlatformContentAdmin } from "@/lib/auth/platformContentAuthority";
import { getTextbookQueueStatus } from "@/lib/textbooks/textbookGenerationQueue";
import { getCronRunSummary, isAutoModeEnabled } from "@/lib/automation/cronRunLog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requirePlatformContentAdmin();
    const { searchParams } = new URL(req.url);
    const grade = searchParams.get("grade");
    const subject = searchParams.get("subject");
    const format = searchParams.get("format");

    const [status, cron] = await Promise.all([
      getTextbookQueueStatus({
      grade: grade ? Number(grade) : undefined,
      subject: subject ?? undefined,
      format: format ?? undefined,
      }),
      getCronRunSummary("textbook"),
    ]);

    return NextResponse.json({ ...status, autoModeEnabled: isAutoModeEnabled(), cron });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Status fetch failed" }, { status: error?.status ?? 500 });
  }
}
