import { describe, it, expect, vi, beforeEach } from "vitest";

const routedCompletion = vi.fn();
vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: (...a: unknown[]) => routedCompletion(...a),
}));

import "@/lib/agents/infraPrompts";
import {
  detectLanguage,
  translateToEnglish,
  translateFromEnglish,
} from "@/lib/agents/translation";

function llm(content: string) {
  return { content, tier: "fast", model: "test", inputTokens: 5, outputTokens: 3, estimatedCostUSD: 0.0001 };
}

describe("detectLanguage", () => {
  beforeEach(() => routedCompletion.mockReset());

  it("returns the detected ISO code", async () => {
    routedCompletion.mockResolvedValue(llm(JSON.stringify({ lang: "fr" })));
    expect(await detectLanguage("Bonjour le monde comment ca va")).toBe("fr");
  });

  it("returns en for empty text without an LLM call", async () => {
    expect(await detectLanguage("  ")).toBe("en");
    expect(routedCompletion).not.toHaveBeenCalled();
  });

  it("falls back to en on classifier error", async () => {
    routedCompletion.mockRejectedValueOnce(new Error("down"));
    expect(await detectLanguage("qwerty zxcvb unknown")).toBe("en");
  });
});

describe("translateToEnglish", () => {
  beforeEach(() => routedCompletion.mockReset());

  it("returns the text unchanged when source is already English", async () => {
    expect(await translateToEnglish("Hello there", "en")).toBe("Hello there");
    expect(routedCompletion).not.toHaveBeenCalled();
  });

  it("translates non-English text to English", async () => {
    routedCompletion.mockResolvedValue(llm(JSON.stringify({ text: "Hello" })));
    expect(await translateToEnglish("Bonjour", "fr")).toBe("Hello");
  });

  it("caches identical (text, source) pairs", async () => {
    routedCompletion.mockResolvedValue(llm(JSON.stringify({ text: "Hello" })));
    await translateToEnglish("Bonjour cache", "fr");
    await translateToEnglish("Bonjour cache", "fr");
    expect(routedCompletion).toHaveBeenCalledTimes(1);
  });

  it("falls back to the original text on error", async () => {
    routedCompletion.mockRejectedValueOnce(new Error("down"));
    expect(await translateToEnglish("Guten Tag", "de")).toBe("Guten Tag");
  });
});

describe("translateFromEnglish", () => {
  beforeEach(() => routedCompletion.mockReset());

  it("returns the text unchanged when target is English", async () => {
    expect(await translateFromEnglish("Hello", "en")).toBe("Hello");
    expect(routedCompletion).not.toHaveBeenCalled();
  });

  it("translates English text into the target language", async () => {
    routedCompletion.mockResolvedValue(llm(JSON.stringify({ text: "Bonjour" })));
    expect(await translateFromEnglish("Hello", "fr")).toBe("Bonjour");
    const messages = routedCompletion.mock.calls[0][0].messages;
    expect(messages[0].content).toMatch(/fr/);
  });
});
