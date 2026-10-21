/**
 * Server loader for the Interactive Learning V4 review route (/lab-review/v4-lessons). The candidates are
 * unreviewed DRAFTs, so the route is gated exactly like the Lesson Player V2 prototype: never in a production
 * build and only with LAB_REVIEW_HARNESS=1. Learners cannot reach it; nothing it plays is a released lesson.
 */
import { getEnabledToolkitCategories } from "@/components/toolkit/ToolkitProvider";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { enabledToolIds, sceneTools, type SceneToolView } from "@/lib/learner-experience/tools";
import { evaluateV4Candidate, findV4Lesson, V4_LESSONS, v4LearnerProjection } from "./candidates";

export const V4_REVIEW_BASE_PATH = "/lab-review/v4-lessons";

export function loadV4Preview(key: string) {
  const lesson = findV4Lesson(key);
  if (!lesson) return null;
  const outcome = evaluateV4Candidate(lesson);
  if (outcome.status === "REJECTED") return null;
  const experience = v4LearnerProjection(lesson, outcome.candidate);
  validateLessonExperience(experience);
  const enabled = enabledToolIds(getEnabledToolkitCategories());
  const toolsByScene: Record<string, SceneToolView[]> = Object.fromEntries(experience.scenes.map((scene) => [scene.id, sceneTools(scene, enabled)]));
  return { experience, toolsByScene };
}

/** The gallery rows: identity, lineage and the V4 standard result for each candidate. */
export function v4PreviewIndex() {
  return V4_LESSONS.map((lesson) => {
    const outcome = evaluateV4Candidate(lesson);
    return {
      key: lesson.key, title: outcome.candidate.title, grade: lesson.grade, subject: lesson.subject, status: outcome.status,
      source: lesson.source.kind === "SYNTHETIC_DEMONSTRATION" ? { kind: lesson.source.kind, label: "Synthetic demonstration (no approved source)" } : { kind: lesson.source.kind, label: `${lesson.source.contentId} @ ${lesson.source.revisionId}` },
      scenes: outcome.candidate.scenes.length,
      problems: outcome.standard.totals.problems,
      activityShare: outcome.standard.balance.activityShare,
      blockTypes: [...new Set(outcome.candidate.scenes.flatMap((scene) => [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])].map((block) => block.type)))],
      blocking: outcome.gaps.filter((gap) => gap.severity === "BLOCKING").map((gap) => gap.code),
    };
  });
}
