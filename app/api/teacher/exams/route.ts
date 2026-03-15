import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ exams: [] });
    }

    const exams = await prisma.exam.findMany({
      where: { schoolId: user.schoolId },
      include: {
        attempts: true,
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      exams: exams.map((exam) => {
        const attemptCount = exam.attempts.length;
        const passCount = exam.attempts.filter((attempt) => attempt.passed).length;
        const avgScore =
          attemptCount > 0
            ? exam.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attemptCount
            : 0;
        const flaggedCount = exam.attempts.filter((attempt) => attempt.integrityFlags.length > 0).length;

        return {
          id: exam.id,
          title: exam.title,
          subject: exam.subject,
          grade: exam.grade,
          status: exam.status,
          questionCount: exam._count.questions,
          attemptCount,
          passRate: attemptCount > 0 ? passCount / attemptCount : 0,
          avgScore,
          flaggedCount,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
