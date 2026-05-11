import { prisma } from "@/lib/db";
import { isFalsePositiveReviewEnabled } from "@/lib/serverFlags";
import { evaluateRecommendationOutcome } from "@/lib/autonomous/evaluation/evaluationService";

export async function markRecommendationFalsePositive(input: {
  agentDecisionId: string;
  reviewedBy: { id: string; schoolId?: string | null; isPlatformAdmin?: boolean; role?: string | null };
  reason: string;
}) {
  if (!isFalsePositiveReviewEnabled()) {
    throw Object.assign(new Error("False-positive review is disabled"), { status: 404, code: "false_positive_review_disabled" });
  }
  const decision = await (prisma as any).agentDecision.findUnique({ where: { id: input.agentDecisionId } });
  if (!decision) throw Object.assign(new Error("AgentDecision not found"), { status: 404 });
  const workflowRun = await (prisma as any).workflowRun.findUnique({ where: { id: decision.workflowRunId } });
  if (!workflowRun) throw Object.assign(new Error("WorkflowRun not found"), { status: 404 });
  if (!input.reviewedBy.isPlatformAdmin && workflowRun.schoolId && input.reviewedBy.schoolId !== workflowRun.schoolId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return evaluateRecommendationOutcome({
    agentDecisionId: input.agentDecisionId,
    actorId: input.reviewedBy.id,
    overrideOutcome: "false_positive",
  });
}

