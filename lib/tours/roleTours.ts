/**
 * lib/tours/roleTours.ts — Phase 2 fix (Deliverable 2, Items 4-6)
 *
 * Pure, single-page tour definitions for the non-student demo roles. Each step
 * anchors to a `[data-tour='…']` attribute placed on a real nav link, so the
 * anchor-filtering RoleTour runner shows exactly the steps whose targets exist
 * (a missing anchor never blanks the whole tour — the bug the old direct
 * driver.js tours had). Kept pure so the step catalogue is unit-tested.
 */

export type RoleTourStep = {
  /** CSS selector of the on-page anchor. Always a data-tour attribute. */
  selector: string;
  title: string;
  body: string;
  side: "top" | "bottom" | "left" | "right";
};

export type TourRole = "teacher" | "guardian" | "admin" | "official";

const TEACHER_STEPS: RoleTourStep[] = [
  {
    selector: "[data-tour='teacher-overview']",
    title: "Your class at a glance",
    body: "This is your overview — delivery, submissions, and alerts for every class you teach.",
    side: "bottom",
  },
  {
    selector: "[data-tour='teacher-curriculum']",
    title: "Assign lessons",
    body: "Browse the MOE-aligned curriculum and assign lessons to your classes. Lessons are sequenced into units that build on each other.",
    side: "bottom",
  },
  {
    selector: "[data-tour='teacher-homework']",
    title: "Grade & approve",
    body: "Review homework here — including AI-assisted grading on writing and code that you approve before it reaches students.",
    side: "bottom",
  },
  {
    selector: "[data-tour='teacher-intelligence']",
    title: "See who is stuck",
    body: "Class intelligence surfaces students who are falling behind on a topic so you can step in early.",
    side: "bottom",
  },
  {
    selector: "[data-tour='teacher-messages']",
    title: "Reach guardians",
    body: "Message a student's guardians directly. That's the tour — explore your classes from here!",
    side: "bottom",
  },
];

const GUARDIAN_STEPS: RoleTourStep[] = [
  {
    selector: "[data-tour='guardian-overview']",
    title: "Your child's week",
    body: "This is your overview — attendance, recent grades, and messages for each child you're linked to.",
    side: "bottom",
  },
  {
    selector: "[data-tour='guardian-grades']",
    title: "Grades & feedback",
    body: "See graded work and teacher feedback as it comes in.",
    side: "bottom",
  },
  {
    selector: "[data-tour='guardian-assignments']",
    title: "Assignments",
    body: "Track what's assigned and what's still outstanding.",
    side: "bottom",
  },
  {
    selector: "[data-tour='guardian-messages']",
    title: "Talk to teachers",
    body: "Message your child's teachers — pick the right teacher for each class from here.",
    side: "bottom",
  },
  {
    selector: "[data-tour='guardian-settings']",
    title: "Notifications",
    body: "Choose how you're notified — including SMS digests. That's the tour!",
    side: "bottom",
  },
];

const ADMIN_STEPS: RoleTourStep[] = [
  {
    selector: "[data-tour='admin-dashboard']",
    title: "School control centre",
    body: "Your dashboard — school-wide health, usage, and the things that need attention.",
    side: "right",
  },
  {
    selector: "[data-tour='admin-curriculum']",
    title: "Curriculum factory",
    body: "Generate and approve curriculum. Content moves NEEDS_REVIEW → APPROVED before students ever see it.",
    side: "right",
  },
  {
    selector: "[data-tour='admin-content-review']",
    title: "Review queue",
    body: "The moderation queue for lessons and teacher-created content awaiting approval.",
    side: "right",
  },
  {
    selector: "[data-tour='admin-analytics']",
    title: "Analytics",
    body: "Track engagement, delivery, and outcomes across the school.",
    side: "right",
  },
  {
    selector: "[data-tour='admin-reports']",
    title: "Reports & exports",
    body: "Generate report cards and MOE submissions. That's the tour — explore from here!",
    side: "right",
  },
];

const OFFICIAL_STEPS: RoleTourStep[] = [
  {
    selector: "[data-tour='moe-dashboard']",
    title: "National overview",
    body: "The Ministry dashboard — activity and outcomes rolled up across every school on the platform.",
    side: "bottom",
  },
  {
    selector: "[data-tour='moe-districts']",
    title: "By district",
    body: "Drill into any county or district to compare participation and progress.",
    side: "bottom",
  },
  {
    selector: "[data-tour='moe-compliance']",
    title: "Compliance",
    body: "Track which schools are meeting delivery and reporting expectations.",
    side: "bottom",
  },
  {
    selector: "[data-tour='moe-exports']",
    title: "Data exports",
    body: "Export national datasets for Ministry reporting and analysis.",
    side: "bottom",
  },
  {
    selector: "[data-tour='moe-live']",
    title: "Live dashboard",
    body: "A fullscreen, real-time view for briefings and press. That's the tour!",
    side: "bottom",
  },
];

export const ROLE_TOURS: Record<TourRole, RoleTourStep[]> = {
  teacher: TEACHER_STEPS,
  guardian: GUARDIAN_STEPS,
  admin: ADMIN_STEPS,
  official: OFFICIAL_STEPS,
};

export function stepsForRole(role: TourRole): RoleTourStep[] {
  return ROLE_TOURS[role] ?? [];
}
