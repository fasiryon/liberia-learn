import { publishedReleaseForLearner } from "@/lib/learning-authority/publishedReleases";

export type LearnerExperienceAuthority = Readonly<{
  mode: "GOVERNED" | "ORDINARY_SCHOOLWORK";
  nextActionAuthority: "LEARNING_ORCHESTRATOR" | "SCHEDULE_AND_ASSIGNMENTS";
  releaseId: string | null;
}>;

/**
 * The learner surface has one adaptive authority.  Without a registered
 * release it deliberately falls back to schoolwork, never to legacy mastery
 * or weak-topic recommendations.
 */
export function learnerExperienceAuthority(
  grade: number | null | undefined,
  subject?: string,
): LearnerExperienceAuthority {
  const release = grade == null ? null : publishedReleaseForLearner(grade, subject);
  return Object.freeze({
    mode: release ? "GOVERNED" : "ORDINARY_SCHOOLWORK",
    nextActionAuthority: release ? "LEARNING_ORCHESTRATOR" : "SCHEDULE_AND_ASSIGNMENTS",
    releaseId: release?.id ?? null,
  });
}
