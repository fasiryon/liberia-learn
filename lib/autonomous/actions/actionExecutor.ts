import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import {
  isActionExecutionEnabled,
  isActionGovernanceEnabled,
  isAutonomousRecommendOnlyModeEnabled,
  isLowRiskAutonomyEnabled,
} from "@/lib/serverFlags";
import { inferActionTypeFromDecision } from "@/lib/autonomous/actions/actionRegistry";
import { buildActionIdempotencyKey } from "@/lib/autonomous/actions/actionIdempotencyService";
import { evaluateActionPolicy } from "@/lib/autonomous/actions/actionPolicyEngine";
import { resolveApprovalRoute } from "@/lib/autonomous/actions/approvalRoutingService";
import { getRollbackPlan } from "@/lib/autonomous/actions/actionRollbackService";
import { recordActionTrace } from "@/lib/autonomous/actions/actionTraceService";
import { transitionWorkflowStatus } from "@/lib/autonomous/workflowStateManager";
import { evaluateExecutionQuota } from "@/lib/autonomous/actions/executionQuotaService";
import { evaluateExecutionCircuit } from "@/lib/autonomous/actions/executionCircuitBreaker";
import { evaluateExecutionHealth } from "@/lib/autonomous/actions/executionHealthService";
import { enforceRollbackAvailability } from "@/lib/autonomous/actions/rollbackEnforcementService";
import type { ActionExecutionContext, ActionResult, GovernedActionType, PrepareActionInput } from "@/lib/autonomous/actions/types";

function normalizeStatus(status: string) {
  return status.toUpperCase();
}

export async function prepareActionFromRecommendation(input: PrepareActionInput) {
  if (!isActionGovernanceEnabled()) {
    throw Object.assign(new Error("Action governance is disabled"), { status: 404, code: "action_governance_disabled" });
  }

  const decision = await (prisma as any).agentDecision.findUnique({ where: { id: input.agentDecisionId } });
  if (!decision) throw Object.assign(new Error("Recommendation not found"), { status: 404 });
  const workflowRun = await (prisma as any).workflowRun.findUnique({ where: { id: decision.workflowRunId } });
  if (!workflowRun) throw Object.assign(new Error("WorkflowRun not found"), { status: 404 });

  const payload = decision.decision ?? {};
  const actionType = input.actionType ?? inferActionTypeFromDecision(decision.decisionType);
  if (workflowRun.schoolId && input.requestedBy.schoolId && workflowRun.schoolId !== input.requestedBy.schoolId) {
    throw Object.assign(new Error("Forbidden tenant scope"), { status: 403, code: "action_tenant_scope_denied" });
  }

  const policy = evaluateActionPolicy({
    actionType,
    sourceRisk: decision.riskLevel,
    targetType: payload.targetType ?? workflowRun.targetType,
    targetId: payload.targetId ?? workflowRun.targetId,
    schoolId: workflowRun.schoolId,
    districtId: workflowRun.districtId,
    decision,
  });
  const idempotencyKey = buildActionIdempotencyKey({
    agentDecisionId: decision.id,
    actionType,
    schoolId: workflowRun.schoolId,
    targetType: payload.targetType ?? workflowRun.targetType,
    targetId: payload.targetId ?? workflowRun.targetId,
  });
  const status = policy.approvalRequired ? "WAITING_APPROVAL" : "PREPARED";

  const action = (await withDbWriteThrottle("autonomous.action.prepare", () =>
    (prisma as any).actionExecution.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        workflowRunId: workflowRun.id,
        agentDecisionId: decision.id,
        actionType,
        status,
        riskLevel: policy.riskLevel,
        tenantId: workflowRun.tenantId,
        schoolId: workflowRun.schoolId,
        targetType: payload.targetType ?? workflowRun.targetType,
        targetId: payload.targetId ?? workflowRun.targetId,
        traceId: decision.traceId ?? workflowRun.traceId,
        idempotencyKey,
        rollbackStatus: "available",
        rollbackRefs: getRollbackPlan(actionType),
        inputRefs: {
          agentDecisionId: decision.id,
          workflowRunId: workflowRun.id,
          evidenceRefs: decision.evidenceRefs ?? null,
        },
        executionMetadata: {
          policy,
          payload,
          requestedByUserId: input.requestedBy.id,
          recommendationOnlySource: true,
        },
      },
    })
  )) as any;

  let approval = null;
  if (policy.approvalRequired && normalizeStatus(action.status) === "WAITING_APPROVAL") {
    const route = resolveApprovalRoute(policy);
    approval = (await withDbWriteThrottle("autonomous.action.approval", () =>
      (prisma as any).approvalRequest.upsert({
        where: { idempotencyKey: `approval:${action.id}:${route.approvalType}` },
        update: {},
        create: {
          workflowRunId: workflowRun.id,
          actionExecutionId: action.id,
          status: "PENDING",
          riskLevel: policy.riskLevel,
          approvalType: route.approvalType,
          tenantId: workflowRun.tenantId,
          schoolId: workflowRun.schoolId,
          districtId: workflowRun.districtId,
          requestedByType: "user",
          requestedById: input.requestedBy.id,
          approverRole: route.approverRole,
          traceId: action.traceId,
          idempotencyKey: `approval:${action.id}:${route.approvalType}`,
          evidenceRefs: decision.evidenceRefs ?? undefined,
          requestPayload: { actionExecutionId: action.id, actionType, policy, escalationRoute: route.escalationRoute },
          expiresAt: input.expiresAt ?? route.expiresAt,
        },
      })
    )) as any;
    await (prisma as any).actionExecution.update({
      where: { id: action.id },
      data: { approvalRequestId: approval.id },
    });
    await (prisma as any).workflowRun.update({
      where: { id: workflowRun.id },
      data: { status: "waiting_for_approval", approvalRequired: true, approvalRequestId: approval.id },
    });
  }

  await recordActionTrace({
    workflowRunId: workflowRun.id,
    actionExecutionId: action.id,
    actionType,
    status,
    traceId: action.traceId,
    schoolId: workflowRun.schoolId,
    actorId: input.requestedBy.id,
    metadata: { approvalRequestId: approval?.id ?? null, policy },
  });

  let actionExecution = { ...action, approvalRequestId: approval?.id ?? action.approvalRequestId };
  if (!policy.approvalRequired && policy.riskLevel === "low" && normalizeStatus(action.status) === "PREPARED") {
    const result = await executeLowRiskPreparedAction({ actionExecution, approvalRequest: null, actor: input.requestedBy, policy, decision, workflowRun });
    actionExecution = await markActionResult({ actionExecution, result, actorId: input.requestedBy.id });
  }

  return { actionExecution, approvalRequest: approval, policy };
}

