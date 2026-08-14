import type { Role } from "@prisma/client";

export type ReviewScopeUser = {
  role: Role | string;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

export function hasNationalReviewCeiling(user: ReviewScopeUser): boolean {
  return (
    user.isPlatformAdmin === true ||
    user.role === "MOE_OFFICIAL" ||
    user.role === "MOE_SUPER_ADMIN"
  );
}

export function hasSchoolReviewCeiling(user: ReviewScopeUser): boolean {
  return user.role === "ADMIN" && Boolean(user.schoolId);
}

export function curriculumSchoolScopeWhere(user: ReviewScopeUser) {
  if (hasNationalReviewCeiling(user)) return {};
  if (!hasSchoolReviewCeiling(user)) return { id: "__review_scope_denied__" };

  const schoolId = user.schoolId as string;
  return {
    OR: [
      { schoolId },
      { schoolId: null, editedBy: { schoolId } },
    ],
  };
}

export function assertCurriculumSchoolScope(
  user: ReviewScopeUser,
  content: { schoolId?: string | null; editedBy?: { schoolId?: string | null } | null }
): void {
  if (hasNationalReviewCeiling(user)) return;
  const ownerSchoolId = content.schoolId ?? content.editedBy?.schoolId ?? null;
  if (!hasSchoolReviewCeiling(user) || ownerSchoolId !== user.schoolId) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
}
