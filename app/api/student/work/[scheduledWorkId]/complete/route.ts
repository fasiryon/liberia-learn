import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { enqueue } from "@/lib/offline/offlineQueue";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ scheduledWorkId: string }> }
) {
  try {
    const user = await requireRole("STUDENT");
    const { scheduledWorkId } = await params;

    const sw = await prisma.scheduledWork.findUnique({
      where: { id: scheduledWorkId },
      include: { class: { select: { schoolId: true } } },
    });

    if (!sw) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: student.id, classId: sw.classId } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const progress = await prisma.studentProgress.upsert({
      where: { studentId_scheduledWorkId: { studentId: user.id, scheduledWorkId } },
      create: { studentId: user.id, scheduledWorkId, startedAt: now, completedAt: now },
      update: { completedAt: now },
    });

    await logAudit({
      userId: user.id,
      action: "lesson.completed",
      resourceType: "scheduledWork",
      resourceId: scheduledWorkId,
    });

    // Fire-and-forget: record in offline queue for idempotent sync tracking.
    // Never let queue errors surface to the student.
    try {
      enqueue("lesson.completed", scheduledWorkId, {
        userId: user.id,
        completedAt: (progress.completedAt ?? new Date()).toISOString(),
      });
    } catch { /* noop */ }

    return NextResponse.json({ success: true, completedAt: progress.completedAt });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