export async function executeApprovedAction(context: ActionExecutionContext): Promise<ActionResult> {
  const { actionExecution, policy, actor } = context;
  if (!isActionExecutionEnabled() || isAutonomousRecommendOnlyModeEnabled()) {
    return { status: "APPROVED", outputRefs: { draftOnly: true, executionSkipped: "recommend_only_or_flag_disabled" } };
  }
  if (!policy.executionAllowed || policy.draftOnly) {
    return { status: "APPROVED", outputRefs: { draftOnly: true, policy } };
  }

  if (actionExecution.actionType === "student_intervention" && actionExecution.schoolId && actionExecution.targetType === "student") {
    const created = (await withDbWriteThrottle("autonomous.action.studentIntervention", () =>
      (prisma as any).interventionRecommendation.upsert({
        where: { idempotencyKey: `governed:${actionExecution.id}` },
        update: {},
        create: {
          studentId: actionExecution.targetId,
          schoolId: actionExecution.schoolId,
          recommendationType: "governed_intervention",
          reason: "Governed detector recommendation approved for teacher follow-up.",
          confidenceScore: 0.75,
          status: "pending",
          idempotencyKey: `governed:${actionExecution.id}`,
          severity: actionExecution.riskLevel,
          sourceSignal: actionExecution.actionType,
          targetType: "ActionExecution",
          targetId: actionExecution.id,
        },
      })
    )) as any;
    return { status: "EXECUTED", outputRefs: { interventionRecommendationId: created.id } };
  }

  if (actionExecution.actionType === "curriculum_gap") {
    const created = (await withDbWriteThrottle("autonomous.action.curriculumGap", () =>
      (prisma as any).curriculumFlag.upsert({
        where: { idempotencyKey: `governed:${actionExecution.id}` },
        update: {},
        create: {
          lessonId: actionExecution.targetType === "lesson" ? actionExecution.targetId : null,
          schoolId: actionExecution.schoolId,
          flagType: "FLAG_CURRICULUM_REVIEW",
          sourceSignal: "governed_detector_action",
          severity: actionExecution.riskLevel,
          status: "ACTIVE",
          idempotencyKey: `governed:${actionExecution.id}`,
          details: { actionExecutionId: actionExecution.id, approvedBy: actor?.id ?? null },
        },
      })
    )) as any;
    return { status: "EXECUTED", outputRefs: { curriculumFlagId: created.id } };
  }

  return { status: "APPROVED", outputRefs: { draftOnly: true, actionType: actionExecution.actionType } };
}

