import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateRecommendationOutcome } from "@/lib/autonomous/evaluation/evaluationService";
import { isAutonomousEvaluationEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { decisionId: string } }) {
  try {
    if (!isAutonomousEvaluationEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const decision = await (prisma as any).agentDecision.findUnique({ where: { id: params.decisionId } });
    if (!decision) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workflowRun = await (prisma as any).workflowRun.findUnique({ where: { id: decision.workflowRunId } });
    if (!user.isPlatformAdmin && workflowRun?.schoolId !== user.schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const evaluation = await evaluateRecommendationOutcome({ agentDecisionId: params.decisionId, actorId: user.id, isReplay: true });
    return NextResponse.json({ ok: true, evaluation });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load evaluation" }, { status: error?.status ?? 500 });
  }
}

