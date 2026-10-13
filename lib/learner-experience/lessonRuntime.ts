/**
 * Lesson Experience V2 runtime adapter (presentation only).
 *
 * Turns what a student lesson route received from the server into one of three presentation states.
 * The live source is the server delivery seam `GET /api/student/lessons/:id/experience`
 * (`LessonExperienceDelivery`, lib/lessons/lessonExperienceDelivery.ts); a signed offline copy of the
 * learner projection is the read-only fallback. Nothing here grants anything: every check can only
 * deny. Release identity, lesson version, scene/objective identity, lab authorization, assessment
 * references and evidence disposition come from the server response and are presented as given.
 */
import { LearnerProjectionError, rebuildLearnerExperience } from "./learnerSafeExperience";
import { SceneContractError, validateLessonExperience } from "./sceneContract";
import { LESSON_EXPERIENCE_CONTRACT_VERSION, type LessonExperience } from "./types";
import type { ExperienceEvidenceEnvelope } from "./evidenceHandoff";

/** Where the learner opened the lesson from: decides the lesson address a lab returns to. */
export type { LessonRouteTarget } from "./lessonRoute";
import { parseLessonRouteTarget, type LessonRouteTarget } from "./lessonRoute";

/** Stable identity of the lesson being played, exactly as the server stated it. */
export type LessonRuntimeIdentity = Readonly<{
  lessonId: string;
  lessonVersion: string;
  contentId: string;
  /** The curriculum row version the server served (null when it did not say). */
  contentVersion: string | null;
  releaseId: string | null;
  releaseIdentity: string | null;
  /** Exact approved curriculum revision the server delivered (null when it did not say). */
  revisionId: string | null;
}>;

/** A lab link the server authorized for this learner and lesson. The client never authorizes one itself. */
export type RuntimeLabLink = Readonly<{ linkId: string; labId: string; sceneId: string; title: string; summary: string | null; launchContext: import("./labLaunch").LabLaunchContext }>;

/** CURRENT: live from the server. CACHED_READ_ONLY: a signed offline copy; nothing is sent from it. */
export type LessonRuntimeAvailability = "CURRENT" | "CACHED_READ_ONLY";

export type LessonUnavailableReason =
  | "NOT_FOUND"
  | "REVOKED"
  | "NOT_RELEASED"
  | "NOT_STUDENT_READY"
  | "INCOMPATIBLE_VERSION"
  | "OFFLINE_NOT_CACHED"
  | "LOAD_FAILED";

export type NativeLessonRuntime = Readonly<{
  kind: "NATIVE";
  availability: LessonRuntimeAvailability;
  experience: LessonExperience;
  identity: LessonRuntimeIdentity;
  routeTarget: LessonRouteTarget;
  labLinks: readonly RuntimeLabLink[];
  /** The server's evidence disposition for this delivery (e.g. OBSERVATION_ONLY), shown as given. */
  evidenceDisposition: string | null;
  /** Server-recorded completion of the assigned lesson (scheduled work only). Never inferred. */
  serverCompletion: Readonly<{ completedAt: string }> | null;
}>;

export type LessonRuntimeResolution =
  | NativeLessonRuntime
  | Readonly<{ kind: "LEGACY" }>
  | Readonly<{ kind: "UNAVAILABLE"; reason: LessonUnavailableReason }>;

/** Server receipt for an evidence envelope. Dispositions are the server's, shown as given. */
export type EvidenceReceipt = Readonly<{ accepted: boolean; dispositions: readonly Readonly<{ observationId: string; disposition: string }>[] }>;

/**
 * How lesson evidence leaves the device. PRESENTATION_ONLY: no server contract is connected, so the
 * lesson shows progress on this device only. SERVER: an injected channel backed by the server contract.
 */
export type EvidenceChannel =
  | Readonly<{ status: "PRESENTATION_ONLY" }>
  | Readonly<{ status: "SERVER"; submit: (envelope: ExperienceEvidenceEnvelope) => Promise<EvidenceReceipt> }>;

export const PRESENTATION_ONLY_EVIDENCE: EvidenceChannel = Object.freeze({ status: "PRESENTATION_ONLY" });

const ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
export function isSafeRuntimeId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Server-authorized lab links from the delivery (`authorizedLabLinks`), kept only when they point at the
 * LAB_LAUNCH scene that places the same link id. A malformed, unplaced or duplicate entry is dropped.
 */
