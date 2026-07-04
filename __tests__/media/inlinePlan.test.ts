/**
 * __tests__/media/inlinePlan.test.ts — Phase 4A Deliverable 3 (inline planning)
 */
import { describe, it, expect } from "vitest";
import { planInlineIllustrations, splitBodyParagraphs, MAX_INLINE_PER_LESSON } from "@/lib/media/inlinePlan";

describe("splitBodyParagraphs", () => {
  it("splits on blank lines and trims", () => {
    expect(splitBodyParagraphs("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
    expect(splitBodyParagraphs("")).toEqual([]);
  });
});

describe("planInlineIllustrations", () => {
  it("returns [] when fewer than two distinct structures are described", () => {
    expect(planInlineIllustrations({ title: "Numbers", body: "Only one cell mentioned here." })).toEqual([]);
    expect(planInlineIllustrations({ title: "Grammar", body: "Verbs and nouns and adjectives." })).toEqual([]);
  });

  it("plans inline specs at the paragraphs where each structure appears", () => {
    const body = [
      "The plant cell has a nucleus at its center.",
      "The chloroplast captures light for photosynthesis.",
      "The membrane surrounds the cell.",
    ].join("\n\n");
    const specs = planInlineIllustrations({ title: "Plant Cell", body });
    expect(specs.length).toBeGreaterThanOrEqual(2);
    expect(specs.length).toBeLessThanOrEqual(MAX_INLINE_PER_LESSON);
    expect(specs[0].subjectFocus).toContain("Plant Cell");
    // positions are valid paragraph indices
    for (const s of specs) expect(typeof s.position).toBe("number");
  });

  it("caps the number of inline illustrations per lesson", () => {
    const body = [
      "cell here", "nucleus here", "membrane here", "leaf here", "root here", "heart here",
    ].join("\n\n");
    const specs = planInlineIllustrations({ title: "Biology", body });
    expect(specs.length).toBe(MAX_INLINE_PER_LESSON);
  });
});