export async function executeLowRiskPreparedAction(context: ActionExecutionContext): Promise<ActionResult> {
  const { actionExecution, policy, actor } = context;
  if (!isActionExecutionEnabled() || isAutonomousRecommendOnlyModeEnabled() || !isLowRiskAutonomyEnabled()) {
    return { status: "APPROVED", outputRefs: { draftOnly: true, executionSkipped: "low_risk_flag_disabled_or_recommend_only" } };
  }
  if (policy.riskLevel !== "low" || policy.approvalRequired || policy.draftOnly || !policy.executionAllowed) {
    return { status: "APPROVED", outputRefs: { draftOnly: true, executionSkipped: "policy_not_low_risk_executable", policy } };
  }

  const rollback = await enforceRollbackAvailability(actionExecution);
  if (!rollback.allowed) {
    return { status: "APPROVED", outputRefs: { draftOnly: true, executionSkipped: "rollback_unavailable", rollback } };
  }

  const [quota, circuit, health] = await Promise.all([
    evaluateExecutionQuota({ actionType: actionExecution.actionType, schoolId: actionExecution.schoolId }),
    evaluateExecutionCircuit({ actionType: actionExecution.actionType, schoolId: actionExecution.schoolId }),
    evaluateExecutionHealth({ schoolId: actionExecution.schoolId }),
  ]);
  const failedGuard = [quota, circuit, health].find((guard) => !guard.allowed);
  if (failedGuard) {
    return {
      status: "APPROVED",
      outputRefs: { draftOnly: true, executionSkipped: failedGuard.reason, guards: { quota, circuit, health } },
    };
  }

  const timeoutMs = Number(process.env.LOW_RISK_AUTONOMY_EXECUTION_TIMEOUT_MS ?? 5000);
  const started = Date.now();
  const result = await executeLowRiskPilotDomainWrite(context);
  const durationMs = Date.now() - started;
  if (durationMs > timeoutMs) {
    return { status: "FAILED", outputRefs: { failureReason: "execution_timeout", durationMs, timeoutMs } };
  }
  return {
    ...result,
    outputRefs: {
      ...(result.outputRefs ?? {}),
      lowRiskPilot: true,
      executedBy: actor?.id ?? "system",
      guards: { quota, circuit, health },
      durationMs,
    },
  };
}

async function executeLowRiskPilotDomainWrite(context: ActionExecutionContext): Promise<ActionResult> {
  const { actionExecution, actor } = context;
  if (actionExecution.actionType === "teacher_support") {
    return { status: "EXECUTED", outputRefs: { artifactType: "teacher_support_summary", targetType: actionExecution.targetType, targetId: actionExecution.targetId } };
  }
  if (actionExecution.actionType === "school_compliance") {
    return { status: "EXECUTED", outputRefs: { artifactType: "operational_analytics_summary", targetType: "school", targetId: actionExecution.schoolId ?? actionExecution.targetId } };
  }
  if (actionExecution.actionType === "curriculum_gap") {
    const created = (await withDbWriteThrottle("autonomous.action.lowRiskCurriculumReview", () =>
      (prisma as any).curriculumFlag.upsert({
        where: { idempotencyKey: `low-risk:${actionExecution.id}` },
        update: {},
        create: {
          lessonId: actionExecution.targetType === "lesson" ? actionExecution.targetId : null,
          schoolId: actionExecution.schoolId,
          flagType: "DRAFT_CURRICULUM_REVIEW_TASK",
          sourceSignal: "low_risk_governed_action",
          severity: "low",
          status: "DRAFT",
          idempotencyKey: `low-risk:${actionExecution.id}`,
          details: { actionExecutionId: actionExecution.id, preparedBy: actor?.id ?? null, draftOnly: true },
        },
      })
    )) as any;
    return { status: "EXECUTED", outputRefs: { curriculumFlagId: created.id, artifactType: "internal_curriculum_review_task" } };
  }
  return { status: "APPROVED", outputRefs: { draftOnly: true, unsupportedLowRiskPilot: actionExecution.actionType } };
}

export async function markActionResult(input: {
  actionExecution: any;
  result: ActionResult;
  actorId?: string | null;
}) {
  const updated = (await withDbWriteThrottle("autonomous.action.result", () =>
    (prisma as any).actionExecution.update({
      where: { id: input.actionExecution.id },
      data: {
        status: input.result.status,
        outputRefs: input.result.outputRefs ?? undefined,
        completedAt: input.result.status === "EXECUTED" || input.result.status === "APPROVED" ? new Date() : null,
      },
    })
  )) as any;
  await recordActionTrace({
    workflowRunId: updated.workflowRunId,
    actionExecutionId: updated.id,
    actionType: updated.actionType,
    status: input.result.status,
    traceId: updated.traceId,
    schoolId: updated.schoolId,
    actorId: input.actorId ?? null,
    metadata: input.result.outputRefs ?? {},
  });
  if (input.result.status === "EXECUTED") {
    await transitionWorkflowStatus({ workflowRunId: updated.workflowRunId, status: "succeeded" });
  }
  return updated;
}
