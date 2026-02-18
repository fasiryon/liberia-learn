import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const weekOf = searchParams.get("weekOf");

    const classes = await prisma.class.findMany({
      where: { schoolId: user.schoolId!, teacherId: user.id },
      select: { id: true, name: true },
    });
    const classIds = classes.map((c) => c.id);

    // Calculate week range
    const baseDate = weekOf ? new Date(weekOf) : new Date();
    const day = baseDate.getUTCDay();
    const monday = new Date(baseDate);
    monday.setUTCDate(baseDate.getUTCDate() - ((day + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 5);

    const schedule = await prisma.scheduledWork.findMany({
      where: {
        classId: { in: classIds },
        scheduledDate: { gte: monday, lt: friday },
      },
      include: {
        content: { select: { contentId: true, subject: true, payload: true } },
        progress: { where: { completedAt: { not: null } }, select: { id: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Get total enrollments per class for completion %
    const enrollmentCounts = await prisma.enrollment.groupBy({
      by: ["classId"],
      where: { classId: { in: classIds } },
      _count: true,
    });
    const enrollMap = Object.fromEntries(enrollmentCounts.map((e) => [e.classId, e._count]));

    const items = schedule.map((sw) => ({
      id: sw.id,
      classId: sw.classId,
      className: classes.find((c) => c.id === sw.classId)?.name || "",
      contentId: sw.content.contentId,
      title: (sw.content.payload as any)?.title || sw.content.subject,
      subject: sw.content.subject,
      scheduledDate: sw.scheduledDate,
      completedCount: sw.progress.length,
      totalStudents: enrollMap[sw.classId] || 0,
    }));

    return NextResponse.json({ items, classes, weekStart: monday.toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { contentId, classId, scheduledDate } = await req.json();

    if (!contentId || !classId || !scheduledDate) {
      return NextResponse.json({ error: "contentId, classId, scheduledDate required" }, { status: 400 });
    }

    // Verify class belongs to teacher's school
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sw = await prisma.scheduledWork.create({
      data: { contentId, classId, scheduledDate: new Date(scheduledDate), createdById: user.id },
    });

    await logAudit({
      userId: user.id,
      action: "schedule.created",
      resourceType: "scheduledWork",
      resourceId: sw.id,
    });

    return NextResponse.json({ id: sw.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const sw = await prisma.scheduledWork.findUnique({
      where: { id },
      include: { class: { select: { schoolId: true } } },
    });

    if (!sw || sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.scheduledWork.delete({ where: { id } });

    await logAudit({
      userId: user.id,
      action: "schedule.deleted",
      resourceType: "scheduledWork",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
