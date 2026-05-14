import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET() {
  const requestId = randomUUID();
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ weeks: [] });
    }

    // Go back 8 weeks from the current Monday
    const currentMonday = getMondayOfWeek(new Date());
    const eightWeeksAgo = new Date(currentMonday);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 7 * 7); // 7 prior weeks + current = 8

    // Fetch learning events for lesson completions
    const lessonEvents = await prisma.learningEvent.findMany({
      where: {
        userId: user.id,
        eventType: "LESSON_COMPLETE",
        occurredAt: { gte: eightWeeksAgo },
      },
      select: { occurredAt: true },
      orderBy: { occurredAt: "asc" },
    });

    // Fetch assessment attempts for quiz scores
    const quizAttempts = await prisma.assessmentAttempt.findMany({
      where: {
        userId: user.id,
        status: "completed",
        score: { not: null },
        attemptedAt: { gte: eightWeeksAgo },
      },
      select: { attemptedAt: true, score: true, maxScore: true },
      orderBy: { attemptedAt: "asc" },
    });

    // Build 8-week array
    const weeks: Array<{
      weekLabel: string;
      weekStart: string;
      lessonsCompleted: number;
      quizAvg: number | null;
      streakDays: number;
    }> = [];

    for (let i = 7; i >= 0; i--) {
      const monday = new Date(currentMonday);
      monday.setDate(monday.getDate() - i * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 7);

      const weekLessons = lessonEvents.filter(
        (e) => e.occurredAt >= monday && e.occurredAt < sunday
      ).length;

      const weekAttempts = quizAttempts.filter(
        (a) => a.attemptedAt >= monday && a.attemptedAt < sunday
      );

      let quizAvg: number | null = null;
      if (weekAttempts.length > 0) {
        const scores = weekAttempts.map((a) => {
          if (a.maxScore && a.maxScore > 0 && a.score !== null) {
            return (a.score / a.maxScore) * 100;
          }
          return a.score !== null ? a.score * 100 : 0;
        });
        quizAvg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
      }

      // Count unique active days this week using lesson events
      const activeDays = new Set(
        lessonEvents
          .filter((e) => e.occurredAt >= monday && e.occurredAt < sunday)
          .map((e) => e.occurredAt.toISOString().slice(0, 10))
      ).size;

      weeks.push({
        weekLabel: formatWeekLabel(monday),
        weekStart: monday.toISOString().slice(0, 10),
        lessonsCompleted: weekLessons,
        quizAvg,
        streakDays: activeDays,
      });
    }

    return NextResponse.json({ weeks });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/student/progress/weekly", method: "GET" });
  }
}
