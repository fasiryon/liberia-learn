import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";
import { recordConfigChangeAudit } from "@/lib/autonomous/optimization/configChangeAuditService";

export type VerificationActor = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

export async function recordRolloutVerification(input: {
  changeRequestId: string;
  actor: VerificationActor;
  stage: string;
  outcome: "PASSED" | "FAILED" | "PARTIAL";
  notes: string;
  checkedAt?: Date;
  traceId?: string | null;
}) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }

  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.changeRequestId } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });

  if (!input.actor.isPlatformAdmin && !(changeRequest.schoolId && input.actor.role === "ADMIN" && input.actor.schoolId === changeRequest.schoolId)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  if (!["ROLLING_OUT", "ROLLOUT_PAUSED"].includes(changeRequest.status)) {
    throw Object.assign(new Error(`Cannot record verification: change request status is ${changeRequest.status}`), { status: 422 });
  }

  const plan = await (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId: input.changeRequestId } });
  if (!plan) throw Object.assign(new Error("Staged rollout plan not found — prepare rollout plan first"), { status: 422 });

  const verificationRecord = {
    stage: input.stage,
    outcome: input.outcome,
    notes: input.notes,
    verifiedBy: input.actor.id,
    verifiedAt: (input.checkedAt ?? new Date()).toISOString(),
    traceId: input.traceId ?? null,
  };

  const updatedPlan = await withDbWriteThrottle("implementation.rollout.verify", () =>
    (prisma as any).stagedRolloutPlan.update({
      where: { changeRequestId: input.changeRequestId },
      data: {
        rolloutVerification: verificationRecord,
        status: input.outcome === "PASSED" ? "ROLLOUT_VERIFIED" : "PAUSED",
        updatedAt: new Date(),
      },
    })
  );

  if (input.outcome === "PASSED") {
    await withDbWriteThrottle("implementation.cr.rollout-verified", () =>
      (prisma as any).optimizationChangeRequest.update({
        where: { id: input.changeRequestId },
        data: { status: "ROLLOUT_VERIFIED", updatedAt: new Date() },
      })
    );
  }

  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "rollout.verified",
    changeRequestId: input.changeRequestId,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    schoolId: changeRequest.schoolId,
    traceId: input.traceId ?? null,
    details: { stage: input.stage, outcome: input.outcome, notes: input.notes },
  });

  return { plan: updatedPlan, verificationRecord };
}
