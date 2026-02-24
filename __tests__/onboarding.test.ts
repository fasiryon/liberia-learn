import { describe, it, expect } from "vitest";
import {
  ONBOARDING_STEPS,
  STORAGE_KEYS,
  getNextStep,
  isLastStep,
  readOnboardingState,
} from "@/lib/onboarding";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

describe("ONBOARDING_STEPS", () => {
  it("has at least 3 steps", () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(3);
  });

  it("every step has id, title, and body fields", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.id).toBe("string");
      expect(step.id.length).toBeGreaterThan(0);
      expect(typeof step.title).toBe("string");
      expect(step.title.length).toBeGreaterThan(0);
      expect(typeof step.body).toBe("string");
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it("step IDs are unique", () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("first step id is 'welcome'", () => {
    expect(ONBOARDING_STEPS[0].id).toBe("welcome");
  });

  it("last step id is 'done'", () => {
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// getNextStep
// ---------------------------------------------------------------------------

describe("getNextStep", () => {
  it("increments from 0", () => {
    expect(getNextStep(0)).toBe(1);
  });

  it("increments mid-sequence", () => {
    expect(getNextStep(2)).toBe(3);
  });

  it("clamps at the last step index — never overflows", () => {
    const last = ONBOARDING_STEPS.length - 1;
    expect(getNextStep(last)).toBe(last);
    expect(getNextStep(last + 10)).toBe(last); // absurd input still safe
  });
});

// ---------------------------------------------------------------------------
// isLastStep
// ---------------------------------------------------------------------------

describe("isLastStep", () => {
  it("returns true at the last step index", () => {
    const last = ONBOARDING_STEPS.length - 1;
    expect(isLastStep(last)).toBe(true);
  });

  it("returns false for step 0", () => {
    expect(isLastStep(0)).toBe(false);
  });

  it("returns false for a middle step", () => {
    if (ONBOARDING_STEPS.length > 2) {
      expect(isLastStep(1)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// readOnboardingState — node / SSR environment (window is undefined)
// ---------------------------------------------------------------------------

describe("readOnboardingState (no window — node env)", () => {
  it("returns safe defaults when window is undefined", () => {
    // In the vitest node environment, window is not defined.
    const state = readOnboardingState();
    expect(state.dismissed).toBe(false);
    expect(state.step).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// STORAGE_KEYS contract
// ---------------------------------------------------------------------------

describe("STORAGE_KEYS", () => {
  it("uses namespaced ll_ prefix for dismissed key", () => {
    expect(STORAGE_KEYS.DISMISSED).toBe("ll_onboarding_dismissed");
  });

  it("uses namespaced ll_ prefix for step key", () => {
    expect(STORAGE_KEYS.STEP).toBe("ll_onboarding_step");
  });
});
