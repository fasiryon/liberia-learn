import { describe, expect, it } from "vitest";
import {
  STUDENT_JOURNEY,
  isDemoEmail,
  shouldStartJourney,
  stepsForPage,
  clampStepIndex,
  nextStepIndex,
  crossesPage,
  pageOfStep,
} from "@/lib/tours/studentJourney";

describe("studentJourney", () => {
  it("defines a well-formed multi-page journey", () => {
    expect(STUDENT_JOURNEY.length).toBeGreaterThanOrEqual(5);
    for (const step of STUDENT_JOURNEY) {
      expect(step.id).toBeTruthy();
      expect(step.selector).toMatch(/^\[data-tour='/);
      expect(step.title).toBeTruthy();
      expect(step.body).toBeTruthy();
    }
    // The journey visits more than one page.
    expect(new Set(STUDENT_JOURNEY.map((s) => s.page)).size).toBeGreaterThan(1);
  });

  it("recognises demo emails by domain", () => {
    expect(isDemoEmail("kid@cha.edu.lr")).toBe(true);
    expect(isDemoEmail("official@moe.gov.lr")).toBe(true);
    expect(isDemoEmail("someone@gmail.com")).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
    expect(isDemoEmail(undefined)).toBe(false);
  });

  it("starts on explicit ?tour=true regardless of completion", () => {
    expect(shouldStartJourney({ hasTourParam: true, email: "x@gmail.com", tourCompleted: true })).toBe(true);
  });

  it("auto-starts for demo accounts that have not finished", () => {
    expect(shouldStartJourney({ hasTourParam: false, email: "kid@cha.edu.lr", tourCompleted: false })).toBe(true);
    expect(shouldStartJourney({ hasTourParam: false, email: "kid@cha.edu.lr", tourCompleted: true })).toBe(false);
    expect(shouldStartJourney({ hasTourParam: false, email: "x@gmail.com", tourCompleted: false })).toBe(false);
  });

  it("groups steps by page", () => {
    const todaySteps = stepsForPage("today");
    expect(todaySteps.length).toBeGreaterThan(0);
    expect(todaySteps.every((s) => s.page === "today")).toBe(true);
  });

  it("clamps step indices into range", () => {
    expect(clampStepIndex(-5)).toBe(0);
    expect(clampStepIndex(999)).toBe(STUDENT_JOURNEY.length - 1);
    expect(clampStepIndex(NaN)).toBe(0);
  });

  it("returns -1 as the next index past the final step", () => {
    expect(nextStepIndex(STUDENT_JOURNEY.length - 1)).toBe(-1);
    expect(nextStepIndex(0)).toBe(1);
  });

  it("detects when the next step crosses to a different page", () => {
    // The last step of the journey never crosses (it is the end).
    expect(crossesPage(STUDENT_JOURNEY.length - 1)).toBe(false);
    // There is at least one page boundary in the journey.
    const boundaries = STUDENT_JOURNEY.map((_, i) => crossesPage(i)).filter(Boolean);
    expect(boundaries.length).toBeGreaterThan(0);
  });

  it("maps a step index to its page", () => {
    expect(pageOfStep(0)).toBe("today");
    expect(pageOfStep(999)).toBeNull();
  });
});
