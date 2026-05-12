import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN", "TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const termId = searchParams.get("termId");

    // Return class list and term list for selectors
    const classWhere =
      user.role === "ADMIN"
        ? { schoolId: user.schoolId }
        : { schoolId: user.schoolId, teacherId: user.id };

    const [classes, academicYears] = await Promise.all([
      prisma.class.findMany({
        where: classWhere,
        select: { id: true, name: true, subject: true, gradeLevel: true },
        orderBy: { name: "asc" },
      }),
      prisma.academicYear.findMany({
        where: { schoolId: user.schoolId },
        include: { terms: { orderBy: { startDate: "asc" } } },
        orderBy: { startDate: "desc" },
      }),
    ]);

    if (!classId || !termId) {
      return NextResponse.json({ classes, academicYears });
    }

    // Verify class access
    const cls = classes.find((c) => c.id === classId);
    if (!cls) {
      return NextResponse.json({ error: "Class not found or access denied" }, { status: 403 });
    }

    // Get enrolled students with their report cards
    const enrollments = await prisma.enrollment.findMany({
      where: { classId },
      include: {
        Student: {
          include: {
            user: { select: { name: true } },
            reportCards: {
              where: { termId },
              select: {
                id: true,
                status: true,
                generatedAt: true,
                publishedAt: true,
                teacherComment: true,
              },
            },
          },
        },
      },
      orderBy: { Student: { user: { name: "asc" } } },
    });

    const students = enrollments.map(({ Student }) => ({
      id: Student.id,
      name: Student.user.name ?? "Unknown",
      reportCard: Student.reportCards[0] ?? null,
    }));

    return NextResponse.json({ classes, academicYears, students, selectedClass: cls });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
