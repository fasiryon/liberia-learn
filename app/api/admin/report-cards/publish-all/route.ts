import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const body = await req.json();
    const { classId, termId } = body as { classId?: string; termId?: string };
    if (!classId || !termId) {
      return NextResponse.json({ error: "classId and termId are required" }, { status: 400 });
    }

    const result = await prisma.reportCard.updateMany({
      where: {
        classId,
        termId,
        schoolId: user.schoolId,
        status: "DRAFT",
      },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    void logAudit({
      userId: user.id,
      action: "report_card.publish_all",
      resourceType: "ReportCard",
      schoolId: user.schoolId,
      details: { classId, termId, count: result.count },
    });

    return NextResponse.json({ published: result.count });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
