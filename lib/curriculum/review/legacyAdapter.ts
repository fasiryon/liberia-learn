import type { CurriculumReviewAuthority, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { evaluateReviewPolicy } from "./policy";
import { enqueueCurriculumReviewTask } from "./tasks";
import { ReviewOperationError } from "./errors";

type LegacyUser = { id: string; role: Role | string; schoolId?: string | null; isPlatformAdmin?: boolean };

function authorityFor(user: LegacyUser): CurriculumReviewAuthority {
  if (user.role === "MOE_OFFICIAL" || user.role === "MOE_SUPER_ADMIN") return "MOE";
  if (user.isPlatformAdmin) return "PLATFORM";
  return "SCHOOL";
}

function operationsEnabled(): boolean {
  return process.env.P2B_REVIEW_OPERATIONS_ENABLED?.trim() === "true";
}

function shadowEnabled(): boolean {
  return process.env.P2B_REVIEW_SHADOW_ENABLED?.trim() === "true";
}

export async function enforceLegacyReviewAdapter(input: {
  contentId: string;
  user: LegacyUser;
  requestedAction: string;
  idempotencyKey: string;
}): Promise<void> {
  if (!operationsEnabled() && !shadowEnabled()) return;
  const content = await prisma.curriculumContent.findUnique({
    where: { contentId: input.contentId },
    include: { provenance: { include: { currentRevision: { include: { evidence: { where: { status: "ACTIVE" }, select: { id: true } } } } } } },
  });
  if (!content?.provenance?.currentRevision) throw new ReviewOperationError("P2B_EXACT_REVISION_REQUIRED", 409);
  const payload = (content.payload as Record<string, unknown>) ?? {};
  const rawRisk = Number(payload.riskScore ?? 0);
  const riskBand = rawRisk >= 8 ? "CRITICAL" : rawRisk >= 6 ? "HIGH" : rawRisk <= 2 ? "LOW" : "STANDARD";
  const nationalPublication = authorityFor(input.user) === "MOE";
  const policyInput = {
    subject: content.subject,
    grade: content.grade,
    contentType: content.contentType,
    requestedAuthority: authorityFor(input.user),
    riskBand,
    riskScore: rawRisk,
    riskReasons: Array.isArray(payload.riskReasons) ? payload.riskReasons.map(String) : [],
    nationalPublication,
    waecAuthoritative: content.waecSyllabusTopics.length > 0,
    provenanceComplete: content.provenance.provenanceCompleteness !== "UNVERIFIED",
    evidenceCount: content.provenance.currentRevision.evidence.length,
  } as const;
  const policy = evaluateReviewPolicy(policyInput);
  if (shadowEnabled() && !operationsEnabled()) {
    await logAudit({
      userId: input.user.id,
      action: "p2b.shadow.legacy_decision",
      resourceType: "curriculum",
      resourceId: content.contentId,
      schoolId: content.schoolId,
      details: {
        requestedAction: input.requestedAction,
        revisionId: content.provenance.currentRevision.id,
        legacyAuthority: authorityFor(input.user),
        p2bRequiredAuthority: policy.requiredAuthority,
        p2bRequiredReviewCount: policy.requiredReviewCount,
        p2bApprovalBlocked: policy.approvalBlocked,
      },
    });
    return;
  }
  const task = await prisma.curriculumReviewTask.findFirst({
    where: {
      revisionId: content.provenance.currentRevision.id,
      policyKey: policy.policyKey,
      policyVersion: policy.policyVersion,
      status: { in: ["QUEUED", "CLAIMED", "IN_REVIEW", "AWAITING_SECOND_REVIEW", "DISAGREEMENT", "ESCALATED"] },
    },
  }) ?? await enqueueCurriculumReviewTask({
    provenanceId: content.provenance.id,
    revisionId: content.provenance.currentRevision.id,
    riskBand,
    riskScore: rawRisk,
    riskReasons: policyInput.riskReasons,
    requestedAuthority: authorityFor(input.user),
    nationalPublication,
    waecAuthoritative: policyInput.waecAuthoritative,
    schoolId: content.schoolId,
    createdByUserId: input.user.id,
    idempotencyKey: `legacy-adapter:${input.idempotencyKey}`,
  });
  throw new ReviewOperationError(
    "P2B_WORKFLOW_REQUIRED",
    409,
    "Qualified review workflow is required",
    { taskId: task.id, reviewUrl: `/review/tasks/${task.id}` },
  );
}

export async function assertMoeReleaseReady(versionId: string, requestedContentIds?: string[]): Promise<string[]> {
  const contents = await prisma.curriculumContent.findMany({
    where: requestedContentIds?.length ? { contentId: { in: requestedContentIds } } : { versionId },
    include: {
      provenance: {
        include: {
          currentRevision: {
            include: {
              governanceEvents: {
                where: {
                  eventType: { in: ["APPROVED", "REAPPROVED", "REINSTATED"] },
                  reviewAuthority: "MOE",
                  correctedBy: null,
                },
                include: { reviewDecision: true },
              },
            },
          },
        },
      },
    },
  });
  const notReady = contents.filter((content) =>
    !content.provenance?.currentRevision ||
    !content.provenance.currentRevision.governanceEvents.some((event) => event.reviewDecision?.status === "FINAL"),
  );
  if (notReady.length) {
    throw new ReviewOperationError("MOE_RELEASE_REQUIRES_QUALIFIED_DECISIONS", 409, "Every current revision needs a final qualified MOE decision", {
      contentIds: notReady.map((content) => content.contentId),
    });
  }
  return contents.map((content) => content.contentId);
}
