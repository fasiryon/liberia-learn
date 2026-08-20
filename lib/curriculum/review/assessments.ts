import type { CurriculumReviewRecommendation, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reviewEligibility } from "./eligibility";
import { ReviewOperationError } from "./errors";
import { validateRubricResponses, type RubricResponses } from "./rubric";
import { logAuditRequired } from "@/lib/audit";
import { REVIEW_TRANSACTION_OPTIONS } from "./transaction";

type AssessmentInput = {
  assignmentId: string;
  user: { id: string; role: Role | string; schoolId?: string | null; isPlatformAdmin?: boolean };
  leaseToken: string;
  assignmentVersion: number;
  assessmentVersion?: number;
  rubricResponses: RubricResponses;
  recommendation?: CurriculumReviewRecommendation;
  rationale?: string;
  evidenceRefs?: Prisma.InputJsonValue;
  reviewerRiskResponse?: Prisma.InputJsonValue;
  idempotencyKey: string;
  now?: Date;
};

async function loadClaim(tx: Prisma.TransactionClient, input: AssessmentInput) {
  const now = input.now ?? new Date();
  const assignment = await tx.curriculumReviewAssignment.findUnique({
    where: { id: input.assignmentId },
    include: { task: true, reviewerProfile: true },
  });
  if (
    !assignment ||
    assignment.reviewerProfile.userId !== input.user.id ||
    assignment.leaseToken !== input.leaseToken ||
    assignment.status !== "ACTIVE" ||
    assignment.version !== input.assignmentVersion ||
    assignment.leaseExpiresAt <= now
  ) throw new ReviewOperationError("CLAIM_LOST", 409);
  return assignment;
}

async function qualificationSnapshot(tx: Prisma.TransactionClient, assignmentId: string, role: string) {
  const assignment = await tx.curriculumReviewAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { reviewerProfile: true, credential: true, credentialScope: true },
  });
  return {
    reviewerId: assignment.reviewerProfile.userId,
    reviewerProfileId: assignment.reviewerProfileId,
    reviewerRole: role,
    credentialId: assignment.credentialId,
    credentialType: assignment.credential.credentialType,
    issuer: assignment.credential.issuer,
    authority: assignment.credential.authority,
    credentialStatus: assignment.credential.status,
    validFrom: assignment.credential.validFrom?.toISOString() ?? null,
    expiresAt: assignment.credential.expiresAt?.toISOString() ?? null,
    verifiedAt: assignment.credential.verifiedAt?.toISOString() ?? null,
    verifierUserId: assignment.credential.verifierUserId,
    scope: {
      id: assignment.credentialScope.id,
      subject: assignment.credentialScope.subject,
      gradeMin: assignment.credentialScope.gradeMin,
      gradeMax: assignment.credentialScope.gradeMax,
      domains: assignment.credentialScope.domains,
      curriculumScopes: assignment.credentialScope.curriculumScopes,
      curriculumTypes: assignment.credentialScope.curriculumTypes,
      schoolId: assignment.credentialScope.schoolId,
      county: assignment.credentialScope.county,
      standardRefs: assignment.credentialScope.standardRefs,
      language: assignment.credentialScope.language,
    },
    capturedAt: new Date().toISOString(),
  } satisfies Prisma.InputJsonObject;
}

