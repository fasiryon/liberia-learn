import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function stripQuestionAnswers<T extends { correctIndex: number }>(questions: T[]) {
  return questions.map(({ correctIndex: _correctIndex, ...question }) => question);
}

export async function POST(_req: NextRequest, context: { params: { examId: string } }) {
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
      return NextResponse.json({ error: "Student context unavailable" }, { status: 400 });
    }

    const exam = await prisma.exam.findFirst({
      where: {
        id: context.params.examId,
        schoolId: student.user.schoolId,
        grade: student.currentGrade,
        status: "PUBLISHED",
      },
      include: { questions: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existingPass = await prisma.examAttempt.findFirst({
      where: { examId: exam.id, studentId: student.id, passed: true },
      select: { id: true },
    });
    if (existingPass) {
      return NextResponse.json({ error: "Exam already passed" }, { status: 409 });
    }

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: student.id,
        answers: [],
        score: 0,
        passed: false,
        integrityFlags: [],
      },
      select: { id: true },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      questions: stripQuestionAnswers(exam.questions),
      timeLimit: exam.timeLimit,
      title: exam.title,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
