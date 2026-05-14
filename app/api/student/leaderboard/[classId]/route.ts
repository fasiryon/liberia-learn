import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildWeeklyLeaderboard } from "@/lib/gamification/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { classId: string } }
) {
  try {
    const user = await requireRole("STUDENT");

    // Verify student is enrolled in this class
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: student.id, classId: params.classId } },
      select: { classId: true, Class: { select: { schoolId: true } } },
    });
    if (!enrollment) return NextResponse.json({ error: "Not enrolled in this class" }, { status: 403 });

    if (enrollment.Class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if leaderboard exists for current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    let leaderboard = await prisma.weeklyLeaderboard.findUnique({
      where: { classId_weekStart: { classId: params.classId, weekStart } },
    });

    if (!leaderboard) {
      const built = await buildWeeklyLeaderboard(params.classId, enrollment.Class.schoolId);
      return NextResponse.json({
        ...built,
        currentStudentId: user.id,
      });
    }

    return NextResponse.json({
      classId: leaderboard.classId,
      schoolId: leaderboard.schoolId,
      weekStart: leaderboard.weekStart.toISOString(),
      entries: leaderboard.entries,
      currentStudentId: user.id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
