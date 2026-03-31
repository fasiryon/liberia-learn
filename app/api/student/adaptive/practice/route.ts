import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import { getAiBudgetMonthlyCap, isAdaptiveEngineEnabled } from "@/lib/serverFlags";
import { detectMasteryGaps } from "@/lib/adaptive/gapDetector";
import {
  computeDifficultyTier,
  type AttemptRecord,
} from "@/lib/adaptive/difficultyAdapter";
import { generateTargetedPracticeWithUsage } from "@/lib/adaptive/practiceGenerator";

export const dynamic = "force-dynamic";

type PracticeBody = {
  strandCode?: string;
  difficultyTier?: string;
};

async function getMonthlyAiSpend(): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const budgetResult = await (prisma as any).aiInteractionLog.aggregate({
    where: { timestamp: { gte: monthStart } },
    _sum: { estimatedCostUSD: true },
  });

  return (budgetResult as any)?._sum?.estimatedCostUSD ?? 0;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdaptiveEngineEnabled()) {
      return NextResponse.json({ error: "adaptive_engine_disabled" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const rateLimit = checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/student/adaptive/practice",
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before making another request" },
        { status: 429 }
      );
    }
    const student = await prisma.student.findFirst({
      where: {
        userId: user.id,
        user: { schoolId: user.schoolId ?? null },
      },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    }

    const body = (await req.json()) as PracticeBody;
    if (typeof body?.strandCode !== "string" || body.strandCode.trim().length === 0) {
      return NextResponse.json({ error: "invalid_strand_code" }, { status: 400 });
    }

    const monthlySpend = await getMonthlyAiSpend();
    const cap = getAiBudgetMonthlyCap();
    if (monthlySpend >= cap) {
      try {
        await recordMetricEvent(
          "ai.budget.cap_hit",
          { monthlySpend, cap },
          { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
        );
      } catch (error) {
        console.error("[adaptive.practice.metric.cap_hit]", error);
      }
      return NextResponse.json({ error: "ai_budget_exhausted" }, { status: 503 });
    }
    if (monthlySpend >= cap * 0.8) {
      try {
        await recordMetricEvent(
          "ai.budget.warning",
          { monthlySpend, cap },
          { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId }
        );
      } catch (error) {
        console.error("[adaptive.practice.metric.warning]", error);
      }
    }

    const gaps = await detectMasteryGaps(student.id);
    const gap = gaps.find((entry) => entry.strand === body.strandCode);
    if (!gap) {
      return NextResponse.json({ error: "gap_not_found" }, { status: 404 });
    }

    const recentAttempts = await (prisma as any).studentAdaptiveAttempt.findMany({
      where: { studentId: student.id, strandCode: body.strandCode },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { score: true, completedAt: true },
    });
    const tier = computeDifficultyTier(gap, recentAttempts as AttemptRecord[]);
    const generation = await generateTargetedPracticeWithUsage(gap, tier);

    await (prisma as any).aiInteractionLog.create({
      data: {
        schoolId: user.schoolId ?? null,
        subject: gap.subject,
        strandKey: gap.strand,
        requestType: "adaptive_practice",
        guidanceLevel: tier,
        hadFallback: false,
        endpoint: "/api/student/adaptive/practice",
        tokensUsed: generation.tokensUsed,
        estimatedCostUSD: generation.estimatedCostUSD,
      },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "student.adaptive.practice.generated",
      resourceType: "adaptive_practice",
      resourceId: gap.strand,
      details: {
        subject: gap.subject,
        difficultyTier: tier,
        requestedDifficultyTier: body.difficultyTier ?? null,
      },
    });

    return NextResponse.json({ practice: generation.practice });
  } catch (error: any) {
    console.error("[adaptive.practice.POST]", error);
    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: error?.status ?? 500 }
    );
  }
}
