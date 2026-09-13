export type StudentAnswerReleasePolicy =
  | { mode: "NEVER" }
  | { mode: "AFTER_COMPLETION" }
  | { mode: "AFTER_TIME"; releaseAt: string };

export function mayReleaseStudentAnswer(input: {
  role: string;
  authenticatedSchoolId: string | null | undefined;
  activitySchoolId: string;
  enrolled: boolean;
  completedAt: Date | null;
  policy: StudentAnswerReleasePolicy | null | undefined;
  now?: Date;
}): boolean {
  if (
    input.role !== "STUDENT" ||
    !input.authenticatedSchoolId ||
    input.authenticatedSchoolId !== input.activitySchoolId ||
    !input.enrolled ||
    !input.policy ||
    input.policy.mode === "NEVER"
  ) return false;

  if (input.policy.mode === "AFTER_COMPLETION") return Boolean(input.completedAt);
  const releaseAt = Date.parse(input.policy.releaseAt);
  return Number.isFinite(releaseAt) && (input.now ?? new Date()).getTime() >= releaseAt;
}
