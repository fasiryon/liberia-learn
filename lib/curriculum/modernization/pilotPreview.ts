/**
 * Dev-only preview entries for the Library Modernization pilot candidates, served by
 * /lab-review/experience (404 in production builds, on Vercel, and without LAB_REVIEW_HARNESS=1).
 * The preview plays the committed learner projection exactly as packaged: no keys, rubrics or
 * reviewer-only content, nothing scored, sent or saved, and the experience stays a non-released draft.
 */
import fs from "fs";
import path from "path";
import type { LearningExperienceLink } from "@/lib/learner-experience/links";
import type { LessonExperience } from "@/lib/learner-experience/types";
import { PILOT_DIR, PILOT_LESSONS } from "./pilot";

export function pilotPreviewEntry(experienceId: string): Readonly<{ experience: LessonExperience; links: readonly LearningExperienceLink[] }> | null {
  for (const lesson of PILOT_LESSONS) {
    const specFile = path.join(process.cwd(), PILOT_DIR, lesson.key, "spec.json");
    if (!fs.existsSync(specFile)) continue;
    const spec = JSON.parse(fs.readFileSync(specFile, "utf8")) as { candidateId: string; candidateVersion: string };
    if (spec.candidateId !== experienceId) continue;
    const file = path.join(process.cwd(), PILOT_DIR, lesson.key, "package", spec.candidateVersion, "learner-projection.json");
    if (!fs.existsSync(file)) return null;
    const projection = JSON.parse(fs.readFileSync(file, "utf8")) as LessonExperience;
    return {
      experience: { ...projection, authority: { ...projection.authority, note: `${projection.authority.note} Library modernization pilot candidate; dev preview only, nothing is scored.` } },
      links: [],
    };
  }
  return null;
}
