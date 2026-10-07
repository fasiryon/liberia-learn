/**
 * Server loader for the Phase A internal prototype. The prototype uses an
 * unreleased lesson fixture and the DRAFT Mount Coffee lab, so it is gated
 * exactly like the lab review harness: never in a production build, never on
 * Vercel, and only with LAB_REVIEW_HARNESS=1. Real students cannot reach it.
 */
import { getEnabledToolkitCategories } from "@/components/toolkit/ToolkitProvider";
import { isLabReviewHarnessEnabled } from "@/lib/interactive-labs/v2/review/scenarios";
import { LESSON_EXPERIENCES } from "./fixtures/hydropowerLesson";
import { findLabExperience, type LabExperience } from "./labExperience";
import { validateExperienceLink } from "./links";
import { validateLessonExperience } from "./sceneContract";
import { enabledToolIds, sceneTools, type SceneToolView } from "./tools";

export const PROTOTYPE_BASE_PATH = "/lab-review/experience";

export function isLearnerExperiencePrototypeEnabled(env: Record<string, string | undefined>): boolean {
  return isLabReviewHarnessEnabled(env);
}

export function loadPrototypeExperience(experienceId: string) {
  const entry = LESSON_EXPERIENCES[experienceId];
  if (!entry) return null;
  validateLessonExperience(entry.experience);
  const labs: Record<string, LabExperience> = {};
  for (const link of entry.links) {
    const lab = findLabExperience(link.experience.labId);
    if (!lab) continue;
    validateExperienceLink(link, entry.experience, lab);
    labs[lab.labId] = lab;
  }
  const enabled = enabledToolIds(getEnabledToolkitCategories());
  const toolsByScene: Record<string, SceneToolView[]> = Object.fromEntries(entry.experience.scenes.map((scene) => [scene.id, sceneTools(scene, enabled)]));
  return { experience: entry.experience, links: entry.links, labs, toolsByScene };
}
