import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  getPrompt,
  getPromptMetadata,
  getSystemPrompt,
  listPrompts,
  registerPrompt,
} from "@/lib/ai/promptRegistry";

describe("promptRegistry", () => {
  it("getPrompt returns registered prompt", () => {
    expect(getPrompt("adaptive.practice").key).toBe("adaptive.practice");
  });

  it("getPrompt throws for unknown prompt name", () => {
    expect(() => getPrompt("missing.prompt")).toThrow(/not found/i);
  });

  it("getSystemPrompt returns the raw template", () => {
    expect(getSystemPrompt("teacher.assist.system")).toContain(
      "supportive instructional coach"
    );
  });

  it("buildPrompt enforces placeholders", () => {
    expect(() => buildPrompt("student.tutor.system")).toThrow(
      /Missing prompt placeholders/i
    );
  });

  it("buildPrompt fills placeholders deterministically", () => {
    const prompt = buildPrompt("student.tutor.system", {
      persona: "a helper.",
      subjectContext: "Mathematics",
      gradeContext: "Grade 6 (upper primary)",
      strandContext: "fractions",
      lessonTitle: "Adding Fractions",
      lessonExcerpt: "Fractions represent equal parts of a whole.",
      contextBlock: "Context goes here.",
      instructionBlock: "Follow the rules.",
    });

    expect(prompt).toContain("You are a helper.");
    expect(prompt).toContain("Current lesson subject: Mathematics.");
    expect(prompt).toContain("Current learner level: Grade 6 (upper primary).");
    expect(prompt).toContain("Current learning strand: fractions.");
    expect(prompt).toContain("Current lesson title: Adding Fractions.");
    expect(prompt).toContain("Lesson excerpt: Fractions represent equal parts of a whole.");
    expect(prompt).toContain("Context goes here.");
    expect(prompt).toContain("Follow the rules.");
    expect(prompt).toContain("Mathematics, Literacy, Science, Civics, Social Studies, and Computer Science");
  });

  it("hash is consistent for same template", () => {
    const first = registerPrompt("test.prompt.hash.1", "1.0.0", "same template");
    const second = registerPrompt("test.prompt.hash.2", "1.0.0", "same template");
    expect(first.hash).toBe(second.hash);
  });

  it("getPromptMetadata returns preview-only metadata", () => {
    const metadata = getPromptMetadata("lesson.deep");
    expect(metadata.key).toBe("lesson.deep");
    expect(metadata.approvedDynamic).toBe(true);
    expect(metadata.preview.length).toBeGreaterThan(0);
    expect((metadata as any).template).toBeUndefined();
  });

  it("listPrompts returns all registered prompts", () => {
    const prompts = listPrompts();
    expect(prompts.some((entry) => entry.key === "adaptive.practice")).toBe(true);
    expect(prompts.some((entry) => entry.key === "exam.generation")).toBe(true);
    expect(prompts.some((entry) => entry.key === "lesson.deep")).toBe(true);
    expect(prompts.some((entry) => entry.key === "student.tutor.system")).toBe(true);
    expect(prompts.some((entry) => entry.key === "student.lessonQuiz.system")).toBe(true);
    expect(prompts.some((entry) => entry.key === "student.lessonGapAnalysis.system")).toBe(true);
    expect(prompts.some((entry) => entry.key === "teacher.assist.user")).toBe(true);
    expect(prompts.some((entry) => entry.key === "teacher.assignment-tutor.user")).toBe(true);
    expect(prompts.some((entry) => entry.key === "teacher.classInsights.system")).toBe(true);
    expect(prompts.some((entry) => entry.key === "teacher.classInsights.user")).toBe(true);
    expect(prompts.some((entry) => entry.key === "curriculum.eliteUpgrade.system")).toBe(true);
    expect(prompts.some((entry) => entry.key === "curriculum.eliteUpgrade.user")).toBe(true);
    expect(prompts.some((entry) => entry.key === "curriculum.eliteUpgrade.assessment")).toBe(true);
    expect(prompts.some((entry) => entry.key === "curriculum.lesson_upgrade_elite_v1.system")).toBe(true);
    expect(prompts.some((entry) => entry.key === "curriculum.lesson_upgrade_elite_v1.user")).toBe(true);
    expect(prompts.some((entry) => entry.key === "curriculum.lesson_upgrade_refinement_v1.user")).toBe(true);
  });

  it("registers elite upgrade prompts with required structured placeholders", () => {
    const system = getSystemPrompt("curriculum.lesson_upgrade_elite_v1.system");
    const user = buildPrompt("curriculum.lesson_upgrade_elite_v1.user", {
      subject: "MATH",
      grade: 7,
      unit: "Ratios",
      lessonTitle: "Ratios in Market Prices",
      existing_curriculum_guidelines: "Follow LiberiaLearn curriculum framework.",
      lessonContent: "{}",
      objectives: "[]",
      assessment: "[]",
      examples: "[]",
      localContext: "[]",
    });
    const refinement = buildPrompt("curriculum.lesson_upgrade_refinement_v1.user", {
      previousGeneratedLesson: "{}",
      qualityScore: "{}",
      weakCategories: "practice, assessment",
    });

    expect(system).toContain("There is no higher level above this");
    expect(system).toContain("independently rescore");
    expect(user).toContain("REQUIRED OUTPUT FORMAT");
    expect(user).toContain("CALIBRATION REQUIREMENTS");
    expect(user).toContain("Include at least 4 assessment questions");
    expect(user).toContain("Teacher notes must contain at least 3 separate actionable moves");
    expect(user).toContain('"quality_score"');
    expect(refinement).toContain("Revise ONLY the weak areas");
  });
});
