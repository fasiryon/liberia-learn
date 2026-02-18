import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeStatus } from "@/lib/progress-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    // Get teacher's classes
    const classes = await prisma.class.findMany({
      where: { schoolId: user.schoolId!, teacherId: user.id },
      select: { id: true, name: true },
    });

    const classIds = classes.map((c) => c.id);
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

    // Get enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: classIds } },
      include: {
        Student: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    // Get progress for all students
    const studentIds = enrollments.map((e) => e.Student.user.id);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);

    const progressRecords = await prisma.studentProgress.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, completedAt: true },
    });

    // Group progress by student
    const progressByStudent: Record<string, { completed: number; lastActive: Date | null }> = {};
    for (const p of progressRecords) {
      if (!progressByStudent[p.studentId]) {
        progressByStudent[p.studentId] = { completed: 0, lastActive: null };
      }
      if (p.completedAt) {
        if (new Date(p.completedAt) >= weekStart) {
          progressByStudent[p.studentId].completed++;
        }
        const d = new Date(p.completedAt);
        if (!progressByStudent[p.studentId].lastActive || d > progressByStudent[p.studentId].lastActive!) {
          progressByStudent[p.studentId].lastActive = d;
        }
      }
    }

    const students = enrollments.map((e) => {
      const userId = e.Student.user.id;
      const prog = progressByStudent[userId] || { completed: 0, lastActive: null };
      return {
        studentId: e.Student.id,
        userId,
        name: e.Student.user.name || e.Student.user.email || "Unknown",
        className: classMap[e.classId] || "Unknown",
        classId: e.classId,
        lessonsCompletedThisWeek: prog.completed,
        lastActive: prog.lastActive,
        status: computeStatus(prog.lastActive),
      };
    });

    return NextResponse.json({ students });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
