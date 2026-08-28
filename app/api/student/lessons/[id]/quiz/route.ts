import { NextRequest, NextResponse } from "next/server";

import { generateLessonQuiz } from "@/lib/ai/lessonQuiz";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { resolveScheduledLessonContext } from "@/lib/student/resolveScheduledLessonContext";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: `/api/student/lessons/${params.id}/quiz`,
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const lesson = await resolveScheduledLessonContext(user, params.id);
    const quiz = await generateLessonQuiz(
      {
        lessonTitle: lesson.title,
        lessonContent: lesson.body,
        subject: lesson.subject,
        gradeLevel: lesson.grade,
        preAuthoredQuestions: lesson.lessonQuizQuestions,
      },
      {
        route: "/api/student/lessons/[id]/quiz",
        feature: "curriculum",
        schoolId: lesson.schoolId,
        userId: user.id,
        studentId: lesson.studentId,
        subject: lesson.subject,
        contentId: lesson.contentId,
        lessonId: lesson.scheduledWorkId,
        requestType: "lesson_quiz_generation",
        assessmentVersion: "sprint11.lesson_quiz.v1",
        metadata: {
          questionCount: 5,
        },
      }
    );

    await logAudit({
      userId: user.id,
      schoolId: lesson.schoolId,
      action: "student.lesson.quiz.generated",
      resourceType: "lesson_quiz",
      resourceId: quiz.quizId,
      details: {
        scheduledWorkId: lesson.scheduledWorkId,
        contentId: lesson.contentId,
        subject: lesson.subject,
      },
    });

    await logLearningEvent({
      schoolId: lesson.schoolId,
      classId: lesson.classId,
      userId: user.id,
      studentId: lesson.studentId,
      actor: { type: "user", id: user.id, role: "STUDENT" },
      target: { type: "lesson_quiz", id: quiz.quizId },
      eventType: "lesson.quiz.generated",
      source: "/api/student/lessons/[id]/quiz",
      contentId: lesson.contentId,
      lessonId: lesson.scheduledWorkId,
      subject: lesson.subject,
      grade: lesson.grade,
      versionRefs: {
        assessmentVersion: "sprint11.lesson_quiz.v1",
      },
      metadata: {
        questionCount: quiz.questions.length,
      },
    });

    return NextResponse.json(quiz, {
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message === "invalid_ai_json"
            ? "We could not generate your quiz right now. Please try again."
            : error?.message ?? "Failed to generate quiz",
      },
      { status: error?.status ?? 500 }
    );
  }
}
