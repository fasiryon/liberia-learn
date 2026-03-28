import { describe, expect, it } from "vitest";
import { getPrompt, listPrompts, registerPrompt } from "@/lib/ai/promptRegistry";

describe("promptRegistry", () => {
  it("getPrompt returns registered prompt", () => {
    expect(getPrompt("adaptive.practice").name).toBe("adaptive.practice");
  });

  it("getPrompt throws for unknown prompt name", () => {
    expect(() => getPrompt("missing.prompt")).toThrow(/not found/i);
  });

  it("hash is consistent for same template", () => {
    const first = registerPrompt("test.prompt.hash.1", "1.0.0", "same template");
    const second = registerPrompt("test.prompt.hash.2", "1.0.0", "same template");
    expect(first.hash).toBe(second.hash);
  });

  it("listPrompts returns all registered prompts", () => {
    const prompts = listPrompts();
    expect(prompts.some((entry) => entry.name === "adaptive.practice")).toBe(true);
    expect(prompts.some((entry) => entry.name === "exam.generation")).toBe(true);
    expect(prompts.some((entry) => entry.name === "lesson.deep")).toBe(true);
  });
});
