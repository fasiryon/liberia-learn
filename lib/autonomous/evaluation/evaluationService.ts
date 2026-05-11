import { prisma } from "@/lib/db";
import { isAutonomousEvaluationEnabled } from "@/lib/serverFlags";
import { CONFIDENCE_CALIBRATION_VERSION, calibrateConfidence, precisionFromOutcome, scoreEvidenceCoverage } from "@/lib/autonomous/evaluation/confidenceCalibrationService";
import { measureInterventionEffectiveness } from "@/lib/autonomous/evaluation/interventionEffectivenessEngine";
import { recordEvaluationTrace } from "@/lib/autonomous/evaluation/evaluationTraceService";
import type { RecommendationEvaluation } from "@/lib/autonomous/evaluation/types";

function detectorIdFromDecision(decision: any) {
  return decision?.decision?.detectorId ?? (String(decision?.decisionType ?? "").replace("detector.recommendation.", "") || null);
}

function inferOutcome(input: { decision: any; action?: any | null; approval?: any | null }): RecommendationEvaluation["outcome"] {
  if (input.approval?.status === "REJECTED" || input.action?.status === "REJECTED") return "rejected";
  if (input.action?.status === "EXECUTED") return "executed";
  if (input.approval?.status === "APPROVED" || input.action?.status === "APPROVED") return "accepted";
  return "no_action";
}

export async function evaluateRecommendationOutcome(input: {
  agentDecisionId: string;
  actorId?: string | null;
  isReplay?: boolean;
  overrideOutcome?: RecommendationEvaluation["outcome"];
}) {
  if (!isAutonomousEvaluationEnabled()) {
    throw Object.assign(new Error("Autonomous evaluation is disabled"), { status: 404, code: "autonomous_evaluation_disabled" });
  }
  const decision = await (prisma as any).agentDecision.findUnique({ where: { id: input.agentDecisionId } });
  if (!decision) throw Object.assign(new Error("AgentDecision not found"), { status: 404 });
  const workflowRun = await (prisma as any).workflowRun.findUnique({ where: { id: decision.workflowRunId } });
  if (!workflowRun) throw Object.assign(new Error("WorkflowRun not found"), { status: 404 });
  const action = await (prisma as any).actionExecution.findFirst({ where: { agentDecisionId: decision.id }, orderBy: { createdAt: "desc" } });
  const approval = action?.approvalRequestId
    ? await (prisma as any).approvalRequest.findUnique({ where: { id: action.approvalRequestId } })
    : null;

  const outcome = input.overrideOutcome ?? inferOutcome({ decision, action, approval });
  const evidenceCoverageScore = scoreEvidenceCoverage(decision.evidenceRefs);
  const interventionEffectiveness = await measureInterventionEffectiveness({
    studentId: action?.targetType === "student" ? action.targetId : workflowRun.targetType === "student" ? workflowRun.targetId : null,
    schoolId: workflowRun.schoolId,
    actionExecutionId: action?.id ?? null,
  });
  const effectivenessScore = outcome === "executed" || outcome === "accepted" ? interventionEffectiveness.effectivenessScore : precisionFromOutcome(outcome);
  const confidenceBefore = Number(decision.confidence ?? 0.5);
  const confidenceAfter = calibrateConfidence({ confidenceBefore, outcome, evidenceCoverageScore, effectivenessScore });
  const evaluation: RecommendationEvaluation = {
    agentDecisionId: decision.id,
    workflowRunId: workflowRun.id,
    detectorId: detectorIdFromDecision(decision),
    decisionType: decision.decisionType,
    outcome,
    confidenceBefore,
    confidenceAfter,
    precisionScore: precisionFromOutcome(outcome),
    evidenceCoverageScore,
    effectivenessScore,
    riskLevel: decision.riskLevel ?? "low",
    evaluationVersion: CONFIDENCE_CALIBRATION_VERSION,
    lineage: {
      workflowRunId: workflowRun.id,
      agentDecisionId: decision.id,
      actionExecutionId: action?.id ?? null,
      approvalRequestId: approval?.id ?? null,
      evidenceRefs: decision.evidenceRefs ?? null,
      interventionEffectiveness,
    },
    explanation: "Deterministic evaluation from approval/action outcome, evidence coverage, and available mastery delta.",
  };
  await recordEvaluationTrace({
    evaluation,
    schoolId: workflowRun.schoolId,
    districtId: workflowRun.districtId,
    traceId: decision.traceId ?? workflowRun.traceId,
    actorId: input.actorId ?? null,
    isReplay: input.isReplay === true,
  });
  return evaluation;
}
