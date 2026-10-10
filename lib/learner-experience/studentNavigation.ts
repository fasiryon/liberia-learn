/**
 * Product Redesign V1 student information architecture. Five primary
 * destinations; every existing student route is mapped to one of them so the
 * redesign consolidates rather than adds surfaces.
 */
export type PrimaryDestination = "TODAY" | "LEARN" | "LABS" | "PROGRESS" | "HELP";

export const STUDENT_PRIMARY_NAV: readonly Readonly<{ id: PrimaryDestination; label: string; href: string; matches: readonly string[] }>[] = Object.freeze([
  { id: "TODAY", label: "Today", href: "/student/today", matches: ["/dashboard", "/assignments", "/student/today", "/student/dashboard", "/student/work", "/student/assignments", "/student/homework", "/student/events", "/student/live", "/student/schedule"] },
  { id: "LEARN", label: "Learn", href: "/student/learn", matches: ["/student/learn", "/student/lessons", "/student/lesson", "/student/units", "/student/adaptive", "/student/exams", "/student/waec", "/student/textbooks", "/student/class", "/student/classes", "/student/capstone"] },
  { id: "LABS", label: "Labs", href: "/student/labs", matches: ["/student/labs", "/student/interactive-labs"] },
  { id: "PROGRESS", label: "Progress", href: "/student/progress", matches: ["/student/progress", "/student/passport", "/student/portfolio", "/student/certificates", "/student/certifications", "/student/report-cards", "/student/transcript", "/student/leaderboard"] },
  { id: "HELP", label: "Help", href: "/student/ai-tutor", matches: ["/student/ai-tutor", "/student/offline-status", "/student/offline-lessons", "/student/messages", "/student/discussion", "/student/packs"] },
]);

export function activeDestination(pathname: string): PrimaryDestination | null {
  for (const item of STUDENT_PRIMARY_NAV) {
    if (item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return item.id;
  }
  return null;
}
