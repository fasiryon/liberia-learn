import {
  type CurriculumApprovalBasis,
  type CurriculumExistingAssignmentPolicy,
  type CurriculumFutureAssignmentPolicy,
  type CurriculumGovernanceActorType,
  type CurriculumGovernanceEvent,
  type CurriculumGovernanceEventType,
  type CurriculumLifecycleState,
  type CurriculumOfflineCachePolicy,
  type CurriculumReviewAuthority,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditRequired, logAuditRequiredWithId } from "@/lib/audit";
import { assertAutomatedApprovalAllowed } from "@/lib/curriculum/provenance/validation";
import {
  lockCurriculumContent,
  ensureCurriculumProvenance,
  provenanceWritersEnabled,
  updateCurriculumGovernanceProjection,
} from "@/lib/curriculum/mutations/repository";

export type GovernanceInput = {
  contentId: string;
  revisionId?: string;
  eventType: CurriculumGovernanceEventType;
  actorType: CurriculumGovernanceActorType;
  actorUserId?: string | null;
  aiReviewAgentId?: string | null;
  actorLabel?: string | null;
  approvalBasis?: CurriculumApprovalBasis | null;
  reviewAuthority?: CurriculumReviewAuthority | null;
  reviewerRoleSnapshot?: string | null;
  reviewerQualificationRef?: string | null;
  reviewerQualificationSnapshot?: Prisma.InputJsonValue | null;
  riskScore?: number | null;
  riskReasons?: string[];
  reason?: string | null;
  replacementRevisionId?: string | null;
  futureAssignmentPolicy?: CurriculumFutureAssignmentPolicy | null;
  existingAssignmentPolicy?: CurriculumExistingAssignmentPolicy | null;
  offlineCachePolicy?: CurriculumOfflineCachePolicy | null;
  occurredAt?: Date;
  idempotencyKey?: string | null;
  backfillRunId?: string | null;
  correctsEventId?: string | null;
  schoolId?: string | null;
  traceId?: string | null;
  compatibility?: {
    where?: Prisma.CurriculumContentWhereUniqueInput;
    projection?: Prisma.CurriculumContentUncheckedUpdateInput;
    auditAction?: string;
    auditDetails?: Record<string, unknown>;
  };
};

const LIFECYCLE_BY_EVENT: Partial<Record<CurriculumGovernanceEventType, CurriculumLifecycleState>> = {
  SUBMITTED: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED_FOR_REVIEW: "PENDING_REVIEW",
  REAPPROVED: "APPROVED",
  REVOKED: "REVOKED",
  REINSTATED: "APPROVED",
  SUPERSEDED: "SUPERSEDED",
};

const STATUS_BY_LIFECYCLE: Record<CurriculumLifecycleState, string> = {
  DRAFT: "draft",
  PENDING_REVIEW: "NEEDS_REVIEW",
  APPROVED: "published",
  REJECTED: "rejected",
  REVOKED: "REVOKED",
  SUPERSEDED: "SUPERSEDED",
};

const REASON_REQUIRED = new Set<CurriculumGovernanceEventType>([
  "REJECTED",
  "RETURNED_FOR_REVIEW",
  "REVOKED",
  "SUPERSEDED",
  "AUTHORITY_CORRECTED",
]);

