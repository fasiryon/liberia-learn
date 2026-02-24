/**
 * lib/training/modules.ts
 *
 * Static definitions for the 8 Micro Training modules that make up the
 * LiberiaLearn Training Center (Block 4).  Module IDs match the `code`
 * column in the TrainingModule DB table (seeded via migration
 * 20260224_000000_seed_training_modules).
 *
 * Keeping module content here (not in the DB) means:
 *   • Zero extra queries on the training landing page.
 *   • Content updates ship as code, not DB patches.
 *   • SSR-safe – no window/localStorage access.
 *
 * Feature-flagged by: NEXT_PUBLIC_ENABLE_TRAINING_CENTER
 */

export type TrainingStep = {
  /** Short, plain-language instruction for low-literacy users. */
  text: string;
  /** Placeholder label shown when a screenshot hasn't been supplied yet. */
  screenshotPlaceholder?: string;
};

export type TrainingModuleDef = {
  /** Stable ID — matches TrainingModule.code in the DB. */
  id: string;
  title: string;
  level: 1 | 2 | 3;
  estimatedMinutes: number;
  steps: TrainingStep[];
};

// ─── 8 modules, 3 levels ────────────────────────────────────────────────────

export const TRAINING_MODULES: TrainingModuleDef[] = [
  // ── Level 1: Foundations ─────────────────────────────────────────────────
  {
    id: "l1-login-nav",
    title: "Login & Navigation Basics",
    level: 1,
    estimatedMinutes: 5,
    steps: [
      {
        text: "Open LiberiaLearn on your phone or computer. You will see the sign-in page.",
        screenshotPlaceholder: "Sign-in page with Student / Teacher / Admin tabs",
      },
      {
        text: "Tap 'Teacher' at the top of the sign-in page. Enter your email address and password, then tap 'Continue'.",
        screenshotPlaceholder: "Teacher tab selected, email and password fields visible",
      },
      {
        text: "You are now on the Teacher Dashboard. Your classes appear here as cards with the number of students.",
        screenshotPlaceholder: "Teacher Dashboard with class cards",
      },
      {
        text: "The top bar shows your school name and your name. Use the '← Home' button to return here from any page.",
        screenshotPlaceholder: "Top header bar with school name, Home, and Log out buttons",
      },
      {
        text: "When you are done for the day, tap 'Log out' in the top bar. Always log out on shared devices.",
      },
    ],
  },
  {
    id: "l1-class-work",
    title: "Find Your Class & Today's Work",
    level: 1,
    estimatedMinutes: 5,
    steps: [
      {
        text: "On the Teacher Dashboard, find your class cards. Each card shows the class name, subject, and number of students.",
        screenshotPlaceholder: "Class cards grid on teacher dashboard",
      },
      {
        text: "Tap 'View students' on a class card to see all students enrolled in that class.",
        screenshotPlaceholder: "Student list for a class",
      },
      {
        text: "Tap 'Homework' on a class card to view or assign homework for that class.",
        screenshotPlaceholder: "Homework tab with assignment list",
      },
      {
        text: "Use the 'Curriculum' tab at the top to see lesson content available for your classes.",
        screenshotPlaceholder: "Curriculum tab showing lesson library",
      },
      {
        text: "Use the 'Overview' tab to return to the main dashboard at any time. The three cards at the top show your totals.",
      },
    ],
  },

  // ── Level 2: Core Features ────────────────────────────────────────────────
  {
    id: "l2-create-lesson",
    title: "Create a Lesson",
    level: 2,
    estimatedMinutes: 7,
    steps: [
      {
        text: "Go to the Curriculum tab at the top of the Teacher Dashboard.",
        screenshotPlaceholder: "Curriculum tab highlighted in navigation",
      },
      {
        text: "Tap 'Add Lesson' or 'Create New Lesson' to start a new lesson.",
        screenshotPlaceholder: "Add Lesson button on curriculum page",
      },
      {
        text: "Enter a title for your lesson. Choose the correct grade and subject from the drop-down menus.",
        screenshotPlaceholder: "Lesson form with title, grade, and subject fields",
      },
      {
        text: "Type the lesson content — objectives, activities, and teacher notes. Keep the language simple.",
        screenshotPlaceholder: "Lesson content editor",
      },
      {
        text: "Tap 'Save' when done. The lesson is now saved and appears in your lesson library.",
        screenshotPlaceholder: "Save button and success confirmation",
      },
      {
        text: "To assign the lesson to a class, return to your class card and tap 'Assign' next to the lesson name.",
      },
    ],
  },
  {
    id: "l2-create-assignment",
    title: "Create an Assignment",
    level: 2,
    estimatedMinutes: 7,
    steps: [
      {
        text: "On the Teacher Dashboard, tap 'Homework' on the class card you want to assign to.",
        screenshotPlaceholder: "Homework button on class card",
      },
      {
        text: "Tap 'Create Homework' or 'Add Assignment' at the top of the homework list.",
        screenshotPlaceholder: "Create Homework button",
      },
      {
        text: "Enter a clear title and write short, simple instructions. Students with low reading levels will see this.",
        screenshotPlaceholder: "Title and instructions fields",
      },
      {
        text: "Set a due date so students know when to submit their work.",
        screenshotPlaceholder: "Due date picker",
      },
      {
        text: "Tap 'Save'. Students in that class will see the assignment when they next log in.",
        screenshotPlaceholder: "Save button — assignment confirmed in list",
      },
      {
        text: "You can view all assignments by tapping 'Homework' from the top navigation of the Teacher Dashboard.",
      },
    ],
  },
  {
    id: "l2-grade-feedback",
    title: "Grade & Give Feedback",
    level: 2,
    estimatedMinutes: 6,
    steps: [
      {
        text: "Go to the Homework tab and find an assignment that has student submissions. You will see a count of submissions.",
        screenshotPlaceholder: "Assignment list with submission counts",
      },
      {
        text: "Tap on a student's submission to open it and read their answer.",
        screenshotPlaceholder: "Student submission view",
      },
      {
        text: "The AI may have already suggested a score. You can review it and change it if needed.",
        screenshotPlaceholder: "AI suggested score with teacher score field",
      },
      {
        text: "Enter your own score in the 'Teacher Score' box.",
        screenshotPlaceholder: "Teacher Score input field",
      },
      {
        text: "Write a short comment in the feedback box. Even one encouraging sentence makes a big difference.",
        screenshotPlaceholder: "Feedback text box",
      },
      {
        text: "Tap 'Save Feedback'. The student will see your score and comment the next time they log in.",
      },
    ],
  },
  {
    id: "l2-message-guardians",
    title: "Message Guardians Safely",
    level: 2,
    estimatedMinutes: 5,
    steps: [
      {
        text: "Go to the Admin panel and find 'Guardian Links'. Your admin sets up guardian phone numbers here.",
        screenshotPlaceholder: "Guardian Links section in admin panel",
      },
      {
        text: "Find the guardian linked to the student you want to contact. You will see their phone number on record.",
        screenshotPlaceholder: "Guardian record with phone number",
      },
      {
        text: "Choose a message type: Absence (student missed school), At Risk (student needs support), or Praise (student did well).",
        screenshotPlaceholder: "Message type selector: Absence, At Risk, Praise",
      },
      {
        text: "The system will send a short SMS to the guardian. Only 3 messages per guardian per day are allowed — this protects guardians from message flooding.",
        screenshotPlaceholder: "SMS send confirmation",
      },
      {
        text: "All messages are logged so you have a record. Guardians can reply STOP at any time to opt out of messages.",
      },
    ],
  },

  // ── Level 3: Advanced Tools ───────────────────────────────────────────────
  {
    id: "l3-view-reports",
    title: "View Reports & Student Progress",
    level: 3,
    estimatedMinutes: 7,
    steps: [
      {
        text: "On the Teacher Dashboard, tap on a class card, then tap 'View students' to see the student list.",
        screenshotPlaceholder: "Student list for the class",
      },
      {
        text: "Tap on a student's name to open their individual progress view.",
        screenshotPlaceholder: "Student progress page",
      },
      {
        text: "You will see their homework scores, lessons completed, and any at-risk flags raised by the system.",
        screenshotPlaceholder: "Student scores and lesson progress summary",
      },
      {
        text: "For school-wide reports — such as how many students passed a topic — ask your Admin to check the Analytics section.",
        screenshotPlaceholder: "Admin Analytics overview screen",
      },
      {
        text: "Use this information to identify students who need extra support and to plan your next lessons.",
      },
      {
        text: "Check reports at least once a week to stay on top of your class's learning progress.",
      },
    ],
  },
  {
    id: "l3-guided-tools",
    title: "Use Guided Onboarding & Accessibility Tools",
    level: 3,
    estimatedMinutes: 5,
    steps: [
      {
        text: "In the bottom-right corner of the Teacher Dashboard, you will see a floating toolbar.",
        screenshotPlaceholder: "Bottom-right floating toolbar with ? Help and Aa buttons",
      },
      {
        text: "Tap the '?' Help button to open the Guided Onboarding tour. It shows you the key features step by step.",
        screenshotPlaceholder: "Guided Onboarding modal — Step 1 of 5",
      },
      {
        text: "You can dismiss the tour at any step and reopen it any time by tapping '?' again.",
      },
      {
        text: "Tap the 'Aa' Accessibility button to turn on Accessibility Mode. This makes text larger and buttons easier to tap.",
        screenshotPlaceholder: "Aa toggle button — accessibility mode active state",
      },
      {
        text: "Both settings are saved automatically and will stay on the next time you log in. They are stored on your device.",
      },
    ],
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

/** Modules grouped by level — avoids repeated `.filter()` in rendering code. */
export const MODULES_BY_LEVEL: Record<1 | 2 | 3, TrainingModuleDef[]> = {
  1: TRAINING_MODULES.filter((m) => m.level === 1),
  2: TRAINING_MODULES.filter((m) => m.level === 2),
  3: TRAINING_MODULES.filter((m) => m.level === 3),
};

export function getModuleById(id: string): TrainingModuleDef | undefined {
  return TRAINING_MODULES.find((m) => m.id === id);
}

export const LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "Level 1 — Foundations",
  2: "Level 2 — Core Features",
  3: "Level 3 — Advanced Tools",
};
