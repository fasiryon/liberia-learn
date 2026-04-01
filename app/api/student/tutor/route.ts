/**
 * POST /api/student/tutor
 *
 * Student AI Tutor — returns a strand-targeted explanation or practice prompt.
 * No PII in request, response, audit log, or AI prompt.
 *
 * Feature flag : AI_TUTOR_ENABLED (default OFF → 404)
 * Auth         : Any authenticated session; studentId = session user.id
 * Rate limit   : 20 requests/hour via checkAiRateLimit()
 * Budget check : AI_BUDGET_MONTHLY_CAP_USD (default $100); 503 when exceeded
 *
 * Audit action : "ai.tutor.requested"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import {
  isAiTutorEnabled,
  getAiBudgetMonthlyCap,
} from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { recordMetricEvent } from "@/lib/metrics/events";
import { prisma } from "@/lib/db";
import {
  getStudentTutorResponse,
  isValidRequestType,
  type StudentTutorInput,
} from "@/lib/ai/tutor/studentTutor";

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isAiTutorEnabled()) {
      return NextResponse.json({ error: "ai_tutor_disabled" }, { status: 404 });
    }

    const user = await requireUser();
    const rateLimit = checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/student/tutor",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before making another request" },
        { status: 429 }
      );
    }

    // ── Rate limit ─────────────────────────────────────────────────────────
    // ── Monthly budget check ───────────────────────────────────────────────
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const budgetResult = await (prisma as any).aiInteractionLog.aggregate({
      where: { timestamp: { gte: monthStart } },
      _sum: { estimatedCostUSD: true },
    });
    const monthlySpend: number =
      (budgetResult as any)?._sum?.estimatedCostUSD ?? 0;
    const cap = getAiBudgetMonthlyCap();

    if (monthlySpend >= cap) {
      recordMetricEvent(
        "ai.budget.cap_hit",
        { monthlySpend, cap },
        { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
      ).catch(() => {});
      return NextResponse.json({ error: "ai_budget_exhausted" }, { status: 503 });
    }
    if (monthlySpend >= cap * 0.8) {
      recordMetricEvent(
        "ai.budget.warning",
        { monthlySpend, cap },
        { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
      ).catch(() => {});
    }

    // ── Parse + validate body ──────────────────────────────────────────────
    const body = await req.json();

    const subject = String(body.subject ?? "").trim();
    const strandKey = String(body.strandKey ?? "").trim();
    if (!subject || !strandKey) {
      return NextResponse.json(
        { error: "subject and strandKey are required" },
        { status: 400 }
      );
    }

    const input: StudentTutorInput = {
      subject,
      strandKey,
      masteryState: String(body.masteryState ?? "NOT_ASSESSED"),
      proficiencyState: String(body.proficiencyState ?? "NOT_ASSESSED"),
      gradeBand: String(body.gradeBand ?? "lower_primary"),
      requestType: isValidRequestType(body.requestType)
        ? body.requestType
        : "explain",
    };

    // ── AI call ────────────────────────────────────────────────────────────
    const result = await getStudentTutorResponse(input);

    // ── Audit log (no PII — no studentId in details) ───────────────────────
    await logAudit({
      userId: user.id,
      action: "ai.tutor.requested",
      resourceType: "ai_tutor",
      schoolId: user.schoolId,
      traceId,
      details: {
        subject: input.subject,
        strandKey: input.strandKey,
        requestType: input.requestType,
        guidanceLevel: result.guidanceLevel,
        hadFallback: result.hadFallback,
        // No studentId, no name
      },
    });

    // ── Interaction log (no studentId) ─────────────────────────────────────
    await (prisma as any).aiInteractionLog.create({
      data: {
        schoolId: user.schoolId ?? null,
        subject: input.subject,
        strandKey: input.strandKey,
        requestType: input.requestType,
        guidanceLevel: result.guidanceLevel,
        hadFallback: result.hadFallback,
        endpoint: "/api/student/tutor",
        tokensUsed: result.tokensUsed,
        estimatedCostUSD: result.estimatedCostUSD,
      },
    });

    // ── Telemetry (no studentId) ───────────────────────────────────────────
    recordMetricEvent(
      result.hadFallback ? "ai_tutor_fallback" : "ai_tutor_request",
      {
        subject: input.subject,
        strandKey: input.strandKey,
        gradeBand: input.gradeBand,
        requestType: input.requestType,
      },
      {
        scope: "school",
        scopeId: user.schoolId ?? null,
        schoolId: user.schoolId,
      }
    ).catch(() => {});

    return NextResponse.json({
      explanation: result.explanation,
      practicePrompt: result.practicePrompt ?? null,
      guidanceLevel: result.guidanceLevel,
      confidenceScore: result.confidenceScore,
      hadFallback: result.hadFallback,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
