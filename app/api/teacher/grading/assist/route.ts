/**
 * POST /api/teacher/grading/assist
 *
 * AI-assisted grading feedback on an anonymized submission.
 * Returns rubric-aligned feedback, suggested score bands, strengths,
 * and areas for development. Teacher final authority always asserted.
 *
 * Feature flag : ENABLE_AI_GRADING_ASSIST (default OFF → 404)
 * Auth         : TEACHER role required
 * Budget check : shared AI_BUDGET_MONTHLY_CAP_USD
 *
 * Body (JSON):
 *   subject           string   (required)
 *   strandKey         string   (required)
 *   rubric            string   (required)
 *   submissionContent string   (required — caller MUST strip all PII first)
 *   expectedAnswer    string   (optional)
 *
 * IMPORTANT: submissionContent must be anonymized before sending.
 * The caller is responsible for stripping all student identifiers.
 *
 * Audit action : "grading.assist.used"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import {
  isAiGradingAssistEnabled,
  getAiBudgetMonthlyCap,
} from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { prisma } from "@/lib/db";
import { getGradingAssistFeedback } from "@/lib/workflows/ai/gradingAssist";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

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

    // ── Monthly budget check ───────────────────────────────────────────────
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const budgetResult = await (prisma as any).aiInteractionLog.aggregate({
      where: { timestamp: { gte: monthStart } },
      _sum: { estimatedCostUSD: true },
    });
    const monthlySpend: number = (budgetResult as any)?._sum?.estimatedCostUSD ?? 0;
    const cap = getAiBudgetMonthlyCap();

    if (monthlySpend >= cap) {
      recordMetricEvent(
        "ai.budget.cap_hit",
        { monthlySpend, cap },
        { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
      ).catch(() => {});
      return NextResponse.json({ error: "ai_budget_exhausted" }, { status: 503 });
    }

    // ── Parse + validate body ──────────────────────────────────────────────
    const body = await req.json();
    const subject = String(body.subject ?? "").trim();
    const strandKey = String(body.strandKey ?? "").trim();
    const rubric = String(body.rubric ?? "").trim();
    const submissionContent = String(body.submissionContent ?? "").trim();
    const expectedAnswer = body.expectedAnswer
      ? String(body.expectedAnswer).trim()
      : undefined;

    if (!subject || !strandKey || !rubric || !submissionContent) {
      return NextResponse.json(
        { error: "subject, strandKey, rubric, and submissionContent are required" },
        { status: 400 }
      );
    }

    // ── AI call ────────────────────────────────────────────────────────────
    const result = await getGradingAssistFeedback({
      subject,
      strandKey,
      rubric,
      submissionContent,
      expectedAnswer,
    });

    // ── Audit log (no student data — submissionContent not logged) ─────────
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
        // submissionContent intentionally omitted from audit log
      },
    });

    // ── AI interaction log (no student data) ──────────────────────────────
    await (prisma as any).aiInteractionLog.create({
      data: {
        schoolId: user.schoolId ?? null,
        subject,
        strandKey,
        requestType: "grading_assist",
        guidanceLevel: null,
        hadFallback: result.hadFallback,
        endpoint: "/api/teacher/grading/assist",
        tokensUsed: result.tokensUsed,
        estimatedCostUSD: result.estimatedCostUSD,
      },
    });

    // ── Telemetry ──────────────────────────────────────────────────────────
    recordMetricEvent(
      result.hadFallback ? "grading_assist_fallback" : "grading_assist_request",
      { subject, strandKey },
      { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
    ).catch(() => {});

    return NextResponse.json({
      feedback: result.feedback,
      suggestedScoreBands: result.suggestedScoreBands,
      strengths: result.strengths,
      areasForDevelopment: result.areasForDevelopment,
      teacherFinalAuthority: result.teacherFinalAuthority,
      hadFallback: result.hadFallback,
    }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
