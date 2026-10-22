import referenceManifest from "@/curriculum/review/v4-candidates/manifest.json";
import { getEnabledToolkitCategories } from "@/components/toolkit/ToolkitProvider";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { enabledToolIds, sceneTools, type SceneToolView } from "@/lib/learner-experience/tools";
import { evaluateV4Candidate, findV4Lesson, V4_LESSONS, v4LearnerProjection, candidateText, V4_CANDIDATE_VERSION } from "./candidates";
import { factoryReviewSelections, loadFactoryReview } from "./factoryReview";
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { LessonExperience } from "@/lib/learner-experience/types";

export const V4_REVIEW_BASE_PATH = "/lab-review/v4-lessons";
export type V4ReviewOrigin = "FACTORY_GENERATED" | "HAND_AUTHORED_FIXTURE";
export type V4ReviewEntry = {
  selection: string; origin: V4ReviewOrigin; lessonKey: string; candidateVersion: string;
  title: string; grade: number; subject: string; state: "DRAFT"; reviewStatus: string; integrity: "VERIFIED";
  provenance: { sourceLineage: { kind: string; label: string };
    generator?: { executor: string; role: string; modelCalls: number; referenceFixtureCopied: false };
    packageHash?: string; candidateSha256: string; learnerProjectionSha256: string; manifestSha256?: string;
  }; blockers: string[];
};
export type V4ReviewRejection = { selection: string; origin: V4ReviewOrigin; reason: string };
export type V4PreviewResult =
  | { ok: true; entry: V4ReviewEntry; experience: LessonExperience; toolsByScene: Record<string, SceneToolView[]> }
  | { ok: false; reason: string };
const hash = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");
const sourceLabel = (lesson: typeof V4_LESSONS[number]) => lesson.source.kind === "SYNTHETIC_DEMONSTRATION"
  ? { kind: lesson.source.kind, label: "Synthetic demonstration (no approved source)" }
  : { kind: lesson.source.kind, label: `${lesson.source.contentId} @ ${lesson.source.revisionId}` };

function reasonFor(error: unknown) {
  if (error instanceof Error && error.message.startsWith("factory_review_")) return error.message.toUpperCase();
  return "FACTORY_REVIEW_INVALID_PACKAGE";
}

/** Exact source selection. Failure never tries a different source or version. Route owns the harness gate. */
export function loadV4Preview(selection: string): V4PreviewResult {
  try {
    let experience: LessonExperience, entry: V4ReviewEntry;
    if (selection.startsWith("factory@")) {
      const loaded = loadFactoryReview(selection);
      experience = loaded.experience;
      const { manifest, review } = loaded;
      const lesson = findV4Lesson(review.key)!;
      entry = { selection, origin: "FACTORY_GENERATED", lessonKey: review.key, candidateVersion: review.candidateVersion,
        title: experience.title, grade: experience.grade, subject: experience.subject, state: "DRAFT", reviewStatus: manifest.factoryStatus, integrity: "VERIFIED",
        provenance: { sourceLineage: sourceLabel(lesson), generator: manifest.generation, packageHash: review.packageHash,
          candidateSha256: review.candidateSha256, learnerProjectionSha256: manifest.learnerProjectionSha256, manifestSha256: review.manifestSha256 }, blockers: loaded.releaseBlockers };
    } else {
      const lesson = findV4Lesson(selection);
      if (!lesson) return { ok: false, reason: "UNKNOWN_SELECTION" };
      const outcome = evaluateV4Candidate(lesson);
      const pin = referenceManifest.lessons.find(l => l.key === selection);
      if (!pin || createHash("sha256").update(candidateText(lesson)).digest("hex") !== pin.candidate.fileSha256) return { ok: false, reason: "REFERENCE_REVIEW_HASH" };
      if (outcome.status === "REJECTED") return { ok: false, reason: "REFERENCE_REVIEW_REJECTED" };
      experience = v4LearnerProjection(lesson, outcome.candidate);
      if (hash(experience) !== pin.learnerProjectionSha256) return { ok: false, reason: "REFERENCE_REVIEW_PROJECTION_HASH" };
      entry = { selection, origin: "HAND_AUTHORED_FIXTURE", lessonKey: lesson.key, candidateVersion: V4_CANDIDATE_VERSION,
        title: experience.title, grade: lesson.grade, subject: lesson.subject, state: "DRAFT", reviewStatus: outcome.status, integrity: "VERIFIED",
        provenance: { sourceLineage: sourceLabel(lesson), candidateSha256: createHash("sha256").update(candidateText(lesson)).digest("hex"), learnerProjectionSha256: hash(experience) },
        blockers: outcome.gaps.filter(g => g.severity === "BLOCKING").map(g => g.code) };
    }
    validateLessonExperience(experience);
    const enabled = enabledToolIds(getEnabledToolkitCategories());
    const toolsByScene = Object.fromEntries(experience.scenes.map(scene => [scene.id, sceneTools(scene, enabled)]));
    return { ok: true, entry, experience, toolsByScene };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}

export function v4ReviewCatalogue(): { entries: V4ReviewEntry[]; rejected: V4ReviewRejection[] } {
  const entries: V4ReviewEntry[] = [], rejected: V4ReviewRejection[] = [];
  let factorySelections: string[] = [];
  try { factorySelections = factoryReviewSelections(); }
  catch (error) { rejected.push({ selection: "factory", origin: "FACTORY_GENERATED", reason: reasonFor(error) }); }
  for (const selection of [...factorySelections, ...V4_LESSONS.map(l => l.key)]) {
    const result = loadV4Preview(selection);
    if (result.ok === true) entries.push(result.entry);
    else rejected.push({ selection, origin: selection.startsWith("factory@") ? "FACTORY_GENERATED" : "HAND_AUTHORED_FIXTURE", reason: result.reason });
  }
  return { entries, rejected };
}

/** Legacy reference-only index retained for callers while T1 wires the new catalogue. */
export function v4PreviewIndex() {
  return V4_LESSONS.map(lesson => {
    const outcome = evaluateV4Candidate(lesson);
    return { key: lesson.key, title: outcome.candidate.title, grade: lesson.grade, subject: lesson.subject, status: outcome.status,
      source: sourceLabel(lesson), scenes: outcome.candidate.scenes.length, problems: outcome.standard.totals.problems,
      activityShare: outcome.standard.balance.activityShare,
      blockTypes: [...new Set(outcome.candidate.scenes.flatMap(scene => [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])].map(block => block.type)))],
      blocking: outcome.gaps.filter(g => g.severity === "BLOCKING").map(g => g.code) };
  });
}
