import { prisma } from "@/lib/db";
import { recordPostChangeMetrics } from "@/lib/autonomous/optimization/postChangeEvaluationService";
import { completeFeedbackLoop } from "@/lib/autonomous/optimization/feedbackLoopCompletionService";

function windowComplete(createdAt: Date, days: number) {
  return Date.now() >= createdAt.getTime() + days * 24 * 60 * 60 * 1000;
}

export async function processDueEvaluationWindows(input: {
  limit?: number;
  actorId?: string | null;
  now?: Date;
} = {}) {
  const plans = await (prisma as any).postChangeEvaluationPlan.findMany({
    where: { feedbackLoopStatus: { not: "COMPLETE" } },
    orderBy: { createdAt: "asc" },
    take: input.limit ?? 25,
    include: { changeRequest: true },
  });
  const results = [];
  for (const plan of plans) {
    const complete = windowComplete(plan.createdAt, plan.evaluationWindowDays);
    if (!complete) {
      results.push({ evaluationPlanId: plan.id, status: "window_open" });
      continue;
    }
    const updated: any = await recordPostChangeMetrics({ evaluationPlanId: plan.id, actorId: input.actorId ?? null });
    const closed = await completeFeedbackLoop({ evaluationPlanId: updated.id, actorId: input.actorId ?? null });
    results.push({ evaluationPlanId: plan.id, status: "closed", findings: closed.findings.findings });
  }
  return results;
}
