// route-policy: auth=session; scope=record; authority=student-self; rationale=grades the authenticated learner own response for a lesson that reaches that learner through scheduled work or an active assignment to an own-school enrolled class (AT-SUBMIT-02; self-directed paths not authorized; non-disclosing 404) and an exercise of that lesson with the same promptId and type; an idempotency key replays only the same learner's exact request, otherwise 409; all before grading, writes or mastery (AT-GRADE-01 2e)
/**
 * app/api/grading/ai-literacy/route.ts  — NR-14D Phase 4
 *
 * POST /api/grading/ai-literacy
 *
 * Student submits a response to an AI literacy exercise for LLM grading.
 * Grade is ADVISORY — shown to student + teacher, never a hard gate.
 *
 * Rate limit: 20 submissions / student / hour (same as code grading).
 *
 * Body: {
 *   lessonId: string,
 *   exerciseId: string,
 *   promptId: string,
 *   exerciseType: "prompt_engineering" | "bias_detection" | "ethics_scenario" | "output_critique",
 *   studentResponse: string,
 *   clientSubmissionId?: string
 * }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { gradeAILiteracy, isAILiteracyGradeResult } from "@/lib/grading/gradeAILiteracy";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { recordAnswer, buildSkillKey } from "@/lib/adaptive/updateMastery";
import type { AILiteracyExerciseType } from "@/lib/exercises/generateAILiteracy";
import { availableLessonForLearner, idempotentReplay, lessonNotFound } from "@/lib/grading/studentSubmissionGuards";

const RATE_LIMIT_WINDOW_MS = 3_600_000;
const RATE_LIMIT_COUNT = 20;
const MASTERY_SCORE_THRESHOLD = 0.70;

const VALID_EXERCISE_TYPES = new Set<AILiteracyExerciseType>([
  "prompt_engineering",
  "bias_detection",
  "ethics_scenario",
  "output_critique",
]);

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    }

    // Rate limit: 20 AI literacy submissions per student per hour
    const rl = await checkRateLimit(`ai-literacy-grade:${student.id}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_COUNT,
      namespace: "ai-literacy-grade",
    });
    if (!rl.allowed) return rateLimitExceededResponse(rl);

    const body = await req.json().catch(() => null);
    const {
      lessonId,
      exerciseId,
      promptId,
      exerciseType,
      studentResponse,
      clientSubmissionId,
    }: {
      lessonId?: string;
      exerciseId?: string;
      promptId?: string;
      exerciseType?: unknown;
      studentResponse?: string;
      clientSubmissionId?: string;
    } = body ?? {};

    if (
      !lessonId ||
      !exerciseId ||
      !promptId ||
      typeof studentResponse !== "string" ||
      !VALID_EXERCISE_TYPES.has(exerciseType as AILiteracyExerciseType)
    ) {
      return NextResponse.json(
        { error: "lessonId, exerciseId, promptId, exerciseType, and studentResponse are required" },
        { status: 400 }
      );
    }

    // The lesson must be available to this learner now (unknown and unavailable answer the same 404).
    const lesson = await availableLessonForLearner(user, lessonId);
    if (!lesson) return lessonNotFound();

    // The exercise must belong to that lesson and be the one the request names (promptId and type); otherwise the
    // same non-disclosing 404 as an unknown exercise.
    const exercise = await prisma.aILiteracyExercise.findUnique({
      where: { id: exerciseId },
      select: { lessonId: true, promptId: true, type: true, scenario: true, studentPromptInstruction: true, rubric: true },
    });
    if (!exercise || exercise.lessonId !== lessonId || exercise.promptId !== promptId || exercise.type !== exerciseType) {
      return NextResponse.json({ error: "exercise_not_found" }, { status: 404 });
    }

    // Idempotency (NR-14A): only the same learner's exact request replays; anything else is 409.
    const replay = await idempotentReplay(clientSubmissionId, {
      studentId: student.id, lessonId, promptId, exerciseType: `ai_literacy_${exerciseType as string}`, submissionText: studentResponse,
    });
    if (replay) return replay;

    // Create pending submission
    const submission = await prisma.gradedSubmission.create({
      data: {
        studentId: student.id,
        lessonId,
        exerciseType: `ai_literacy_${exerciseType as string}`,
        promptId: promptId ?? null,
        submissionText: studentResponse,
        status: "pending",
        clientSubmissionId: clientSubmissionId ?? null,
      },
    });

    // Grade the response
    const gradeResult = await gradeAILiteracy({
      studentResponse,
      exerciseType: exerciseType as AILiteracyExerciseType,
      scenario: exercise.scenario,
      studentPromptInstruction: exercise.studentPromptInstruction,
      rubric: exercise.rubric as { criteria: Array<{ key: string; label: string; description: string; weight: number }> },
      grade: lesson.grade,
    });

    if (gradeResult.tooShort) {
      await prisma.gradedSubmission.update({
        where: { id: submission.id },
        data: {
          status: "graded",
          gradedAt: new Date(),
          feedback: `Your response is too short to grade (${gradeResult.wordCount} words). Please write at least ${gradeResult.minWords} words.`,
        },
      });
      return NextResponse.json({
        ok: true,
        tooShort: true,
        wordCount: gradeResult.wordCount,
        minWords: gradeResult.minWords,
        submissionId: submission.id,
      });
    }

    if (!isAILiteracyGradeResult(gradeResult)) {
      return NextResponse.json({ error: "grading_failed" }, { status: 500 });
    }

    await prisma.gradedSubmission.update({
      where: { id: submission.id },
      data: {
        score: gradeResult.score,
        rubricBreakdown: gradeResult.breakdown as any,
        feedback: gradeResult.feedback,
        status: "graded",
        gradedAt: new Date(),
      },
    });

    // Fire-and-forget mastery update
    void (async () => {
      try {
        const skillKey = buildSkillKey({
          subject: lesson.subject,
          grade: lesson.grade,
          unitId: lesson.unitId,
          contentId: lesson.contentId,
        });
        await recordAnswer({
          studentId: student.id,
          skillKey,
          correct: gradeResult.score >= MASTERY_SCORE_THRESHOLD,
        });
      } catch {
        // non-critical
      }
    })();

    return NextResponse.json({
      ok: true,
      score: gradeResult.score,
      breakdown: gradeResult.breakdown,
      feedback: gradeResult.feedback,
      submissionId: submission.id,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
