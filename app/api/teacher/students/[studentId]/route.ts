import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { studentId } = await params;
    const previousSubmissionCount = Number(req.nextUrl.searchParams.get("previousSubmissionCount") ?? "NaN");
    const source = req.nextUrl.searchParams.get("source") ?? "page";

    // Verify student is in one of teacher's classes
    const teacherClasses = await prisma.class.findMany({
      where: { schoolId: user.schoolId!, teacherId: user.id },
      select: { id: true },
    });
    const classIds = teacherClasses.map((c) => c.id);

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classId: { in: classIds } },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const progress = await prisma.studentProgress.findMany({
      where: { studentId: student.user.id },
      include: {
        scheduledWork: {
          include: {
            content: { select: { id: true, contentId: true, subject: true, contentType: true, payload: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const records = progress.map((p) => {
      const payload = p.scheduledWork.content.payload as any;
      const contentId = p.scheduledWork.content.contentId;
      return {
        id: p.id,
        contentId,
        title: payload?.title || payload?.topic || `${p.scheduledWork.content.subject} Lesson`,
        subject: p.scheduledWork.content.subject,
        completedAt: p.completedAt,
        startedAt: p.startedAt,
        scheduledDate: p.scheduledWork.scheduledDate,
        quizScore: null as number | null,
      };
    });

    let recentAttempts: Array<{ subject: string | null; score: number | null; maxScore: number | null; attemptedAt: Date }> = [];
    try {
      recentAttempts = await prisma.assessmentAttempt.findMany({
        where: { studentId: student.id, schoolId: user.schoolId! },
        orderBy: { attemptedAt: "desc" },
        take: 20,
        select: {
          subject: true,
          score: true,
          maxScore: true,
          attemptedAt: true,
        },
      });
    } catch {
      // not critical — proceed with empty
    }

    const subjectAvgMap: Record<string, { total: number; count: number }> = {};
    for (const attempt of recentAttempts) {
      if (attempt.subject && attempt.score != null && attempt.maxScore && attempt.maxScore > 0) {
        if (!subjectAvgMap[attempt.subject]) subjectAvgMap[attempt.subject] = { total: 0, count: 0 };
        subjectAvgMap[attempt.subject].total += (attempt.score / attempt.maxScore) * 100;
        subjectAvgMap[attempt.subject].count++;
      }
    }

    const lastActive = progress.length > 0
      ? progress.reduce((latest, p) => {
          const ts = p.completedAt ?? p.startedAt;
          if (!ts) return latest;
          return !latest || ts > latest ? ts : latest;
        }, null as Date | null)
      : null;

    const recentScores = recentAttempts
      .filter((a) => a.score != null && a.maxScore && a.maxScore > 0)
      .slice(0, 8)
      .reverse()
      .map((a) => Math.round((a.score! / a.maxScore!) * 100));

    let scoreTrend: "improving" | "declining" | "stable" = "stable";
    if (recentScores.length >= 2) {
      const half = Math.floor(recentScores.length / 2);
      const firstHalfAvg = recentScores.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const secondHalfAvg = recentScores.slice(half).reduce((a, b) => a + b, 0) / (recentScores.length - half);
      if (secondHalfAvg - firstHalfAvg > 5) scoreTrend = "improving";
      else if (firstHalfAvg - secondHalfAvg > 5) scoreTrend = "declining";
    }

    const lessonsThisWeek = progress.filter((p) => {
      if (!p.completedAt) return false;
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      return p.completedAt > weekAgo;
    }).length;

    const lessonsThisMonth = progress.filter((p) => {
      if (!p.completedAt) return false;
      const monthAgo = new Date(Date.now() - 30 * 86400000);
      return p.completedAt > monthAgo;
    }).length;

    const daysSinceActive = lastActive
      ? Math.floor((Date.now() - lastActive.getTime()) / 86400000)
      : null;

    const submissions = await prisma.assignmentSubmission.findMany({
      where: {
        studentId: student.id,
        Assignment: {
          Class: {
            schoolId: user.schoolId!,
            id: { in: classIds },
          },
        },
      },
      include: {
        Assignment: {
          select: {
            id: true,
            title: true,
            points: true,
            dueAt: true,
            Class: { select: { name: true, subject: true } },
          },
        },
      },
      orderBy: { turnedInAt: "desc" },
    });

    const newSubmissionCount = Number.isFinite(previousSubmissionCount)
      ? Math.max(0, submissions.length - previousSubmissionCount)
      : 0;

    if (source === "poll" && Number.isFinite(previousSubmissionCount) && previousSubmissionCount !== submissions.length) {
      logLearningEvent({
        schoolId: user.schoolId,
        userId: user.id,
        studentId: student.id,
        actor: { type: "teacher", id: user.id, role: user.role },
        target: { type: "student", id: student.id },
        eventType: "submission_feed_polled",
        source: "/api/teacher/students/[studentId]",
        metadata: { submissionCount: submissions.length, newCount: newSubmissionCount },
      }).catch(() => null);
    }

    if (source === "page") {
      logLearningEvent({
        schoolId: user.schoolId,
        userId: user.id,
        studentId: student.id,
        actor: { type: "teacher", id: user.id, role: user.role },
        target: { type: "student", id: student.id },
        eventType: "submission_viewed_by_teacher",
        source: "/teacher/students/[studentId]",
        metadata: { submissionCount: submissions.length },
      }).catch(() => null);
    }

    return NextResponse.json({
      student: { id: student.id, name: student.user.name, email: student.user.email },
      records,
      trends: {
        recentScores,
        scoreTrend,
        subjectAvg: Object.entries(subjectAvgMap).map(([subject, data]) => ({
          subject,
          avg: Math.round(data.total / data.count),
        })),
        lastActiveDaysAgo: daysSinceActive,
        lessonsThisWeek,
        lessonsThisMonth,
      },
      submissions: submissions.map((submission) => ({
        id: submission.id,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.Assignment.title,
        className: submission.Assignment.Class.name,
        subject: String(submission.Assignment.Class.subject),
        points: submission.Assignment.points,
        dueAt: submission.Assignment.dueAt?.toISOString() ?? null,
        submittedAt: submission.turnedInAt?.toISOString() ?? null,
        score: submission.score,
        feedback: submission.feedback ?? "",
        content: submission.content ?? "",
      })),
      submissionCount: submissions.length,
      newSubmissionCount,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
