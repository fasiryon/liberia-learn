// route-policy: auth=session; scope=tenant; authority=student-own-school-grade; rationale=lists published, non-deleted exams for the learner's school and grade with keys and explanations withheld
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectLegacyExamQuestionForLearner } from "@/lib/assessment/v2/adapters";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { buildStudentExamReadiness } from "@/lib/outcomes/examReadiness";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

// Allow-list: the key and the worked explanation stay server-side until results are released.
function stripQuestionAnswers<T extends Parameters<typeof projectLegacyExamQuestionForLearner>[0]>(questions: T[]) {
  return questions.map(projectLegacyExamQuestionForLearner);
}

function isExamReadinessRouteEnabled() {
  return process.env.ENABLE_EXAM_READINESS?.trim() !== "false";
}

export async function GET() {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ exams: [], disabled: true });
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
        deletedAt: null,
      },
      include: { questions: { orderBy: { id: "asc" } }, _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      readiness:
        isExamReadinessRouteEnabled()
          ? await buildStudentExamReadiness(student.id).catch(() => null)
          : null,
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
