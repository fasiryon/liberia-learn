import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { studentId } = await params;

    // Verify student is in one of teacher's classes
    const teacherClasses = await prisma.class.findMany({
      where: { schoolId: user.schoolId!, teacherId: user.id },
      select: { id: true },
    });
    const classIds = teacherClasses.map((c) => c.id);

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classId: { in: classIds } },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const progress = await prisma.studentProgress.findMany({
      where: { studentId: student.user.id },
      include: {
        scheduledWork: {
          include: {
            content: { select: { subject: true, contentType: true, payload: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const records = progress.map((p) => {
      const payload = p.scheduledWork.content.payload as any;
      return {
        id: p.id,
        title: payload?.title || payload?.topic || `${p.scheduledWork.content.subject} Lesson`,
        subject: p.scheduledWork.content.subject,
        completedAt: p.completedAt,
        startedAt: p.startedAt,
        scheduledDate: p.scheduledWork.scheduledDate,
      };
    });

    return NextResponse.json({
      student: { id: student.id, name: student.user.name, email: student.user.email },
      records,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
