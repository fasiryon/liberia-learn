/**
 * app/api/grading/code/route.ts  — NR-14C Phase 2
 *
 * POST /api/grading/code
 *
 * Student submits code for sandboxed execution grading via Judge0.
 *
 * SECURITY: student code NEVER executes here.
 *   It is forwarded to Judge0's isolate sandbox only.
 *
 * Rate limit: 20 code submissions / student / hour (cost + abuse protection).
 *
 * Body: {
 *   lessonId: string,
 *   promptId?: string,
 *   sourceCode: string,
 *   languageId: number,   // must be in ALLOWED_LANGUAGE_ID_SET
 *   clientSubmissionId?: string
 * }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { gradeCode, ALLOWED_LANGUAGE_ID_SET } from "@/lib/grading/gradeCode";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { recordAnswer, buildSkillKey } from "@/lib/adaptive/updateMastery";

const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour
const RATE_LIMIT_COUNT = 20;            // 20 submissions / student / hour
const MASTERY_SCORE_THRESHOLD = 1.0;    // all tests pass = mastery for code

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

    // Rate limit per student
    const rl = await checkRateLimit(`code-grade:${student.id}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_COUNT,
      namespace: "code-grade",
    });
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl);
    }

    const body = await req.json().catch(() => null);
    const {
      lessonId,
      promptId,
      sourceCode,
      languageId,
      clientSubmissionId,
    }: {
      lessonId?: string;
      promptId?: string;
      sourceCode?: string;
      languageId?: unknown;
      clientSubmissionId?: string;
    } = body ?? {};

    if (!lessonId || !promptId || typeof sourceCode !== "string") {
      return NextResponse.json(
        { error: "lessonId, promptId, and sourceCode are required" },
        { status: 400 }
      );
    }

    if (typeof languageId !== "number" || !ALLOWED_LANGUAGE_ID_SET.has(languageId)) {
      return NextResponse.json(
        {
          error: `languageId ${languageId} is not allowed. Permitted: ${Array.from(ALLOWED_LANGUAGE_ID_SET).join(", ")}`,
        },
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
      select: { grade: true, subject: true, unitId: true, contentId: true },
    });
    if (!lesson) {
      return NextResponse.json({ error: "lesson_not_found" }, { status: 404 });
    }

    // Assessment authority is server-held. Learners may name an exercise but
    // never supply its expected outputs or hidden cases.
    const exercise = await prisma.codeExercise.findUnique({
      where: { promptId },
      select: { lessonId: true, languageId: true, testCases: true, validatedAt: true },
    });
    if (!exercise || exercise.lessonId !== lessonId || !exercise.validatedAt) {
      return NextResponse.json({ error: "validated_code_exercise_not_found" }, { status: 404 });
    }
    if (exercise.languageId !== languageId) {
      return NextResponse.json({ error: "language_does_not_match_exercise" }, { status: 400 });
    }
    const authoritativeCases = exercise.testCases as Array<{ stdin: string; expectedStdout: string; hidden?: boolean }>;
    if (!Array.isArray(authoritativeCases) || authoritativeCases.length === 0 || authoritativeCases.length > 20) {
      return NextResponse.json({ error: "invalid_code_exercise_contract" }, { status: 500 });
    }

    // Create pending submission
    const submission = await prisma.gradedSubmission.create({
      data: {
        studentId: student.id,
        lessonId,
        exerciseType: "code",
        promptId: promptId ?? null,
        submissionText: sourceCode,
        status: "pending",
        clientSubmissionId: clientSubmissionId ?? null,
      },
    });

    // Grade: submit to Judge0 sandbox
    const gradeResult = await gradeCode({
      sourceCode,
      languageId,
      testCases: authoritativeCases.map(({ stdin, expectedStdout }) => ({ stdin, expectedStdout })),
    });

    // Update submission with results
    const updated = await prisma.gradedSubmission.update({
      where: { id: submission.id },
      data: {
        score: gradeResult.score,
        rubricBreakdown: gradeResult.results as any,
        feedback:
          gradeResult.passed === gradeResult.total
            ? "All test cases passed — excellent work!"
            : `${gradeResult.passed} of ${gradeResult.total} test cases passed. Check the failing cases and try again.`,
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
        // Non-critical
      }
    })();

    return NextResponse.json({
      ok: true,
      submissionId: updated.id,
      score: updated.score,
      passed: gradeResult.passed,
      total: gradeResult.total,
      // Hidden expected output stays server-side. Visible cases may provide
      // formative feedback after submission; hidden cases only affect totals.
      results: gradeResult.results.filter((_, index) => !authoritativeCases[index]?.hidden),
      feedback: updated.feedback,
      gradedAt: updated.gradedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "internal_error";
    const status =
      msg.includes("Unauthorized") ? 401 :
      msg.includes("JUDGE0_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
