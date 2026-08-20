import type {
  CurriculumReviewAuthority,
  CurriculumReviewSlot,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";

export const REVIEW_ELIGIBILITY_REASON = {
  ELIGIBLE: "ELIGIBLE",
  PROFILE_MISSING: "PROFILE_MISSING",
  PROFILE_INACTIVE: "PROFILE_INACTIVE",
  REVIEWER_UNAVAILABLE: "REVIEWER_UNAVAILABLE",
  RBAC_CEILING: "RBAC_CEILING",
  SCHOOL_SCOPE: "SCHOOL_SCOPE",
  CAPACITY_EXHAUSTED: "CAPACITY_EXHAUSTED",
  CALIBRATION_REQUIRED: "CALIBRATION_REQUIRED",
  CREDENTIAL_MISSING: "CREDENTIAL_MISSING",
  CREDENTIAL_EXPIRED: "CREDENTIAL_EXPIRED",
  CREDENTIAL_SCOPE_MISMATCH: "CREDENTIAL_SCOPE_MISMATCH",
  SPECIALIST_CREDENTIAL_MISSING: "SPECIALIST_CREDENTIAL_MISSING",
  RESTRICTION_ACTIVE: "RESTRICTION_ACTIVE",
  AUTHOR_CONFLICT: "AUTHOR_CONFLICT",
  SOURCE_CHAIN_CONFLICT: "SOURCE_CHAIN_CONFLICT",
  PRIOR_REVIEWER_CONFLICT: "PRIOR_REVIEWER_CONFLICT",
  LEGACY_CONFLICT_UNRESOLVED: "LEGACY_CONFLICT_UNRESOLVED",
  REVISION_STALE: "REVISION_STALE",
  TASK_CLOSED: "TASK_CLOSED",
} as const;

export type ReviewEligibilityReason =
  (typeof REVIEW_ELIGIBILITY_REASON)[keyof typeof REVIEW_ELIGIBILITY_REASON];

export type EligibilityUser = {
  id: string;
  role: Role | string;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

export type ReviewEligibilityResult = {
  eligible: boolean;
  reasons: ReviewEligibilityReason[];
  reviewerProfileId?: string;
  credentialId?: string;
  credentialScopeId?: string;
  authority?: CurriculumReviewAuthority;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function hasAuthorityCeiling(
  user: EligibilityUser,
  required: CurriculumReviewAuthority,
  taskSchoolId: string | null,
): boolean {
  if (user.role === "MOE_DISTRICT_ADMIN") return false;
  if (required === "MOE") return user.role === "MOE_OFFICIAL" || user.role === "MOE_SUPER_ADMIN";
  if (required === "PLATFORM") return user.isPlatformAdmin === true;
  if (required === "SCHOOL") {
    if (user.isPlatformAdmin || user.role === "MOE_OFFICIAL" || user.role === "MOE_SUPER_ADMIN") return true;
    return (user.role === "ADMIN" || user.role === "TEACHER") && Boolean(user.schoolId) && user.schoolId === taskSchoolId;
  }
  return false;
}

function credentialAuthorityMatches(
  credential: CurriculumReviewAuthority,
  required: CurriculumReviewAuthority,
): boolean {
  if (required === "SCHOOL") return ["SCHOOL", "MOE", "PLATFORM"].includes(credential);
  return credential === required;
}

function scopeMatches(
  scope: {
    subject: string | null;
    gradeMin: number | null;
    gradeMax: number | null;
    curriculumTypes: string[];
    curriculumScopes: string[];
    schoolId: string | null;
  },
  task: {
    schoolId: string | null;
    requiredAuthority: CurriculumReviewAuthority;
    revision: { contentSnapshot: Prisma.JsonValue };
  },
): boolean {
  const snapshot = task.revision.contentSnapshot as Record<string, unknown>;
  const identity = snapshot.identity && typeof snapshot.identity === "object" && !Array.isArray(snapshot.identity)
    ? snapshot.identity as Record<string, unknown>
    : {};
  const subject = String(identity.subject ?? snapshot.subject ?? "").trim().toUpperCase();
  const grade = Number(identity.grade ?? snapshot.grade);
  const contentType = String(identity.contentType ?? snapshot.contentType ?? "").trim().toLowerCase();
  if (scope.subject && scope.subject.trim().toUpperCase() !== subject) return false;
  if (scope.gradeMin != null && (grade < scope.gradeMin || grade > (scope.gradeMax ?? scope.gradeMin))) return false;
  if (scope.curriculumTypes.length && !scope.curriculumTypes.map((v) => v.toLowerCase()).includes(contentType)) return false;
  if (task.requiredAuthority === "SCHOOL" && scope.schoolId !== task.schoolId) return false;
  if (task.requiredAuthority === "MOE" && !scope.curriculumScopes.includes("NATIONAL") && !scope.curriculumScopes.includes("WAEC")) return false;
  return true;
}

export async function reviewEligibility(
  input: {
    user: EligibilityUser;
    taskId: string;
    slot: CurriculumReviewSlot;
    now?: Date;
    excludeAssignmentId?: string;
    ignoreOwnSubmittedAssessment?: boolean;
  },
  db: DbClient = prisma,
): Promise<ReviewEligibilityResult> {
  const now = input.now ?? new Date();
  const task = await db.curriculumReviewTask.findUnique({
    where: { id: input.taskId },
    include: {
      provenance: { include: { curriculumContent: { select: { editedById: true } } } },
      revision: { include: { sourceRevision: { select: { authorUserId: true } } } },
      assessments: {
        where: { status: "SUBMITTED" },
        select: { reviewerProfile: { select: { userId: true } } },
      },
    },
  });
  if (!task || ["COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status)) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.TASK_CLOSED] };
  }
  if (task.provenance.currentRevisionId !== task.revisionId) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.REVISION_STALE] };
  }
  if (!hasAuthorityCeiling(input.user, task.requiredAuthority, task.schoolId)) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.RBAC_CEILING] };
  }
  if (
    task.requiredAuthority === "SCHOOL" &&
    !input.user.isPlatformAdmin &&
    input.user.role !== "MOE_OFFICIAL" &&
    input.user.role !== "MOE_SUPER_ADMIN" &&
    input.user.schoolId !== task.schoolId
  ) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.SCHOOL_SCOPE] };
  }

  const profile = await db.reviewerProfile.findUnique({
    where: { userId: input.user.id },
    include: {
      credentials: { include: { scopes: true } },
      restrictions: {
        where: {
          effectiveFrom: { lte: now },
          liftedAt: null,
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        },
      },
    },
  });
  if (!profile) return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.PROFILE_MISSING] };
  if (profile.status !== "ACTIVE") return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.PROFILE_INACTIVE], reviewerProfileId: profile.id };
  if (!profile.available) return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.REVIEWER_UNAVAILABLE], reviewerProfileId: profile.id };
  if (profile.restrictions.length) return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.RESTRICTION_ACTIVE], reviewerProfileId: profile.id };

  const activeClaims = await db.curriculumReviewAssignment.count({
    where: {
      reviewerProfileId: profile.id,
      status: "ACTIVE",
      leaseExpiresAt: { gt: now },
      ...(input.excludeAssignmentId ? { id: { not: input.excludeAssignmentId } } : {}),
    },
  });
  if (activeClaims >= profile.maxActiveClaims) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.CAPACITY_EXHAUSTED], reviewerProfileId: profile.id };
  }
  const specialist = (task.specialistRequirements as { credentialTypes?: string[]; calibrationRequired?: boolean } | null) ?? {};
  if (
    specialist.calibrationRequired &&
    (!profile.calibrationEligibleThrough || profile.calibrationEligibleThrough <= now)
  ) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.CALIBRATION_REQUIRED], reviewerProfileId: profile.id };
  }
  if (task.revision.authorUserId === input.user.id || task.provenance.curriculumContent.editedById === input.user.id) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.AUTHOR_CONFLICT], reviewerProfileId: profile.id };
  }
  if (task.revision.sourceRevision?.authorUserId === input.user.id) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.SOURCE_CHAIN_CONFLICT], reviewerProfileId: profile.id };
  }
  if (
    !input.ignoreOwnSubmittedAssessment &&
    task.assessments.some((assessment) => assessment.reviewerProfile.userId === input.user.id)
  ) {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.PRIOR_REVIEWER_CONFLICT], reviewerProfileId: profile.id };
  }
  if (task.provenance.provenanceCompleteness === "UNVERIFIED") {
    return { eligible: false, reasons: [REVIEW_ELIGIBILITY_REASON.LEGACY_CONFLICT_UNRESOLVED], reviewerProfileId: profile.id };
  }

  const verified = profile.credentials.filter(
    (credential) =>
      credential.status === "VERIFIED" &&
      credential.verifiedAt != null &&
      credential.verifierUserId != null &&
      (!credential.validFrom || credential.validFrom <= now) &&
      (!credential.expiresAt || credential.expiresAt > now) &&
      credentialAuthorityMatches(credential.authority, task.requiredAuthority),
  );
  if (!verified.length) {
    const expired = profile.credentials.some(
      (credential) => credential.status === "VERIFIED" && credential.expiresAt != null && credential.expiresAt <= now,
    );
    return {
      eligible: false,
      reasons: [expired ? REVIEW_ELIGIBILITY_REASON.CREDENTIAL_EXPIRED : REVIEW_ELIGIBILITY_REASON.CREDENTIAL_MISSING],
      reviewerProfileId: profile.id,
    };
  }
  const specialistRequired =
    (input.slot === "SECOND" || input.slot === "RESOLVER") &&
    (specialist.credentialTypes?.length ?? 0) > 0;
  const credential = verified.find((candidate) => {
    if (specialistRequired && !specialist.credentialTypes?.includes(candidate.credentialType)) return false;
    return candidate.scopes.some((scope) => scopeMatches(scope, task));
  });
  if (!credential) {
    return {
      eligible: false,
      reasons: [
        specialistRequired
          ? REVIEW_ELIGIBILITY_REASON.SPECIALIST_CREDENTIAL_MISSING
          : REVIEW_ELIGIBILITY_REASON.CREDENTIAL_SCOPE_MISMATCH,
      ],
      reviewerProfileId: profile.id,
    };
  }
  const matchedScope = credential.scopes.find((scope) => scopeMatches(scope, task));
  return {
    eligible: true,
    reasons: [REVIEW_ELIGIBILITY_REASON.ELIGIBLE],
    reviewerProfileId: profile.id,
    credentialId: credential.id,
    credentialScopeId: matchedScope?.id,
    authority: credential.authority,
  };
}
