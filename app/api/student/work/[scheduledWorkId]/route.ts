import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scheduledWorkId: string }> }
) {
  try {
    const user = await requireRole("STUDENT");
    const { scheduledWorkId } = await params;

    const sw = await prisma.scheduledWork.findUnique({
      where: { id: scheduledWorkId },
      include: {
        content: true,
        class: { select: { id: true, schoolId: true } },
        progress: {
          where: { studentId: user.id },
          select: { completedAt: true, startedAt: true },
        },
      },
    });

    if (!sw) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Tenant isolation
    if (sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify enrollment
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

    const progress = sw.progress[0];

    // Mark as started if not already
    if (!progress) {
      await prisma.studentProgress.create({
        data: { studentId: user.id, scheduledWorkId: sw.id, startedAt: new Date() },
      });
    }

    const payload = sw.content.payload as any;

    return NextResponse.json({
      id: sw.id,
      title: payload?.title || payload?.topic || `${sw.content.subject} Lesson`,
      subject: sw.content.subject,
      grade: sw.content.grade,
      contentType: sw.content.contentType,
      body: payload?.body || payload?.lessons || payload,
      objectives: payload?.objectives || payload?.learningObjectives || [],
      activities: payload?.activities || [],
      labs: payload?.labs || [],
      durationMins: payload?.durationMins || 45,
      status: progress?.completedAt ? "completed" : progress?.startedAt ? "in_progress" : "not_started",
      completedAt: progress?.completedAt || null,
      startedAt: progress?.startedAt || null,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
