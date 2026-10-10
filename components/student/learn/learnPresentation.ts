/**
 * Product Design V2 Learn: display-only contracts over authorized student
 * endpoints. Availability, eligibility, lock state and reasons come from the
 * server (`learn-discovery/2`); nothing here ranks, recommends, unlocks or
 * decides access. Rows keep the order the server returned.
 */

export type LearnRead<T> = {
  state: "loading" | "ready" | "error" | "restricted" | "signed-out";
  data: T | null;
  /** Data is from an earlier successful load; current state is unknown. */
  stale: boolean;
  error?: string;
};

export type SectionAvailability = "current" | "empty" | "unavailable";
type Openable = { state: "open" | "unavailable"; locked: boolean; href: string | null; reason?: string };
export type DiscoveryLesson = Openable & { contentId: string; title: string; subject: string; grade: number };
export type DiscoveryUnit = Openable & { unitId: string; title: string; subject: string; grade: number };
export type DiscoveryAssignment = Openable & { id: string; title: string; subject: string; dueAt: string | null; assignmentHref: string };
export type DiscoveryCheck = Openable & { id: string; title: string; subject: string };
export type DiscoveryReading = Openable & { id: string; title: string; subject: string; kind: "reading" };
export type LearnDiscovery = {
  schemaVersion: "learn-discovery/2";
  availability: SectionAvailability;
  generatedAt: string;
  subjects: Array<{ subject: string; label: string }>;
  subjectCompletion: Array<{ subject: string; total: number; completed: number }>;
  lessons: { availability: SectionAvailability; total: number; items: DiscoveryLesson[] };
  activeUnits: { availability: SectionAvailability; eligibility: "eligible" | "not_enrolled" | "unavailable"; items: DiscoveryUnit[] };
  assignedWork: { availability: SectionAvailability; items: DiscoveryAssignment[] };
  checks: { availability: SectionAvailability; total: number; items: DiscoveryCheck[]; reason?: string };
  resources: { availability: SectionAvailability; items: DiscoveryReading[]; destinations: Array<{ title: string; href: string }>; compiledBooks: "deferred" };
  search: { availability: "deferred" };
};

export type ActiveUnit = { unitId: string; unitName: string; subject: string; grade: number; completedCount: number; totalCount: number; completionPct: number };
export type ActiveUnitsEnvelope = { availability: SectionAvailability; eligibility: "eligible" | "not_enrolled" | "unavailable"; items: ActiveUnit[] };
export type CatalogLesson = { contentId: string; displayTitle: string; subject: string; grade: number; href: string };
export type CatalogPage = { availability: "current" | "unavailable"; items: CatalogLesson[]; page: number; totalPages: number; total: number };
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
const AVAILABILITY = ["current", "empty", "unavailable"];

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

