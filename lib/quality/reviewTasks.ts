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
import { assertReviewOperationsAdmin } from "@/lib/curriculum/review/access";

export type Operator = { id: string; role: Role | string; schoolId?: string | null; isPlatformAdmin?: boolean };

function operatorHasRequiredAuthority(operator: Operator, requiredAuthority: CurriculumReviewAuthority, schoolId: string | null): boolean {
  if (requiredAuthority === "PLATFORM") return operator.isPlatformAdmin === true;
  if (requiredAuthority === "MOE") return operator.role === "MOE_OFFICIAL" || operator.role === "MOE_SUPER_ADMIN";
  if (requiredAuthority === "SCHOOL") {
    return operator.isPlatformAdmin === true || operator.role === "MOE_OFFICIAL" || operator.role === "MOE_SUPER_ADMIN" ||
      ((operator.role === "ADMIN" || operator.role === "TEACHER") && Boolean(operator.schoolId) && operator.schoolId === schoolId);
  }
  return false;
}

function authorityMatches(requiredAuthority: CurriculumReviewAuthority, actualAuthority: CurriculumReviewAuthority): boolean {
  return requiredAuthority === "SCHOOL"
    ? ["SCHOOL", "MOE", "PLATFORM"].includes(actualAuthority)
    : actualAuthority === requiredAuthority;
}

async function assertQualityReviewerEligible(tx: any, input: { operator: Operator; reviewerProfileId: string; task: QualityReviewTask }): Promise<void> {
  if (!operatorHasRequiredAuthority(input.operator, input.task.requiredAuthority, input.task.schoolId)) {
    throw new ReviewOperationError("QUALITY_REVIEWER_FORBIDDEN", 403);
  }
  const profile = await tx.reviewerProfile.findUnique({
    where: { id: input.reviewerProfileId },
    include: { credentials: true },
  });
  if (!profile || profile.userId !== input.operator.id || profile.status !== "ACTIVE" || !profile.available) {
    throw new ReviewOperationError("QUALITY_REVIEWER_FORBIDDEN", 403);
  }
  if (!authorityMatches(input.task.requiredAuthority, profile.authority) ||
    (input.task.requiredAuthority === "SCHOOL" && profile.authority === "SCHOOL" && profile.schoolId !== input.task.schoolId)) {
    throw new ReviewOperationError("QUALITY_REVIEWER_FORBIDDEN", 403);
  }
  const now = new Date();
  const restriction = await tx.reviewerRestriction.findFirst({
    where: {
      reviewerProfileId: profile.id,
      liftedAt: null,
      effectiveFrom: { lte: now },
      AND: [{ OR: [{ schoolId: input.task.schoolId }, { schoolId: null }] }, { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }],
    },
  });
  if (restriction) throw new ReviewOperationError("REVIEWER_RESTRICTED", 403);
  const credential = profile.credentials.some((candidate: any) =>
    candidate.status === "VERIFIED" && candidate.verifiedAt != null && candidate.verifierUserId != null &&
    (!candidate.validFrom || candidate.validFrom <= now) && (!candidate.expiresAt || candidate.expiresAt > now) &&
    authorityMatches(input.task.requiredAuthority, candidate.authority),
  );
  if (!credential) throw new ReviewOperationError("QUALITY_REVIEWER_FORBIDDEN", 403);
}

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
    assertReviewOperationsAdmin(input.operator, input.schoolId ?? null);
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
    await assertQualityReviewerEligible(tx, { operator: input.operator, reviewerProfileId: input.reviewerProfileId, task });
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
    await assertQualityReviewerEligible(tx, { operator: input.operator, reviewerProfileId: task.claimedByProfileId, task });

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

export type HelpfulnessOutcome = "helpful" | "partially_helpful" | "not_helpful" | "unsafe";

export async function recordHelpfulnessDecision(input: {
  operator: Operator;
  taskId: string;
  outcome: HelpfulnessOutcome;
  notes?: string;
  idempotencyKey: string;
}): Promise<QualityReviewAssessment> {
  const mapped: QualityReviewOutcome = input.outcome === "helpful" ? "PASS" : "FAIL";
  const severity = input.outcome === "unsafe" ? "CRITICAL" : "MEDIUM";
  return decideQualityReviewTask({
    operator: input.operator,
    taskId: input.taskId,
    outcome: mapped,
    severity,
    notes: JSON.stringify({ rubric: "helpfulness", outcome: input.outcome, notes: input.notes ?? null }),
    idempotencyKey: input.idempotencyKey,
  });
}

