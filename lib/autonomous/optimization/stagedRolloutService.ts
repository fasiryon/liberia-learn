import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";
import { recordConfigChangeAudit } from "@/lib/autonomous/optimization/configChangeAuditService";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export type RolloutActor = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

// Stage order — every stage is MANUAL_IMPLEMENTATION_REQUIRED.
const ROLLOUT_STAGES = [
  {
    stage: "INTERNAL_ONLY",
    description: "Review configuration plan internally. Validate plan documents, rollback procedure, and reviewer instructions before any external deployment.",
    requiresManualImplementation: true,
    verificationRequired: true,
  },
  {
    stage: "SINGLE_SCHOOL",
    description: "Deploy plan artifacts to a single pilot school environment. Human operator applies changes and verifies outcome.",
    requiresManualImplementation: true,
    verificationRequired: true,
  },
  {
    stage: "LIMITED_TENANT_GROUP",
    description: "Extend to a small group of verified tenant schools. Human operator applies changes and verifies outcome for each.",
    requiresManualImplementation: true,
    verificationRequired: true,
  },
  {
    stage: "DISTRICT_AGGREGATE",
    description: "Apply to district-level aggregate configuration. Verify aggregate-only, no raw PII exposure.",
    requiresManualImplementation: true,
    verificationRequired: true,
  },
  {
    stage: "NATIONAL_AGGREGATE_REVIEW",
    description: "Final national aggregate review. MOE sign-off required before any national-scope application.",
    requiresManualImplementation: true,
    verificationRequired: true,
  },
];

function ensureEnabled() {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }
}

function canManageRollout(changeRequest: any, actor: RolloutActor) {
  if (actor.isPlatformAdmin) return true;
  if (changeRequest.schoolId) return actor.role === "ADMIN" && actor.schoolId === changeRequest.schoolId;
  return actor.role === "MOE_SUPER_ADMIN";
}

export async function prepareStagedRolloutPlan(input: {
  changeRequestId: string;
  actor: RolloutActor;
  traceId?: string | null;
}) {
  ensureEnabled();
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.changeRequestId } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (!canManageRollout(changeRequest, input.actor)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (changeRequest.status !== "APPROVED_FOR_ROLLOUT") {
    throw Object.assign(new Error(`Cannot prepare rollout plan: change request status is ${changeRequest.status}, must be APPROVED_FOR_ROLLOUT`), { status: 422 });
  }

  const existing = await (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId: input.changeRequestId } });
  if (existing) return existing;

  const rollbackPlan = changeRequest.rollbackPlan ?? {};
  const plan: any = await withDbWriteThrottle("implementation.rolloutPlan", () =>
    (prisma as any).stagedRolloutPlan.create({
      data: {
        changeRequestId: input.changeRequestId,
        currentStage: "INTERNAL_ONLY",
        stages: ROLLOUT_STAGES.map((s) => ({ ...s, status: "pending" })),
        status: "DRAFT",
        requiresManualImplementation: true,
        rollbackTrigger: rollbackPlan.rollbackTrigger ?? "Any validation failure, reviewer concern, or tenant safety issue.",
        rollbackOwner: rollbackPlan.rollbackOwner ?? "platform_admin",
        rollbackSteps: rollbackPlan.steps ?? [],
        rollbackVerificationChecklist: [
          "Confirm all partially applied changes have been reversed",
          "Verify detector/policy outputs match pre-change baseline",
          "Confirm no tenant safety issues remain",
          "Run evaluation layer queries to confirm metric restoration",
          "Record rollback verification with timestamp and actor",
        ],
        expectedRestoredState: rollbackPlan.expectedRestoredState ?? { status: "pre-change baseline restored", policyMutation: false },
        traceId: input.traceId ?? null,
        createdBy: input.actor.id,
      },
    })
  );

  await withDbWriteThrottle("implementation.cr.rolling_out", () =>
    (prisma as any).optimizationChangeRequest.update({
      where: { id: input.changeRequestId },
      data: { status: "ROLLING_OUT", implementationStatus: "IN_PROGRESS", updatedAt: new Date() },
    })
  );

  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "rollout_plan.created",
    changeRequestId: input.changeRequestId,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    traceId: input.traceId ?? null,
    schoolId: changeRequest.schoolId,
    details: { planId: plan.id, stages: ROLLOUT_STAGES.map((s) => s.stage), requiresManualImplementation: true },
  });

  return plan as any;
}

export async function pauseRollout(input: { changeRequestId: string; actor: RolloutActor; reason?: string }) {
  ensureEnabled();
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.changeRequestId } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (!canManageRollout(changeRequest, input.actor)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (changeRequest.status !== "ROLLING_OUT") {
    throw Object.assign(new Error("Cannot pause: rollout is not active"), { status: 422 });
  }
  const updated: any = await withDbWriteThrottle("implementation.cr.pause", () =>
    (prisma as any).optimizationChangeRequest.update({ where: { id: input.changeRequestId }, data: { status: "ROLLOUT_PAUSED", updatedAt: new Date() } })
  );
  await withDbWriteThrottle("implementation.plan.pause", () =>
    (prisma as any).stagedRolloutPlan.updateMany({ where: { changeRequestId: input.changeRequestId }, data: { status: "PAUSED", updatedAt: new Date() } })
  );
  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "rollout.paused",
    changeRequestId: input.changeRequestId,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    schoolId: changeRequest.schoolId,
    details: { reason: input.reason ?? null },
  });
  return updated;
}

export async function cancelRollout(input: { changeRequestId: string; actor: RolloutActor; reason?: string }) {
  ensureEnabled();
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.changeRequestId } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (!canManageRollout(changeRequest, input.actor)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  const cancellableStatuses = ["ROLLING_OUT", "ROLLOUT_PAUSED", "APPROVED_FOR_ROLLOUT"];
  if (!cancellableStatuses.includes(changeRequest.status)) {
    throw Object.assign(new Error(`Cannot cancel rollout in status ${changeRequest.status}`), { status: 422 });
  }
  const updated: any = await withDbWriteThrottle("implementation.cr.cancel-rollout", () =>
    (prisma as any).optimizationChangeRequest.update({ where: { id: input.changeRequestId }, data: { status: "CANCELLED", updatedAt: new Date() } })
  );
  await withDbWriteThrottle("implementation.plan.cancel", () =>
    (prisma as any).stagedRolloutPlan.updateMany({ where: { changeRequestId: input.changeRequestId }, data: { status: "CANCELLED", updatedAt: new Date() } })
  );
  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "rollout.cancelled",
    changeRequestId: input.changeRequestId,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    schoolId: changeRequest.schoolId,
    details: { reason: input.reason ?? null, previousStatus: changeRequest.status },
  });
  return updated;
}

export async function getRolloutPlan(changeRequestId: string) {
  return (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId } });
}
