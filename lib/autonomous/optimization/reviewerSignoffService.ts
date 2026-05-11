import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";
import { recordConfigChangeAudit } from "@/lib/autonomous/optimization/configChangeAuditService";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export type SignoffActor = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

// Map actor role to internal signoff role string.
function resolveSignoffRole(actor: SignoffActor, changeRequest: any): string | null {
  if (actor.isPlatformAdmin) return "platform_admin";
  const role = actor.role ?? "";
  if (role === "ADMIN" && changeRequest.schoolId && actor.schoolId === changeRequest.schoolId) return "school_admin";
  if (role === "MOE_SUPER_ADMIN") return "governance_reviewer";
  if (role === "MOE_OFFICIAL" && !changeRequest.schoolId) return "governance_reviewer";
  if (role === "CURRICULUM_ADMIN") return "curriculum_reviewer";
  return null;
}

function canSignoff(actor: SignoffActor, changeRequest: any): boolean {
  const role = resolveSignoffRole(actor, changeRequest);
  if (!role) return false;
  const required: string[] = changeRequest.requiredReviewerRoles ?? [];
  return required.includes(role);
}

export async function recordReviewerSignoff(input: {
  changeRequestId: string;
  actor: SignoffActor;
  decision: "APPROVED" | "REJECTED";
  comment?: string | null;
  traceId?: string | null;
}) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({
    where: { id: input.changeRequestId },
    include: { signoffs: true },
  });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (changeRequest.status !== "PENDING_REVIEW") {
    throw Object.assign(new Error(`Change request is not pending review (status: ${changeRequest.status})`), { status: 422 });
  }
  if (!canSignoff(input.actor, changeRequest)) {
    throw Object.assign(new Error("Forbidden: your role is not required for this change request"), { status: 403 });
  }

  const signoffRole = resolveSignoffRole(input.actor, changeRequest)!;
  const idempotencyKey = `signoff:${input.changeRequestId}:${input.actor.id}:${signoffRole}`;

  const existing = await (prisma as any).changeRequestSignoff.findUnique({ where: { idempotencyKey } });
  if (existing) {
    throw Object.assign(new Error("You have already signed off on this change request"), { status: 409 });
  }

  const signoff = await withDbWriteThrottle("implementation.signoff", () =>
    (prisma as any).changeRequestSignoff.create({
      data: {
        changeRequestId: input.changeRequestId,
        reviewerUserId: input.actor.id,
        reviewerRole: signoffRole,
        schoolId: changeRequest.schoolId,
        decision: input.decision,
        comment: input.comment ?? null,
        decidedAt: new Date(),
        traceId: input.traceId ?? null,
        idempotencyKey,
      },
    })
  );

  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: `signoff.${input.decision.toLowerCase()}`,
    changeRequestId: input.changeRequestId,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    traceId: input.traceId ?? null,
    schoolId: changeRequest.schoolId,
    details: { signoffRole, decision: input.decision, comment: input.comment ?? null },
  });

  // If the actor rejected, immediately set the change request to REJECTED.
  if (input.decision === "REJECTED") {
    await withDbWriteThrottle("implementation.cr.reject", () =>
      (prisma as any).optimizationChangeRequest.update({
        where: { id: input.changeRequestId },
        data: { status: "REJECTED", updatedAt: new Date() },
      })
    );
    await logLearningEvent(
      {
        workflowTraceId: input.traceId ?? null,
        schoolId: changeRequest.schoolId,
        actor: { type: "user", id: input.actor.id, role: input.actor.role },
        target: { type: "OptimizationChangeRequest", id: input.changeRequestId },
        eventType: "autonomous.implementation.change_request.rejected",
        source: "autonomous.implementation",
        status: "REJECTED",
        metadata: { changeRequestId: input.changeRequestId, signoffRole, policyMutation: false },
      },
      { throwOnError: true }
    );
    return { signoff, changeRequest: { ...changeRequest, status: "REJECTED" }, allApproved: false };
  }

  // Check if all required roles have now approved.
  const allSignoffs = await (prisma as any).changeRequestSignoff.findMany({ where: { changeRequestId: input.changeRequestId } });
  const approvedRoles = new Set(allSignoffs.filter((s: any) => s.decision === "APPROVED").map((s: any) => s.reviewerRole));
  const required: string[] = changeRequest.requiredReviewerRoles ?? [];
  const allApproved = required.every((r) => approvedRoles.has(r));

  if (allApproved) {
    await withDbWriteThrottle("implementation.cr.approve", () =>
      (prisma as any).optimizationChangeRequest.update({
        where: { id: input.changeRequestId },
        data: { status: "APPROVED_FOR_ROLLOUT", updatedAt: new Date() },
      })
    );
    await logLearningEvent(
      {
        workflowTraceId: input.traceId ?? null,
        schoolId: changeRequest.schoolId,
        actor: { type: "system", id: "reviewerSignoffService" },
        target: { type: "OptimizationChangeRequest", id: input.changeRequestId },
        eventType: "autonomous.implementation.change_request.approved_for_rollout",
        source: "autonomous.implementation",
        status: "APPROVED_FOR_ROLLOUT",
        metadata: { changeRequestId: input.changeRequestId, approvedRoles: [...approvedRoles], policyMutation: false },
      },
      { throwOnError: true }
    );
  }

  return { signoff, changeRequest: { ...changeRequest, status: allApproved ? "APPROVED_FOR_ROLLOUT" : "PENDING_REVIEW" }, allApproved };
}

export async function listSignoffs(input: { changeRequestId: string }) {
  return (prisma as any).changeRequestSignoff.findMany({
    where: { changeRequestId: input.changeRequestId },
    orderBy: { createdAt: "asc" },
  });
}
