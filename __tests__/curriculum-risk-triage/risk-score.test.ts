import { describe, expect, it } from "vitest";
import {
  computeRiskScore,
  gradeBandOf,
  isWorthFlagging,
  FLAG_THRESHOLD,
} from "@/lib/curriculum/riskTriage";

describe("gradeBandOf", () => {
  it("classifies G1-G3 as G1_3", () => {
    expect(gradeBandOf(1)).toBe("G1_3");
    expect(gradeBandOf(3)).toBe("G1_3");
  });
  it("classifies G4-G6 as G4_6", () => {
    expect(gradeBandOf(4)).toBe("G4_6");
    expect(gradeBandOf(6)).toBe("G4_6");
  });
  it("classifies G7+ as G7_PLUS", () => {
    expect(gradeBandOf(7)).toBe("G7_PLUS");
    expect(gradeBandOf(12)).toBe("G7_PLUS");
  });
});

describe("computeRiskScore", () => {
  it("scores a low-risk candidate (older grade, non-sensitive subject, not first-of-kind, comfortably passing) as zero", () => {
    const result = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("adds grade-band risk for G1-G3", () => {
    const result = computeRiskScore({
      grade: 2,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 400,
    });
    expect(result.reasons).toContain("grade_band_g1_3");
    expect(result.score).toBeGreaterThan(0);
  });

  it("adds sensitivity risk for CIVICS and SOCIAL_STUDIES", () => {
    const civics = computeRiskScore({
      grade: 9,
      subject: "CIVICS",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(civics.reasons).toContain("sensitive_subject_civics");

    const social = computeRiskScore({
      grade: 9,
      subject: "social_studies",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(social.reasons).toContain("sensitive_subject_social_studies");
  });

  it("adds first-of-kind risk", () => {
    const result = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: true,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(result.reasons).toContain("first_of_kind_cell");
  });

  it("adds gate-margin risk when word count is within 15% of the minimum", () => {
    const borderline = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 850, // 800 * 1.0625, inside the 1.15 threshold
      minWordCount: 800,
    });
    expect(borderline.reasons).toContain("borderline_quality_gate_margin");

    const comfortable = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(comfortable.reasons).not.toContain("borderline_quality_gate_margin");
  });

  it("stacks all four factors for the worst case (G2 SOCIAL_STUDIES, first-of-kind, borderline words)", () => {
    const result = computeRiskScore({
      grade: 2,
      subject: "SOCIAL_STUDIES",
      isFirstOfKind: true,
      wordCount: 410,
      minWordCount: 400,
    });
    expect(result.reasons).toEqual([
      "grade_band_g1_3",
      "sensitive_subject_social_studies",
      "first_of_kind_cell",
      "borderline_quality_gate_margin",
    ]);
    expect(result.score).toBeGreaterThanOrEqual(FLAG_THRESHOLD);
  });
});

describe("isWorthFlagging", () => {
  it("is false below FLAG_THRESHOLD and true at/above it", () => {
    expect(isWorthFlagging(FLAG_THRESHOLD - 1)).toBe(false);
    expect(isWorthFlagging(FLAG_THRESHOLD)).toBe(true);
  });
});
