import { describe, expect, it } from "vitest";
import { chunkTextForTTS } from "@/lib/audio/chunkText";

describe("chunkTextForTTS", () => {
  it("splits long text by paragraph and sentence without exceeding maxChars", () => {
    const text = [
      "Paragraph one has a short sentence. ".repeat(80),
      "Paragraph two has another short sentence. ".repeat(80),
    ].join("\n\n");

    const chunks = chunkTextForTTS(text, 3500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3500)).toBe(true);
    expect(chunks.join("\n\n")).toContain("Paragraph one");
    expect(chunks.join("\n\n")).toContain("Paragraph two");
  });

  it("falls back to word splitting for oversized sentences", () => {
    const text = Array.from({ length: 900 }, (_, index) => `word${index}`).join(" ");

    const chunks = chunkTextForTTS(text, 3500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3500)).toBe(true);
  });
});
