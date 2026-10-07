/**
 * Lesson Player V2 progress and resume. Pure reducers so position, completion
 * and lab return are testable without a browser. Progress is a learner-side
 * convenience: it is never evidence, scoring or mastery.
 */
import type { LessonExperience, Scene } from "./types";
import type { LabReturnObservation } from "./labLaunch";

export const EXPERIENCE_PROGRESS_VERSION = 1 as const;

export type SceneResponses = Readonly<Record<string, number | string>>;

export type ExperienceProgress = Readonly<{
  v: typeof EXPERIENCE_PROGRESS_VERSION;
  experienceId: string;
  experienceVersion: string;
  sceneId: string;
  completedSceneIds: readonly string[];
  responses: Readonly<Record<string, SceneResponses>>;
  revealed: Readonly<Record<string, readonly string[]>>;
  lab: Readonly<{ status: "NOT_STARTED" | "LAUNCHED" | "RETURNED" | "FALLBACK_USED"; observation: LabReturnObservation | null }>;
  updatedAt: string;
}>;

export function initialProgress(experience: LessonExperience, now = new Date().toISOString()): ExperienceProgress {
  return { v: EXPERIENCE_PROGRESS_VERSION, experienceId: experience.id, experienceVersion: experience.version, sceneId: experience.scenes[0].id, completedSceneIds: [], responses: {}, revealed: {}, lab: { status: "NOT_STARTED", observation: null }, updatedAt: now };
}

/**
 * Restore saved progress. A different lesson version starts fresh rather than
 * mapping old answers onto changed scenes.
 */
export function restoreProgress(experience: LessonExperience, raw: unknown): ExperienceProgress {
  const fresh = initialProgress(experience);
  if (!raw || typeof raw !== "object") return fresh;
  const saved = raw as Partial<ExperienceProgress>;
  if (saved.v !== EXPERIENCE_PROGRESS_VERSION || saved.experienceId !== experience.id || saved.experienceVersion !== experience.version) return fresh;
  const sceneIds = new Set(experience.scenes.map((scene) => scene.id));
  if (typeof saved.sceneId !== "string" || !sceneIds.has(saved.sceneId)) return fresh;
  return {
    ...fresh,
    sceneId: saved.sceneId,
    completedSceneIds: Array.isArray(saved.completedSceneIds) ? saved.completedSceneIds.filter((id) => sceneIds.has(id)) : [],
    responses: saved.responses && typeof saved.responses === "object" ? saved.responses : {},
    revealed: saved.revealed && typeof saved.revealed === "object" ? saved.revealed : {},
    lab: saved.lab && typeof saved.lab === "object" ? saved.lab : fresh.lab,
    updatedAt: typeof saved.updatedAt === "string" ? saved.updatedAt : fresh.updatedAt,
  };
}

export function sceneIndexOf(experience: LessonExperience, progress: ExperienceProgress): number {
  return Math.max(0, experience.scenes.findIndex((scene) => scene.id === progress.sceneId));
}

/** Whether the scene's completion rule is met by the learner's progress. */
export function isSceneComplete(scene: Scene, progress: ExperienceProgress): boolean {
  const responses = progress.responses[scene.id] ?? {};
  switch (scene.completion.kind) {
    case "VIEWED": return true;
    case "ALL_STEPS_REVEALED":
      return scene.interaction.kind === "DIAGRAM_REVEAL" && scene.interaction.steps.every((step) => (progress.revealed[scene.id] ?? []).includes(step.id));
    case "ALL_ANSWERED":
      if (scene.interaction.kind === "MULTIPLE_CHOICE") return scene.interaction.items.every((item) => typeof responses[item.id] === "number");
      if (scene.interaction.kind === "ASSESSMENT_HANDOFF") return scene.interaction.assessment.items.every((item) => typeof responses[item.itemId] === "number");
      return false;
    case "ALL_RESPONSES_WRITTEN":
      return scene.interaction.kind === "FREE_RESPONSE" && scene.interaction.prompts.every((prompt) => String(responses[prompt.id] ?? "").trim().length >= prompt.minLength);
    case "LAB_RETURNED_OR_FALLBACK":
      return progress.lab.status === "RETURNED" || progress.lab.status === "FALLBACK_USED";
  }
}

function touch(progress: ExperienceProgress, patch: Partial<ExperienceProgress>, now?: string): ExperienceProgress {
  return { ...progress, ...patch, updatedAt: now ?? new Date().toISOString() };
}

export function goToScene(experience: LessonExperience, progress: ExperienceProgress, sceneId: string): ExperienceProgress {
  if (!experience.scenes.some((scene) => scene.id === sceneId)) return progress;
  return touch(progress, { sceneId });
}

/** Continue: only when the current scene is complete. Marks it complete and moves on. */
export function advance(experience: LessonExperience, progress: ExperienceProgress): ExperienceProgress {
  const index = sceneIndexOf(experience, progress);
  const scene = experience.scenes[index];
  if (!isSceneComplete(scene, progress)) return progress;
  const completedSceneIds = progress.completedSceneIds.includes(scene.id) ? progress.completedSceneIds : [...progress.completedSceneIds, scene.id];
  const next = experience.scenes[Math.min(index + 1, experience.scenes.length - 1)];
  return touch(progress, { completedSceneIds, sceneId: next.id });
}

export function retreat(experience: LessonExperience, progress: ExperienceProgress): ExperienceProgress {
  const index = sceneIndexOf(experience, progress);
  return touch(progress, { sceneId: experience.scenes[Math.max(0, index - 1)].id });
}

export function recordResponse(progress: ExperienceProgress, sceneId: string, key: string, value: number | string): ExperienceProgress {
  return touch(progress, { responses: { ...progress.responses, [sceneId]: { ...(progress.responses[sceneId] ?? {}), [key]: value } } });
}

export function revealStep(progress: ExperienceProgress, sceneId: string, stepId: string): ExperienceProgress {
  const current = progress.revealed[sceneId] ?? [];
  if (current.includes(stepId)) return progress;
  return touch(progress, { revealed: { ...progress.revealed, [sceneId]: [...current, stepId] } });
}

export function markLabLaunched(progress: ExperienceProgress, sceneId: string): ExperienceProgress {
  return touch(progress, { sceneId, lab: { status: progress.lab.status === "RETURNED" ? "RETURNED" : "LAUNCHED", observation: progress.lab.observation } });
}

/** Lab → lesson: restore the originating scene and record what the lab reported. */
export function applyLabReturn(experience: LessonExperience, progress: ExperienceProgress, sceneId: string, observation: LabReturnObservation | null): ExperienceProgress {
  const scene = experience.scenes.find((candidate) => candidate.id === sceneId && candidate.type === "LAB");
  if (!scene) return progress;
  if (!observation) return touch(progress, { sceneId });
  return touch(progress, { sceneId, lab: { status: "RETURNED", observation } });
}

export function chooseLabFallback(progress: ExperienceProgress): ExperienceProgress {
  if (progress.lab.status === "RETURNED") return progress;
  return touch(progress, { lab: { status: "FALLBACK_USED", observation: null } });
}

export function percentComplete(experience: LessonExperience, progress: ExperienceProgress): number {
  return Math.round((progress.completedSceneIds.length / experience.scenes.length) * 100);
}
