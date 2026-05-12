import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const classWhere =
      user.role === "ADMIN"
        ? { schoolId: user.schoolId }
        : { schoolId: user.schoolId, teacherId: user.id };

    const classes = await prisma.class.findMany({
      where: classWhere,
      select: { id: true, name: true, subject: true },
      orderBy: { name: "asc" },
    });

    if (!classId) {
      return NextResponse.json({ classes });
    }

    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) {
      return NextResponse.json({ error: "Class not found or access denied" }, { status: 403 });
    }

    const [enrollments, assignments] = await Promise.all([
      prisma.enrollment.findMany({
        where: { classId },
        include: {
          Student: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { Student: { user: { name: "asc" } } },
      }),
      prisma.assignment.findMany({
        where: { classId },
        select: { id: true, title: true, points: true, dueAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const studentIds = enrollments.map((e) => e.Student.id);
    const assignmentIds = assignments.map((a) => a.id);

    const submissions =
      assignmentIds.length > 0 && studentIds.length > 0
        ? await prisma.assignmentSubmission.findMany({
            where: {
              assignmentId: { in: assignmentIds },
              studentId: { in: studentIds },
            },
            select: {
              id: true,
              studentId: true,
              assignmentId: true,
              score: true,
              gradedAt: true,
              feedback: true,
            },
          })
        : [];

    return NextResponse.json({
      classes,
      selectedClass: { id: targetClass.id, name: targetClass.name, subject: targetClass.subject },
      students: enrollments.map((e) => ({
        id: e.Student.id,
        name: e.Student.user.name ?? "Unknown",
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        points: a.points,
        dueAt: a.dueAt?.toISOString() ?? null,
      })),
      submissions: submissions.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        assignmentId: s.assignmentId,
        grade: s.score,
        gradedAt: s.gradedAt?.toISOString() ?? null,
        feedback: s.feedback,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load gradebook";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
