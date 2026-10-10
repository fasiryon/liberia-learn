// route-policy: auth=session; scope=tenant; authority=authenticated-student-own-school-enrollments; rationale=lists messaging teachers only for own-school classes, and only teachers who belong to the learner's school
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studentRecord = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!studentRecord || !user.schoolId) return NextResponse.json([]);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: studentRecord.id, Class: { schoolId: user.schoolId } },
      include: {
        Class: {
          select: {
            subject: true,
            schoolId: true,
            Teacher: { select: { id: true, name: true, schoolId: true } },
          },
        },
      },
    });

    const seen = new Set<string>();
    const teachers = enrollments
      // A teacher identity is projected only for a teacher of the learner's own school.
      .filter((e) => e.Class.schoolId === user.schoolId && e.Class.Teacher != null && e.Class.Teacher.schoolId === user.schoolId)
      .reduce<Array<{ teacherId: string; teacherName: string; subject: string | null }>>((acc, e) => {
        const t = e.Class.Teacher!;
        if (!seen.has(t.id)) {
          seen.add(t.id);
          acc.push({ teacherId: t.id, teacherName: t.name ?? "Teacher", subject: String(e.Class.subject) });
        }
        return acc;
      }, []);

    return NextResponse.json(teachers);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
