import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getTextbookQueueStatus } from "@/lib/textbooks/textbookGenerationQueue";
import { getCronRunSummary, isAutoModeEnabled } from "@/lib/automation/cronRunLog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");
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
