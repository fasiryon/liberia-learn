import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireRole("GUARDIAN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  // Verify guardian is linked to student
  const link = await prisma.studentGuardian.findFirst({
    where: { guardianId: user.id, studentId },
  });
  if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get graded assignment submissions
  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      studentId,
      score: { not: null },
    },
    include: {
      Assignment: {
        select: {
          title: true,
          dueAt: true,
          points: true,
          classId: true,
          Class: { select: { subject: true, name: true } },
        },
      },
    },
    orderBy: { gradedAt: "desc" },
  });

  // Group by subject
  type SubjectEntry = {
    subject: string;
    grades: Array<{ title: string; dueAt: string | null; score: number; maxScore: number; feedback: string | null; gradedAt: string | null }>;
  };

  const subjectMap = new Map<string, SubjectEntry>();
  for (const sub of submissions) {
    const subject = sub.Assignment.Class.subject;
    if (!subjectMap.has(subject)) {
      subjectMap.set(subject, { subject, grades: [] });
    }
    subjectMap.get(subject)!.grades.push({
      title: sub.Assignment.title,
      dueAt: sub.Assignment.dueAt?.toISOString() ?? null,
      score: sub.score!,
      maxScore: sub.Assignment.points,
      feedback: sub.feedback ?? null,
      gradedAt: sub.gradedAt?.toISOString() ?? null,
    });
  }

  const grouped = Array.from(subjectMap.values()).map((entry) => {
    const grades = entry.grades;
    const avg = grades.length > 0
      ? Math.round(grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 100, 0) / grades.length)
      : null;

    // Trend: compare last 3 vs previous 3
    let trend: "improving" | "stable" | "declining" = "stable";
    if (grades.length >= 6) {
      const recent = grades.slice(0, 3).map((g) => (g.score / g.maxScore) * 100);
      const prev = grades.slice(3, 6).map((g) => (g.score / g.maxScore) * 100);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
      if (recentAvg - prevAvg > 5) trend = "improving";
      else if (prevAvg - recentAvg > 5) trend = "declining";
    }

    return { ...entry, average: avg, trend };
  });

  return NextResponse.json({ subjects: grouped });
}
