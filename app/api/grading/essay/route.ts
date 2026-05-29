/**
 * app/api/grading/essay/route.ts  — NR-14C Phase 1
 *
 * POST /api/grading/essay
 *
 * Student submits an essay for AI rubric grading.
 * Grade is ADVISORY — shown to student + teacher, never a hard gate.
 * Teacher can override via PATCH /api/grading/[submissionId]/override.
 *
 * Body: { lessonId, promptId?, essayText, clientSubmissionId? }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { gradeEssay, isEssayGradeResult } from "@/lib/grading/gradeEssay";
import { recordAnswer, buildSkillKey } from "@/lib/adaptive/updateMastery";

const MASTERY_SCORE_THRESHOLD = 0.70; // essay score ≥ 0.70 counts as a correct answer for mastery

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

    const body = await req.json().catch(() => null);
    const {
      lessonId,
      promptId,
      essayText,
      clientSubmissionId,
    }: {
      lessonId?: string;
      promptId?: string;
      essayText?: string;
      clientSubmissionId?: string;
    } = body ?? {};

    if (!lessonId || typeof essayText !== "string") {
      return NextResponse.json(
        { error: "lessonId and essayText are required" },
        { status: 400 }
      );
    }

    // Idempotency — NR-14A pattern
    if (clientSubmissionId) {
      const existing = await prisma.gradedSubmission
        .findUnique({ where: { clientSubmissionId } })
        .catch(() => null);
      if (existing) {
        return NextResponse.json({ ok: true, submission: existing }, { status: 200 });
      }
    }

    // Look up lesson for grade/subject context
    const lesson = await prisma.curriculumContent.findUnique({
      where: { id: lessonId },
      select: { grade: true, subject: true, title: true, unitId: true, contentId: true },
    });
    if (!lesson) {
      return NextResponse.json({ error: "lesson_not_found" }, { status: 404 });
    }

    // Create pending submission
    const submission = await prisma.gradedSubmission.create({
      data: {
        studentId: student.id,
        lessonId,
        exerciseType: "essay",
        promptId: promptId ?? null,
        submissionText: essayText,
        status: "pending",
        clientSubmissionId: clientSubmissionId ?? null,
      },
    });

    // Grade the essay
    const gradeResult = await gradeEssay({
      essayText,
      grade: lesson.grade,
      subject: lesson.subject,
      prompt: promptId ?? lesson.title ?? "Write an essay based on what you learned.",
    });

    if (!isEssayGradeResult(gradeResult)) {
      // Too short — update submission status but don't assign a score
      await prisma.gradedSubmission.update({
        where: { id: submission.id },
        data: {
          status: "graded",
          gradedAt: new Date(),
          feedback: `Your essay is too short to grade (${gradeResult.wordCount} words). Please write at least ${gradeResult.minWords} words and resubmit.`,
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

    // gradeResult is now EssayGradeResult (type guard narrowed it)
    const update = await prisma.gradedSubmission.update({
      where: { id: submission.id },
      data: {
        score: gradeResult.score,
        rubricBreakdown: gradeResult.breakdown as any,
        feedback: gradeResult.feedback,
        status: "graded",
        gradedAt: new Date(),
      },
    });

    // Fire-and-forget: feed into AdaptiveMasteryRecord
    // Essay score ≥ 0.70 = correct answer equivalent for skill tracking
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
        // Non-critical — grading still succeeded
      }
    })();

    return NextResponse.json({
      ok: true,
      submissionId: update.id,
      score: update.score,
      feedback: update.feedback,
      rubricBreakdown: update.rubricBreakdown,
      gradedAt: update.gradedAt,
      advisory: true, // always remind client this is advisory
    });
  } catch (err: unknown) {
    const status =
      err instanceof Error && err.message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "internal_error" },
      { status }
    );
  }
}
