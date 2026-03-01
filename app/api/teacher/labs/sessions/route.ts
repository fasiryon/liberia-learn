import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/labs/sessions?classId=
 * Part 7: Aggregate lab session data for all students in a class.
 * No student identifiers above teacher scope — aggregates only per lab.
 */
export async function GET(req: NextRequest) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json({ error: "classId required" }, { status: 400 });
    }

    // Verify class belongs to teacher's school
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all student userIds enrolled in the class
    const enrollments = await prisma.enrollment.findMany({
      where: { classId },
      include: { Student: { select: { userId: true } } },
    });
    const studentIds = enrollments.map((e) => e.Student.userId);

    if (studentIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Get lab sessions for these students in this school
    const labSessions = await prisma.labSession.findMany({
      where: {
        studentId: { in: studentIds },
        schoolId: user.schoolId!,
      },
      select: {
        id: true,
        labId: true,
        startedAt: true,
        completedAt: true,
        score: true,
      },
    });

    // Aggregate by labId
    const labMap = new Map<
      string,
      { labId: string; totalStudents: number; completedCount: number; totalScore: number; sessions: any[] }
    >();

    for (const s of labSessions) {
      const existing = labMap.get(s.labId);
      const sessionEntry = {
        sessionId: s.id,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        score: s.score,
      };
      if (existing) {
        existing.totalStudents += 1;
        if (s.completedAt) existing.completedCount += 1;
        if (s.score != null) existing.totalScore += s.score;
        existing.sessions.push(sessionEntry);
      } else {
        labMap.set(s.labId, {
          labId: s.labId,
          totalStudents: 1,
          completedCount: s.completedAt ? 1 : 0,
          totalScore: s.score ?? 0,
          sessions: [sessionEntry],
        });
      }
    }

    // Fetch lab titles
    const labIds = Array.from(labMap.keys());
    const labs = await prisma.virtualLab.findMany({
      where: { labId: { in: labIds } },
      select: { labId: true, title: true },
    });
    const titleMap = Object.fromEntries(labs.map((l) => [l.labId, l.title]));

    const result = Array.from(labMap.values()).map((entry) => ({
      labId: entry.labId,
      title: titleMap[entry.labId] ?? entry.labId,
      totalStudents: entry.totalStudents,
      completedCount: entry.completedCount,
      avgScore:
        entry.completedCount > 0
          ? Math.round(entry.totalScore / entry.completedCount)
          : null,
      sessions: entry.sessions,
    }));

    return NextResponse.json({ sessions: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to get sessions" },
      { status: err?.status ?? 500 }
    );
  }
}
