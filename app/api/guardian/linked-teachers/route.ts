import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("GUARDIAN");

    const links = await prisma.studentGuardian.findMany({
      where: { guardianId: user.id },
      select: {
        studentId: true,
        student: { select: { user: { select: { name: true } } } },
      },
    });

    const studentIds = links.map((l) => l.studentId);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, Class: { select: { teacherId: true } } },
      distinct: ["studentId"],
    });

    const teacherIds = [...new Set(enrollments.map((e) => e.Class.teacherId))];
    const teachers = await prisma.user.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, name: true },
    });
    const teacherMap = new Map(teachers.map((t) => [t.id, t.name ?? "Teacher"]));
    const enrollmentMap = new Map(enrollments.map((e) => [e.studentId, e.Class.teacherId]));

    const result = links
      .filter((l) => enrollmentMap.has(l.studentId))
      .map((l) => {
        const teacherId = enrollmentMap.get(l.studentId)!;
        return {
          studentId: l.studentId,
          studentName: l.student.user.name ?? "Student",
          teacherId,
          teacherName: teacherMap.get(teacherId) ?? "Teacher",
        };
      });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
