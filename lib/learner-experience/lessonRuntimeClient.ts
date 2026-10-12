"use client";

/**
 * Browser loader for the server lesson delivery seam (`GET /api/student/lessons/:id/experience`). The id
 * is the lesson's contentId or an enrolled scheduledWorkId, exactly as the learner's route names it. The
 * server applies release, exact-revision, eligibility and lab authorization; nothing is repeated here.
 */
import { lessonRouteMatches, parseLessonRouteTarget, type LessonRouteRef } from "./lessonRoute";
import { loadCachedLesson } from "@/lib/lesson-offline-cache";
import { resolveLessonDelivery, resolveLessonRuntime, unavailableReasonForStatus, type LessonRouteTarget, type LessonRuntimeResolution } from "./lessonRuntime";

/**
 * NO_DELIVERY is an indistinguishable 404 (historical content detail may resolve a legacy lesson),
 * or a transport failure (the admitted offline cache owns presentation). Native denials never use it.
 */
export type LessonDeliveryOutcome = LessonRuntimeResolution | Readonly<{ kind: "NO_DELIVERY"; status: number | "OFFLINE" }>;

export function lessonDeliveryUrl(target: LessonRouteRef, requestedVersion?: string): string {
  const id = target.kind === "CONTENT" ? target.contentId : target.scheduledWorkId;
  const query = new URLSearchParams({ kind: target.kind });
  if (requestedVersion !== undefined) query.set("version", requestedVersion);
  return `/api/student/lessons/${encodeURIComponent(id)}/experience?${query}`;
}

export async function loadLessonDelivery(target: LessonRouteRef, serverCompletedAt: string | null = null, requestedVersion?: string): Promise<LessonDeliveryOutcome> {
  let response: Response;
  try {
    response = await fetch(lessonDeliveryUrl(target, requestedVersion), { cache: "no-store" });
  } catch {
    return { kind: "NO_DELIVERY", status: "OFFLINE" };
  }
  const body = await response.json().catch(() => null);
  if (response.status === 409) return { kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" };
  if (!response.ok) {
    if (body?.format === "NATIVE_V2") {
      const reason = ["REVOKED", "NOT_RELEASED", "NOT_STUDENT_READY"].includes(body.reason) ? body.reason : unavailableReasonForStatus(response.status);
      return { kind: "UNAVAILABLE", reason };
    }
    // Only an indistinguishable 404 can consult historical legacy detail. Never fall back on server failure.
    return response.status === 404 ? { kind: "NO_DELIVERY", status: 404 } : { kind: "UNAVAILABLE", reason: unavailableReasonForStatus(response.status) };
  }
  if (!body) return { kind: "UNAVAILABLE", reason: "LOAD_FAILED" };
  const routeTarget = parseLessonRouteTarget(body.routeTarget);
  if (!routeTarget || !lessonRouteMatches(routeTarget, target)) return { kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" };
  const resolved = resolveLessonDelivery(body, { serverCompletedAt });
  return resolved;
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
