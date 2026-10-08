import type { TutorIdentity } from "./contextContract";

export type TutorRouteContext = { pathname: string; identity: TutorIdentity };

/** Path identifiers are hints only; the server still authorizes and resolves content. */
export function studentTutorIdentityForPath(pathname: string, context?: TutorRouteContext | null): TutorIdentity | undefined {
  const match = /^\/student\/(lesson|lessons)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return undefined;
  let id: string;
  try { id = decodeURIComponent(match[2]); } catch { return undefined; }
  if (!id.trim() || id.length > 200 || /[/?#]/.test(id)) return undefined;
  const hint: TutorIdentity = match[1] === "lesson" ? { contentId: id } : { lessonId: id };
  // Scene/revision hints may enrich only the same route identity, never a stale page.
  const sameIdentity = context?.pathname === pathname &&
    (hint.contentId ? context.identity.contentId === id : context.identity.lessonId === id);
  return sameIdentity ? { ...context.identity, ...hint } : hint;
}
