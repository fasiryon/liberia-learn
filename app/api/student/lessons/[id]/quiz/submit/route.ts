import { NextRequest, NextResponse } from "next/server";

import { generateLessonGapAnalysis } from "@/lib/ai/lessonQuiz";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { awardLessonQuizCertificates } from "@/lib/certificates/certificateService";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { resolveActionsOnQuizPass } from "@/lib/intelligence/actionEngine";
import { tagMisconception } from "@/lib/intelligence/misconceptions";
import { recordPerformanceEvent } from "@/lib/intelligence/recordPerformanceEvent";
import { resolveScheduledLessonContext } from "@/lib/student/resolveScheduledLessonContext";

type QuizSubmissionBody = {
  quizId?: string;
  answers?: Array<{
    questionId?: string;
    selectedIndex?: number;
  }>;
  questions?: Array<{
    id?: string;
    question?: string;
    options?: string[];
    correctIndex?: number;
    explanation?: string;
  }>;
  startedAt?: string;
};

function normalizeSubmission(body: QuizSubmissionBody) {
  if (
    typeof body.quizId !== "string" ||
    !Array.isArray(body.answers) ||
    !Array.isArray(body.questions) ||
    body.questions.length !== 5
  ) {
    throw Object.assign(new Error("invalid_payload"), { status: 400 });
  }

  const questions = body.questions.map((question, index) => {
    if (
      typeof question?.id !== "string" ||
      typeof question?.question !== "string" ||
      !Array.isArray(question?.options) ||
      question.options.length !== 4 ||
      !Number.isInteger(question?.correctIndex) ||
      typeof question?.explanation !== "string"
    ) {
      throw Object.assign(new Error(`invalid_question_${index + 1}`), { status: 400 });
    }

    return {
      id: question.id,
      question: question.question,
      options: question.options.map((option) => String(option)),
      correctIndex: Number(question.correctIndex),
      explanation: question.explanation,
    };
  });

  const answers = body.answers.map((answer) => {
    if (typeof answer?.questionId !== "string" || !Number.isInteger(answer?.selectedIndex)) {
      throw Object.assign(new Error("invalid_answer"), { status: 400 });
    }

    return {
      questionId: answer.questionId,
      selectedIndex: Number(answer.selectedIndex),
    };
  });

  return {
    quizId: body.quizId,
    questions,
    answers,
    startedAt: typeof body.startedAt === "string" ? body.startedAt : null,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const submission = normalizeSubmission((await req.json()) as QuizSubmissionBody);
    const lesson = await resolveScheduledLessonContext(user, params.id);

    const questionMap = new Map(
      submission.questions.map((question) => [question.id, question] as const)
    );
    const evaluatedAnswers = submission.answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw Object.assign(new Error("question_not_found"), { status: 400 });
      }

      return {
        ...answer,
        question,
        isCorrect: answer.selectedIndex === question.correctIndex,
      };
    });

    const correctCount = evaluatedAnswers.filter((answer) => answer.isCorrect).length;
    const score = correctCount / Math.max(evaluatedAnswers.length, 1);
    const incorrectAnswers = evaluatedAnswers
      .filter((answer) => !answer.isCorrect)
      .map((answer) => ({
        questionId: answer.questionId,
        question: answer.question.question,
        selectedIndex: answer.selectedIndex,
        selectedOption: answer.question.options[answer.selectedIndex] ?? "No answer",
        correctIndex: answer.question.correctIndex,
        correctOption:
          answer.question.options[answer.question.correctIndex] ?? "Unknown answer",
        explanation: answer.question.explanation,
      }));

    let gapAnalysis = null;
    let gapAnalysisError: string | null = null;
    if (incorrectAnswers.length > 0) {
      try {
        gapAnalysis = await generateLessonGapAnalysis(
          {
            lessonTitle: lesson.title,
            lessonContent: lesson.body,
            subject: lesson.subject,
            gradeLevel: lesson.grade,
            incorrectAnswers: incorrectAnswers.map((answer) => ({
              question: answer.question,
              selectedOption: answer.selectedOption,
              correctOption: answer.correctOption,
              explanation: answer.explanation,
            })),
          },
          {
            route: "/api/student/lessons/[id]/quiz/submit",
            feature: "curriculum",
            schoolId: lesson.schoolId,
            userId: user.id,
            studentId: lesson.studentId,
            subject: lesson.subject,
            contentId: lesson.contentId,
            lessonId: lesson.scheduledWorkId,
            requestType: "lesson_quiz_gap_analysis",
            assessmentVersion: "sprint11.lesson_quiz.v1",
            metadata: {
              incorrectCount: incorrectAnswers.length,
            },
          }
        );
      } catch {
        gapAnalysisError =
          "We could not generate your review notes right now. Please re-read the lesson and try again.";
      }
    }

    const durationSeconds = submission.startedAt
      ? Math.max(
          0,
          Math.round(
            (Date.now() - new Date(submission.startedAt).getTime()) / 1000
          )
        )
      : 0;

    const assessmentAttempt = await prisma.assessmentAttempt.create({
      data: {
        assessmentId: submission.quizId,
        studentId: lesson.studentId,
        userId: user.id,
        schoolId: lesson.schoolId,
        classId: lesson.classId,
        subject: lesson.subject,
        grade: lesson.grade,
        attemptNumber: 1,
        status: "completed",
        score,
        maxScore: 1,
        aiAssisted: true,
        rawResponse: {
          answers: submission.answers,
        },
        evaluation: {
          questions: submission.questions.map((question) => ({
            id: question.id,
            question: question.question,
            correctIndex: question.correctIndex,
            explanation: question.explanation,
          })),
          incorrectAnswers,
          score,
          correctCount,
          totalQuestions: submission.questions.length,
          gapAnalysis,
          gapAnalysisError,
        },
        metadata: {
          scheduledWorkId: lesson.scheduledWorkId,
          contentId: lesson.contentId,
          assessmentVersion: "sprint11.lesson_quiz.v1",
        },
        source: "student.lesson.quiz.submit",
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    // Create per-question detail records (fire-and-forget)
    if (submission.answers.length > 0) {
      void prisma.assessmentAttemptDetail.createMany({
        data: submission.answers.map((answer, idx) => {
          const question = questionMap.get(answer.questionId);
          const selectedAnswer = question?.options[answer.selectedIndex] ?? String(answer.selectedIndex);
          const correctAnswer = question ? (question.options[question.correctIndex] ?? String(question.correctIndex)) : "";
          return {
            attemptId: assessmentAttempt.id,
            questionIdx: idx,
            questionText: question?.question ?? `Question ${idx + 1}`,
            selectedAnswer,
            correctAnswer,
            isCorrect: answer.selectedIndex === (question?.correctIndex ?? -1),
          };
        }),
      }).catch(() => null);
    }

    if (incorrectAnswers.length > 0) {
      await tagMisconception({
        studentId: lesson.studentId,
        schoolId: lesson.schoolId,
        subject: lesson.subject,
        strandKey: lesson.contentId,
        assessmentAttemptId: assessmentAttempt.id,
        taggedByUserId: user.id,
        categoryCode: "lesson_quiz_incorrect_response",
        categoryLabel: "Lesson Quiz Incorrect Response",
        categoryDescription: "Incorrect response pattern captured from a lesson-end quiz.",
        confidence: incorrectAnswers.length / submission.questions.length,
        evidence: {
          contentId: lesson.contentId,
          incorrectQuestionIds: incorrectAnswers.map((answer) => answer.questionId),
          missedConcepts: gapAnalysis?.missedConcepts?.map((concept) => concept.concept) ?? [],
        },
        createCategoryIfMissing: true,
      });
    }

    await logAudit({
      userId: user.id,
      schoolId: lesson.schoolId,
      action: "student.lesson.quiz.submitted",
      resourceType: "lesson_quiz_attempt",
      resourceId: assessmentAttempt.id,
      details: {
        scheduledWorkId: lesson.scheduledWorkId,
        contentId: lesson.contentId,
        score,
        incorrectCount: incorrectAnswers.length,
      },
    });

    await logLearningEvent({
      schoolId: lesson.schoolId,
      classId: lesson.classId,
      userId: user.id,
      studentId: lesson.studentId,
      actor: { type: "user", id: user.id, role: "STUDENT" },
      target: { type: "assessment_attempt", id: assessmentAttempt.id },
      eventType: "lesson.quiz.submitted",
      source: "/api/student/lessons/[id]/quiz/submit",
      contentId: lesson.contentId,
      lessonId: lesson.scheduledWorkId,
      subject: lesson.subject,
      grade: lesson.grade,
      versionRefs: {
        assessmentVersion: "sprint11.lesson_quiz.v1",
      },
      metadata: {
        score,
        incorrectCount: incorrectAnswers.length,
      },
      qualityMarkers: {
        aiAssisted: true,
      },
    });

    void recordPerformanceEvent({
      studentId: lesson.studentId,
      schoolId: lesson.schoolId,
      subject: lesson.subject,
      gradeLevel: lesson.grade,
      eventType: "quiz",
      score,
      durationSeconds,
      attempts: 1,
      aiAssistUsed: true,
      lessonId: lesson.scheduledWorkId,
    }).catch(() => null);

    resolveActionsOnQuizPass(lesson.studentId, lesson.scheduledWorkId, score).catch(() => null);

    const certificateAwards = await awardLessonQuizCertificates({
      studentId: lesson.studentId,
      studentUserId: user.id,
      schoolId: lesson.schoolId,
      classId: lesson.classId,
      subject: lesson.subject,
      scheduledWorkId: lesson.scheduledWorkId,
      contentId: lesson.contentId,
      lessonTitle: lesson.title,
      actingUserId: user.id,
      quizScore: score,
    });

    return NextResponse.json({
      attemptId: assessmentAttempt.id,
      score,
      scorePercent: Math.round(score * 100),
      correctCount,
      totalQuestions: submission.questions.length,
      explanations: submission.questions.map((question) => ({
        questionId: question.id,
        question: question.question,
        explanation: question.explanation,
        correctIndex: question.correctIndex,
        selectedIndex:
          submission.answers.find((answer) => answer.questionId === question.id)
            ?.selectedIndex ?? null,
        options: question.options,
      })),
      gapAnalysis,
      gapAnalysisError,
      congratulatoryMessage:
        score === 1
          ? "Excellent work. You answered every question correctly."
          : null,
      certificates: certificateAwards,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to submit quiz" },
      { status: error?.status ?? 500 }
    );
  }
}
