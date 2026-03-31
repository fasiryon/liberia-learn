/**
 * POST /api/teacher/assignment/tutor
 *
 * Assignment-context AI tutor guidance for teachers.
 * Returns teaching hints, anticipated misconceptions, and scaffolding suggestions
 * scoped to the assignment's grade/subject/strand/rubric/prompt.
 *
 * Feature flag : ENABLE_ASSIGNMENT_TUTOR (default OFF → 404)
 * Auth         : TEACHER role required
 * Budget check : shared AI_BUDGET_MONTHLY_CAP_USD
 *
 * Body (JSON):
 *   grade           number   (1–12, required)
 *   subject         string   (required)
 *   strandKey       string   (required)
 *   rubric          string   (required, max 500 chars used)
 *   questionPrompt  string   (required, max 400 chars used)
 *
 * No student identifiers accepted in body.
 *
 * Audit action : "assignment.tutor.used"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import {
  isAssignmentTutorEnabled,
  getAiBudgetMonthlyCap,
} from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { recordMetricEvent } from "@/lib/metrics/events";
import { prisma } from "@/lib/db";
import { getAssignmentTutorGuidance } from "@/lib/workflows/ai/assignmentTutor";

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isAssignmentTutorEnabled()) {
      return NextResponse.json({ error: "assignment_tutor_disabled" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    const rateLimit = checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/teacher/assignment/tutor",
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before making another request" },
        { status: 429 }
      );
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
    const grade = Number(body.grade ?? 0);
    const subject = String(body.subject ?? "").trim();
    const strandKey = String(body.strandKey ?? "").trim();
    const rubric = String(body.rubric ?? "").trim();
    const questionPrompt = String(body.questionPrompt ?? "").trim();

    if (!subject || !strandKey || !rubric || !questionPrompt) {
      return NextResponse.json(
        { error: "subject, strandKey, rubric, and questionPrompt are required" },
        { status: 400 }
      );
    }
    if (grade < 1 || grade > 12 || !Number.isInteger(grade)) {
      return NextResponse.json(
        { error: "grade must be an integer 1–12" },
        { status: 400 }
      );
    }

    // ── AI call ────────────────────────────────────────────────────────────
    const result = await getAssignmentTutorGuidance({
      grade,
      subject,
      strandKey,
      rubric,
      questionPrompt,
    });

    // ── Audit log (no PII) ─────────────────────────────────────────────────
    await logAudit({
      userId: user.id,
      action: "assignment.tutor.used",
      resourceType: "assignment_tutor",
      schoolId: user.schoolId,
      traceId,
      details: {
        subject,
        strandKey,
        grade,
        hadFallback: result.hadFallback,
        // No student IDs
      },
    });

    // ── AI interaction log (no student data) ──────────────────────────────
    await (prisma as any).aiInteractionLog.create({
      data: {
        schoolId: user.schoolId ?? null,
        subject,
        strandKey,
        requestType: "assignment_tutor",
        guidanceLevel: null,
        hadFallback: result.hadFallback,
        endpoint: "/api/teacher/assignment/tutor",
        tokensUsed: result.tokensUsed,
        estimatedCostUSD: result.estimatedCostUSD,
      },
    });

    // ── Telemetry ──────────────────────────────────────────────────────────
    recordMetricEvent(
      result.hadFallback ? "assignment_tutor_fallback" : "assignment_tutor_request",
      { subject, strandKey, grade },
      { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
    ).catch(() => {});

    return NextResponse.json({
      teachingHints: result.teachingHints,
      anticipatedMisconceptions: result.anticipatedMisconceptions,
      scaffoldingSuggestions: result.scaffoldingSuggestions,
      hadFallback: result.hadFallback,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
