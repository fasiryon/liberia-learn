import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";
import { recordConfigChangeAudit } from "@/lib/autonomous/optimization/configChangeAuditService";

export type RollbackVerificationActor = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

export async function recordRollbackVerification(input: {
  changeRequestId: string;
  actor: RollbackVerificationActor;
  checklistResults: Record<string, boolean>;
  restoredStateConfirmed: boolean;
  notes: string;
  traceId?: string | null;
}) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }

  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.changeRequestId } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });

  if (!input.actor.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden: rollback verification requires platform admin"), { status: 403 });
  }

  const plan = await (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId: input.changeRequestId } });
  if (!plan) throw Object.assign(new Error("Staged rollout plan not found"), { status: 422 });

  const allChecklistPassed = Object.values(input.checklistResults).every(Boolean);

  const verificationRecord = {
    checklistResults: input.checklistResults,
    allChecklistPassed,
    restoredStateConfirmed: input.restoredStateConfirmed,
    notes: input.notes,
    verifiedBy: input.actor.id,
    verifiedAt: new Date().toISOString(),
    traceId: input.traceId ?? null,
  };

  const updatedPlan = await withDbWriteThrottle("implementation.rollback.verify", () =>
    (prisma as any).stagedRolloutPlan.update({
      where: { changeRequestId: input.changeRequestId },
      data: {
        rollbackVerification: verificationRecord,
        status: allChecklistPassed && input.restoredStateConfirmed ? "ROLLBACK_VERIFIED" : "PAUSED",
        updatedAt: new Date(),
      },
    })
  );

  if (allChecklistPassed && input.restoredStateConfirmed) {
    await withDbWriteThrottle("implementation.cr.rolled-back", () =>
      (prisma as any).optimizationChangeRequest.update({
        where: { id: input.changeRequestId },
        data: { status: "ROLLED_BACK", implementationStatus: "ROLLED_BACK", updatedAt: new Date() },
      })
    );
  }

  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "rollback.verified",
    changeRequestId: input.changeRequestId,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    schoolId: changeRequest.schoolId,
    traceId: input.traceId ?? null,
    details: { allChecklistPassed, restoredStateConfirmed: input.restoredStateConfirmed, notes: input.notes },
  });

  return { plan: updatedPlan, verificationRecord };
}
