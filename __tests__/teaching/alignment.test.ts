import { describe, it, expect } from "vitest";
import { determineAlignmentMode } from "@/lib/teaching/alignment";

describe("determineAlignmentMode", () => {
  it("returns FULL_CONFIDENCE for a genuinely non-empty canonical alignment", () => {
    expect(
      determineAlignmentMode({ contentId: "c1", standards: ["MOE-MATH-G7-01"], alignedAt: "2026-01-01", method: "manual" })
    ).toBe("FULL_CONFIDENCE");
  });

  it("returns FULL_CONFIDENCE for a genuinely non-empty legacy array", () => {
    expect(determineAlignmentMode(["MOE-MATH-G7-01"])).toBe("FULL_CONFIDENCE");
  });

  it("returns DEFERRED for an empty legacy placeholder array", () => {
    expect(determineAlignmentMode([])).toBe("DEFERRED");
  });

  it("returns DEFERRED for null/undefined", () => {
    expect(determineAlignmentMode(null)).toBe("DEFERRED");
    expect(determineAlignmentMode(undefined)).toBe("DEFERRED");
  });
});
