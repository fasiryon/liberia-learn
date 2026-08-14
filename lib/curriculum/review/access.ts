import type { Role } from "@prisma/client";
import { ReviewOperationError } from "./errors";

export type ReviewAccessUser = {
  id: string;
  role: Role | string;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

export function assertReviewReadScope(user: ReviewAccessUser, taskSchoolId: string | null): void {
  if (user.isPlatformAdmin || ["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN"].includes(user.role)) return;
  if ((user.role === "ADMIN" || user.role === "TEACHER") && user.schoolId && user.schoolId === taskSchoolId) return;
  throw new ReviewOperationError("TASK_NOT_FOUND", 404);
}

export function assertReviewOperationsAdmin(user: ReviewAccessUser, schoolId?: string | null): void {
  if (user.isPlatformAdmin || user.role === "MOE_SUPER_ADMIN") return;
  if (user.role === "ADMIN" && user.schoolId && (!schoolId || schoolId === user.schoolId)) return;
  throw new ReviewOperationError("REVIEW_ADMIN_FORBIDDEN", 403);
}

export function queueSchoolFilter(user: ReviewAccessUser): string | null | undefined {
  if (user.isPlatformAdmin || ["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN"].includes(user.role)) return undefined;
  if ((user.role === "ADMIN" || user.role === "TEACHER") && user.schoolId) return user.schoolId;
  throw new ReviewOperationError("REVIEW_QUEUE_FORBIDDEN", 403);
}
