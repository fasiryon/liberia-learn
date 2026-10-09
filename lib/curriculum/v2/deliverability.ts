/**
 * Executable accessibility / offline deliverability (Codex P1-8).
 *
 * A textAlternative string is not proof that a learner can be taught. For every scene and
 * every runtime constraint, this checks whether Lesson Player V2 — as it exists today — can
 * deliver the declared experience, or a declared fallback that the runtime can render and that
 * preserves the objective. Anything else is NOT_DELIVERABLE and blocks the lesson in review:
 * the artifact stays incomplete rather than pretending to be deliverable.
 */
import type { LabExperience } from "@/lib/learner-experience/labExperience";
import type { CandidateScene, FallbackKind, InteractionKind, ReviewGap } from "./contract";

export const RUNTIME_SCENARIOS = [
  "DEFAULT", "OFFLINE", "WEBGL_UNAVAILABLE", "VIDEO_UNAVAILABLE", "KEYBOARD_ONLY", "SCREEN_READER", "REDUCED_MOTION", "LOW_MEMORY", "POINTER_DRAG_UNAVAILABLE",
] as const;
export type RuntimeScenario = (typeof RUNTIME_SCENARIOS)[number];

/** Interactions Lesson Player V2 renders today (components/learner-experience). */
export const RENDERABLE_INTERACTIONS: ReadonlySet<InteractionKind> = new Set(["NONE", "DIAGRAM_REVEAL", "SINGLE_CHOICE", "FREE_RESPONSE", "LAB_LAUNCH", "ASSESSMENT_HANDOFF"]);
/** Fallbacks it can render (compat.ts): text walkthroughs, paper activities, and a written-response input. */
export const RENDERABLE_FALLBACKS: ReadonlySet<FallbackKind> = new Set(["TEXT_WALKTHROUGH", "PAPER_ACTIVITY", "FREE_RESPONSE"]);
/** The player has no media renderer yet, and generation never supplies asset URLs. */
export const RENDERABLE_MEDIA_KINDS: ReadonlySet<string> = new Set();
const POINTER_INTERACTIONS = new Set<InteractionKind>(["DRAG_DROP", "DIAGRAM_LABELING", "MATCHING", "ORDERING"]);
const MOTION_MEDIA = new Set(["ANIMATION", "VIDEO", "INTERACTIVE_MODEL"]);

export type Delivery = "PRIMARY" | "FALLBACK" | "NOT_DELIVERABLE";
export type SceneDeliverability = Readonly<{ sceneId: string; byScenario: Readonly<Record<RuntimeScenario, Delivery>>; reasons: readonly string[] }>;

/** What a LAB scene's lab supports, resolved from the lab registry by the caller. */
export type LabRuntime = Readonly<{ lab: LabExperience | null; studentEligible: boolean; keyboard: boolean; reducedMotion: boolean; offline: boolean; hasFallback2D: boolean }>;

/**
 * Whether the declared fallback itself works in this scenario. A paper activity (drawing, building,
 * handling objects) is not automatically usable with a screen reader: it needs a stated non-visual path.
 */
function usableFallback(scene: CandidateScene, scenario: RuntimeScenario): boolean {
  if (!scene.fallback || !scene.fallback.objectivePreserved || !RENDERABLE_FALLBACKS.has(scene.fallback.kind)) return false;
  if (scene.fallback.kind === "PAPER_ACTIVITY" && scenario === "SCREEN_READER" && !scene.accessibility.nonPointerAlternative) return false;
  return true;
}

