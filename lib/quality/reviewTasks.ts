import type {
  CurriculumReviewAuthority,
  QualityReviewAssessment,
  QualityReviewDomain,
  QualityReviewOutcome,
  QualityReviewTask,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditRequiredWithId } from "@/lib/audit";
import { ReviewOperationError } from "@/lib/quality/errors";
import { REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS, REVIEW_TRANSACTION_OPTIONS } from "@/lib/curriculum/review/transaction";

type Operator = { id: string; role: Role | string; schoolId?: string | null; isPlatformAdmin?: boolean };

export async function createQualityReviewTask(input: {
  operator: Operator;
  domain: QualityReviewDomain;
  artifactRef: string;
  fixtureId?: string | null;
  fixtureVersion?: number | null;
  requiredAuthority: CurriculumReviewAuthority;
  schoolId?: string | null;
  dueAt: Date;
  idempotencyKey: string;
}): Promise<QualityReviewTask> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.qualityReviewTask.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    const task = await tx.qualityReviewTask.create({
      data: {
        domain: input.domain,
        artifactRef: input.artifactRef,
        fixtureId: input.fixtureId ?? null,
        fixtureVersion: input.fixtureVersion ?? null,
        requiredAuthority: input.requiredAuthority,
        schoolId: input.schoolId ?? null,
        dueAt: input.dueAt,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await logAuditRequiredWithId({
      userId: input.operator.id,
      action: "quality_review.task.created",
      resourceType: "quality_review_task",
      resourceId: task.id,
      schoolId: task.schoolId,
      details: { idempotencyKey: input.idempotencyKey, domain: task.domain, requiredAuthority: task.requiredAuthority },
    }, tx);
    return task;
  }, REVIEW_TRANSACTION_OPTIONS);
}

export async function claimQualityReviewTask(input: {
  operator: Operator;
  taskId: string;
  reviewerProfileId: string;
  idempotencyKey: string;
}): Promise<QualityReviewTask> {
  return prisma.$transaction(async (tx) => {
    const task = await tx.qualityReviewTask.findUnique({ where: { id: input.taskId } });
    if (!task || task.status !== "QUEUED") throw new ReviewOperationError("TASK_NOT_CLAIMABLE", 409);
    const restriction = await tx.reviewerRestriction.findFirst({
      where: {
        reviewerProfileId: input.reviewerProfileId,
        OR: [{ schoolId: task.schoolId }, { schoolId: null }],
        effectiveUntil: null,
      },
    });
    if (restriction) throw new ReviewOperationError("REVIEWER_RESTRICTED", 403);
    const changed = await tx.qualityReviewTask.updateMany({
      where: { id: task.id, version: task.version, status: "QUEUED" },
      data: { status: "CLAIMED", claimedByProfileId: input.reviewerProfileId, claimedAt: new Date(), version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ReviewOperationError("TASK_VERSION_CONFLICT", 409);
    await logAuditRequiredWithId({
      userId: input.operator.id,
      action: "quality_review.task.claimed",
      resourceType: "quality_review_task",
      resourceId: task.id,
      schoolId: task.schoolId,
      details: { reviewerProfileId: input.reviewerProfileId, idempotencyKey: input.idempotencyKey },
    }, tx);
    return tx.qualityReviewTask.findUniqueOrThrow({ where: { id: task.id } });
  }, REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS);
}

export async function decideQualityReviewTask(input: {
  operator: Operator;
  taskId: string;
  outcome: QualityReviewOutcome;
  severity: string;
  notes?: string | null;
  idempotencyKey: string;
}): Promise<QualityReviewAssessment> {
  return prisma.$transaction(async (tx) => {
    const task = await tx.qualityReviewTask.findUnique({ where: { id: input.taskId } });
    if (!task) throw new ReviewOperationError("TASK_NOT_FOUND", 404);

    const existingAssessment = await tx.qualityReviewAssessment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingAssessment) return existingAssessment;

    if (task.status !== "CLAIMED" || !task.claimedByProfileId) {
      throw new ReviewOperationError("TASK_NOT_DECIDABLE", 409);
    }

    const auditLogId = await logAuditRequiredWithId({
      userId: input.operator.id,
      action: "quality_review.task.decided",
      resourceType: "quality_review_task",
      resourceId: task.id,
      schoolId: task.schoolId,
      details: {
        outcome: input.outcome,
        severity: input.severity,
        idempotencyKey: input.idempotencyKey,
        reviewerProfileId: task.claimedByProfileId,
      },
    }, tx);

    const changed = await tx.qualityReviewTask.updateMany({
      where: { id: task.id, version: task.version, status: "CLAIMED" },
      data: { status: "DECIDED", version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ReviewOperationError("TASK_VERSION_CONFLICT", 409);

    return tx.qualityReviewAssessment.create({
      data: {
        taskId: task.id,
        reviewerProfileId: task.claimedByProfileId,
        outcome: input.outcome,
        severity: input.severity,
        notes: input.notes ?? null,
        auditLogId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }, REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS);
}
