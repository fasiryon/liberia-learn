/**
 * Dev-only preview entries for the Grade 7 native candidates (served by /lab-review/experience, which
 * returns 404 in production builds and on Vercel). The preview plays the learner projection in the
 * existing Lesson Player V2. So reviewers can walk the whole flow, the exit-ticket scene shows the
 * candidate items' prompts and options with every key, hint and worked example stripped; nothing is
 * scored, sent or saved, and the experience stays non-released (all evidence is RAW_OBSERVATION).
 */
import type { LearningExperienceLink } from "@/lib/learner-experience/links";
import type { LessonExperience } from "@/lib/learner-experience/types";
import { G7_NATIVE_LESSONS, g7LearnerProjection } from "./g7Native";
import { G7_EXIT_ITEMS } from "./g7NativeReview";

export function g7NativePreviewEntry(experienceId: string): Readonly<{ experience: LessonExperience; links: readonly LearningExperienceLink[] }> | null {
  const lesson = G7_NATIVE_LESSONS.find((candidate) => candidate.lessonId === experienceId);
  if (!lesson) return null;
  const projection = g7LearnerProjection(lesson);
  const items = G7_EXIT_ITEMS[lesson.key].map(({ item }) => ({ itemId: item.id, itemVersion: item.version, prompt: item.prompt, options: [...item.options] }));
  return {
    experience: {
      ...projection,
      authority: { ...projection.authority, note: `${projection.authority.note} Dev preview: the exit ticket shows unreviewed candidate items without keys; nothing is scored.` },
      scenes: projection.scenes.map((scene) => scene.interaction.kind === "ASSESSMENT_HANDOFF" ? { ...scene, interaction: { kind: "ASSESSMENT_HANDOFF", assessment: { ...scene.interaction.assessment, items } } } : scene),
    },
    links: [],
  };
}
