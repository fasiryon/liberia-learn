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

    // No `distinct: ["studentId"]` here — a child enrolled in several classes
    // has several teachers, and the guardian must be able to reach each one.
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, Class: { select: { teacherId: true } } },
    });

    const teacherIds = [...new Set(enrollments.map((e) => e.Class.teacherId))];
    const teachers = await prisma.user.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, name: true },
    });
    const teacherMap = new Map(teachers.map((t) => [t.id, t.name ?? "Teacher"]));
    const studentNameMap = new Map(
      links.map((l) => [l.studentId, l.student.user.name ?? "Student"])
    );

    // One recipient per (student, teacher) pair, de-duplicated.
    const seen = new Set<string>();
    const result: Array<{
      studentId: string;
      studentName: string;
      teacherId: string;
      teacherName: string;
    }> = [];
    for (const enrollment of enrollments) {
      const teacherId = enrollment.Class.teacherId;
      const key = `${enrollment.studentId}:${teacherId}`;
      if (seen.has(key)) continue;
      if (!studentNameMap.has(enrollment.studentId)) continue;
      seen.add(key);
      result.push({
        studentId: enrollment.studentId,
        studentName: studentNameMap.get(enrollment.studentId)!,
        teacherId,
        teacherName: teacherMap.get(teacherId) ?? "Teacher",
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
