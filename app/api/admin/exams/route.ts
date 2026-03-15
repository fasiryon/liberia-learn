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

    const user = await requireRole("ADMIN", "TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ exams: [] });
    }

    const exams = await prisma.exam.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        subject: true,
        grade: true,
        schoolId: true,
        createdBy: true,
        status: true,
        moeStandards: true,
        timeLimit: true,
        passingScore: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { questions: true, attempts: true } },
      },
    });

    return NextResponse.json({
      exams: exams.map((exam) => ({
        ...exam,
        questionCount: exam._count.questions,
        attemptCount: exam._count.attempts,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
