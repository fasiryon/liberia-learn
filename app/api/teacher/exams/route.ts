// route-policy: auth=session; scope=record; authority=class-teacher-subject-coteacher; rationale=a TEACHER lists only class-bound exams of classes where lib/authz/classAuthority grants class.read.learning for the exam's subject (class teacher, or a co-teacher assigned that subject); attempt aggregates are those exams' only; unclassed exams (classId null) are ADMIN-only through the admin exams route; no attempt is read for an exam the teacher may not see (AT-GRADE-01-2D, CoS ruling E-A)
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { authorizeClassAccess } from "@/lib/authz/classAuthority";
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

    // E-A: decide on class-bound exams' class and subject first, reading no attempt data; unclassed exams are ADMIN-only.
    const candidates = await prisma.exam.findMany({
      where: { schoolId: user.schoolId, deletedAt: null, classId: { not: null } },
      select: { id: true, classId: true, subject: true },
    });
    const decided = new Map<string, boolean>();
    const visible: string[] = [];
    for (const exam of candidates) {
      if (!exam.classId) continue;
      const key = `${exam.classId}\u0000${exam.subject}`;
      if (!decided.has(key)) {
        decided.set(key, (await authorizeClassAccess(user, { classId: exam.classId, subject: exam.subject, fn: "class.read.learning" })).allowed);
      }
      if (decided.get(key)) visible.push(exam.id);
    }

    const exams = visible.length === 0 ? [] : await prisma.exam.findMany({
      where: { schoolId: user.schoolId, deletedAt: null, id: { in: visible } },
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
