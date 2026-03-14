import { describe, expect, it } from "vitest";
import { generateAssessmentItems, generateLabs, generateRubric } from "@/lib/curriculum-helpers";

describe("generateAssessmentItems — standardCodes", () => {
  it("attaches provided moeAlignmentCodes to every item", () => {
    const codes = ["MOE-MATH-4A", "MOE-MATH-4B"];
    const items = generateAssessmentItems(4, "MATH", "Fractions", codes);

    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item.standardCodes).toEqual(codes);
    }
  });

  it("defaults standardCodes to empty array when not provided", () => {
    const items = generateAssessmentItems(6, "SCIENCE", "Ecosystems");

    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item.standardCodes).toEqual([]);
    }
  });

  it("defaults standardCodes to empty array when empty codes passed", () => {
    const items = generateAssessmentItems(3, "LITERACY", "Phonics", []);

    for (const item of items) {
      expect(item.standardCodes).toEqual([]);
    }
  });
});

describe("generateLabs", () => {
  it("returns labs for science subjects", () => {
    const labs = generateLabs(8, "SCIENCE", "Plant Growth");
    expect(labs.length).toBeGreaterThan(0);
    expect(labs[0].procedure.length).toBeGreaterThan(0);
    expect(labs[0].observationForm.length).toBeGreaterThan(0);
    expect(labs[0].analysisQuestions.length).toBeGreaterThan(0);
  });

  it("returns no labs for civics subjects", () => {
    expect(generateLabs(6, "CIVICS", "Local Government")).toEqual([]);
  });

  it("uses locally available materials and offline-capable walkthroughs", () => {
    const [lab] = generateLabs(8, "SCIENCE", "Plant Growth");
    expect(lab.offlineCapable).toBe(true);
    expect(lab.materialsNeeded.join(" ").toLowerCase()).not.toContain("test tube");
  });
});

describe("generateRubric — standardCodes", () => {
  it("attaches provided moeAlignmentCodes to every criterion", () => {
    const codes = ["MOE-ENG-7C"];
    const rubric = generateRubric("Essay Writing", codes);

    expect(rubric.criteria).toHaveLength(3);
    for (const criterion of rubric.criteria) {
      expect(criterion.standardCodes).toEqual(codes);
    }
  });

  it("defaults criterion standardCodes to empty array when not provided", () => {
    const rubric = generateRubric("Reading Comprehension");

    for (const criterion of rubric.criteria) {
      expect(criterion.standardCodes).toEqual([]);
    }
  });

  it("defaults criterion standardCodes to empty array when empty codes passed", () => {
    const rubric = generateRubric("Science Lab", []);

    for (const criterion of rubric.criteria) {
      expect(criterion.standardCodes).toEqual([]);
    }
  });

  it("all criterion names are present", () => {
    const rubric = generateRubric("Test", ["MOE-X-1"]);
    const names = rubric.criteria.map((c) => c.name);
    expect(names).toEqual(["Understanding", "Application", "Communication"]);
  });
});
