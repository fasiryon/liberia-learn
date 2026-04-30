/**
 * POST /api/teacher/grading/assist
 *
 * AI-assisted grading feedback on a server-anonymized submission.
 * Returns rubric-aligned feedback, suggested score bands, strengths,
 * and areas for development. Teacher final authority always asserted.
 *
 * Feature flag : ENABLE_AI_GRADING_ASSIST (default OFF -> 404)
 * Auth         : TEACHER role required
 * Budget check : centralized routed AI budget guards with graceful fallback
 *
 * Body (JSON):
 *   subject           string   (required)
 *   strandKey         string   (required)
 *   rubric            string   (required)
 *   submissionContent string   (required)
 *   expectedAnswer    string   (optional)
 *   submissionId      string   (optional - used to verify teacher scope and known identifiers)
 *
 * Audit action : "grading.assist.used"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { isAiGradingAssistEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { getGradingAssistFeedback } from "@/lib/workflows/ai/gradingAssist";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { prisma } from "@/lib/db";
import { anonymizeForAI } from "@/lib/privacy/anonymizeForAI";

async function loadSubmissionContext(submissionId: string, teacherUserId: string, schoolId: string | null) {
  const submission = await (prisma as any).assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      Assignment: {
        include: {
          Class: {
            select: { id: true, schoolId: true, teacherId: true },
          },
        },
      },
      Student: {
        include: {
          user: { select: { name: true, email: true, schoolId: true } },
        },
      },
    },
  });

  if (!submission) {
    throw Object.assign(new Error("Submission not found"), { status: 404 });
  }

  const cls = submission.Assignment?.Class;
  const studentSchoolId = submission.Student?.user?.schoolId ?? null;
  if (!schoolId || !cls || cls.schoolId !== schoolId || studentSchoolId !== schoolId || cls.teacherId !== teacherUserId) {
    throw Object.assign(new Error("Submission not found"), { status: 404 });
  }

  return submission;
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (!isAiGradingAssistEnabled()) {
      return NextResponse.json({ error: "ai_grading_assist_disabled" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/teacher/grading/assist",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = await req.json();
    const subject = String(body.subject ?? "").trim();
    const strandKey = String(body.strandKey ?? "").trim();
    const rubric = String(body.rubric ?? "").trim();
    const submissionId = body.submissionId ? String(body.submissionId).trim() : "";
    const bodySubmissionContent = String(body.submissionContent ?? "").trim();
    const expectedAnswer = body.expectedAnswer
      ? String(body.expectedAnswer).trim()
      : undefined;

    if (!subject || !strandKey || !rubric || !bodySubmissionContent) {
      return NextResponse.json(
        { error: "subject, strandKey, rubric, and submissionContent are required" },
        { status: 400 }
      );
    }

    const submission = submissionId
      ? await loadSubmissionContext(submissionId, user.id, user.schoolId ?? null)
      : null;
    const rawSubmissionContent = String(submission?.content ?? bodySubmissionContent).trim();
    const knownNames = [submission?.Student?.user?.name, body.studentName];
    const knownEmails = [submission?.Student?.user?.email, body.studentEmail];
    const anonymizedSubmission = anonymizeForAI(rawSubmissionContent, { knownNames, knownEmails });
    const anonymizedExpectedAnswer = expectedAnswer
      ? anonymizeForAI(expectedAnswer, { knownNames, knownEmails })
      : null;

    const result = await getGradingAssistFeedback(
      {
        subject,
        strandKey,
        rubric,
        submissionContent: anonymizedSubmission.text,
        expectedAnswer: anonymizedExpectedAnswer?.text,
      },
      {
        route: "/api/teacher/grading/assist",
        schoolId: user.schoolId ?? null,
        userId: user.id,
      }
    );

    await logAudit({
      userId: user.id,
      action: "grading.assist.used",
      resourceType: "grading_assist",
      schoolId: user.schoolId,
      traceId,
      details: {
        subject,
        strandKey,
        hadFallback: result.hadFallback,
        feedbackCount: result.feedback.length,
        submissionId: submissionId || undefined,
        anonymizedForAI: true,
        redactionCount:
          anonymizedSubmission.redactionCount + (anonymizedExpectedAnswer?.redactionCount ?? 0),
      },
    });

    recordMetricEvent(
      result.hadFallback ? "grading_assist_fallback" : "grading_assist_request",
      { subject, strandKey },
      { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
    ).catch(() => {});

    return NextResponse.json(
      {
        suggestedScore: result.suggestedScore,
        feedback: result.feedback,
        suggestedScoreBands: result.suggestedScoreBands,
        strengths: result.strengths,
        areasForDevelopment: result.areasForDevelopment,
        teacherFinalAuthority: result.teacherFinalAuthority,
        hadFallback: result.hadFallback,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
