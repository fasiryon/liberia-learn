import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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

    const user = await requireUser();
    if (user.role !== "STUDENT") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
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
        deletedAt: null,
      },
      include: {
        questions: true,
        class: { select: { id: true, name: true } },
      },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (exam.classId) {
      const rosterMembership = await prisma.enrollment.findFirst({
        where: {
          classId: exam.classId,
          studentId: student.id,
          Class: { schoolId: student.user.schoolId },
        },
        select: { id: true },
      });

      if (!rosterMembership) {
        return NextResponse.json({ error: "Exam not available for this student" }, { status: 403 });
      }
    }

    if (exam.academicYearId) {
      const academicEnrollment = await prisma.academicEnrollment.findFirst({
        where: {
          studentId: student.id,
          schoolId: student.user.schoolId,
          academicYearId: exam.academicYearId,
        },
        select: { id: true },
      });
      if (!academicEnrollment) {
        return NextResponse.json({ error: "Academic year record required" }, { status: 403 });
      }
    }

    const existingPass = await prisma.examAttempt.findFirst({
      where: { examId: exam.id, studentId: student.id, passed: true },
      select: { id: true },
    });
    if (existingPass) {
      return NextResponse.json({ error: "Exam already passed" }, { status: 409 });
    }

    const existingAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        studentId: student.id,
        submittedAt: null,
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true },
    });

    const attempt = existingAttempt ?? await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: student.id,
        answers: [],
        score: 0,
        passed: false,
        integrityFlags: [],
        submissionLog: {
          events: [
            {
              type: "attempt_started",
              at: new Date().toISOString(),
              detail: exam.classId ? `class:${exam.classId}` : "school_scoped",
            },
          ],
        },
      },
      select: { id: true, startedAt: true },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      questions: stripQuestionAnswers(exam.questions),
      timeLimit: exam.timeLimit,
      title: exam.title,
      startedAt: attempt.startedAt,
      resumed: Boolean(existingAttempt),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