export function parseAuthorizedLabLinks(raw: unknown, experience: LessonExperience): RuntimeLabLink[] {
  if (!Array.isArray(raw)) return [];
  const links: RuntimeLabLink[] = [];
  for (const entry of raw) {
    const link = record(entry);
    if (!link || link.authorization !== "APPROVED_LINK_CERTIFIED_LAB") continue;
    const { linkId, labId, sceneId, label } = link;
    if (!isSafeRuntimeId(linkId) || !isSafeRuntimeId(labId) || !isSafeRuntimeId(sceneId) || typeof label !== "string" || !label.trim()) continue;
    const scene = experience.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene || scene.type !== "LAB" || scene.interaction.kind !== "LAB_LAUNCH" || scene.interaction.linkId !== linkId) continue;
    if (links.some((existing) => existing.linkId === linkId || existing.sceneId === sceneId)) continue;
    const context = record(link.launchContext);
    const origin = record(context?.origin);
    if (!context || !origin || !isSafeRuntimeId(context.labVersion) || context.v !== 1 || context.labId !== labId || context.linkId !== linkId ||
      origin.experienceId !== experience.id || origin.experienceVersion !== experience.version || origin.sceneId !== sceneId ||
      !isSafeRuntimeId(origin.activityId) || !Array.isArray(origin.objectiveIds) || !origin.objectiveIds.length ||
      origin.objectiveIds.some((id) => !isSafeRuntimeId(id))) continue;
    links.push({ linkId, labId, sceneId, title: label.trim(), summary: null, launchContext: context as import("./labLaunch").LabLaunchContext });
  }
  return links;
}

export const LESSON_DELIVERY_CONTRACT_VERSION = "lesson-experience-delivery/1.1.0" as const;

/** Rebuild + validate a lesson experience; contract or projection failures deny, anything else throws. */
function strictExperience(raw: Record<string, unknown>): LessonExperience | LessonUnavailableReason {
  try {
    // The same strict rebuild the server ran: a cached or altered copy cannot carry more than it did.
    const rebuilt = rebuildLearnerExperience(raw);
    // Cached historical projections may carry formative keys. Never use them in the student runtime.
    const experience: LessonExperience = { ...rebuilt, scenes: rebuilt.scenes.map((scene) => scene.interaction.kind === "MULTIPLE_CHOICE"
      ? { ...scene, interaction: { kind: "MULTIPLE_CHOICE", feedbackAuthority: "SERVER_REQUIRED", items: scene.interaction.items.map(({ id, prompt, options }) => ({ id, prompt, options })) } }
      : scene) };
    validateLessonExperience(experience);
    return experience;
  } catch (error) {
    if (error instanceof LearnerProjectionError || error instanceof SceneContractError) return "NOT_STUDENT_READY";
    throw error;
  }
}

/**
 * Resolve a live `LessonExperienceDelivery`. NATIVE_V2 is the server's statement that it resolved the
 * exact approved revision and published release; the player is shown only with that release identity.
 * LEGACY_COMPATIBLE stays with the existing renderer.
 */
