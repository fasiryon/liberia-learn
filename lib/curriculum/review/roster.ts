import type {
  CurriculumReviewAuthority,
  Prisma,
  ReviewerCredentialStatus,
  ReviewerCredentialType,
  ReviewerOrganizationType,
  ReviewerRestrictionType,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditRequiredWithId } from "@/lib/audit";
import { ReviewOperationError } from "./errors";

type Operator = { id: string; role: Role | string; schoolId?: string | null; isPlatformAdmin?: boolean };

function canAdministerProfile(operator: Operator, authority: CurriculumReviewAuthority, schoolId?: string | null): boolean {
  if (operator.isPlatformAdmin) return true;
  if (authority === "MOE") return operator.role === "MOE_SUPER_ADMIN" || (operator.role === "MOE_OFFICIAL" && operator.isPlatformAdmin === true);
  if (authority === "SCHOOL") return operator.role === "ADMIN" && Boolean(operator.schoolId) && operator.schoolId === schoolId;
  return false;
}

function canVerifyCredential(
  operator: Operator,
  credential: { authority: CurriculumReviewAuthority; credentialType: ReviewerCredentialType; reviewerProfile: { userId: string; schoolId: string | null } },
): boolean {
  if (operator.id === credential.reviewerProfile.userId) return false;
  if (credential.credentialType === "WAEC_SUBJECT_REVIEW") return false;
  if (credential.authority === "MOE") return operator.role === "MOE_SUPER_ADMIN" || (operator.role === "MOE_OFFICIAL" && operator.isPlatformAdmin === true);
  if (credential.authority === "SCHOOL") {
    return operator.role === "ADMIN" && Boolean(operator.schoolId) && operator.schoolId === credential.reviewerProfile.schoolId;
  }
  return operator.isPlatformAdmin === true;
}

export async function createReviewerProfile(input: {
  operator: Operator;
  userId: string;
  organizationType: ReviewerOrganizationType;
  authority: CurriculumReviewAuthority;
  schoolId?: string | null;
  organizationName?: string | null;
  tier?: number;
  languages?: string[];
  idempotencyKey: string;
}) {
  if (!canAdministerProfile(input.operator, input.authority, input.schoolId)) {
    throw new ReviewOperationError("ROSTER_ADMIN_FORBIDDEN", 403);
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reviewerProfile.findFirst({
      where: { OR: [{ userId: input.userId }, { creationIdempotencyKey: input.idempotencyKey }] },
    });
    if (existing) return existing;
    const profile = await tx.reviewerProfile.create({
      data: {
        userId: input.userId,
        organizationType: input.organizationType,
        authority: input.authority,
        schoolId: input.schoolId ?? null,
        organizationName: input.organizationName ?? null,
        tier: input.tier ?? 1,
        languages: input.languages ?? [],
        creationIdempotencyKey: input.idempotencyKey,
      },
    });
    await logAuditRequiredWithId({
      userId: input.operator.id,
      action: "reviewer.profile.created",
      resourceType: "reviewer_profile",
      resourceId: profile.id,
      schoolId: profile.schoolId,
      details: { idempotencyKey: input.idempotencyKey, authority: profile.authority, subjectQualificationInferred: false },
    }, tx);
    return profile;
  });
}

export async function updateReviewerAvailability(input: {
  operator: Operator;
  profileId: string;
  available: boolean;
  maxActiveClaims: number;
  expectedVersion: number;
}) {
  const profile = await prisma.reviewerProfile.findUnique({ where: { id: input.profileId } });
  if (!profile || !canAdministerProfile(input.operator, profile.authority, profile.schoolId)) {
    throw new ReviewOperationError("PROFILE_NOT_FOUND", 404);
  }
  return prisma.$transaction(async (tx) => {
    const changed = await tx.reviewerProfile.updateMany({
      where: { id: profile.id, version: input.expectedVersion },
      data: { available: input.available, maxActiveClaims: input.maxActiveClaims, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ReviewOperationError("PROFILE_VERSION_CONFLICT", 409);
    await logAuditRequiredWithId({
      userId: input.operator.id,
      action: "reviewer.profile.availability.updated",
      resourceType: "reviewer_profile",
      resourceId: profile.id,
      schoolId: profile.schoolId,
      details: { available: input.available, maxActiveClaims: input.maxActiveClaims },
    }, tx);
    return tx.reviewerProfile.findUniqueOrThrow({ where: { id: profile.id } });
  });
}

export type CredentialScopeInput = {
  subject?: string | null;
  gradeMin?: number | null;
  gradeMax?: number | null;
  domains?: string[];
  curriculumScopes?: ("SCHOOL" | "NATIONAL" | "WAEC" | "IMPORTED" | "LICENSED_SOURCE")[];
  curriculumTypes?: string[];
  schoolId?: string | null;
  county?: string | null;
  standardRefs?: string[];
  language?: string | null;
};

export async function createReviewerCredential(input: {
  operator: Operator;
  reviewerProfileId: string;
  credentialType: ReviewerCredentialType;
  issuer: string;
  authority: CurriculumReviewAuthority;
  validFrom?: Date | null;
  expiresAt?: Date | null;
  evidenceRef?: string | null;
  notes?: string | null;
  supersedesCredentialId?: string | null;
  scopes: CredentialScopeInput[];
  idempotencyKey: string;
}) {
  const profile = await prisma.reviewerProfile.findUnique({ where: { id: input.reviewerProfileId } });
  if (!profile || !canAdministerProfile(input.operator, input.authority, profile.schoolId)) {
    throw new ReviewOperationError("PROFILE_NOT_FOUND", 404);
  }
  if (input.scopes.length === 0) throw new ReviewOperationError("CREDENTIAL_SCOPE_REQUIRED", 400);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reviewerCredential.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { scopes: true } });
    if (existing) return existing;
    const credential = await tx.reviewerCredential.create({
      data: {
        reviewerProfileId: profile.id,
        credentialType: input.credentialType,
        issuer: input.issuer,
        authority: input.authority,
        validFrom: input.validFrom,
        expiresAt: input.expiresAt,
        evidenceRef: input.evidenceRef,
        notes: input.notes,
        supersedesCredentialId: input.supersedesCredentialId,
        idempotencyKey: input.idempotencyKey,
        scopes: { create: input.scopes },
      },
      include: { scopes: true },
    });
    await logAuditRequiredWithId({
      userId: input.operator.id,
      action: "reviewer.credential.created",
      resourceType: "reviewer_credential",
      resourceId: credential.id,
      schoolId: profile.schoolId,
      details: { idempotencyKey: input.idempotencyKey, credentialType: credential.credentialType, status: credential.status },
    }, tx);
    return credential;
  });
}

