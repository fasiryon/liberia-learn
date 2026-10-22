import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import { v4LearnerProjection, type V4Lesson } from "./candidates";

/** Preserve legacy draft.4 projection bytes; stamp new packages with their explicit version. */
export function factoryLearnerProjection(lesson: V4Lesson, candidate: CandidateLessonV2, version: string) {
  const experience = v4LearnerProjection(lesson, candidate);
  if (version === "4.0.0-draft.4") return experience;
  return { ...experience, version, scenes: experience.scenes.map(scene => scene.interaction.kind === "ASSESSMENT_HANDOFF"
    ? { ...scene, interaction: { ...scene.interaction, assessment: { ...scene.interaction.assessment, assessmentVersion: version } } } : scene) };
}
