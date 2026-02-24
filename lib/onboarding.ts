/**
 * Guided onboarding — pure state helpers.
 *
 * All functions are free of React and DOM dependencies so they can be
 * imported and tested in a node environment. Browser-only paths are
 * guarded with typeof window checks.
 */

export const ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Welcome to LiberiaLearn",
    body: "This is your teacher dashboard. Follow these short steps to learn the key features.",
  },
  {
    id: "classes",
    title: "Your Classes",
    body: "All your classes appear here. Each card shows how many students are enrolled.",
  },
  {
    id: "homework",
    title: "Assign Homework",
    body: "Click the green Homework button on any class card to create or review assignments.",
  },
  {
    id: "students",
    title: "View Students",
    body: "Click 'View students' to see individual progress and attendance for your class.",
  },
  {
    id: "done",
    title: "You are ready!",
    body: "You can reopen this guide at any time by pressing the Help button at the bottom-right corner.",
  },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STORAGE_KEYS = {
  DISMISSED: "ll_onboarding_dismissed",
  STEP: "ll_onboarding_step",
} as const;

// ---------------------------------------------------------------------------
// Pure state helpers
// ---------------------------------------------------------------------------

export function getNextStep(current: number): number {
  return Math.min(current + 1, ONBOARDING_STEPS.length - 1);
}

export function isLastStep(step: number): boolean {
  return step === ONBOARDING_STEPS.length - 1;
}

// ---------------------------------------------------------------------------
// localStorage helpers (guarded for SSR / node test env)
// ---------------------------------------------------------------------------

export function readOnboardingState(): { dismissed: boolean; step: number } {
  if (typeof window === "undefined") return { dismissed: false, step: 0 };
  try {
    const dismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED) === "true";
    const raw = localStorage.getItem(STORAGE_KEYS.STEP);
    const step = raw !== null ? Number(raw) : 0;
    return { dismissed, step: Number.isFinite(step) ? step : 0 };
  } catch {
    return { dismissed: false, step: 0 };
  }
}

export function writeOnboardingStep(step: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.STEP, String(step));
  } catch {}
}

export function writeOnboardingDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.DISMISSED, "true");
  } catch {}
}

export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.DISMISSED);
    localStorage.removeItem(STORAGE_KEYS.STEP);
  } catch {}
}
