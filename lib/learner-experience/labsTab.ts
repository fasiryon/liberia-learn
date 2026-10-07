/**
 * The single student Labs destination: For You, Assigned, Continue, Library,
 * Completed. Every section renders the same LabExperience card, whatever
 * runtime the lab uses.
 */
import { isGradeAppropriate, isStudentAccessible, type LabExperience } from "./labExperience";
import type { LearningExperienceLink } from "./links";

export type LabSessionSummary = Readonly<{
  sessionId: string;
  labId: string;
  assigned: boolean;
  startedAt: string;
  completedAt: string | null;
}>;

export type LabsTabEntry = Readonly<{ lab: LabExperience; session: LabSessionSummary | null; reason: string | null }>;

export type LabsTabModel = Readonly<{
  forYou: readonly LabsTabEntry[];
  assigned: readonly LabsTabEntry[];
  continue: readonly LabsTabEntry[];
  library: readonly LabsTabEntry[];
  completed: readonly LabsTabEntry[];
}>;

export const LABS_TAB_SECTIONS = [
  { id: "for-you", key: "forYou", label: "For You" },
  { id: "assigned", key: "assigned", label: "Assigned" },
  { id: "continue", key: "continue", label: "Continue" },
  { id: "library", key: "library", label: "Library" },
  { id: "completed", key: "completed", label: "Completed" },
] as const;

export function buildLabsTab(input: {
  labs: readonly LabExperience[];
  sessions: readonly LabSessionSummary[];
  /** Approved links on the learner's current governed path. Prototype links never reach students. */
  pathLinks: readonly LearningExperienceLink[];
  grade: number | null;
}): LabsTabModel {
  const visible = input.labs.filter(isStudentAccessible);
  const byId = new Map(visible.map((lab) => [lab.labId, lab]));
  const withSession = (session: LabSessionSummary): LabsTabEntry | null => {
    const lab = byId.get(session.labId);
    return lab ? { lab, session, reason: null } : null;
  };
  const sessionEntries = input.sessions.map(withSession).filter((entry): entry is LabsTabEntry => entry !== null);
  const forYou = input.pathLinks
    .filter((link) => link.status === "APPROVED")
    .map((link) => byId.get(link.experience.labId))
    .filter((lab): lab is LabExperience => !!lab)
    .map((lab) => ({ lab, session: null, reason: "Supports an objective in your current lesson" }));
  return {
    forYou,
    assigned: sessionEntries.filter((entry) => entry.session?.assigned),
    continue: sessionEntries.filter((entry) => !entry.session?.completedAt),
    library: visible.filter((lab) => lab.runtime.kind !== "PRACTICAL_GUIDED" && isGradeAppropriate(lab, input.grade)).map((lab) => ({ lab, session: null, reason: null })),
    completed: sessionEntries.filter((entry) => !!entry.session?.completedAt),
  };
}
