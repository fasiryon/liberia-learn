import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRecommendationPrecisionAnalytics } from "@/lib/autonomous/evaluation/recommendationOutcomeTracker";
import { getPilotOutcomeAnalytics } from "@/lib/autonomous/evaluation/pilotOutcomeAnalyticsService";
import { isAutonomousEvaluationEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isAutonomousEvaluationEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const schoolId = user.isPlatformAdmin ? null : user.schoolId;
    const [precision, pilots] = await Promise.all([
      getRecommendationPrecisionAnalytics({ schoolId }),
      getPilotOutcomeAnalytics({ schoolId }),
    ]);
    return NextResponse.json({ ok: true, precision, pilots });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load evaluations" }, { status: error?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAutonomousEvaluationEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { evaluateRecommendationOutcome } = await import("@/lib/autonomous/evaluation/evaluationService");
    const result = await evaluateRecommendationOutcome({ agentDecisionId: body.agentDecisionId, actorId: user.id, isReplay: body.isReplay === true });
    return NextResponse.json({ ok: true, evaluation: result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to evaluate recommendation" }, { status: error?.status ?? 500 });
  }
}

