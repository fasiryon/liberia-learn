import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function stripQuestionAnswers<T extends { correctIndex: number }>(questions: T[]) {
  return questions.map(({ correctIndex: _correctIndex, ...question }) => question);
}

export async function GET() {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true, currentGrade: true, user: { select: { schoolId: true } } },
    });

    if (!student?.user.schoolId || !student.currentGrade) {
      return NextResponse.json({ exams: [] });
    }

    const exams = await prisma.exam.findMany({
      where: {
        schoolId: student.user.schoolId,
        grade: student.currentGrade,
        status: "PUBLISHED",
      },
      include: { questions: true, _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      exams: exams.map((exam) => ({
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        grade: exam.grade,
        status: exam.status,
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        moeStandards: exam.moeStandards,
        questionCount: exam._count.questions,
        questions: stripQuestionAnswers(exam.questions),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