export type HallucinationOutcome =
  | "unsupported_claim"
  | "wrong_curriculum_claim"
  | "fabricated_citation"
  | "citation_mismatch"
  | "confident_unsupported"
  | "none";

const HALLUCINATION_SEVERITY: Record<HallucinationOutcome, string> = {
  none: "LOW",
  citation_mismatch: "MEDIUM",
  unsupported_claim: "MEDIUM",
  wrong_curriculum_claim: "HIGH",
  fabricated_citation: "CRITICAL",
  confident_unsupported: "CRITICAL",
};

export async function recordHallucinationDecision(input: {
  operator: Operator;
  taskId: string;
  outcome: HallucinationOutcome;
  notes?: string;
  idempotencyKey: string;
}): Promise<QualityReviewAssessment> {
  const mapped: QualityReviewOutcome = input.outcome === "none" ? "PASS" : "FAIL";
  return decideQualityReviewTask({
    operator: input.operator,
    taskId: input.taskId,
    outcome: mapped,
    severity: HALLUCINATION_SEVERITY[input.outcome],
    notes: JSON.stringify({ rubric: "hallucination", outcome: input.outcome, notes: input.notes ?? null }),
    idempotencyKey: input.idempotencyKey,
  });
}

export type GroundingOutcome =
  | "used_approved_context"
  | "misrepresented_source"
  | "ignored_required_evidence"
  | "grounded";

const GROUNDING_SEVERITY: Record<GroundingOutcome, string> = {
  grounded: "LOW",
  used_approved_context: "LOW",
  ignored_required_evidence: "MEDIUM",
  misrepresented_source: "HIGH",
};

export async function recordGroundingDecision(input: {
  operator: Operator;
  taskId: string;
  outcome: GroundingOutcome;
  notes?: string;
  idempotencyKey: string;
}): Promise<QualityReviewAssessment> {
  const mapped: QualityReviewOutcome =
    input.outcome === "grounded" || input.outcome === "used_approved_context" ? "PASS" : "FAIL";
  return decideQualityReviewTask({
    operator: input.operator,
    taskId: input.taskId,
    outcome: mapped,
    severity: GROUNDING_SEVERITY[input.outcome],
    notes: JSON.stringify({ rubric: "grounding", outcome: input.outcome, notes: input.notes ?? null }),
    idempotencyKey: input.idempotencyKey,
  });
}

export type ModerationFalsePositiveOutcome = "confirmed_false_positive" | "correctly_moderated";

export async function recordModerationFalsePositive(input: {
  operator: Operator;
  taskId: string;
  outcome: ModerationFalsePositiveOutcome;
  notes?: string;
  idempotencyKey: string;
}): Promise<QualityReviewAssessment> {
  const mapped: QualityReviewOutcome = input.outcome === "confirmed_false_positive" ? "FALSE_POSITIVE" : "PASS";
  const severity = input.outcome === "confirmed_false_positive" ? "HIGH" : "LOW";
  return decideQualityReviewTask({
    operator: input.operator,
    taskId: input.taskId,
    outcome: mapped,
    severity,
    notes: JSON.stringify({ rubric: "moderation_false_positive", outcome: input.outcome, notes: input.notes ?? null }),
    idempotencyKey: input.idempotencyKey,
  });
}

export type ModerationFalseNegativeOutcome = "confirmed_false_negative" | "correctly_moderated";

export async function recordModerationFalseNegative(input: {
  operator: Operator;
  taskId: string;
  outcome: ModerationFalseNegativeOutcome;
  notes?: string;
  idempotencyKey: string;
}): Promise<QualityReviewAssessment> {
  const mapped: QualityReviewOutcome = input.outcome === "confirmed_false_negative" ? "FALSE_NEGATIVE" : "PASS";
  return decideQualityReviewTask({
    operator: input.operator,
    taskId: input.taskId,
    outcome: mapped,
    // Moderation false-negative review tasks always carry CRITICAL severity: missed-unsafe-
    // content risk is treated as maximally severe regardless of whether the reviewer confirms
    // or overturns the automated flag.
    severity: "CRITICAL",
    notes: JSON.stringify({ rubric: "moderation_false_negative", outcome: input.outcome, notes: input.notes ?? null }),
    idempotencyKey: input.idempotencyKey,
  });
}
