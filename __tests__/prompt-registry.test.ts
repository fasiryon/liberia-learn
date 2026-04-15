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
  });
});
