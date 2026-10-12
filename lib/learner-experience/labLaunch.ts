/**
 * Lesson → Lab → Lesson continuity. A lab entered from a lesson carries its
 * origin (lesson, scene, objectives, activity, link) and returns to that exact
 * scene — never to the generic Labs library.
 *
 * The return URL is never taken from the query string: it is rebuilt from a
 * server-chosen base path plus validated identifiers, so the launch context
 * cannot become an open redirect.
 */
export const LAB_LAUNCH_CONTEXT_VERSION = 1 as const;

export type LabLaunchContext = Readonly<{
  v: typeof LAB_LAUNCH_CONTEXT_VERSION;
  labId: string;
  linkId: string;
  origin: Readonly<{ experienceId: string; experienceVersion: string; sceneId: string; objectiveIds: readonly string[]; activityId: string }>;
}>;

/** What the lab host reports back when the learner returns. Presentation facts only; never scores or mastery. */
export type LabReturnObservation = Readonly<{
  labId: string;
  labVersion: string;
  linkId: string;
  completedCheckIds: readonly string[];
  totalChecks: number;
  tripObserved: boolean;
  resetObserved: boolean;
  finalProfile: string;
  minutesInLab: number;
  exit: "COMPLETED" | "RETURNED_EARLY";
}>;

const ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;

function safeId(value: string | null | undefined): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

/** Base paths the player is allowed to live under (server-selected, never user input). */
export const EXPERIENCE_BASE_PATHS = Object.freeze(["/student/learn/experience", "/lab-review/experience"]);

function assertBasePath(basePath: string): void {
  if (!EXPERIENCE_BASE_PATHS.includes(basePath)) throw new Error("experience_base_path_not_allowed");
}

export function labLaunchQuery(context: LabLaunchContext): string {
  const params = new URLSearchParams({
    v: String(context.v),
    link: context.linkId,
    exp: context.origin.experienceId,
    ver: context.origin.experienceVersion,
    scene: context.origin.sceneId,
    activity: context.origin.activityId,
    obj: context.origin.objectiveIds.join(","),
  });
  return params.toString();
}

export function buildLabLaunchHref(basePath: string, context: LabLaunchContext): string {
  assertBasePath(basePath);
  return `${basePath}/${encodeURIComponent(context.origin.experienceId)}/lab/${encodeURIComponent(context.labId)}?${labLaunchQuery(context)}`;
}

/** Parse and validate a launch context from the lab route. Returns null for anything malformed. */
export function parseLabLaunchContext(labId: string, query: Record<string, string | string[] | undefined>): LabLaunchContext | null {
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : null);
  if (one("v") !== String(LAB_LAUNCH_CONTEXT_VERSION)) return null;
  const lab = safeId(labId), link = safeId(one("link")), exp = safeId(one("exp")), ver = safeId(one("ver")), scene = safeId(one("scene")), activity = safeId(one("activity"));
  if (!lab || !link || !exp || !ver || !scene || !activity) return null;
  const objectiveIds = (one("obj") ?? "").split(",").filter(Boolean);
  if (objectiveIds.length === 0 || objectiveIds.some((id) => !safeId(id))) return null;
  return { v: LAB_LAUNCH_CONTEXT_VERSION, labId: lab, linkId: link, origin: { experienceId: exp, experienceVersion: ver, sceneId: scene, objectiveIds, activityId: activity } };
}

export function buildLessonReturnHref(basePath: string, context: LabLaunchContext): string {
  assertBasePath(basePath);
  const params = new URLSearchParams({ scene: context.origin.sceneId, from: "lab" });
  return `${basePath}/${encodeURIComponent(context.origin.experienceId)}?${params.toString()}`;
}

/** The hand-back channel between lab host and lesson: one sessionStorage slot per experience. */
export function labReturnStorageKey(experienceId: string): string {
  return `ll-lesson-lab-return/v1/${experienceId}`;
}

export function isLabReturnObservation(value: unknown): value is LabReturnObservation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.labId === "string" && typeof v.linkId === "string" && Array.isArray(v.completedCheckIds)
    && v.completedCheckIds.every((id) => typeof id === "string") && typeof v.totalChecks === "number"
    && typeof v.tripObserved === "boolean" && typeof v.resetObserved === "boolean"
    && (v.exit === "COMPLETED" || v.exit === "RETURNED_EARLY");
}

/**
 * Student lesson → existing Labs route. The lab route keeps its own server authorization; the lesson only
 * adds its origin and a return target (`rt`): `c:<contentId>` or `w:<scheduledWorkId>`. The return address is
 * rebuilt from those validated ids on the lab page, never read as a URL.
 */
export function buildStudentLabLaunchHref(target: Readonly<{ kind: "CONTENT"; contentId: string } | { kind: "SCHEDULED_WORK"; scheduledWorkId: string }>, context: LabLaunchContext): string {
  const returnTarget = target.kind === "CONTENT" ? `c:${target.contentId}` : `w:${target.scheduledWorkId}`;
  if (!safeId(context.labId) || !safeId(returnTarget.slice(2))) throw new Error("student_lab_launch_invalid");
  return `/student/labs/${encodeURIComponent(context.labId)}?${labLaunchQuery(context)}&${new URLSearchParams({ rt: returnTarget }).toString()}`;
}

export type StudentLessonLabReturn = Readonly<{ context: LabLaunchContext; returnHref: string }>;

/** The lesson a student lab was opened from, or null (an ordinary Labs visit, or anything malformed). */
export function parseStudentLabReturn(labId: string, query: Record<string, string | string[] | undefined>): StudentLessonLabReturn | null {
  const context = parseLabLaunchContext(labId, query);
  const rt = typeof query.rt === "string" ? query.rt : null;
  const match = rt ? /^([cw]):(.+)$/.exec(rt) : null;
  const id = match ? safeId(match[2]) : null;
  if (!context || !match || !id) return null;
  const base = match[1] === "c" ? `/student/lesson/${encodeURIComponent(id)}` : `/student/lessons/${encodeURIComponent(id)}`;
  return { context, returnHref: `${base}?${new URLSearchParams({ scene: context.origin.sceneId, from: "lab" }).toString()}` };
}