/** Same-origin learner destinations only; never an arbitrary or external URL. */
export function learnTarget(value: unknown): value is string {
  return typeof value === "string" && !/[\\\u0000-\u001f]/.test(value) &&
    /^\/student\/(?:(?:lesson|lessons|units|exams)\/[^/?#]+|assignments|textbooks)$/.test(value);
}

function openable(row: any) {
  return row && ["open", "unavailable"].includes(row.state) && typeof row.locked === "boolean" &&
    (row.href === null || typeof row.href === "string") && (row.reason == null || typeof row.reason === "string");
}
function section(value: any, item: (row: any) => boolean) {
  return value && AVAILABILITY.includes(value.availability) && Array.isArray(value.items) && value.items.every((row: any) => openable(row) && item(row));
}

export function validDiscovery(data: any): data is LearnDiscovery {
  return !!data && data.schemaVersion === "learn-discovery/2" && AVAILABILITY.includes(data.availability) &&
    Array.isArray(data.subjects) && data.subjects.every((row: any) => row && text(row.subject) && text(row.label)) &&
    Array.isArray(data.subjectCompletion) && data.subjectCompletion.every((row: any) => row && text(row.subject) && count(row.total) && count(row.completed)) &&
    section(data.lessons, (row) => text(row.contentId) && text(row.title) && text(row.subject) && Number.isInteger(row.grade)) && count(data.lessons.total) &&
    section(data.activeUnits, (row) => text(row.unitId) && text(row.title) && text(row.subject)) && ["eligible", "not_enrolled", "unavailable"].includes(data.activeUnits.eligibility) &&
    section(data.assignedWork, (row) => text(row.id) && typeof row.title === "string" && typeof row.subject === "string" && (row.dueAt == null || typeof row.dueAt === "string")) &&
    section(data.checks, (row) => text(row.id) && typeof row.title === "string" && typeof row.subject === "string") && (data.checks.reason == null || typeof data.checks.reason === "string") &&
    section(data.resources, (row) => text(row.id) && text(row.title) && typeof row.subject === "string") &&
    Array.isArray(data.resources.destinations) && data.resources.destinations.every((row: any) => row && text(row.title) && typeof row.href === "string") &&
    data.search?.availability === "deferred";
}

export function validActiveUnits(data: any): data is ActiveUnitsEnvelope {
  return !!data && AVAILABILITY.includes(data.availability) && ["eligible", "not_enrolled", "unavailable"].includes(data.eligibility) && Array.isArray(data.items) &&
    data.items.every((row: any) => row && text(row.unitId) && text(row.unitName) && text(row.subject) &&
      count(row.completedCount) && count(row.totalCount) && row.completedCount <= row.totalCount && typeof row.completionPct === "number");
}

export function validCatalog(data: any): data is CatalogPage {
  return !!data && ["current", "unavailable"].includes(data.availability) && Array.isArray(data.items) && count(data.page) && count(data.totalPages) && count(data.total) &&
    data.items.every((row: any) => row && text(row.contentId) && text(row.displayTitle) && text(row.subject) && Number.isInteger(row.grade) && typeof row.href === "string");
}

export function validGovernedAction(data: any): data is GovernedLearningAction {
  return !!data && data.available === true && text(data.decisionId) && text(data.sessionId) && text(data.releaseId) && text(data.releaseIdentity) &&
    Number.isInteger(data.grade) && text(data.subject) && ["DIAGNOSTIC", "PRACTICE"].includes(data.action?.kind) && typeof data.action?.reason === "string" &&
    text(data.item?.id) && typeof data.item?.version === "string" && typeof data.item?.prompt === "string" &&
    Array.isArray(data.item?.options) && data.item.options.length > 0 && data.item.options.every((option: unknown) => typeof option === "string") &&
    Array.isArray(data.toolPolicy?.allowed) && (data.lessonHref == null || typeof data.lessonHref === "string");
}

/** Display grouping only: keeps the server's order of first appearance. */
export function groupBySubject<T extends { subject: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.subject, [...(groups.get(row.subject) ?? []), row]);
  return [...groups.entries()].map(([subject, items]) => ({ subject, items }));
}

/**
 * Existing Learn routes reached by navigation only. They make no availability
 * claim; each route enforces its own access. WAEC keeps the shell's existing
 * grade rule for showing its link.
 */
export function learnPlaces(grade: number | null, waecMinGrade: number) {
  const places = [
    { id: "practice", label: "Practice", href: "/student/adaptive" },
    { id: "projects", label: "Projects", href: "/student/capstone" },
    { id: "offline", label: "Offline lessons", href: "/student/offline-lessons" },
  ];
  if (grade != null && grade >= waecMinGrade) places.splice(1, 0, { id: "waec", label: "WAEC prep", href: "/student/waec" });
  return places;
}

export function dueLabel(dueAt: string | null) {
  if (!dueAt || !Number.isFinite(Date.parse(dueAt))) return "No due date provided";
  return `Due ${new Date(dueAt).toLocaleString("en-LR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}
