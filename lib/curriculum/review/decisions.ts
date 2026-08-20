import type {
  CurriculumGovernanceEventType,
  CurriculumReviewDecisionOutcome,
  CurriculumReviewRecommendation,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditRequiredWithId } from "@/lib/audit";
import { appendCurriculumGovernanceEventInTransaction } from "@/lib/curriculum/mutations/governanceWriter";
import { reviewEligibility } from "./eligibility";
import { ReviewOperationError } from "./errors";
import { REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS } from "./transaction";

function recommendationOutcome(
  recommendation: CurriculumReviewRecommendation,
  reinstatement: boolean,
): CurriculumReviewDecisionOutcome | null {
  if (recommendation === "APPROVE") return reinstatement ? "REINSTATED" : "APPROVED";
  if (recommendation === "REJECT") return "REJECTED";
  if (recommendation === "RETURN_FOR_REVISION") return "RETURNED_FOR_REVISION";
  return null;
}

function eventTypeFor(
  outcome: CurriculumReviewDecisionOutcome,
  lifecycle: string,
): CurriculumGovernanceEventType {
  if (outcome === "APPROVED") return lifecycle === "REJECTED" ? "REAPPROVED" : "APPROVED";
  if (outcome === "REJECTED") return "REJECTED";
  if (outcome === "RETURNED_FOR_REVISION") return "RETURNED_FOR_REVIEW";
  if (outcome === "REVOKED") return "REVOKED";
  return "REINSTATED";
}

