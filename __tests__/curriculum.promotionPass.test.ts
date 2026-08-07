import { describe, expect, it } from "vitest";
import { evaluatePromotionCandidate } from "@/lib/curriculum/promotionPass";

function buildPayload(overrides: Record<string, any> = {}) {
  return {
    title: "Grade 4 Fractions",
    grade: 4,
    subject: "MATH",
    body: "placeholder",
    body_standard: `${"word ".repeat(1750)} ## Teacher Explanation ${"word ".repeat(50)}`,
    body_block: `${"word ".repeat(1750)} ## Assessment Questions ${"word ".repeat(50)}`,
    explanation: "Detailed explanation",
    workedExamples: ["Example 1"],
    guidedPractice: ["Practice 1", "Practice 2"],
    independentPractice: ["Practice 3", "Practice 4"],
    assessment: "Exit ticket",
    primaryConcept: "fractions",
    prerequisites: ["division"],
    generationStage: "generated_enriched",
    ...overrides,
  };
}

describe("promotion pass", () => {
  it("promotes lesson that passes all gates", () => {
    const decision = evaluatePromotionCandidate({
      contentId: "math-g4-fractions",
      grade: 4,
      subject: "MATH",
      status: "generated",
      payload: buildPayload(),
    }, "2026-03-31T00:00:00.000Z");

    expect(decision.action).toBe("promote");
    if (decision.action === "promote") {
      expect(decision.normalizedPayload.conceptTag).toBe("fractions");
      expect(decision.normalizedPayload.prerequisiteConcepts).toEqual(["division"]);
      expect(decision.normalizedPayload.approvedBy).toBe("system:promotion-pass-2b");
    }
  });

  it("skips lesson below 3500 words", () => {
    const decision = evaluatePromotionCandidate({
      contentId: "math-g4-short",
      grade: 4,
      subject: "MATH",
      status: "generated",
      payload: buildPayload({
        body_standard: "short body",
        body_block: "short body",
      }),
    });

    expect(decision.action).toBe("skip");
    expect(decision.gate).toBe(1);
  });

  it("skips lesson missing practice questions", () => {
    const decision = evaluatePromotionCandidate({
      contentId: "math-g4-no-practice",
      grade: 4,
      subject: "MATH",
      status: "generated",
      payload: buildPayload({
        guidedPractice: ["Practice 1"],
        independentPractice: [],
      }),
    });

    expect(decision.action).toBe("skip");
    expect(decision.gate).toBe(2);
    expect(decision.reason).toContain("practice questions");
  });

  it("skips lesson missing conceptTag", () => {
    const decision = evaluatePromotionCandidate({
      contentId: "math-g4-no-concept",
      grade: 4,
      subject: "MATH",
      status: "generated",
      payload: buildPayload({
        primaryConcept: undefined,
        conceptTag: undefined,
      }),
    });

    expect(decision.action).toBe("skip");
    expect(decision.gate).toBe(3);
    expect(decision.reason).toContain("conceptTag");
  });

  it("does not touch already-approved lessons", () => {
    const decision = evaluatePromotionCandidate({
      contentId: "math-g4-approved",
      grade: 4,
      subject: "MATH",
      status: "APPROVED",
      payload: buildPayload(),
    });

    expect(decision.action).toBe("skip");
    expect(decision.gate).toBeNull();
    expect(decision.reason).toBe("already approved");
  });

  it("accepts structured practice sections when top-level practice arrays are thin", () => {
    const decision = evaluatePromotionCandidate({
      contentId: "math-g4-structured-practice",
      grade: 4,
      subject: "MATH",
      status: "generated",
      payload: buildPayload({
        guidedPractice: ["One stored practice item"],
        independentPractice: ["One stored independent item"],
        activities: ["Activity 1", "Activity 2", "Activity 3"],
        body_standard: `${"word ".repeat(1750)} ## Guided Practice ${"word ".repeat(40)} ## Independent Practice ${"word ".repeat(40)} ## Assessment Questions ${"word ".repeat(40)}`,
        body_block: `${"word ".repeat(1750)} ## Guided Group Work ${"word ".repeat(40)} ## Independent or Project Work ${"word ".repeat(40)} ## Assessment and Reflection ${"word ".repeat(40)}`,
      }),
    });

    expect(decision.action).toBe("promote");
  });

  it("logs correct reason for subject mismatch skips", () => {
    const decision = evaluatePromotionCandidate({
      contentId: "math-g4-subject-mismatch",
      grade: 4,
      subject: "MATH",
      status: "generated",
      payload: buildPayload({
        subject: "SCIENCE",
      }),
    });

    expect(decision.action).toBe("skip");
    expect(decision.gate).toBe(5);
    expect(decision.reason).toContain("payload subject");
  });
});