function validateGovernance(input: GovernanceInput, writersEnabled: boolean): void {
  if (input.actorType === "USER" && !input.actorUserId) {
    throw new Error("USER governance events require actorUserId");
  }
  if (input.actorType === "AI" && !input.aiReviewAgentId) {
    throw new Error("AI governance events require aiReviewAgentId");
  }
  if (input.actorType === "SYSTEM" && !input.actorLabel?.trim()) {
    throw new Error("SYSTEM governance events require actorLabel");
  }
  if (input.actorType === "LEGACY_UNKNOWN" && !input.backfillRunId) {
    throw new Error("LEGACY_UNKNOWN is restricted to backfill");
  }
  if (writersEnabled && REASON_REQUIRED.has(input.eventType) && !input.reason?.trim()) {
    throw new Error(`${input.eventType} requires a reason`);
  }
  const approvalEvent =
    input.eventType === "APPROVED" ||
    input.eventType === "REAPPROVED" ||
    input.eventType === "REINSTATED";
  if (approvalEvent && (!input.approvalBasis || !input.reviewAuthority)) {
    throw new Error(`${input.eventType} requires approvalBasis and reviewAuthority`);
  }
  if (!approvalEvent && input.approvalBasis) {
    throw new Error(`approvalBasis is not applicable to ${input.eventType}`);
  }
  const hasQualification =
    Boolean(input.reviewerQualificationRef?.trim()) &&
    input.reviewerQualificationSnapshot != null;
  if (
    input.approvalBasis === "HUMAN_REVIEW" &&
    (input.actorType !== "USER" ||
      !input.actorUserId ||
      !hasQualification ||
      !input.reviewAuthority ||
      input.reviewAuthority === "SYSTEM" ||
      input.reviewAuthority === "UNKNOWN")
  ) {
    throw new Error(
      "HUMAN_REVIEW requires an identified qualified USER actor and PLATFORM/SCHOOL/MOE authority",
    );
  }
  if (
    input.approvalBasis === "AI_PLATFORM_REVIEW" &&
    (input.actorType !== "AI" ||
      !input.aiReviewAgentId ||
      input.reviewAuthority !== "PLATFORM" ||
      !hasQualification)
  ) {
    throw new Error(
      "AI_PLATFORM_REVIEW requires a qualified AI actor with PLATFORM authority",
    );
  }
  if (
    input.reviewAuthority === "MOE" &&
    (input.actorType !== "USER" ||
      !input.actorUserId ||
      !hasQualification)
  ) {
    throw new Error("MOE authority requires an identified qualified human reviewer");
  }
  if (
    input.eventType === "AUTHORITY_CORRECTED" &&
    (!input.correctsEventId ||
      (input.actorType !== "USER" && input.actorType !== "SYSTEM") ||
      !input.reason?.trim() ||
      input.approvalBasis != null)
  ) {
    throw new Error(
      "AUTHORITY_CORRECTED requires a linked prior event, USER/SYSTEM actor, and reason without a new approval basis",
    );
  }
  if (input.eventType === "REVOKED") {
    if (
      !input.futureAssignmentPolicy ||
      !input.existingAssignmentPolicy ||
      !input.offlineCachePolicy
    ) {
      throw new Error("REVOKED requires all consequence policies");
    }
  }
  const replacementRequired =
    input.futureAssignmentPolicy === "REPLACE_WITH_SUCCESSOR" ||
    input.existingAssignmentPolicy === "REPLACE_WITH_SUCCESSOR";
  if (replacementRequired && !input.replacementRevisionId) {
    throw new Error("Replacement policy requires replacementRevisionId");
  }
}

export async function appendCurriculumGovernanceEvent(
  input: GovernanceInput,
): Promise<CurriculumGovernanceEvent | null> {
  validateGovernance(input, provenanceWritersEnabled());
  return prisma.$transaction((tx) => appendCurriculumGovernanceEventInTransaction(tx, input));
}

