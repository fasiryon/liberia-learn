import { randomUUID } from "crypto";
import type { CurriculumReviewSlot, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reviewEligibility, type EligibilityUser } from "./eligibility";
import { ReviewOperationError } from "./errors";
import { logAuditRequired } from "@/lib/audit";
import { REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS, REVIEW_TRANSACTION_OPTIONS } from "./transaction";

export const REVIEW_LEASE_MINUTES = 15;
export const REVIEW_MAX_CONTINUOUS_CLAIM_MINUTES = 120;

async function selectSlot(tx: Prisma.TransactionClient, taskId: string): Promise<CurriculumReviewSlot> {
  const task = await tx.curriculumReviewTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { assessments: { where: { status: "SUBMITTED" }, include: { assignment: { select: { slot: true } } } } },
  });
  const submitted = new Set(task.assessments.map((assessment) => assessment.assignment.slot));
  if (task.status === "DISAGREEMENT" || task.status === "ESCALATED") return "RESOLVER";
  if (!submitted.has("FIRST")) return "FIRST";
  if (task.requiredReviewCount > 1 && !submitted.has("SECOND")) return "SECOND";
  throw new ReviewOperationError("NO_OPEN_REVIEW_SLOT", 409);
}

export async function claimReviewTask(input: {
  taskId: string;
  user: EligibilityUser;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CurriculumReviewTask" WHERE "id" = ${input.taskId} FOR UPDATE`;
    await tx.curriculumReviewAssignment.updateMany({
      where: { taskId: input.taskId, status: "ACTIVE", leaseExpiresAt: { lte: now } },
      data: { status: "EXPIRED", releasedAt: now, releaseReason: "LEASE_EXPIRED", version: { increment: 1 } },
    });
    const prior = await tx.curriculumReviewAssignment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) return prior;
    const slot = await selectSlot(tx, input.taskId);
    const eligibility = await reviewEligibility({ user: input.user, taskId: input.taskId, slot, now }, tx);
    if (!eligibility.eligible || !eligibility.reviewerProfileId || !eligibility.credentialId || !eligibility.credentialScopeId) {
      throw new ReviewOperationError("REVIEWER_INELIGIBLE", 403, "Reviewer is not eligible", { reasons: eligibility.reasons });
    }
    const leaseToken = randomUUID();
    const assignment = await tx.curriculumReviewAssignment.create({
      data: {
        taskId: input.taskId,
        slot,
        reviewerProfileId: eligibility.reviewerProfileId,
        credentialId: eligibility.credentialId,
        credentialScopeId: eligibility.credentialScopeId,
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + REVIEW_LEASE_MINUTES * 60_000),
        maxContinuousUntil: new Date(now.getTime() + REVIEW_MAX_CONTINUOUS_CLAIM_MINUTES * 60_000),
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.curriculumReviewTask.update({
      where: { id: input.taskId },
      data: { status: "IN_REVIEW", version: { increment: 1 } },
    });
    await logAuditRequired({
      userId: input.user.id,
      action: "curriculum.review.claimed",
      resourceType: "review_assignment",
      resourceId: assignment.id,
      schoolId: input.user.schoolId,
      details: { taskId: input.taskId, slot, credentialId: assignment.credentialId },
    }, tx);
    return assignment;
  }, REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS);
}

export async function heartbeatReviewClaim(input: {
  assignmentId: string;
  reviewerProfileId: string;
  leaseToken: string;
  version: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.curriculumReviewAssignment.findUnique({ where: { id: input.assignmentId } });
    if (
      !assignment ||
      assignment.reviewerProfileId !== input.reviewerProfileId ||
      assignment.leaseToken !== input.leaseToken ||
      assignment.status !== "ACTIVE" ||
      assignment.version !== input.version ||
      assignment.leaseExpiresAt <= now ||
      assignment.maxContinuousUntil <= now
    ) throw new ReviewOperationError("CLAIM_LOST", 409);
    const requested = new Date(now.getTime() + REVIEW_LEASE_MINUTES * 60_000);
    const leaseExpiresAt = requested < assignment.maxContinuousUntil ? requested : assignment.maxContinuousUntil;
    const updated = await tx.curriculumReviewAssignment.updateMany({
      where: { id: assignment.id, version: input.version, status: "ACTIVE", leaseToken: input.leaseToken },
      data: { leaseExpiresAt, lastHeartbeatAt: now, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ReviewOperationError("CLAIM_LOST", 409);
    return tx.curriculumReviewAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  }, REVIEW_TRANSACTION_OPTIONS);
}

export async function releaseReviewClaim(input: {
  assignmentId: string;
  reviewerProfileId: string;
  leaseToken: string;
  version: number;
  reason?: string;
  recusal?: boolean;
  actorUserId: string;
  schoolId?: string | null;
  idempotencyKey: string;
}) {
  return prisma.$transaction(async (tx) => {
    const released = await tx.curriculumReviewAssignment.updateMany({
      where: {
        id: input.assignmentId,
        reviewerProfileId: input.reviewerProfileId,
        leaseToken: input.leaseToken,
        version: input.version,
        status: "ACTIVE",
      },
      data: {
        status: input.recusal ? "RECUSED" : "RELEASED",
        releasedAt: new Date(),
        releaseReason: input.reason ?? (input.recusal ? "DECLARED_CONFLICT" : "RELEASED_BY_REVIEWER"),
        version: { increment: 1 },
      },
    });
    if (released.count !== 1) throw new ReviewOperationError("CLAIM_LOST", 409);
    await logAuditRequired({
      userId: input.actorUserId,
      action: input.recusal ? "curriculum.review.recused" : "curriculum.review.claim.released",
      resourceType: "review_assignment",
      resourceId: input.assignmentId,
      schoolId: input.schoolId,
      details: { reason: input.reason ?? null, idempotencyKey: input.idempotencyKey },
    }, tx);
  }, REVIEW_TRANSACTION_OPTIONS);
}

export async function overrideReviewClaim(input: {
  assignmentId: string;
  actorUserId: string;
  schoolId?: string | null;
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.curriculumReviewAssignment.updateMany({
      where: { id: input.assignmentId, status: "ACTIVE", version: input.expectedVersion },
      data: { status: "OVERRIDDEN", releasedAt: new Date(), releaseReason: input.reason, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ReviewOperationError("CLAIM_VERSION_CONFLICT", 409);
    await logAuditRequired({
      userId: input.actorUserId,
      action: "curriculum.review.claim.overridden",
      resourceType: "review_assignment",
      resourceId: input.assignmentId,
      schoolId: input.schoolId,
      details: { reason: input.reason, idempotencyKey: input.idempotencyKey },
    }, tx);
  }, REVIEW_TRANSACTION_OPTIONS);
}
