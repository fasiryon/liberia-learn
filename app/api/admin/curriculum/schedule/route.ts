import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/curriculum/schedule
 * Body: { contentId, classId, scheduledDate }
 * Creates a ScheduledWork entry (Today's Work) for a class.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await req.json();
    const { contentId, classId, scheduledDate } = body;

    if (!contentId || !classId || !scheduledDate) {
      return NextResponse.json(
        { error: "contentId, classId, and scheduledDate are required" },
        { status: 400 }
      );
    }

    // Verify class belongs to user's school
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true },
    });
    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json(
        { error: "Class not found in your school" },
        { status: 404 }
      );
    }

    // Verify content exists and is published
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId },
      select: { status: true },
    });
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    if (content.status !== "published") {
      return NextResponse.json(
        { error: "Content must be published before scheduling" },
        { status: 400 }
      );
    }

    const record = await prisma.scheduledWork.create({
      data: {
        contentId,
        classId,
        scheduledDate: new Date(scheduledDate),
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "curriculum.schedule",
      resourceType: "curriculum",
      resourceId: contentId,
      details: { classId, scheduledDate },
    });

    return NextResponse.json({ ok: true, scheduledWorkId: record.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to schedule" },
      { status: err?.status ?? 500 }
    );
  }
}
