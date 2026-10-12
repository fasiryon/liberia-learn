/**
 * Showcase lab access: the server's answer to "may this student open the
 * unreleased interactive showcase labs?". It is a presentation grant only.
 * It never changes a lab's release, certification, curriculum linkage,
 * mastery or evidence authority, and the browser never infers it.
 */
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { fromInteractiveLab, type LabExperience } from "@/lib/learner-experience/labExperience";

/** The registered interactive labs a server grant may expose. Nothing outside this list is ever showcased. */
export const SHOWCASE_LAB_IDS = Object.freeze(["g4-solid-figures", "fixture-lever", "fixture-simple-circuit", "mount-coffee-hydropower"] as const);

/** The authenticated user as the server authority reads it (role is re-checked against persisted records). */
export type ShowcaseLabUser = Readonly<{ id: string; role: string; schoolId?: string | null }>;

export type ShowcaseLabAccess = Readonly<{ authorized: boolean; labIds: readonly string[] }>;

export const NO_SHOWCASE_ACCESS: ShowcaseLabAccess = Object.freeze({ authorized: false, labIds: Object.freeze([]) });

/**
 * Server authority seam. The demo-account authorization boundary is owned by
 * the server slice (loadShowcaseStudentAuthority + canAccessShowcaseLab) and
 * replaces this body; until it lands every student is denied, so ordinary
 * learners keep the released/assigned-only experience.
 */
export async function loadShowcaseLabAccess(user: ShowcaseLabUser): Promise<ShowcaseLabAccess> {
  void user;
  return NO_SHOWCASE_ACCESS;
}

/** Labs the grant names, limited to the showcase list and the live registry. Order follows SHOWCASE_LAB_IDS. */
export function showcaseLabIds(access: ShowcaseLabAccess): string[] {
  if (!access.authorized) return [];
  const granted = new Set(access.labIds);
  return SHOWCASE_LAB_IDS.filter((labId) => granted.has(labId) && getInteractiveLabDefinition(labId) !== null);
}

export function isShowcaseLabAuthorized(access: ShowcaseLabAccess, labId: string): boolean {
  return showcaseLabIds(access).includes(labId);
}

export function showcaseLabExperiences(access: ShowcaseLabAccess): LabExperience[] {
  return showcaseLabIds(access).map((labId) => fromInteractiveLab(getInteractiveLabDefinition(labId)!));
}
