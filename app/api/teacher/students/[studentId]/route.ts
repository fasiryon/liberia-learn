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
