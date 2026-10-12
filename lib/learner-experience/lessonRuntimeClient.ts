"use client";

/**
 * Browser loader for the server lesson delivery seam (`GET /api/student/lessons/:id/experience`). The id
 * is the lesson's contentId or an enrolled scheduledWorkId, exactly as the learner's route names it. The
 * server applies release, exact-revision, eligibility and lab authorization; nothing is repeated here.
 */
import { loadCachedLesson } from "@/lib/lesson-offline-cache";
import { resolveLessonDelivery, resolveLessonRuntime, unavailableReasonForStatus, type LessonRouteTarget, type LessonRuntimeResolution } from "./lessonRuntime";

/**
 * NO_DELIVERY: the seam had nothing for this route (missing, not a lesson, signed out, offline). The
 * route then keeps its existing behaviour, so legacy deep links are unchanged.
 */
export type LessonDeliveryOutcome = LessonRuntimeResolution | Readonly<{ kind: "NO_DELIVERY"; status: number | "OFFLINE" }>;

export function lessonDeliveryUrl(target: LessonRouteTarget): string {
  const id = target.kind === "CONTENT" ? target.contentId : target.scheduledWorkId;
  return `/api/student/lessons/${encodeURIComponent(id)}/experience`;
}

export async function loadLessonDelivery(target: LessonRouteTarget, serverCompletedAt: string | null = null): Promise<LessonDeliveryOutcome> {
  let response: Response;
  try {
    response = await fetch(lessonDeliveryUrl(target), { cache: "no-store" });
  } catch {
    return { kind: "NO_DELIVERY", status: "OFFLINE" };
  }
  // A version the server no longer delivers is reported honestly instead of falling back to another copy.
  if (response.status === 409) return { kind: "UNAVAILABLE", reason: unavailableReasonForStatus(409) };
  if (!response.ok) return { kind: "NO_DELIVERY", status: response.status };
  const body = await response.json().catch(() => null);
  return body ? resolveLessonDelivery(body, { serverCompletedAt }) : { kind: "UNAVAILABLE", reason: "LOAD_FAILED" };
}

/** A scheduled-work response whose learner text is empty may be a native scene lesson. */
export function mayBeNativeLesson(work: { body?: unknown; bodyStandard?: unknown; bodyBlock?: unknown; contentId?: unknown }): boolean {
  const empty = (value: unknown) => typeof value !== "string" || value.trim() === "";
  return typeof work.contentId === "string" && work.contentId.length > 0 && empty(work.body) && empty(work.bodyStandard) && empty(work.bodyBlock);
}

/** A signed offline copy of a native lesson, read-only. Legacy copies stay with the legacy renderer. */
export async function loadCachedNativeLesson(target: LessonRouteTarget): Promise<LessonRuntimeResolution> {
  const cached = await loadCachedLesson(target.contentId).catch(() => null);
  const payload = cached?.payload as Record<string, unknown> | undefined;
  if (!cached || !payload) return { kind: "UNAVAILABLE", reason: "OFFLINE_NOT_CACHED" };
  if (!("lessonExperience" in payload)) return { kind: "LEGACY" };
  const metadata = cached.metadata as { version?: unknown } | undefined;
  return resolveLessonRuntime({ payload, source: "CACHE", target, contentVersion: typeof metadata?.version === "string" ? metadata.version : null });
}
