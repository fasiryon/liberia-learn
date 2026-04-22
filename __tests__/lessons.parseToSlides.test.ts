import { describe, expect, it } from "vitest";
import { parseToSlides } from "@/lib/lessons/parseToSlides";

describe("parseToSlides", () => {
  it("uses H2 and H3 headings as slide boundaries", () => {
    const slides = parseToSlides({
      title: "Ratios",
      content: "Intro paragraph.\n\n## Meaning\n\nFull section text.\n\n### Example\n\nMore full text.",
    });
    expect(slides.map((slide) => slide.title)).toContain("Meaning");
    expect(slides.map((slide) => slide.title)).toContain("Example");
  });

  it("groups paragraphs when no headings exist", () => {
    const slides = parseToSlides({
      title: "No Headings",
      content: "One.\n\nTwo.\n\nThree.\n\nFour.",
    });
    expect(slides.some((slide) => slide.title === "Part 2")).toBe(true);
  });

  it("keeps the title and first paragraph on the first slide", () => {
    const slides = parseToSlides({ title: "Market Math", content: "First paragraph.\n\nSecond paragraph." });
    expect(slides[0].title).toBe("Market Math");
    expect(slides[0].content).toContain("First paragraph.");
  });

  it("does not lose original lesson text across slides", () => {
    const content = "Intro paragraph.\n\n## Section\n\nImportant body text.\n\nAnother sentence.";
    const slides = parseToSlides({ title: "Full Text", content });
    const combined = slides.map((slide) => slide.content).join("\n");
    expect(combined).toContain("Intro paragraph.");
    expect(combined).toContain("Important body text.");
    expect(combined).toContain("Another sentence.");
  });

  it("handles an empty lesson gracefully", () => {
    const slides = parseToSlides({ title: "Empty", content: "" });
    expect(slides).toHaveLength(1);
    expect(slides[0].content).toContain("No lesson text");
  });
});
