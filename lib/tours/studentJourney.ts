/**
 * lib/tours/studentJourney.ts — Phase 2, Deliverable 2
 *
 * Pure definition + helpers for the multi-page student demo journey. The
 * journey walks a principal through the real student workflow: the Today page
 * (schedule + lesson sequencing), a lesson (unit map, practice, assessment),
 * homework, and certificates. Kept pure so navigation logic is unit-tested in
 * the node environment; driver.js handles the on-screen spotlight.
 */

export type JourneyPage = "today" | "lesson" | "homework" | "certificates";

export type JourneyStep = {
  id: string;
  page: JourneyPage;
  /** CSS selector of the on-page anchor (a data-tour attribute). */
  selector: string;
  title: string;
  body: string;
  side: "top" | "bottom" | "left" | "right";
};

export const STUDENT_JOURNEY: JourneyStep[] = [
  {
    id: "today-schedule",
    page: "today",
    selector: "[data-tour='today-schedule']",
    title: "Your day at a glance",
    body: "This is the Today page — the lessons and assignments scheduled for you. Everything starts here.",
    side: "bottom",
  },
  {
    id: "today-units",
    page: "today",
    selector: "[data-tour='this-weeks-units']",
    title: "Lessons that build on each other",
    body: "These are your units. Lessons are sequenced 1‑2‑3‑4 — they build on each other, they are not random. Tap a unit to see the full sequence.",
    side: "bottom",
  },
  {
    id: "lesson-unit-map",
    page: "lesson",
    selector: "[data-tour='unit-map']",
    title: "Where you are in the unit",
    body: "Inside every lesson, this strip shows which lesson you are on (\"Lesson 4 of 12\") and what you have completed in the unit.",
    side: "bottom",
  },
  {
    id: "lesson-practice",
    page: "lesson",
    selector: "[data-tour='practice']",
    title: "Practice as you learn",
    body: "Work the practice problems, then reveal the answer to check yourself. You can hide it again anytime.",
    side: "top",
  },
  {
    id: "lesson-assessment",
    page: "lesson",
    selector: "[data-tour='assessment']",
    title: "Finish with an assessment",
    body: "Every lesson ends with a short assessment. Your teacher uses it to see how you did.",
    side: "top",
  },
  {
    id: "homework",
    page: "homework",
    selector: "[data-tour='homework-list']",
    title: "Homework & feedback",
    body: "Assignments from your teacher live here. You submit them and see grades and feedback — including AI‑assisted grading on writing and code.",
    side: "bottom",
  },
  {
    id: "certificates",
    page: "certificates",
    selector: "[data-tour='certificates-list']",
    title: "Your achievements",
    body: "Completed work earns certificates you can verify and share. That's the tour — explore on your own from here!",
    side: "bottom",
  },
];

export const STATIC_PAGE_PATHS: Record<Exclude<JourneyPage, "lesson">, string> = {
  today: "/student/today",
  homework: "/student/homework",
  certificates: "/student/certificates",
};

/** Demo accounts that auto-start the journey on first login. */
export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /@(cha\.edu\.lr|moe\.gov\.lr)$/i.test(email.trim());
}

/** Whether the journey should activate: explicit ?tour=true, or a demo account that hasn't finished it. */
export function shouldStartJourney(input: {
  hasTourParam: boolean;
  email: string | null | undefined;
  tourCompleted: boolean;
}): boolean {
  if (input.hasTourParam) return true;
  return isDemoEmail(input.email) && !input.tourCompleted;
}

export function stepsForPage(page: JourneyPage): JourneyStep[] {
  return STUDENT_JOURNEY.filter((s) => s.page === page);
}

export function clampStepIndex(index: number): number {
  if (Number.isNaN(index) || index < 0) return 0;
  if (index > STUDENT_JOURNEY.length - 1) return STUDENT_JOURNEY.length - 1;
  return index;
}

/** Next step index, or -1 when the journey is finished. */
export function nextStepIndex(index: number): number {
  return index >= STUDENT_JOURNEY.length - 1 ? -1 : index + 1;
}

/** The page a global step index belongs to. */
export function pageOfStep(index: number): JourneyPage | null {
  return STUDENT_JOURNEY[index]?.page ?? null;
}

/** True when the next step lives on a different page than the current one. */
export function crossesPage(index: number): boolean {
  const next = nextStepIndex(index);
  if (next === -1) return false;
  return STUDENT_JOURNEY[index].page !== STUDENT_JOURNEY[next].page;
}
