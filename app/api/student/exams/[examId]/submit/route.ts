import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  buildAttemptIntegrityMetadata,
  normalizeAttemptLog,
  submitExamSchema,
  syncTranscriptSummariesForExam,
} from "@/lib/exams/examAuthority";
import { gradeAttempt } from "@/lib/exams/gradingPipeline";
import { recordPerformanceEvent } from "@/lib/intelligence/recordPerformanceEvent";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const body = submitExamSchema.parse(await req.json());
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student context unavailable" }, { status: 400 });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: body.attemptId,
        examId: context.params.examId,
        studentId: student.id,
      },
      include: {
        exam: { include: { questions: true } },
      },
    });
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (attempt.submittedAt) {
      return NextResponse.json({ error: "Attempt already submitted" }, { status: 409 });
    }

    const previousPass = await prisma.examAttempt.findFirst({
      where: {
        examId: attempt.examId,
        studentId: student.id,
        passed: true,
        NOT: { id: attempt.id },
      },
      select: { id: true },
    });
    if (previousPass) {
      return NextResponse.json({ error: "Exam already passed" }, { status: 409 });
    }

    const grading = gradeAttempt(
      {
        ...attempt,
        answers: body.answers,
        passingScore: attempt.exam.passingScore,
      } as any,
      attempt.exam.questions as any
    );

    const submittedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)
    );
    const suspiciousDuration = durationSeconds > 0 && durationSeconds < Math.max(30, attempt.exam.questions.length * 5);
    const integrityFlags = Array.isArray(body.flags) ? [...body.flags] : [];
    const tabSwitchCount = body.tabSwitchCount ?? 0;
    const maxAllowedMs = (attempt.exam.timeLimit + 5) * 60 * 1000;
    if (submittedAt.getTime() - attempt.startedAt.getTime() > maxAllowedMs) {
      integrityFlags.push("time_exceeded");
    }
    if (tabSwitchCount > 0) {
      integrityFlags.push("tab_switch");
    }
    if (suspiciousDuration) {
      integrityFlags.push("suspicious_duration");
    }

    const uniqueFlags = Array.from(new Set(integrityFlags));
    const submissionLog = normalizeAttemptLog(body.submissionLog).concat([
      {
        type: "submitted",
        at: submittedAt.toISOString(),
        detail: `duration_seconds:${durationSeconds}`,
      },
    ]);

    let certCode: string | undefined;
    if (grading.passed) {
      certCode = `CERT-${submittedAt.getUTCFullYear()}-${student.id.slice(0, 6)}-${attempt.exam.id.slice(0, 6)}`;
    }

    await prisma.$transaction(async (tx) => {
      await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          answers: body.answers,
          score: grading.score,
          passed: grading.passed,
          submittedAt,
          tabSwitchCount,
          durationSeconds,
          integrityFlags: uniqueFlags,
          submissionLog: {
            events: submissionLog,
          },
          integrityMetadata: buildAttemptIntegrityMetadata({
            flags: uniqueFlags,
            tabSwitchCount,
            durationSeconds,
            weakMoeCodes: grading.weakMoeCodes,
            suspiciousDuration,
            submissionLog,
          }),
        },
      });

      if (grading.passed && certCode) {
        await tx.examCertification.upsert({
          where: { certCode },
          update: {
            score: grading.score,
            subject: attempt.exam.subject,
            grade: attempt.exam.grade,
          },
          create: {
            studentId: student.id,
            examId: attempt.exam.id,
            subject: attempt.exam.subject,
            grade: attempt.exam.grade,
            score: grading.score,
            certCode,
          },
        });
      }
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "exam.submitted",
      resourceType: "exam",
      resourceId: attempt.exam.id,
      details: {
        attemptId: attempt.id,
        score: grading.score,
        passed: grading.passed,
        integrityFlags: uniqueFlags,
        tabSwitchCount,
        durationSeconds,
        weakMoeCodes: grading.weakMoeCodes,
      },
    });

    if (attempt.exam.resultsPublishedAt && attempt.exam.academicYearId) {
      await syncTranscriptSummariesForExam(attempt.exam.id);
    }

    void recordPerformanceEvent({
      studentId: student.id,
      schoolId: user.schoolId ?? "",
      subject: attempt.exam.subject,
      gradeLevel: attempt.exam.grade,
      eventType: "quiz",
      score: grading.score,
      durationSeconds,
      attempts: 1,
      aiAssistUsed: false,
      lessonId: attempt.exam.id,
    }).catch((eventError) => {
      console.error("[exam.submit.performanceEvent]", eventError);
    });

    return NextResponse.json({
      score: grading.score,
      passed: grading.passed,
      certCode,
      resultsPublished: Boolean(attempt.exam.resultsPublishedAt),
      durationSeconds,
      tabSwitchCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