export async function transitionReviewerCredential(input: {
  operator: Operator;
  credentialId: string;
  toStatus: Exclude<ReviewerCredentialStatus, "DRAFT">;
  reason?: string;
  idempotencyKey: string;
  expectedVersion: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ReviewerCredential" WHERE "id" = ${input.credentialId} FOR UPDATE`;
    const credential = await tx.reviewerCredential.findUnique({
      where: { id: input.credentialId },
      include: { reviewerProfile: true, scopes: true },
    });
    if (!credential) throw new ReviewOperationError("CREDENTIAL_NOT_FOUND", 404);
    if (input.toStatus === "VERIFIED") {
      if (!canVerifyCredential(input.operator, credential)) throw new ReviewOperationError("CREDENTIAL_VERIFY_FORBIDDEN", 403);
      if (!credential.evidenceRef?.trim()) throw new ReviewOperationError("CREDENTIAL_EVIDENCE_REQUIRED", 409);
      if (credential.scopes.length === 0) throw new ReviewOperationError("CREDENTIAL_SCOPE_REQUIRED", 409);
    } else if (!canAdministerProfile(input.operator, credential.authority, credential.reviewerProfile.schoolId)) {
      throw new ReviewOperationError("CREDENTIAL_ADMIN_FORBIDDEN", 403);
    }
    const priorEvent = await tx.reviewerCredentialStatusEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (priorEvent) return credential;
    const auditLogId = await logAuditRequiredWithId({
      userId: input.operator.id,
      action: `reviewer.credential.${input.toStatus.toLowerCase()}`,
      resourceType: "reviewer_credential",
      resourceId: credential.id,
      schoolId: credential.reviewerProfile.schoolId,
      details: { fromStatus: credential.status, toStatus: input.toStatus, reason: input.reason ?? null },
    }, tx);
    const changed = await tx.reviewerCredential.updateMany({
      where: { id: credential.id, version: input.expectedVersion },
      data: {
        status: input.toStatus,
        ...(input.toStatus === "VERIFIED" ? { verifierUserId: input.operator.id, verifiedAt: now } : {}),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ReviewOperationError("CREDENTIAL_VERSION_CONFLICT", 409);
    await tx.reviewerCredentialStatusEvent.create({
      data: {
        credentialId: credential.id,
        fromStatus: credential.status,
        toStatus: input.toStatus,
        actorUserId: input.operator.id,
        reason: input.reason,
        auditLogId,
        occurredAt: now,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return tx.reviewerCredential.findUniqueOrThrow({ where: { id: credential.id }, include: { scopes: true } });
  }, { isolationLevel: "Serializable" });
}

export async function imposeReviewerRestriction(input: {
  operator: Operator;
  reviewerProfileId: string;
  restrictionType: ReviewerRestrictionType;
  reason: string;
  subject?: string | null;
  schoolId?: string | null;
  organizationRef?: string | null;
  effectiveUntil?: Date | null;
  idempotencyKey: string;
}) {
  const profile = await prisma.reviewerProfile.findUnique({ where: { id: input.reviewerProfileId } });
  if (!profile || !canAdministerProfile(input.operator, profile.authority, profile.schoolId)) {
    throw new ReviewOperationError("PROFILE_NOT_FOUND", 404);
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reviewerRestriction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    const auditLogId = await logAuditRequiredWithId({
      userId: input.operator.id,
      action: "reviewer.restriction.imposed",
      resourceType: "reviewer_profile",
      resourceId: profile.id,
      schoolId: profile.schoolId,
      details: { restrictionType: input.restrictionType, reason: input.reason },
    }, tx);
    return tx.reviewerRestriction.create({
      data: {
        reviewerProfileId: profile.id,
        restrictionType: input.restrictionType,
        reason: input.reason,
        subject: input.subject,
        schoolId: input.schoolId,
        organizationRef: input.organizationRef,
        effectiveUntil: input.effectiveUntil,
        imposedByUserId: input.operator.id,
        auditLogId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  });
}
