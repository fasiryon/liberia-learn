import { describe, it, expect } from "vitest";
import { ROLE_TOURS, stepsForRole, type TourRole } from "@/lib/tours/roleTours";

const ROLES: TourRole[] = ["teacher", "guardian", "admin", "official"];

describe("roleTours", () => {
  it("defines a tour for every non-student role", () => {
    for (const role of ROLES) {
      expect(Array.isArray(ROLE_TOURS[role])).toBe(true);
      expect(ROLE_TOURS[role].length).toBeGreaterThan(0);
    }
  });

  it("keeps each tour within the 5-8 step spec ceiling", () => {
    for (const role of ROLES) {
      const steps = stepsForRole(role);
      expect(steps.length).toBeGreaterThanOrEqual(4);
      expect(steps.length).toBeLessThanOrEqual(8);
    }
  });

  it("every step has a data-tour anchor selector, title, body and side", () => {
    for (const role of ROLES) {
      for (const step of stepsForRole(role)) {
        expect(step.selector).toMatch(/^\[data-tour='[a-z-]+'\]$/);
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
        expect(["top", "bottom", "left", "right"]).toContain(step.side);
      }
    }
  });

  it("uses unique anchors within each role's tour", () => {
    for (const role of ROLES) {
      const selectors = stepsForRole(role).map((s) => s.selector);
      expect(new Set(selectors).size).toBe(selectors.length);
    }
  });

  it("returns an empty list for an unknown role", () => {
    // @ts-expect-error — exercising the runtime guard for an invalid role
    expect(stepsForRole("wizard")).toEqual([]);
  });
});
