import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { buildTeacherExamReadinessSummary } from "@/lib/outcomes/examReadiness";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function isExamReadinessRouteEnabled() {
  return process.env.ENABLE_EXAM_READINESS?.trim() !== "false";
}

export async function GET() {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "TEACHER") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ exams: [] });
    }

    const exams = await prisma.exam.findMany({
      where: { schoolId: user.schoolId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        subject: true,
        grade: true,
        status: true,
        resultsPublishedAt: true,
        class: { select: { name: true } },
        academicYear: { select: { yearLabel: true } },
        attempts: {
          select: {
            score: true,
            passed: true,
            submittedAt: true,
            integrityFlags: true,
          },
        },
        _count: { select: { attempts: true } },
      },
    });

    const readinessSummary =
      isExamReadinessRouteEnabled() && user.schoolId
        ? await buildTeacherExamReadinessSummary(user.id, user.schoolId).catch(() => null)
        : null;

    return NextResponse.json({
      readinessSummary,
      exams: exams.map((exam) => {
        const attempts = Array.isArray(exam.attempts) ? exam.attempts : [];
        const submittedAttempts = attempts.filter((attempt) => !("submittedAt" in attempt) || Boolean(attempt.submittedAt));
        const attemptCount = exam._count?.attempts ?? attempts.length;
        const passCount = attempts.filter((attempt) => attempt.passed).length;
        const flaggedCount = attempts.filter((attempt) => attempt.integrityFlags.length > 0).length;

        return {
          id: exam.id,
          title: exam.title,
          subject: exam.subject,
          grade: exam.grade,
          status: exam.status,
          className: exam.class?.name ?? null,
          academicYearLabel: exam.academicYear?.yearLabel ?? null,
          resultsPublishedAt: exam.resultsPublishedAt,
          attemptCount,
          passRate: attemptCount > 0 ? passCount / attemptCount : 0,
          flaggedCount,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
