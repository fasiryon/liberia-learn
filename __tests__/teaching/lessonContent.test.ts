import { describe, it, expect } from "vitest";
import { getLessonNarration, getLessonSlides } from "@/lib/teaching/lessonContent";

describe("getLessonNarration", () => {
  it("prefers body_standard over body", () => {
    const narration = getLessonNarration({ body_standard: "Standard text.", body: "Fallback text." });
    expect(narration).toBe("Standard text.");
  });

  it("falls back to body when body_standard is absent", () => {
    const narration = getLessonNarration({ body: "Fallback text." });
    expect(narration).toBe("Fallback text.");
  });

  it("strips HTML tags and collapses whitespace when the content looks like HTML", () => {
    const narration = getLessonNarration({ body: "<p>Hello   <b>world</b></p>" });
    expect(narration).toBe("Hello world");
  });

  it("returns a clear placeholder when no narration is available", () => {
    const narration = getLessonNarration({});
    expect(narration).toBe("No lesson narration is available yet.");
  });
});

describe("getLessonSlides", () => {
  it("returns the first slide deck's slides when present", () => {
    const slides = getLessonSlides({
      slideDeckSpecs: [{ slides: [{ title: "Intro", bullets: ["A", "B"] }] }],
    });
    expect(slides).toEqual([{ title: "Intro", bullets: ["A", "B"] }]);
  });

  it("synthesizes a single fallback slide from objectives when no slide deck exists", () => {
    const slides = getLessonSlides({ objectives: ["Learn X", "Learn Y"] });
    expect(slides).toHaveLength(1);
    expect(slides[0].bullets).toEqual(["Learn X", "Learn Y"]);
  });
});
