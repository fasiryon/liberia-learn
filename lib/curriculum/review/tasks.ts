import type { CurriculumReviewPriorityBand, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { evaluateReviewPolicy, type ReviewPolicyInput } from "./policy";
import { ReviewOperationError } from "./errors";
import { logAuditRequired } from "@/lib/audit";

export async function enqueueCurriculumReviewTask(input: {
  provenanceId: string;
  revisionId: string;
  riskBand: CurriculumReviewPriorityBand;
  riskScore?: number | null;
  riskReasons?: string[];
  requestedAuthority: ReviewPolicyInput["requestedAuthority"];
  nationalPublication?: boolean;
  waecAuthoritative?: boolean;
  importedOrLicensed?: boolean;
  sourceRightsRequired?: boolean;
  reinstatementAfterRevocation?: boolean;
  emergencyRevocation?: boolean;
  policyException?: boolean;
  schoolId?: string | null;
  createdByUserId?: string | null;
  idempotencyKey: string;
  now?: Date;
}) {
  const root = await prisma.curriculumProvenance.findUnique({
    where: { id: input.provenanceId },
    include: {
      curriculumContent: true,
      currentRevision: { include: { evidence: { where: { status: "ACTIVE" }, select: { id: true } } } },
    },
  });
  if (!root || !root.currentRevision || root.currentRevision.id !== input.revisionId) {
    throw new ReviewOperationError("REVISION_STALE", 409);
  }
  if (input.schoolId && root.curriculumContent.schoolId && input.schoolId !== root.curriculumContent.schoolId) {
    throw new ReviewOperationError("SCHOOL_SCOPE_MISMATCH", 404);
  }
  const policyInputs: ReviewPolicyInput = {
    subject: root.curriculumContent.subject,
    grade: root.curriculumContent.grade,
    contentType: root.curriculumContent.contentType,
    requestedAuthority: input.requestedAuthority,
    riskBand: input.riskBand,
    riskScore: input.riskScore,
    riskReasons: input.riskReasons,
    nationalPublication: input.nationalPublication,
    waecAuthoritative: input.waecAuthoritative,
    importedOrLicensed: input.importedOrLicensed,
    sourceRightsRequired: input.sourceRightsRequired,
    reinstatementAfterRevocation: input.reinstatementAfterRevocation,
    emergencyRevocation: input.emergencyRevocation,
    policyException: input.policyException,
    provenanceComplete: root.provenanceCompleteness !== "UNVERIFIED",
    evidenceCount: root.currentRevision.evidence.length,
    now: input.now,
  };
  const policy = evaluateReviewPolicy(policyInputs);
  return prisma.curriculumReviewTask.create({
    data: {
      provenanceId: input.provenanceId,
      revisionId: input.revisionId,
      policyKey: policy.policyKey,
      policyVersion: policy.policyVersion,
      rubricKey: policy.rubricKey,
      rubricVersion: policy.rubricVersion,
      priorityBand: policy.priorityBand,
      priorityScore: policy.priorityScore,
      priorityReasons: policy.priorityReasons,
      riskScore: input.riskScore ?? null,
      riskReasons: input.riskReasons ?? [],
      requiredAuthority: policy.requiredAuthority,
      requiredReviewCount: policy.requiredReviewCount,
      specialistRequirements: {
        credentialTypes: policy.specialistCredentialTypes,
        calibrationRequired: policy.specialistCredentialTypes.length > 0,
        policyInputs: {
          nationalPublication: Boolean(input.nationalPublication),
          waecAuthoritative: Boolean(input.waecAuthoritative),
          importedOrLicensed: Boolean(input.importedOrLicensed),
          sourceRightsRequired: Boolean(input.sourceRightsRequired),
          reinstatementAfterRevocation: Boolean(input.reinstatementAfterRevocation),
          emergencyRevocation: Boolean(input.emergencyRevocation),
          policyException: Boolean(input.policyException),
        },
      } satisfies Prisma.InputJsonValue,
      blindSecondReview: policy.blindSecondReview,
      evidenceRequirements: {
        required: policy.evidenceRequired,
        reasonCodes: policy.evidenceReasonCodes,
        approvalBlocked: policy.approvalBlocked,
      },
      schoolId: input.schoolId ?? root.curriculumContent.schoolId ?? null,
      dueAt: policy.dueAt,
      createdByUserId: input.createdByUserId ?? null,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function cancelTasksForSupersededRevisions(provenanceId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CurriculumProvenance" WHERE "id" = ${provenanceId} FOR UPDATE`;
    const root = await tx.curriculumProvenance.findUniqueOrThrow({ where: { id: provenanceId } });
    const cancelled = await tx.curriculumReviewTask.updateMany({
      where: {
        provenanceId,
        revisionId: { not: root.currentRevisionId ?? "__none__" },
        status: { in: ["QUEUED", "CLAIMED", "IN_REVIEW", "AWAITING_SECOND_REVIEW", "DISAGREEMENT", "ESCALATED"] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledReason: "SUPERSEDED_REVISION",
        version: { increment: 1 },
      },
    });
    return cancelled.count;
  });
}

export async function listReviewQueue(input: {
  schoolId?: string | null;
  authority?: ReviewPolicyInput["requestedAuthority"];
  limit?: number;
}) {
  return prisma.curriculumReviewTask.findMany({
    where: {
      status: { in: ["QUEUED", "CLAIMED", "IN_REVIEW", "AWAITING_SECOND_REVIEW", "DISAGREEMENT", "ESCALATED"] },
      ...(input.schoolId !== undefined ? { schoolId: input.schoolId } : {}),
      ...(input.authority ? { requiredAuthority: input.authority } : {}),
    },
    orderBy: [
      { priorityBand: "asc" },
      { priorityScore: "desc" },
      { dueAt: "asc" },
      { createdAt: "asc" },
    ],
    take: Math.min(Math.max(input.limit ?? 50, 1), 200),
    include: {
      provenance: { include: { curriculumContent: { select: { contentId: true, title: true, subject: true, grade: true, contentType: true } } } },
      assignments: { where: { status: "ACTIVE" }, select: { slot: true, leaseExpiresAt: true } },
    },
  });
}

export async function reprioritizeReviewTask(input: {
  taskId: string;
  expectedVersion: number;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CurriculumReviewTask" WHERE "id" = ${input.taskId} FOR UPDATE`;
    const task = await tx.curriculumReviewTask.findUnique({
      where: { id: input.taskId },
      include: { provenance: { include: { curriculumContent: true } }, revision: { include: { evidence: { where: { status: "ACTIVE" }, select: { id: true } } } } },
    });
    if (!task) throw new ReviewOperationError("TASK_NOT_FOUND", 404);
    if (task.provenance.currentRevisionId !== task.revisionId) throw new ReviewOperationError("REVISION_STALE", 409);
    const flags = (task.specialistRequirements as { policyInputs?: Record<string, boolean> } | null)?.policyInputs ?? {};
    const policy = evaluateReviewPolicy({
      subject: task.provenance.curriculumContent.subject,
      grade: task.provenance.curriculumContent.grade,
      contentType: task.provenance.curriculumContent.contentType,
      requestedAuthority: task.requiredAuthority,
      riskBand: task.priorityBand,
      riskScore: task.riskScore,
      riskReasons: task.riskReasons,
      nationalPublication: flags.nationalPublication,
      waecAuthoritative: flags.waecAuthoritative,
      importedOrLicensed: flags.importedOrLicensed,
      sourceRightsRequired: flags.sourceRightsRequired,
      reinstatementAfterRevocation: flags.reinstatementAfterRevocation,
      emergencyRevocation: flags.emergencyRevocation,
      policyException: flags.policyException,
      provenanceComplete: task.provenance.provenanceCompleteness !== "UNVERIFIED",
      evidenceCount: task.revision.evidence.length,
      now: task.createdAt,
    });
    const changed = await tx.curriculumReviewTask.updateMany({
      where: { id: task.id, version: input.expectedVersion },
      data: {
        priorityScore: policy.priorityScore,
        priorityReasons: policy.priorityReasons,
        dueAt: policy.dueAt,
        evidenceRequirements: { required: policy.evidenceRequired, reasonCodes: policy.evidenceReasonCodes, approvalBlocked: policy.approvalBlocked },
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ReviewOperationError("TASK_VERSION_CONFLICT", 409);
    await logAuditRequired({ userId: input.actorUserId, action: "curriculum.review.task.reprioritized", resourceType: "review_task", resourceId: task.id, schoolId: task.schoolId, details: { priorityBand: task.priorityBand, priorityScore: policy.priorityScore } }, tx);
    return tx.curriculumReviewTask.findUniqueOrThrow({ where: { id: task.id } });
  });
}

export async function cancelReviewTask(input: {
  taskId: string;
  expectedVersion: number;
  actorUserId: string;
  reason: string;
  idempotencyKey: string;
}) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.curriculumReviewTask.findUnique({ where: { id: input.taskId } });
    if (!task) throw new ReviewOperationError("TASK_NOT_FOUND", 404);
    const changed = await tx.curriculumReviewTask.updateMany({
      where: { id: task.id, version: input.expectedVersion, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: input.reason, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ReviewOperationError("TASK_VERSION_CONFLICT", 409);
    await tx.curriculumReviewAssignment.updateMany({ where: { taskId: task.id, status: "ACTIVE" }, data: { status: "OVERRIDDEN", releasedAt: new Date(), releaseReason: "TASK_CANCELLED", version: { increment: 1 } } });
    await logAuditRequired({ userId: input.actorUserId, action: "curriculum.review.task.cancelled", resourceType: "review_task", resourceId: task.id, schoolId: task.schoolId, details: { reason: input.reason, idempotencyKey: input.idempotencyKey } }, tx);
  });
}
