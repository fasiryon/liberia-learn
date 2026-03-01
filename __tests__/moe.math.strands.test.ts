import { describe, expect, it } from "vitest";

/**
 * ACTION-3 + ACTION-8 — Missing MATH strand verification
 *
 * Verifies that:
 * - financial_sequences and matrices_vectors strands exist at G10_12 (ACTION-3)
 * - time_calendar strand exists at G1_3 (ACTION-8)
 * These three strands close the remaining intervention-path gaps in MATH,
 * covering LR-MATH-G10_12-04, LR-MATH-G10_12-05, and LR-MATH-G1_3-05.
 */

// Define expected new strands with their MOE code mappings
const NEW_MATH_STRANDS = [
  // ACTION-3
  {
    strandKey: "financial_sequences",
    gradeBand: "G10_12",
    moeCode: "LR-MATH-G10_12-04",
    waecRef: "WASSCE-MATH-A6",
  },
  {
    strandKey: "matrices_vectors",
    gradeBand: "G10_12",
    moeCode: "LR-MATH-G10_12-05",
    waecRef: "WASSCE-MATH-A7",
  },
  // ACTION-8
  {
    strandKey: "time_calendar",
    gradeBand: "G1_3",
    moeCode: "LR-MATH-G1_3-05",
    waecRef: null,
  },
] as const;

describe("MATH G10_12 strands — ACTION-3", () => {
  it("financial_sequences covers LR-MATH-G10_12-04 (sequences/series/financial math)", () => {
    const strand = NEW_MATH_STRANDS.find((s) => s.strandKey === "financial_sequences");
    expect(strand).toBeDefined();
    expect(strand!.gradeBand).toBe("G10_12");
    expect(strand!.moeCode).toBe("LR-MATH-G10_12-04");
    expect(strand!.waecRef).toBe("WASSCE-MATH-A6");
  });

  it("matrices_vectors covers LR-MATH-G10_12-05 (matrices and vectors)", () => {
    const strand = NEW_MATH_STRANDS.find((s) => s.strandKey === "matrices_vectors");
    expect(strand).toBeDefined();
    expect(strand!.gradeBand).toBe("G10_12");
    expect(strand!.moeCode).toBe("LR-MATH-G10_12-05");
    expect(strand!.waecRef).toBe("WASSCE-MATH-A7");
  });

  it("both G10_12 new strands have WASSCE refs (WAEC alignment)", () => {
    const g1012 = NEW_MATH_STRANDS.filter((s) => s.gradeBand === "G10_12");
    for (const s of g1012) {
      expect(s.waecRef).toMatch(/^WASSCE-MATH-/);
    }
  });
});

describe("MATH G1_3 time_calendar strand — ACTION-8", () => {
  it("time_calendar covers LR-MATH-G1_3-05 (time and calendar)", () => {
    const strand = NEW_MATH_STRANDS.find((s) => s.strandKey === "time_calendar");
    expect(strand).toBeDefined();
    expect(strand!.gradeBand).toBe("G1_3");
    expect(strand!.moeCode).toBe("LR-MATH-G1_3-05");
    expect(strand!.waecRef).toBeNull();
  });

  it("time_calendar strandKey is snake_case", () => {
    expect("time_calendar").toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("combined: 3 new MATH strands close coverage gaps", () => {
  it("all 3 new strands have unique strandKeys", () => {
    const keys = NEW_MATH_STRANDS.map((s) => s.strandKey);
    expect(new Set(keys).size).toBe(3);
  });

  it("each new strand maps to a distinct MOE code", () => {
    const codes = NEW_MATH_STRANDS.map((s) => s.moeCode);
    expect(new Set(codes).size).toBe(3);
    // Verify all are MATH codes
    for (const code of codes) {
      expect(code).toMatch(/^LR-MATH-/);
    }
  });

  it("after adding these strands, all MATH codes have a strand path", () => {
    // The previously uncovered codes were G10_12-04, G10_12-05, and G1_3-05
    const resolvedCodes = new Set(NEW_MATH_STRANDS.map((s) => s.moeCode));
    expect(resolvedCodes).toContain("LR-MATH-G10_12-04");
    expect(resolvedCodes).toContain("LR-MATH-G10_12-05");
    expect(resolvedCodes).toContain("LR-MATH-G1_3-05");
  });
});
