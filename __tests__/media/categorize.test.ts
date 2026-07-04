/**
 * __tests__/media/categorize.test.ts — Phase 4A Deliverable 1
 * Deterministic lesson categorization + grade banding.
 */
import { describe, it, expect } from "vitest";
import { categorizeLesson, gradeBand } from "@/lib/media/categorize";
import { lessonMediaPath } from "@/lib/media/blobStorage";
import { isImageCategory, IMAGE_CATEGORIES } from "@/lib/media/types";

describe("gradeBand", () => {
  it("maps grades to K-3 / 4-8 / 9-12", () => {
    expect(gradeBand(1)).toBe("K-3");
    expect(gradeBand(3)).toBe("K-3");
    expect(gradeBand(4)).toBe("4-8");
    expect(gradeBand(8)).toBe("4-8");
    expect(gradeBand(9)).toBe("9-12");
    expect(gradeBand(12)).toBe("9-12");
  });
});

describe("categorizeLesson", () => {
  it("marks pure math / grammar / reading as ABSTRACT", () => {
    expect(categorizeLesson("MATH", "Solving Linear Equations")).toBe("ABSTRACT");
    expect(categorizeLesson("ENGLISH", "Subject-Verb Agreement")).toBe("ABSTRACT");
    expect(categorizeLesson("LITERACY", "Reading Comprehension: The Fox")).toBe("ABSTRACT");
    expect(categorizeLesson("COMPUTER_SCIENCE", "Introduction to Loops")).toBe("ABSTRACT");
  });

  it("marks science structures / diagrams as VISUAL", () => {
    expect(categorizeLesson("SCIENCE", "The Plant Cell and Its Organelles")).toBe("VISUAL");
    expect(categorizeLesson("BIOLOGY", "Human Digestive System")).toBe("VISUAL");
    expect(categorizeLesson("CHEMISTRY", "Atomic Structure")).toBe("VISUAL");
    expect(categorizeLesson("PHYSICS", "Forces and Circuits")).toBe("VISUAL");
    expect(categorizeLesson("ENGINEERING_FOUNDATIONS", "Levers and Pulleys")).toBe("VISUAL");
    expect(categorizeLesson("GEOGRAPHY", "Landforms of West Africa")).toBe("VISUAL");
  });

  it("routes health / nutrition science topics to PHOTO", () => {
    expect(categorizeLesson("SCIENCE", "Healthy Eating and Nutrition")).toBe("PHOTO");
    expect(categorizeLesson("SCIENCE", "Exercise and Wellness")).toBe("PHOTO");
  });

  it("marks civics / civic-life social studies as PHOTO", () => {
    expect(categorizeLesson("CIVICS", "The Role of Local Government")).toBe("PHOTO");
    expect(categorizeLesson("SOCIAL_STUDIES", "Community Life in Liberia")).toBe("PHOTO");
  });

  it("uses keyword signals for social studies structure topics", () => {
    expect(categorizeLesson("SOCIAL_STUDIES", "Rivers and Mountains of Liberia")).toBe("VISUAL");
  });

  it("always returns a valid category", () => {
    for (const subj of ["MATH", "SCIENCE", "CIVICS", "UNKNOWN_SUBJECT", ""]) {
      const c = categorizeLesson(subj, "Some Title");
      expect(isImageCategory(c)).toBe(true);
      expect(IMAGE_CATEGORIES).toContain(c);
    }
  });
});

describe("lessonMediaPath", () => {
  it("builds deterministic hero + inline paths under the media prefix", () => {
    expect(lessonMediaPath({ lessonId: "abc123", kind: "hero" })).toBe("lesson-media/abc123/hero.webp");
    expect(lessonMediaPath({ lessonId: "abc123", kind: "inline", index: 2 })).toBe(
      "lesson-media/abc123/inline-2.webp"
    );
  });

  it("sanitizes unsafe id segments", () => {
    expect(lessonMediaPath({ lessonId: "AB C/../x", kind: "hero" })).toBe("lesson-media/ab-c-x/hero.webp");
  });

  it("honors a custom extension", () => {
    expect(lessonMediaPath({ lessonId: "id", kind: "hero", ext: "png" })).toBe("lesson-media/id/hero.png");
  });
});