export function resolveLessonDelivery(raw: unknown, input: { serverCompletedAt?: string | null } = {}): LessonRuntimeResolution {
  const delivery = record(raw);
  if (!delivery || delivery.contractVersion !== LESSON_DELIVERY_CONTRACT_VERSION) return { kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" };
  if (delivery.compatibility === "LEGACY_COMPATIBLE") return { kind: "LEGACY" };
  if (delivery.compatibility !== "NATIVE_V2") return { kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" };
  const { lessonId, lessonVersion, releaseId, releaseIdentity, revisionId } = delivery;
  const routeTarget = parseLessonRouteTarget(delivery.routeTarget);
  if (!routeTarget || routeTarget.contentId !== lessonId) return { kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" };
  // The live DTO must be keyless, including unknown correctness/feedback fields.
  const keyed = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(keyed);
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, child]) => (key !== "feedbackAuthority" && /correct|answerkey|scoringkey|feedback|grading|solution/i.test(key)) || keyed(child));
  };
  if (keyed(delivery.scenes) || !Array.isArray(delivery.scenes) || delivery.scenes.some((scene) => scene?.interaction?.kind === "MULTIPLE_CHOICE" && scene.interaction.feedbackAuthority !== "SERVER_REQUIRED")) return { kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" };
  if (!isSafeRuntimeId(lessonId) || typeof lessonVersion !== "string" || !lessonVersion) return { kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" };
  // No release identity, no released lesson: never presented as one.
  if (typeof releaseId !== "string" || !releaseId || typeof releaseIdentity !== "string" || !releaseIdentity) return { kind: "UNAVAILABLE", reason: "NOT_RELEASED" };
  const evidence = record(delivery.evidenceDisposition);
  // The delivery carries its own invariants; a response without them is not trusted for presentation.
  if (!evidence || evidence.masteryMutation !== false || evidence.authoritativeSubmission !== false) return { kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" };
  const experience = strictExperience({
    contractVersion: LESSON_EXPERIENCE_CONTRACT_VERSION,
    id: lessonId, version: lessonVersion, title: delivery.title, subject: delivery.subject, grade: delivery.grade, ageBand: delivery.ageBand,
    authority: { status: "APPROVED_RELEASE", note: "Server-resolved exact-revision release.", candidateContentIds: [], releaseId, releaseIdentity },
    objectives: delivery.objectives, scenes: delivery.scenes,
    // The delivery grants no offline admission of its own.
    offline: { packageable: false, requiredAssets: [] },
  });
  if (typeof experience === "string") return { kind: "UNAVAILABLE", reason: experience };
  return {
    kind: "NATIVE",
    availability: "CURRENT",
    routeTarget,
    experience,
    identity: { lessonId, lessonVersion, contentId: lessonId, contentVersion: lessonVersion, releaseId, releaseIdentity, revisionId: typeof revisionId === "string" ? revisionId : null },
    labLinks: parseAuthorizedLabLinks(delivery.authorizedLabLinks, experience),
    evidenceDisposition: typeof evidence.status === "string" ? evidence.status : null,
    serverCompletion: typeof input.serverCompletedAt === "string" && input.serverCompletedAt ? { completedAt: input.serverCompletedAt } : record(delivery.serverCompletion) && typeof record(delivery.serverCompletion)?.completedAt === "string" ? { completedAt: record(delivery.serverCompletion)!.completedAt as string } : null,
  };
}

/**
 * Resolve a learner projection payload (a curriculum detail response or its signed offline copy). A
 * payload without a native experience is LEGACY (the existing renderer owns it). Lab authorization is
 * never read from a payload: only the delivery seam authorizes lab links.
 */
export function resolveLessonRuntime(input: {
  payload: unknown;
  source: "NETWORK" | "CACHE";
  target: LessonRouteTarget;
  contentVersion?: string | null;
  serverCompletedAt?: string | null;
}): LessonRuntimeResolution {
  const payload = record(input.payload);
  if (!payload) return { kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" };
  if (payload.lessonExperience === undefined) {
    // The projection says outright when a lesson must not be shown (malformed native data, secrets found).
    return payload.studentReady === false ? { kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" } : { kind: "LEGACY" };
  }
  const raw = record(payload.lessonExperience);
  // A copy written by an older or newer contract is not reinterpreted.
  if (!raw || raw.contractVersion !== LESSON_EXPERIENCE_CONTRACT_VERSION) return { kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" };
  if (input.source === "NETWORK") return { kind: "UNAVAILABLE", reason: "NOT_RELEASED" };
  if (raw.id !== input.target.contentId || (input.contentVersion != null && raw.version !== input.contentVersion)) return { kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" };
  const experience = strictExperience(raw);
  if (typeof experience === "string") return { kind: "UNAVAILABLE", reason: experience };
  // Never present an unreleased lesson as released, whatever route served it.
  if (experience.authority.status !== "APPROVED_RELEASE") return { kind: "UNAVAILABLE", reason: "NOT_RELEASED" };
  return {
    kind: "NATIVE",
    availability: "CACHED_READ_ONLY",
    routeTarget: input.target,
    experience,
    identity: {
      lessonId: experience.id,
      lessonVersion: experience.version,
      contentId: input.target.contentId,
      contentVersion: input.contentVersion ?? null,
      releaseId: experience.authority.releaseId,
      releaseIdentity: experience.authority.releaseIdentity ?? null,
      revisionId: null,
    },
    // A payload never authorizes a lab, and a cached copy cannot re-check one.
    labLinks: [],
    evidenceDisposition: input.source === "CACHE" ? "READ_ONLY" : null,
    serverCompletion: typeof input.serverCompletedAt === "string" && input.serverCompletedAt ? { completedAt: input.serverCompletedAt } : null,
  };
}

/** HTTP outcome of the lesson request mapped to an honest unavailable reason. */
export function unavailableReasonForStatus(status: number): LessonUnavailableReason {
  if (status === 410) return "REVOKED";
  if (status === 409) return "INCOMPATIBLE_VERSION";
  if (status === 404 || status === 403) return "NOT_FOUND";
  return "LOAD_FAILED";
}

/** The lesson address for a route target, optionally restoring a scene after a lab. */
export { lessonRouteHref } from "./lessonRoute";

/** The scene to restore when the URL says the learner came back from a lab. */
export function returnSceneFromSearch(search: URLSearchParams | null | undefined): string | null {
  if (!search || search.get("from") !== "lab") return null;
  const scene = search.get("scene");
  return isSafeRuntimeId(scene) ? scene : null;
}
