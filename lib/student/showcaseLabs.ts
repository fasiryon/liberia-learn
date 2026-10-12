import { prisma } from "@/lib/db";
import { CHA_DEMO_SCHOOL_ID, CHA_DEMO_STUDENT_LOGIN_ID, chaDemoStudentEmail } from "@/lib/demo/chaStudentIdentity";
import { buildLabsTab, type LabsTabModel } from "@/lib/learner-experience/labsTab";
import { fromInteractiveLab, type LabExperience } from "@/lib/learner-experience/labExperience";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";

export const SHOWCASE_LAB_IDS = Object.freeze([
  "g4-solid-figures", "fixture-lever", "fixture-simple-circuit", "mount-coffee-hydropower",
] as const);

type ShowcaseUser = { id: string; role: string; schoolId?: string | null };
type ShowcaseStudent = {
  id: string; userId: string;
  user: ShowcaseUser & { email: string | null; loginId: string | null };
};

/** Server-only exception. Never changes release/certification or grants evidence authority. */
export function canAccessShowcaseLab({ user, student, labId }: {
  user: ShowcaseUser | null; student: ShowcaseStudent | null; labId: string;
}): boolean {
  return !!user?.id && user.role === "STUDENT" && user.schoolId === CHA_DEMO_SCHOOL_ID &&
    !!student?.id && student.userId === user.id && student.user?.id === user.id &&
    student.user.role === "STUDENT" && student.user.schoolId === user.schoolId &&
    !!student.user.email?.trim() && student.user.email === chaDemoStudentEmail() && student.user.loginId === CHA_DEMO_STUDENT_LOGIN_ID &&
    SHOWCASE_LAB_IDS.some((id) => id === labId);
}

/** Read persisted authority, rather than trusting a stale auth token's email/login ID. */
export async function loadShowcaseStudentAuthority(user: ShowcaseUser): Promise<ShowcaseStudent | null> {
  if (!user?.id || user.role !== "STUDENT" || user.schoolId !== CHA_DEMO_SCHOOL_ID) return null;
  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: {
    id: true, userId: true,
    user: { select: { id: true, role: true, schoolId: true, email: true, loginId: true } },
  } });
  return canAccessShowcaseLab({ user, student, labId: SHOWCASE_LAB_IDS[0] }) ? student : null;
}

/**
 * Add showcase entries to the existing Library, retaining truthful unreleased metadata.
 * Not used by the student Labs page, which shows showcase labs in their own section
 * (loadAuthorizedShowcaseLabs) so they never appear twice.
 */
export function buildStudentLabsTab(input: Parameters<typeof buildLabsTab>[0], authority: {
  user: ShowcaseUser; student: ShowcaseStudent | null;
}): LabsTabModel {
  const tab = buildLabsTab(input);
  const listed = new Set(tab.library.map((entry) => entry.lab.labId));
  const showcase = input.labs.filter((lab) => !listed.has(lab.labId) &&
    canAccessShowcaseLab({ ...authority, labId: lab.labId }));
  return { ...tab, library: [...tab.library, ...showcase.map((lab) => ({
    lab, session: null, reason: "Showcase exploration",
  }))] };
}

/**
 * Showcase labs for the Labs hub: server-verified identity, then every exact
 * SHOWCASE_LAB_IDS entry through canAccessShowcaseLab. A failed identity read
 * denies (it never takes the hub down). Entries keep their unreleased metadata.
 */
export async function loadAuthorizedShowcaseLabs(user: ShowcaseUser): Promise<LabExperience[]> {
  const student = await loadShowcaseStudentAuthority(user).catch(() => null);
  return SHOWCASE_LAB_IDS.filter((labId) => canAccessShowcaseLab({ user, student, labId }))
    .flatMap((labId) => {
      const definition = getInteractiveLabDefinition(labId);
      return definition ? [fromInteractiveLab(definition)] : [];
    });
}
