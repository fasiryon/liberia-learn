import { z } from "zod";

/** Browser input is an identity hint, never educational authority. */
export const TutorIdentitySchema = z.object({
  lessonId: z.string().trim().min(1).max(200).optional(),
  contentId: z.string().trim().min(1).max(200).optional(),
  lessonVersion: z.string().trim().min(1).max(100).optional(),
  revisionId: z.string().trim().min(1).max(200).optional(),
  experienceId: z.string().trim().min(1).max(200).optional(),
  experienceVersion: z.string().trim().min(1).max(100).optional(),
  sceneId: z.string().trim().min(1).max(200).optional(),
  objectiveIds: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  releaseId: z.string().trim().min(1).max(200).optional(),
});
export const TutorActionSchema = z.enum(["explain", "explain_differently", "practice", "step_by_step"]);
export type TutorIdentity = z.infer<typeof TutorIdentitySchema>;
export type TutorAction = z.infer<typeof TutorActionSchema>;
export type TutorGroundingStrength = "STRONG" | "MEDIUM" | "WEAK";
export type TutorSourceTier = 0 | 1 | 2 | 3;

export function tutorActionForQuestion(question: string): TutorAction {
  if (/explain.*different|simpler words/i.test(question)) return "explain_differently";
  if (/generate practice|practice question/i.test(question)) return "practice";
  return "explain";
}