export async function saveAssessmentDraft(input: AssessmentInput) {
  return prisma.$transaction(async (tx) => {
    const assignment = await loadClaim(tx, input);
    const existing = await tx.curriculumReviewAssessment.findUnique({ where: { assignmentId: assignment.id } });
    const snapshot = await qualificationSnapshot(tx, assignment.id, input.user.role);
    if (!existing) {
      return tx.curriculumReviewAssessment.create({
        data: {
          taskId: assignment.taskId,
          assignmentId: assignment.id,
          reviewerProfileId: assignment.reviewerProfileId,
          credentialId: assignment.credentialId,
          credentialScopeId: assignment.credentialScopeId,
          reviewerRoleSnapshot: input.user.role,
          qualificationSnapshot: snapshot,
          rubricKey: assignment.task.rubricKey,
          rubricVersion: assignment.task.rubricVersion,
          rubricResponses: input.rubricResponses as Prisma.InputJsonValue,
          recommendation: input.recommendation,
          rationale: input.rationale,
          evidenceRefs: input.evidenceRefs,
          reviewerRiskResponse: input.reviewerRiskResponse,
          idempotencyKey: input.idempotencyKey,
        },
      });
    }
    if (existing.status === "SUBMITTED" || existing.version !== input.assessmentVersion) {
      throw new ReviewOperationError("ASSESSMENT_VERSION_CONFLICT", 409);
    }
    const updated = await tx.curriculumReviewAssessment.updateMany({
      where: { id: existing.id, status: "DRAFT", version: existing.version },
      data: {
        qualificationSnapshot: snapshot,
        rubricResponses: input.rubricResponses as Prisma.InputJsonValue,
        recommendation: input.recommendation,
        rationale: input.rationale,
        evidenceRefs: input.evidenceRefs,
        reviewerRiskResponse: input.reviewerRiskResponse,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new ReviewOperationError("ASSESSMENT_VERSION_CONFLICT", 409);
    return tx.curriculumReviewAssessment.findUniqueOrThrow({ where: { id: existing.id } });
  }, REVIEW_TRANSACTION_OPTIONS);
}

export async function submitAssessment(input: AssessmentInput) {
  return prisma.$transaction(async (tx) => {
    const now = input.now ?? new Date();
    const assignment = await loadClaim(tx, input);
    await tx.$queryRaw`SELECT "id" FROM "CurriculumReviewTask" WHERE "id" = ${assignment.taskId} FOR UPDATE`;
    const task = await tx.curriculumReviewTask.findUniqueOrThrow({
      where: { id: assignment.taskId },
      include: { provenance: true },
    });
    if (task.provenance.currentRevisionId !== task.revisionId) throw new ReviewOperationError("REVISION_STALE", 409);
    const eligibility = await reviewEligibility(
      {
        user: input.user,
        taskId: task.id,
        slot: assignment.slot,
        now,
        excludeAssignmentId: assignment.id,
      },
      tx,
    );
    if (!eligibility.eligible || eligibility.credentialId !== assignment.credentialId || eligibility.credentialScopeId !== assignment.credentialScopeId) {
      throw new ReviewOperationError("REVIEWER_INELIGIBLE", 403, "Reviewer eligibility changed", { reasons: eligibility.reasons });
    }
    const rubricErrors = validateRubricResponses(input.rubricResponses);
    if (rubricErrors.length) throw new ReviewOperationError("RUBRIC_INCOMPLETE", 400, "Rubric is incomplete", { reasons: rubricErrors });
    if (!input.recommendation || !input.rationale?.trim()) throw new ReviewOperationError("ASSESSMENT_INCOMPLETE", 400);
    const evidencePolicy = (task.evidenceRequirements as { required?: boolean; approvalBlocked?: boolean } | null) ?? {};
    const evidenceRefs = Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [];
    if (input.recommendation === "APPROVE" && evidencePolicy.approvalBlocked && evidenceRefs.length === 0) {
      throw new ReviewOperationError("REQUIRED_EVIDENCE_MISSING", 409);
    }
    const snapshot = await qualificationSnapshot(tx, assignment.id, input.user.role);
    let assessment = await tx.curriculumReviewAssessment.findUnique({ where: { assignmentId: assignment.id } });
    if (!assessment) {
      assessment = await tx.curriculumReviewAssessment.create({
        data: {
          taskId: task.id,
          assignmentId: assignment.id,
          reviewerProfileId: assignment.reviewerProfileId,
          credentialId: assignment.credentialId,
          credentialScopeId: assignment.credentialScopeId,
          status: "DRAFT",
          reviewerRoleSnapshot: input.user.role,
          qualificationSnapshot: snapshot,
          rubricKey: task.rubricKey,
          rubricVersion: task.rubricVersion,
          rubricResponses: input.rubricResponses as Prisma.InputJsonValue,
          recommendation: input.recommendation,
          rationale: input.rationale,
          evidenceRefs: input.evidenceRefs,
          reviewerRiskResponse: input.reviewerRiskResponse,
          idempotencyKey: input.idempotencyKey,
        },
      });
    } else if (assessment.status === "SUBMITTED") {
      return assessment;
    } else if (assessment.version !== input.assessmentVersion) {
      throw new ReviewOperationError("ASSESSMENT_VERSION_CONFLICT", 409);
    }
    const submitted = await tx.curriculumReviewAssessment.updateMany({
      where: { id: assessment.id, status: "DRAFT", version: assessment.version },
      data: {
        qualificationSnapshot: snapshot,
        rubricResponses: input.rubricResponses as Prisma.InputJsonValue,
        recommendation: input.recommendation,
        rationale: input.rationale.trim(),
        evidenceRefs: input.evidenceRefs,
        reviewerRiskResponse: input.reviewerRiskResponse,
        status: "SUBMITTED",
        submittedAt: now,
        version: { increment: 1 },
      },
    });
    if (submitted.count !== 1) throw new ReviewOperationError("ASSESSMENT_VERSION_CONFLICT", 409);
    await tx.curriculumReviewAssignment.update({
      where: { id: assignment.id },
      data: { status: "SUBMITTED", releasedAt: now, releaseReason: "ASSESSMENT_SUBMITTED", version: { increment: 1 } },
    });
    await logAuditRequired({
      userId: input.user.id,
      action: "curriculum.review.assessment.submitted",
      resourceType: "curriculum_review_assessment",
      resourceId: assessment.id,
      schoolId: task.schoolId,
      details: {
        taskId: task.id,
        revisionId: task.revisionId,
        assignmentId: assignment.id,
        slot: assignment.slot,
        recommendation: input.recommendation,
        rubricKey: task.rubricKey,
        rubricVersion: task.rubricVersion,
        credentialId: assignment.credentialId,
        credentialScopeId: assignment.credentialScopeId,
        idempotencyKey: input.idempotencyKey,
      },
    }, tx);

    const submittedAssessments = await tx.curriculumReviewAssessment.findMany({
      where: { taskId: task.id, status: "SUBMITTED" },
      include: { assignment: { select: { slot: true } } },
    });
    const independent = submittedAssessments.filter((item) => item.assignment.slot === "FIRST" || item.assignment.slot === "SECOND");
    let nextStatus = task.status;
    if (assignment.slot === "RESOLVER") nextStatus = "ESCALATED";
    else if (input.recommendation === "ESCALATE") nextStatus = "ESCALATED";
    else if (input.recommendation === "ABSTAIN_CONFLICT") nextStatus = "QUEUED";
    else if (independent.length < task.requiredReviewCount) nextStatus = "AWAITING_SECOND_REVIEW";
    else if (new Set(independent.map((item) => item.recommendation)).size > 1) nextStatus = "DISAGREEMENT";
    await tx.curriculumReviewTask.update({ where: { id: task.id }, data: { status: nextStatus, version: { increment: 1 } } });
    return tx.curriculumReviewAssessment.findUniqueOrThrow({ where: { id: assessment.id } });
  }, REVIEW_TRANSACTION_OPTIONS);
}