export async function finalizeReviewTaskIfReady(input: {
  taskId: string;
  idempotencyKey: string;
  traceId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CurriculumReviewTask" WHERE "id" = ${input.taskId} FOR UPDATE`;
    const existing = await tx.curriculumReviewDecision.findUnique({ where: { taskId: input.taskId } });
    if (existing?.status === "FINAL") return { status: "FINAL" as const, decision: existing };
    const task = await tx.curriculumReviewTask.findUnique({
      where: { id: input.taskId },
      include: {
        provenance: { include: { curriculumContent: true } },
        assessments: {
          where: { status: "SUBMITTED" },
          include: {
            assignment: true,
            reviewerProfile: { include: { user: true } },
            credential: true,
            credentialScope: true,
          },
          orderBy: { submittedAt: "asc" },
        },
      },
    });
    if (!task) throw new ReviewOperationError("TASK_NOT_FOUND", 404);
    if (task.provenance.currentRevisionId !== task.revisionId) throw new ReviewOperationError("REVISION_STALE", 409);
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status)) throw new ReviewOperationError("TASK_CLOSED", 409);

    const independent = task.assessments.filter(
      (assessment) =>
        (assessment.assignment.slot === "FIRST" || assessment.assignment.slot === "SECOND") &&
        assessment.recommendation !== "ABSTAIN_CONFLICT",
    );
    const resolver = task.assessments.find((assessment) => assessment.assignment.slot === "RESOLVER");
    if (independent.some((assessment) => assessment.recommendation === "ESCALATE") && !resolver) {
      await tx.curriculumReviewTask.update({ where: { id: task.id }, data: { status: "ESCALATED", version: { increment: 1 } } });
      return { status: "ESCALATED" as const };
    }
    if (independent.length < task.requiredReviewCount) {
      return { status: "AWAITING_ASSESSMENTS" as const };
    }
    if (new Set(independent.map((assessment) => assessment.reviewerProfile.userId)).size < task.requiredReviewCount) {
      throw new ReviewOperationError("TWO_PERSON_INDEPENDENCE_FAILED", 409);
    }
    const recommendations = new Set(independent.map((assessment) => assessment.recommendation));
    if (recommendations.size > 1 && !resolver) {
      await tx.curriculumReviewTask.update({ where: { id: task.id }, data: { status: "DISAGREEMENT", version: { increment: 1 } } });
      return { status: "DISAGREEMENT" as const };
    }
    const decidingAssessment = resolver ?? independent[independent.length - 1];
    if (!decidingAssessment?.recommendation) throw new ReviewOperationError("DECISION_NOT_READY", 409);
    const specialist = (task.specialistRequirements as { policyInputs?: { reinstatementAfterRevocation?: boolean; emergencyRevocation?: boolean } } | null) ?? {};
    let outcome = recommendationOutcome(
      decidingAssessment.recommendation,
      Boolean(specialist.policyInputs?.reinstatementAfterRevocation),
    );
    if (specialist.policyInputs?.emergencyRevocation && decidingAssessment.recommendation === "REJECT") outcome = "REVOKED";
    if (!outcome) throw new ReviewOperationError("DECISION_REQUIRES_RESOLUTION", 409);

    const evidencePolicy = (task.evidenceRequirements as { approvalBlocked?: boolean } | null) ?? {};
    if ((outcome === "APPROVED" || outcome === "REINSTATED") && evidencePolicy.approvalBlocked) {
      const hasEvidence = independent.every((assessment) => Array.isArray(assessment.evidenceRefs) && assessment.evidenceRefs.length > 0);
      if (!hasEvidence) throw new ReviewOperationError("REQUIRED_EVIDENCE_MISSING", 409);
    }

    for (const assessment of [...independent, ...(resolver ? [resolver] : [])]) {
      const eligibility = await reviewEligibility(
        {
          user: {
            id: assessment.reviewerProfile.user.id,
            role: assessment.reviewerProfile.user.role,
            schoolId: assessment.reviewerProfile.user.schoolId,
            isPlatformAdmin: assessment.reviewerProfile.user.isPlatformAdmin,
          },
          taskId: task.id,
          slot: assessment.assignment.slot,
          now,
          ignoreOwnSubmittedAssessment: true,
        },
        tx,
      );
      if (!eligibility.eligible || eligibility.credentialId !== assessment.credentialId) {
        throw new ReviewOperationError("REVIEWER_INELIGIBLE_AT_DECISION", 409, "Reviewer eligibility changed", {
          reviewerProfileId: assessment.reviewerProfileId,
          reasons: eligibility.reasons,
        });
      }
    }

    const qualificationSnapshot = {
      policyKey: task.policyKey,
      policyVersion: task.policyVersion,
      rubricKey: task.rubricKey,
      rubricVersion: task.rubricVersion,
      taskId: task.id,
      revisionId: task.revisionId,
      assessments: [...independent, ...(resolver ? [resolver] : [])].map((assessment) => ({
        assessmentId: assessment.id,
        slot: assessment.assignment.slot,
        reviewerProfileId: assessment.reviewerProfileId,
        qualification: assessment.qualificationSnapshot,
        recommendation: assessment.recommendation,
        submittedAt: assessment.submittedAt?.toISOString() ?? null,
      })),
      capturedAt: now.toISOString(),
    } satisfies Prisma.InputJsonObject;
    const rationale = resolver?.rationale ?? independent.map((assessment) => assessment.rationale).filter(Boolean).join("\n\n");
    const actor = decidingAssessment.reviewerProfile.user;
    const auditLogId = await logAuditRequiredWithId(
      {
        userId: actor.id,
        action: `curriculum.review.decision.${outcome.toLowerCase()}`,
        resourceType: "curriculum",
        resourceId: task.provenance.curriculumContent.contentId,
        schoolId: task.schoolId,
        traceId: input.traceId ?? null,
        details: {
          p2bTaskId: task.id,
          revisionId: task.revisionId,
          outcome,
          assessmentIds: [...independent, ...(resolver ? [resolver] : [])].map((assessment) => assessment.id),
          policyKey: task.policyKey,
          policyVersion: task.policyVersion,
        },
      },
      tx,
    );
    const pendingDecision = existing ?? await tx.curriculumReviewDecision.create({
      data: {
        taskId: task.id,
        status: "PENDING",
        outcome,
        rationale: rationale || outcome,
        resolverAssessmentId: resolver?.id ?? null,
        resolverUserId: resolver ? actor.id : null,
        qualificationSnapshot,
        auditLogId,
        idempotencyKey: input.idempotencyKey,
        decidedAt: now,
      },
    });
    if (pendingDecision.auditLogId !== auditLogId) throw new ReviewOperationError("DECISION_IDEMPOTENCY_CONFLICT", 409);
    const eventType = eventTypeFor(outcome, task.provenance.lifecycleState);
    const governanceEvent = await appendCurriculumGovernanceEventInTransaction(
      tx,
      {
        contentId: task.provenance.curriculumContent.contentId,
        revisionId: task.revisionId,
        eventType,
        actorType: "USER",
        actorUserId: actor.id,
        ...(eventType === "APPROVED" || eventType === "REAPPROVED" || eventType === "REINSTATED"
          ? { approvalBasis: "HUMAN_REVIEW" as const, reviewAuthority: task.requiredAuthority }
          : {}),
        reviewerRoleSnapshot: actor.role,
        reviewerQualificationRef: `p2b-decision:${pendingDecision.id}`,
        reviewerQualificationSnapshot: qualificationSnapshot,
        riskScore: task.riskScore,
        riskReasons: task.riskReasons,
        ...(eventType === "REJECTED" || eventType === "RETURNED_FOR_REVIEW" || eventType === "REVOKED"
          ? { reason: rationale || outcome }
          : {}),
        ...(eventType === "REVOKED"
          ? {
              futureAssignmentPolicy: "BLOCK_NEW" as const,
              existingAssignmentPolicy: "WITHDRAW_EXISTING" as const,
              offlineCachePolicy: "URGENT_INVALIDATE_ON_NEXT_REFRESH" as const,
            }
          : {}),
        schoolId: task.schoolId,
        traceId: input.traceId ?? null,
        occurredAt: now,
        idempotencyKey: `p2b-governance:${pendingDecision.id}`,
      },
      { auditLogId },
    );
    if (!governanceEvent) throw new ReviewOperationError("P2A_WRITER_DISABLED", 409);
    const finalized = await tx.curriculumReviewDecision.update({
      where: { id: pendingDecision.id },
      data: { status: "FINAL", governanceEventId: governanceEvent.id, finalizedAt: now },
    });
    await tx.curriculumReviewTask.update({
      where: { id: task.id },
      data: { status: "COMPLETED", completedAt: now, version: { increment: 1 } },
    });
    return { status: "FINAL" as const, decision: finalized, governanceEvent };
  }, REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS);
}
