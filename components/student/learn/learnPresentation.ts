/**
 * Product Design V2 Learn: display-only contracts over existing authorized
 * student endpoints. Nothing here ranks, recommends, unlocks or decides
 * eligibility; rows keep the order the server returned.
 */
import type { AssignedWork } from "@/lib/learner-experience/todayPresentation";

export type LearnRead<T> = {
  state: "loading" | "ready" | "error" | "restricted" | "signed-out";
  data: T | null;
  /** Data is from an earlier successful load; current state is unknown. */
  stale: boolean;
  error?: string;
};

export type ActiveUnit = { unitId: string; unitName: string; subject: string; grade: number; completedCount: number; totalCount: number; completionPct: number };
export type CatalogLesson = { contentId: string; displayTitle: string; subject: string; grade: number };
export type SubjectCompletion = { subject: string; total: number; completed: number };
export type CatalogPage = { items: CatalogLesson[]; page: number; totalPages: number; studentId?: string; subjectCompletion?: SubjectCompletion[] };
export type GovernedLearningAction = {
  available: true; decisionId: string; sessionId: string; releaseId: string; releaseIdentity: string; learnerStateRevision: string;
  grade: number; subject: string; conceptLabel?: string;
  action: { kind: "DIAGNOSTIC" | "PRACTICE"; reason: string };
  item: { id: string; version: string; prompt: string; options: string[] };
  toolPolicy: { allowed: string[]; prohibited: string[] };
  lessonHref: string | null;
};
export type AgeBand = "young" | "middle";

const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

export function ageBand(grade: number | null): AgeBand {
  return grade != null && grade >= 1 && grade <= 3 ? "young" : "middle";
}

export function subjectName(subject: string) {
  return subject.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function readError(status: number): Pick<LearnRead<never>, "state" | "error"> {
  if (status === 401) return { state: "signed-out", error: "Sign in again to see your learning." };
  if (status === 403) return { state: "restricted", error: "This is not available for your account. Ask your teacher if you think it should be." };
  if (status === 404) return { state: "error", error: "This learning information is not available right now." };
  return { state: "error", error: "This could not load. Try again." };
}

export function validActiveUnits(data: unknown): data is ActiveUnit[] {
  return Array.isArray(data) && data.every((row) => row && text(row.unitId) && text(row.unitName) && text(row.subject) &&
    count(row.completedCount) && count(row.totalCount) && row.completedCount <= row.totalCount && typeof row.completionPct === "number");
}

export function validCatalog(data: any): data is CatalogPage {
  return !!data && Array.isArray(data.items) && count(data.page) && count(data.totalPages) &&
    data.items.every((row: any) => row && text(row.contentId) && text(row.displayTitle) && text(row.subject) && Number.isInteger(row.grade)) &&
    (data.subjectCompletion == null || Array.isArray(data.subjectCompletion) && data.subjectCompletion.every((row: any) => row && text(row.subject) && count(row.total) && count(row.completed)));
}

export function validAssignments(data: any): data is { assignments: AssignedWork[] } {
  return !!data && Array.isArray(data.assignments) && data.assignments.every((row: any) => row && text(row.id) && typeof row.title === "string" && typeof row.subject === "string" &&
    (row.dueAt == null || typeof row.dueAt === "string") && (row.submission == null || typeof row.submission === "object"));
}

export function validGovernedAction(data: any): data is GovernedLearningAction {
  return !!data && data.available === true && text(data.decisionId) && text(data.sessionId) && text(data.releaseId) && text(data.releaseIdentity) &&
    Number.isInteger(data.grade) && text(data.subject) && ["DIAGNOSTIC", "PRACTICE"].includes(data.action?.kind) && typeof data.action?.reason === "string" &&
    text(data.item?.id) && typeof data.item?.version === "string" && typeof data.item?.prompt === "string" &&
    Array.isArray(data.item?.options) && data.item.options.length > 0 && data.item.options.every((option: unknown) => typeof option === "string") &&
    Array.isArray(data.toolPolicy?.allowed) && (data.lessonHref == null || typeof data.lessonHref === "string");
}

/**
 * The lessons endpoint answers a slow query with an empty 200 that has no
 * learner identity. That response cannot confirm "no lessons", so the UI must
 * not present it as an empty catalog.
 */
export function catalogConfirmed(page: CatalogPage) {
  return typeof page.studentId === "string" && page.studentId.length > 0;
}

/** Unsubmitted work, in server order (the endpoint orders by due date). */
export function openAssignments(rows: AssignedWork[]) {
  return rows.filter((row) => !row.submission?.turnedInAt);
}

/** Display grouping only: keeps the server's order of first appearance. */
export function groupBySubject<T extends { subject: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.subject, [...(groups.get(row.subject) ?? []), row]);
  return [...groups.entries()].map(([subject, items]) => ({ subject, items }));
}

/** Authorized learner destinations; each route enforces its own access. */
export function learnResources(grade: number | null, waecMinGrade: number) {
  const resources = [
    { id: "textbooks", label: "Textbooks", description: "Approved readings for your grade, by subject.", href: "/student/textbooks", needsGrade: true },
    { id: "practice", label: "Practice", description: "Extra practice activities.", href: "/student/adaptive", needsGrade: true },
    { id: "projects", label: "Projects", description: "Longer projects and capstone work.", href: "/student/capstone", needsGrade: false },
    { id: "offline", label: "Offline lessons", description: "Lessons saved on this device. Only verified downloads open offline.", href: "/student/offline-lessons", needsGrade: false },
  ];
  if (grade != null && grade >= waecMinGrade) resources.splice(2, 0, { id: "waec", label: "WAEC prep", description: "Exam preparation for eligible grades.", href: "/student/waec", needsGrade: true });
  return resources;
}

/** Same-origin student routes only; never an arbitrary or external URL. */
export function learnTarget(value: unknown): value is string {
  return typeof value === "string" && /^\/student\/(?:lesson|lessons|units)\/[^/?#\\]+$/.test(value) && !/[\u0000-\u001f]/.test(value);
}