export function sceneDeliverability(scene: CandidateScene, lab: LabRuntime | null, assessmentItemsBound: boolean): SceneDeliverability {
  const reasons: string[] = [];
  const byScenario = {} as Record<RuntimeScenario, Delivery>;
  for (const scenario of RUNTIME_SCENARIOS) {
    const fallback = usableFallback(scene, scenario);
    const needs: string[] = [];
    const kind = scene.interaction.kind;
    if (!RENDERABLE_INTERACTIONS.has(kind)) needs.push(`interaction_${kind}_not_renderable`);
    if (POINTER_INTERACTIONS.has(kind) && (scenario === "KEYBOARD_ONLY" || scenario === "SCREEN_READER" || scenario === "POINTER_DRAG_UNAVAILABLE") && !scene.accessibility.nonPointerAlternative) needs.push(`interaction_${kind}_pointer_only`);
    for (const media of scene.media ?? []) {
      if (media.requirement !== "MEDIA_REQUIRED") continue;
      if (!RENDERABLE_MEDIA_KINDS.has(media.kind)) needs.push(`media_${media.kind}_not_renderable`);
      if (scenario === "VIDEO_UNAVAILABLE" && media.kind === "VIDEO") needs.push("video_unavailable");
      if (scenario === "REDUCED_MOTION" && MOTION_MEDIA.has(media.kind) && scene.accessibility.reducedMotion !== "STATIC_EQUIVALENT") needs.push("motion_without_static_equivalent");
      if (scenario === "LOW_MEMORY" && (media.kind === "VIDEO" || media.kind === "INTERACTIVE_MODEL" || media.kind === "ANIMATION")) needs.push(`low_memory_${media.kind}`);
      if ((media.kind === "VIDEO" || media.kind === "NARRATION") && !media.transcript && (scenario === "SCREEN_READER" || scenario === "DEFAULT")) needs.push("audio_without_transcript");
    }
    if (scenario === "OFFLINE" && (scene.offline.mode === "ONLINE_ENHANCED" || scene.offline.mode === "FALLBACK_REQUIRED" || scene.offline.mode === "CACHED_ASSET_REQUIRED")) needs.push(`offline_${scene.offline.mode}`);
    if (kind === "LAB_LAUNCH") {
      if (!lab?.lab) needs.push("lab_unresolved");
      else {
        if (!lab.studentEligible) needs.push("lab_not_student_eligible");
        if (scenario === "OFFLINE" && !lab.offline) needs.push("lab_not_offline");
        if ((scenario === "KEYBOARD_ONLY" || scenario === "SCREEN_READER") && !lab.keyboard) needs.push("lab_not_keyboard_operable");
        if (scenario === "WEBGL_UNAVAILABLE" && !lab.hasFallback2D) needs.push("lab_no_2d_fallback");
        if (scenario === "REDUCED_MOTION" && !lab.reducedMotion) needs.push("lab_not_reduced_motion_safe");
        if (scenario === "POINTER_DRAG_UNAVAILABLE" && !lab.keyboard) needs.push("lab_requires_pointer");
        if (scenario === "LOW_MEMORY" && !lab.hasFallback2D) needs.push("lab_no_low_resource_path");
      }
    }
    if (kind === "ASSESSMENT_HANDOFF" && !assessmentItemsBound) needs.push("assessment_items_not_governed");
    byScenario[scenario] = needs.length === 0 ? "PRIMARY" : fallback ? "FALLBACK" : "NOT_DELIVERABLE";
    if (needs.length && !fallback) reasons.push(...needs.map((need) => `${scenario}:${need}`));
  }
  return { sceneId: scene.id, byScenario, reasons: [...new Set(reasons)] };
}

/**
 * Lesson-level gaps. A scene that cannot be delivered in some scenario blocks review. An
 * assessment with no governed items blocks student delivery too: there is nothing to score.
 */
export function deliverabilityGaps(reports: readonly SceneDeliverability[]): ReviewGap[] {
  const gaps: ReviewGap[] = [];
  for (const report of reports) {
    const blocked = (Object.entries(report.byScenario) as [RuntimeScenario, Delivery][]).filter(([, delivery]) => delivery === "NOT_DELIVERABLE").map(([scenario]) => scenario);
    if (blocked.length) gaps.push({ code: "SCENE_NOT_DELIVERABLE", severity: "BLOCKING", sceneId: report.sceneId, detail: `Not deliverable under ${blocked.join(", ")}: ${report.reasons.slice(0, 4).join("; ")}` });
    else if (Object.values(report.byScenario).some((delivery) => delivery === "FALLBACK")) gaps.push({ code: "SCENE_USES_FALLBACK", severity: "ADVISORY", sceneId: report.sceneId, detail: `Delivered through its declared fallback under: ${(Object.entries(report.byScenario) as [RuntimeScenario, Delivery][]).filter(([, delivery]) => delivery === "FALLBACK").map(([scenario]) => scenario).join(", ")}.` });
  }
  return gaps;
}
