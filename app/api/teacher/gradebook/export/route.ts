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
    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    const classWhere =
      user.role === "ADMIN"
        ? { id: classId, schoolId: user.schoolId }
        : { id: classId, schoolId: user.schoolId, teacherId: user.id };

    const targetClass = await prisma.class.findFirst({
      where: classWhere,
      select: { id: true, name: true },
    });
    if (!targetClass) {
      return NextResponse.json({ error: "Class not found or access denied" }, { status: 403 });
    }

    const [enrollments, assignments] = await Promise.all([
      prisma.enrollment.findMany({
        where: { classId },
        include: { Student: { select: { id: true, user: { select: { name: true } } } } },
        orderBy: { Student: { user: { name: "asc" } } },
      }),
      prisma.assignment.findMany({
        where: { classId },
        select: { id: true, title: true, points: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const studentIds = enrollments.map((e) => e.Student.id);
    const assignmentIds = assignments.map((a) => a.id);

    const submissions =
      assignmentIds.length > 0 && studentIds.length > 0
        ? await prisma.assignmentSubmission.findMany({
            where: { assignmentId: { in: assignmentIds }, studentId: { in: studentIds } },
            select: { studentId: true, assignmentId: true, score: true, gradedAt: true },
          })
        : [];

    const submissionMap = new Map(
      submissions.map((s) => [`${s.studentId}:${s.assignmentId}`, s])
    );

    const headerRow = [
      "Student",
      ...assignments.map((a) => `"${a.title.replace(/"/g, '""')}"`),
      "Average",
    ];

    const rows = enrollments.map((e) => {
      const scores = assignments.map((a) => {
        const s = submissionMap.get(`${e.Student.id}:${a.id}`);
        return s?.score ?? null;
      });
      const graded = scores.filter((s) => s !== null) as number[];
      const avg =
        graded.length > 0
          ? Math.round(graded.reduce((a, b) => a + b, 0) / graded.length)
          : null;
      const name = `"${(e.Student.user.name ?? "Unknown").replace(/"/g, '""')}"`;
      return [name, ...scores.map((s) => (s !== null ? String(s) : "")), avg !== null ? String(avg) : ""].join(",");
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = targetClass.name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const csv = [headerRow.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gradebook-${safeName}-${dateStr}.csv"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