export async function appendCurriculumGovernanceEventInTransaction(
  tx: Prisma.TransactionClient,
  input: GovernanceInput,
  options?: { auditLogId?: string },
): Promise<CurriculumGovernanceEvent | null> {
  const writersEnabled = provenanceWritersEnabled();
  validateGovernance(input, writersEnabled);

  if (!writersEnabled) {
    if (
      input.approvalBasis === "AUTOMATED_RISK_POLICY" ||
      input.approvalBasis === "ROLE_POLICY" ||
      input.approvalBasis === "SCHOOL_POLICY"
    ) {
      // Compatibility mode may mirror a canonical write, but it must never
      // become a second, ungated authority path: an automated approval
      // basis has to clear the same provenance-completeness gate here as
      // it does on the canonical (writers-enabled) branch below. Content
      // with no provenance root at all defaults to UNVERIFIED (fail
      // closed) rather than silently skipping the check.
      const content = await tx.curriculumContent.findUnique({
        where: { contentId: input.contentId },
      });
      const provenance = content
        ? await tx.curriculumProvenance.findUnique({
            where: { curriculumContentId: content.id },
          })
        : null;
      assertAutomatedApprovalAllowed(provenance?.provenanceCompleteness ?? "UNVERIFIED");
    }
    const lifecycleResult = LIFECYCLE_BY_EVENT[input.eventType] ?? null;
    const defaultProjection: Prisma.CurriculumContentUncheckedUpdateInput = {
        ...(lifecycleResult ? { status: STATUS_BY_LIFECYCLE[lifecycleResult] } : {}),
        ...(lifecycleResult === "APPROVED" ? { publishedAt: input.occurredAt ?? new Date() } : {}),
        ...(lifecycleResult === "REJECTED" ? { rejectionReason: input.reason ?? null } : {}),
        ...(input.eventType === "APPROVED" || input.eventType === "REAPPROVED"
          ? { editReviewStatus: "APPROVED" }
          : input.eventType === "REJECTED"
            ? { editReviewStatus: "REJECTED" }
            : input.eventType === "SUBMITTED" || input.eventType === "RETURNED_FOR_REVIEW"
              ? { editReviewStatus: "PENDING" }
              : {}),
    };
    const compatibilityWhere = input.compatibility?.where ?? { contentId: input.contentId };
    await updateCurriculumGovernanceProjection(
      tx,
      compatibilityWhere,
      (input.compatibility?.projection ?? defaultProjection) as Parameters<
        typeof updateCurriculumGovernanceProjection
      >[2],
    );
    await logAuditRequired(
      {
          userId: input.actorUserId ?? null,
          action:
            input.compatibility?.auditAction ??
            `curriculum.governance.${input.eventType.toLowerCase()}`,
          resourceType: "curriculum",
          resourceId: input.contentId,
          schoolId: input.schoolId ?? undefined,
          traceId: input.traceId ?? null,
          details:
            input.compatibility?.auditDetails ?? {
              provenanceWritersDisabled: true,
              approvalBasis: input.approvalBasis ?? null,
              reviewAuthority: input.reviewAuthority ?? null,
              riskScore: input.riskScore ?? null,
              riskReasons: input.riskReasons ?? [],
              reason: input.reason ?? null,
            },
      },
      tx,
    );
    return null;
  }
  if (input.idempotencyKey) {
    const prior = await tx.curriculumGovernanceEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (prior) return prior;
  }
  const content = await tx.curriculumContent.findUniqueOrThrow({
      where: { contentId: input.contentId },
    });
    await lockCurriculumContent(tx, content.id);
    const ensured = await ensureCurriculumProvenance(tx, content);
    const root = await tx.curriculumProvenance.findUniqueOrThrow({
      where: { id: ensured.provenance.id },
      include: { currentRevision: true },
    });
    const revisionId = input.revisionId ?? root.currentRevisionId;
    if (!revisionId) throw new Error("Governance event requires an exact current revision");
    const revision = await tx.curriculumContentRevision.findFirst({
      where: { id: revisionId, provenanceId: root.id },
    });
    if (!revision) throw new Error("Governance revision does not belong to the content root");
    if (
      input.approvalBasis === "AUTOMATED_RISK_POLICY" ||
      input.approvalBasis === "ROLE_POLICY" ||
      input.approvalBasis === "SCHOOL_POLICY"
    ) {
      assertAutomatedApprovalAllowed(root.provenanceCompleteness);
    }
    if (input.replacementRevisionId) {
      const replacement = await tx.curriculumContentRevision.findUnique({
        where: { id: input.replacementRevisionId },
      });
      if (!replacement) throw new Error("Replacement revision does not exist");
    }
    if (input.correctsEventId) {
      const corrected = await tx.curriculumGovernanceEvent.findUnique({
        where: { id: input.correctsEventId },
        select: { id: true, provenanceId: true },
      });
      if (!corrected || corrected.provenanceId !== root.id) {
        throw new Error("Authority correction must reference an event on the same provenance root");
      }
    }
    const last = await tx.curriculumGovernanceEvent.findFirst({
      where: { provenanceId: root.id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const lifecycleResult = LIFECYCLE_BY_EVENT[input.eventType] ?? null;
    let auditLogId = options?.auditLogId;
    if (auditLogId) {
      const sharedAudit = await tx.auditLog.findUnique({ where: { id: auditLogId } });
      if (
        !sharedAudit ||
        sharedAudit.resourceType !== "curriculum" ||
        sharedAudit.resourceId !== input.contentId
      ) {
        throw new Error("Shared governance audit row does not match the curriculum decision");
      }
    } else {
      auditLogId = await logAuditRequiredWithId(
        {
          userId: input.actorUserId ?? null,
          action: `curriculum.governance.${input.eventType.toLowerCase()}`,
          resourceType: "curriculum",
          resourceId: input.contentId,
          schoolId: input.schoolId ?? content.schoolId ?? null,
          traceId: input.traceId ?? null,
          details: {
            revisionId,
            approvalBasis: input.approvalBasis ?? null,
            reviewAuthority: input.reviewAuthority ?? null,
            riskScore: input.riskScore ?? null,
            riskReasons: input.riskReasons ?? [],
            reason: input.reason ?? null,
            replacementRevisionId: input.replacementRevisionId ?? null,
            correctsEventId: input.correctsEventId ?? null,
          },
        },
        tx,
      );
    }
    const event = await tx.curriculumGovernanceEvent.create({
      data: {
        provenanceId: root.id,
        sequence: (last?.sequence ?? 0) + 1,
        revisionId,
        eventType: input.eventType,
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? null,
        aiReviewAgentId: input.aiReviewAgentId ?? null,
        actorLabel: input.actorLabel ?? null,
        approvalBasis: input.approvalBasis ?? null,
        reviewAuthority: input.reviewAuthority ?? null,
        reviewerRoleSnapshot: input.reviewerRoleSnapshot ?? null,
        reviewerQualificationRef: input.reviewerQualificationRef ?? null,
        reviewerQualificationSnapshot: input.reviewerQualificationSnapshot ?? Prisma.JsonNull,
        riskScore: input.riskScore ?? null,
        riskReasons: input.riskReasons ?? [],
        reason: input.reason ?? null,
        lifecycleResult,
        replacementRevisionId: input.replacementRevisionId ?? null,
        futureAssignmentPolicy: input.futureAssignmentPolicy ?? null,
        existingAssignmentPolicy: input.existingAssignmentPolicy ?? null,
        offlineCachePolicy: input.offlineCachePolicy ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        auditLogId,
        idempotencyKey: input.idempotencyKey ?? null,
        backfillRunId: input.backfillRunId ?? null,
        correctsEventId: input.correctsEventId ?? null,
      },
    });
    if (input.eventType === "RISK_ASSESSED") {
      const riskPayload =
        content.payload && typeof content.payload === "object" && !Array.isArray(content.payload)
          ? (content.payload as Record<string, unknown>)
          : {};
      await updateCurriculumGovernanceProjection(tx, content.id, {
        payload: {
          ...riskPayload,
          riskScore: input.riskScore ?? null,
          riskReasons: input.riskReasons ?? [],
          riskAssessedAt: (input.occurredAt ?? new Date()).toISOString(),
        } as Prisma.InputJsonValue,
      });
    }
    if (lifecycleResult) {
      await tx.curriculumProvenance.update({
        where: { id: root.id },
        data: { lifecycleState: lifecycleResult },
      });
      const payload = content.payload && typeof content.payload === "object" && !Array.isArray(content.payload)
        ? (content.payload as Record<string, unknown>)
        : {};
      await updateCurriculumGovernanceProjection(tx, content.id, {
        status: STATUS_BY_LIFECYCLE[lifecycleResult],
        payload: {
          ...payload,
          approvalStatus: lifecycleResult,
          governanceEventId: event.id,
          governanceRevisionId: revisionId,
          ...(input.riskScore !== undefined ? { riskScore: input.riskScore } : {}),
          ...(input.riskReasons ? { riskReasons: input.riskReasons } : {}),
        } as Prisma.InputJsonValue,
        ...(lifecycleResult === "APPROVED" ? { publishedAt: input.occurredAt ?? new Date() } : {}),
        ...(lifecycleResult === "REJECTED" ? { rejectionReason: input.reason ?? null } : {}),
        ...(input.eventType === "APPROVED" || input.eventType === "REAPPROVED"
          ? { editReviewStatus: "APPROVED" }
          : input.eventType === "REJECTED"
            ? { editReviewStatus: "REJECTED" }
            : input.eventType === "SUBMITTED" || input.eventType === "RETURNED_FOR_REVIEW"
              ? { editReviewStatus: "PENDING" }
              : {}),
      });
    }
    return event;
}
