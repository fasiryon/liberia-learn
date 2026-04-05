import { z } from "zod";

export const enrollmentStatusValues = [
  "ACTIVE",
  "PROMOTED",
  "GRADUATED",
  "TRANSFERRED",
] as const;

export const enrollmentStatusSchema = z.enum(enrollmentStatusValues);

export type EnrollmentStatus = (typeof enrollmentStatusValues)[number];

export function canTransitionEnrollmentStatus(
  currentStatus: EnrollmentStatus,
  nextStatus: EnrollmentStatus
) {
  if (currentStatus === nextStatus) return true;
  if (currentStatus === "ACTIVE") return true;
  if (currentStatus === "PROMOTED") return nextStatus === "GRADUATED" || nextStatus === "TRANSFERRED";
  return false;
}

export function buildPromotionFoundation(input: {
  currentGrade: number;
  status: EnrollmentStatus;
}) {
  return {
    isTerminal: input.status === "GRADUATED" || input.status === "TRANSFERRED",
    nextGradeCandidate: input.status === "PROMOTED" ? input.currentGrade + 1 : null,
    requiresManualReview: input.status === "GRADUATED" || input.currentGrade >= 12,
  };
}
