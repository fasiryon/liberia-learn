import type {
  Prisma,
  QualityReviewCalibrationResult,
  QualityReviewCalibrationSession,
  QualityReviewDomain,
  QualityReviewOutcome,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { ReviewOperationError } from "@/lib/quality/errors";
import { REVIEW_TRANSACTION_OPTIONS } from "@/lib/curriculum/review/transaction";
import { assertReviewOperationsAdmin } from "@/lib/curriculum/review/access";
import type { Operator } from "@/lib/quality/reviewTasks";

export function computeDisagreement(
  results: Array<{ reviewerProfileId: string; outcome: string }>,
): { agreementRate: number; disagreements: Array<{ a: string; b: string }> } {
  const disagreements: Array<{ a: string; b: string }> = [];
  let pairs = 0, agreeing = 0;
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      pairs++;
      if (results[i].outcome === results[j].outcome) agreeing++;
      else disagreements.push({ a: results[i].reviewerProfileId, b: results[j].reviewerProfileId });
    }
  }
  return { agreementRate: pairs === 0 ? 1 : agreeing / pairs, disagreements };
}

export async function createCalibrationSession(input: {
  name: string;
  domain: QualityReviewDomain;
  referenceTaskId: string;
  referenceSnapshot: Prisma.InputJsonValue;
  createdByUserId: string;
  opensAt?: Date | null;
  closesAt?: Date | null;
  idempotencyKey: string;
}): Promise<QualityReviewCalibrationSession> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.qualityReviewCalibrationSession.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    const session = await tx.qualityReviewCalibrationSession.create({
      data: {
        name: input.name,
        domain: input.domain,
        referenceTaskId: input.referenceTaskId,
        referenceSnapshot: input.referenceSnapshot,
        createdByUserId: input.createdByUserId,
        opensAt: input.opensAt ?? null,
        closesAt: input.closesAt ?? null,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await logAuditRequired(
      {
        userId: input.createdByUserId,
        action: "quality_review.calibration.session.created",
        resourceType: "quality_review_calibration_session",
        resourceId: session.id,
        details: { idempotencyKey: input.idempotencyKey, domain: session.domain, referenceTaskId: session.referenceTaskId },
      },
      tx,
    );
    return session;
  }, REVIEW_TRANSACTION_OPTIONS);
}

export async function recordCalibrationResult(input: {
  sessionId: string;
  reviewerProfileId: string;
  outcome: QualityReviewOutcome;
  notes?: string | null;
  idempotencyKey: string;
}): Promise<QualityReviewCalibrationResult> {
  const existingResult = await prisma.qualityReviewCalibrationResult.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existingResult) return existingResult;

  const session = await prisma.qualityReviewCalibrationSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.status !== "OPEN") throw new ReviewOperationError("CALIBRATION_NOT_OPEN", 409);

  const reference = session.referenceSnapshot as { outcome?: QualityReviewOutcome };
  const outcomeMatchesReference = reference.outcome === input.outcome;

  return prisma.qualityReviewCalibrationResult.create({
    data: {
      sessionId: session.id,
      reviewerProfileId: input.reviewerProfileId,
      assessmentSnapshot: {
        outcome: input.outcome,
        notes: input.notes ?? null,
        domain: session.domain,
      },
      comparisonResult: {
        outcomeMatchesReference,
        diagnosticOnly: true,
      },
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function openCalibrationSession(input: {
  operator: Operator;
  sessionId: string;
}): Promise<QualityReviewCalibrationSession> {
  assertReviewOperationsAdmin(input.operator, null);
  return prisma.$transaction(async (tx) => {
    const session = await tx.qualityReviewCalibrationSession.findUnique({ where: { id: input.sessionId } });
    if (!session || session.status !== "DRAFT") throw new ReviewOperationError("CALIBRATION_NOT_OPENABLE", 409);
    const changed = await tx.qualityReviewCalibrationSession.updateMany({
      where: { id: session.id, status: "DRAFT" },
      data: { status: "OPEN", opensAt: session.opensAt ?? new Date() },
    });
    if (changed.count !== 1) throw new ReviewOperationError("CALIBRATION_NOT_OPENABLE", 409);
    await logAuditRequired({
      userId: input.operator.id,
      action: "quality_review.calibration.session.opened",
      resourceType: "quality_review_calibration_session",
      resourceId: session.id,
      details: { domain: session.domain },
    }, tx);
    return tx.qualityReviewCalibrationSession.findUniqueOrThrow({ where: { id: session.id } });
  }, REVIEW_TRANSACTION_OPTIONS);
}
