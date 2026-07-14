import { describe, it, expect } from "vitest";
import { detectSafeguardingKeywords } from "@/lib/agents/safeguarding/keywordGate";

describe("detectSafeguardingKeywords", () => {
  it("detects direct hurt/hit language", () => {
    expect(detectSafeguardingKeywords("my child says the teacher hit him yesterday")).toBe(true);
    expect(detectSafeguardingKeywords("someone is hurting my child")).toBe(true);
  });

  it("detects abuse, threats, missing, following", () => {
    expect(detectSafeguardingKeywords("I think he is being abused at home")).toBe(true);
    expect(detectSafeguardingKeywords("a man threatened my daughter")).toBe(true);
    expect(detectSafeguardingKeywords("my child has been missing since this morning")).toBe(true);
    expect(detectSafeguardingKeywords("a stranger has been following me and my child")).toBe(true);
  });

  it("detects self-harm and crisis language", () => {
    expect(detectSafeguardingKeywords("she wants to kill herself")).toBe(true);
    expect(detectSafeguardingKeywords("he keeps talking about self-harm")).toBe(true);
    expect(detectSafeguardingKeywords("I am worried, she seems suicidal")).toBe(true);
  });

  it("does not flag ordinary school questions", () => {
    expect(detectSafeguardingKeywords("How is my son doing in math?")).toBe(false);
    expect(detectSafeguardingKeywords("Can you tell me his attendance this week?")).toBe(false);
    expect(detectSafeguardingKeywords("I want to reach the science teacher")).toBe(false);
  });

  it("handles empty input", () => {
    expect(detectSafeguardingKeywords("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(detectSafeguardingKeywords("MY CHILD IS MISSING")).toBe(true);
  });
});
