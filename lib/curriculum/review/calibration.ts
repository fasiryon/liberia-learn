import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { P2B_POLICY_KEY, P2B_POLICY_VERSION } from "./policy";
import { P2B_RUBRIC_KEY, P2B_RUBRIC_VERSION, validateRubricResponses, type RubricResponses } from "./rubric";
import { ReviewOperationError } from "./errors";
import { logAuditRequired } from "@/lib/audit";
import { REVIEW_TRANSACTION_OPTIONS } from "./transaction";

export async function createCalibrationSession(input: {
  name: string;
  revisionId: string;
  referenceSnapshot: Prisma.InputJsonValue;
  createdByUserId: string;
  opensAt?: Date | null;
  closesAt?: Date | null;
  idempotencyKey: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reviewCalibrationSession.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    const session = await tx.reviewCalibrationSession.create({ data: {
      name: input.name,
      revisionId: input.revisionId,
      referenceSnapshot: input.referenceSnapshot,
      createdByUserId: input.createdByUserId,
      policyKey: P2B_POLICY_KEY,
      policyVersion: P2B_POLICY_VERSION,
      rubricKey: P2B_RUBRIC_KEY,
      rubricVersion: P2B_RUBRIC_VERSION,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      idempotencyKey: input.idempotencyKey,
    } });
    await logAuditRequired({
      userId: input.createdByUserId,
      action: "review.calibration.session.created",
      resourceType: "review_calibration_session",
      resourceId: session.id,
      details: { idempotencyKey: input.idempotencyKey, policyKey: session.policyKey, policyVersion: session.policyVersion },
    }, tx);
    return session;
  }, REVIEW_TRANSACTION_OPTIONS);
}

export async function submitCalibrationResult(input: {
  sessionId: string;
  reviewerProfileId: string;
  rubricResponses: RubricResponses;
  recommendation: string;
  rationale: string;
  idempotencyKey: string;
}) {
  const session = await prisma.reviewCalibrationSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.status !== "OPEN") throw new ReviewOperationError("CALIBRATION_NOT_OPEN", 409);
  const errors = validateRubricResponses(input.rubricResponses);
  if (errors.length) throw new ReviewOperationError("RUBRIC_INCOMPLETE", 400, "Rubric is incomplete", { reasons: errors });
  const reference = session.referenceSnapshot as { rubricResponses?: RubricResponses; recommendation?: string };
  const dimensions = Object.keys(input.rubricResponses);
  const matches = dimensions.filter((dimension) =>
    reference.rubricResponses?.[dimension as keyof RubricResponses]?.value === input.rubricResponses[dimension as keyof RubricResponses]?.value,
  ).length;
  return prisma.reviewCalibrationResult.create({
    data: {
      sessionId: session.id,
      reviewerProfileId: input.reviewerProfileId,
      assessmentSnapshot: {
        rubricResponses: input.rubricResponses,
        recommendation: input.recommendation,
        rationale: input.rationale,
        policyKey: session.policyKey,
        policyVersion: session.policyVersion,
        rubricKey: session.rubricKey,
        rubricVersion: session.rubricVersion,
      },
      comparisonResult: {
        dimensionCount: dimensions.length,
        matchingDimensions: matches,
        rubricAgreementRate: dimensions.length ? matches / dimensions.length : null,
        recommendationMatches: reference.recommendation === input.recommendation,
        diagnosticOnly: true,
      },
      idempotencyKey: input.idempotencyKey,
    },
  });
}
