import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { syncTranscriptSummariesForExam } from "@/lib/exams/examAuthority";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (
      user.role !== "ADMIN" &&
      user.role !== "TEACHER" &&
      !user.isPlatformAdmin
    ) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId =
      user.role === "TEACHER" && !user.isPlatformAdmin
        ? user.schoolId ?? null
        : resolveAdminSchoolScope(user, null);
    if (!schoolId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: context.params.examId, schoolId, deletedAt: null },
      include: {
        attempts: {
          include: {
            student: {
              include: {
                user: {
                  select: { name: true, email: true },
                },
              },
            },
          },
          orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const submittedAttempts = exam.attempts.filter((attempt) => Boolean(attempt.submittedAt));

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        publishedAt: exam.publishedAt,
        resultsPublishedAt: exam.resultsPublishedAt,
      },
      results: submittedAttempts.map((attempt) => ({
        attemptId: attempt.id,
        studentId: attempt.studentId,
        studentName:
          attempt.student.user.name ?? attempt.student.user.email ?? attempt.studentId,
        score: attempt.score,
        passed: attempt.passed,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        integrityFlags: attempt.integrityFlags,
        tabSwitchCount: attempt.tabSwitchCount,
        durationSeconds: attempt.durationSeconds,
        integrityMetadata: attempt.integrityMetadata ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(_req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId = resolveAdminSchoolScope(user, null);
    const exam = await prisma.exam.findFirst({
      where: { id: context.params.examId, schoolId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        resultsPublishedAt: true,
        _count: { select: { attempts: true } },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (exam._count.attempts === 0) {
      return NextResponse.json(
        { error: "No submitted attempts are available for result publication" },
        { status: 400 }
      );
    }

    const releasedAt = exam.resultsPublishedAt ?? new Date();
    await prisma.exam.update({
      where: { id: exam.id },
      data: { resultsPublishedAt: releasedAt },
    });

    const syncResult = await syncTranscriptSummariesForExam(exam.id);

    await logAudit({
      userId: user.id,
      schoolId,
      action: "exam.results_published",
      resourceType: "exam",
      resourceId: exam.id,
      details: {
        title: exam.title,
        status: exam.status,
        updatedTranscripts: syncResult.updatedTranscripts,
      },
    });

    return NextResponse.json({
      ok: true,
      resultsPublishedAt: releasedAt,
      updatedTranscripts: syncResult.updatedTranscripts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
