/** Route identity is presentation identity, never learner or release authority. */
export type LessonRouteTarget =
  | Readonly<{ kind: "CONTENT"; contentId: string }>
  | Readonly<{ kind: "SCHEDULED_WORK"; scheduledWorkId: string; contentId: string }>;
export type LessonRouteRef = Readonly<{ kind: "CONTENT"; contentId: string } | { kind: "SCHEDULED_WORK"; scheduledWorkId: string }>;
export type LessonReturnTarget = Readonly<{ route: LessonRouteTarget; sceneId: string }>;
const ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
export function safeLessonId(value: unknown): value is string { return typeof value === "string" && ID.test(value); }
export function parseLessonRouteTarget(raw: unknown): LessonRouteTarget | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const t = raw as Record<string, unknown>;
  if (!safeLessonId(t.contentId)) return null;
  if (t.kind === "CONTENT") return { kind: "CONTENT", contentId: t.contentId };
  if (t.kind === "SCHEDULED_WORK" && safeLessonId(t.scheduledWorkId)) return { kind: "SCHEDULED_WORK", scheduledWorkId: t.scheduledWorkId, contentId: t.contentId };
  return null;
}
export function lessonRouteHref(target: LessonRouteTarget | LessonReturnTarget, sceneId?: string | null): string {
  const route = "route" in target ? target.route : target;
  const scene = "route" in target ? target.sceneId : sceneId;
  if (!parseLessonRouteTarget(route) || (scene && !safeLessonId(scene))) throw new Error("invalid_lesson_route");
  const base = route.kind === "CONTENT" ? `/student/lesson/${encodeURIComponent(route.contentId)}` : `/student/lessons/${encodeURIComponent(route.scheduledWorkId)}`;
  return scene ? `${base}?${new URLSearchParams({ scene, from: "lab" })}` : base;
}
export function encodeReturnTarget(target: LessonRouteRef): `c:${string}` | `w:${string}` {
  const id = target.kind === "CONTENT" ? target.contentId : target.scheduledWorkId;
  if (!safeLessonId(id)) throw new Error("invalid_lesson_route");
  return target.kind === "CONTENT" ? `c:${id}` : `w:${id}`;
}
export function decodeReturnTarget(encoded: unknown, contentId: string): LessonRouteTarget | null {
  if (typeof encoded !== "string" || !safeLessonId(contentId)) return null;
  const match = /^([cw]):(.+)$/.exec(encoded);
  if (!match || !safeLessonId(match[2])) return null;
  return match[1] === "c" ? (match[2] === contentId ? { kind: "CONTENT", contentId } : null)
    : { kind: "SCHEDULED_WORK", scheduledWorkId: match[2], contentId };
}

export function lessonRouteMatches(target: LessonRouteTarget, ref: LessonRouteRef): boolean {
  return target.kind === ref.kind && (ref.kind === "CONTENT" ? target.contentId === ref.contentId
    : target.kind === "SCHEDULED_WORK" && target.scheduledWorkId === ref.scheduledWorkId);
}
