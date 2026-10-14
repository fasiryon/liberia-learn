import { describe, expect, it } from "vitest";
import { digitsOf, expandedForm, formatNumber, fromDigits, placeOfDigit, placeValueOf, wordForm } from "@/lib/learner-experience/demo/placeValue";
import { isSafeHref, isSafeImageSrc, parseLessonBlocks, sectionRole, slideBlocks, splitLessonSections, teachingParts } from "@/lib/learner-experience/lessonText";

describe("Grade 7 place-value demo arithmetic", () => {
  it("breaks numbers into seven places and back", () => {
    expect(digitsOf(2_350_480)).toEqual([2, 3, 5, 0, 4, 8, 0]);
    expect(fromDigits([4, 2, 0, 5, 3, 1, 6])).toBe(4_205_316);
    expect(digitsOf(12_000_000)).toEqual([9, 9, 9, 9, 9, 9, 9]);
  });
  it("formats, expands and reads numbers", () => {
    expect(formatNumber(4205316)).toBe("4,205,316");
    expect(expandedForm(2_350_480)).toBe("2,000,000 + 300,000 + 50,000 + 400 + 80");
    expect(expandedForm(0)).toBe("0");
    expect(wordForm(4_205_316)).toBe("four million, two hundred five thousand, three hundred sixteen");
    expect(wordForm(5_040_009)).toBe("five million, forty thousand, nine");
    expect(wordForm(1_742_009)).toBe("one million, seven hundred forty-two thousand, nine");
  });
  it("finds the value of a digit by its place", () => {
    expect(placeOfDigit(2_350_480, 3)).toBe(1);
    expect(placeValueOf(2_350_480, 1)).toBe(300_000);
    expect(placeValueOf(1_742_009, placeOfDigit(1_742_009, 7))).toBe(700_000);
  });
});

describe("legacy lesson text presentation", () => {
  const body = "Intro text.\n\n## Place and value\n\nThe **place** matters.\n\n- One\n- Two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n## Worked example\n\n1. First\n2. Second\n\n## Try it yourself\n\nDo this.\n\n## Key takeaways\n\n- Done";
  it("parses blocks in authored order without inventing content", () => {
    const blocks = parseLessonBlocks(body);
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "heading", "paragraph", "list", "table", "heading", "list", "heading", "paragraph", "heading", "list"]);
    const table = blocks.find((block) => block.kind === "table");
    expect(table).toEqual({ kind: "table", header: ["A", "B"], rows: [["1", "2"]] });
  });
  it("splits sections at authored headings and reads roles only from headings", () => {
    const sections = splitLessonSections(parseLessonBlocks(body), "Lesson");
    expect(sections.map((section) => section.title)).toEqual(["Introduction", "Place and value", "Worked example", "Try it yourself", "Key takeaways"]);
    expect(sections.map((section, index) => sectionRole(section.title, index))).toEqual(["INTRODUCTION", "LEARN", "EXAMPLE", "PRACTICE", "REVIEW"]);
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
  });
  it("keeps a headingless lesson as one section titled with the lesson", () => {
    expect(splitLessonSections(parseLessonBlocks("Just text."), "My lesson")).toMatchObject([{ title: "My lesson" }]);
  });
  it("derives teaching parts only from the slide's own blocks", () => {
    const parts = teachingParts(parseLessonBlocks("Lead.\n\n- a\n- b\n\n1. x\n\n| H |\n| --- |\n| v |\n\nMore."));
    expect(parts.lead?.text).toBe("Lead.");
    expect(parts.points?.items).toEqual(["a", "b"]);
    expect(parts.steps?.items).toEqual(["x"]);
    expect(parts.visuals).toHaveLength(1);
    expect(parts.rest).toEqual([{ kind: "paragraph", text: "More." }]);
    expect(teachingParts(parseLessonBlocks("Only text.")).visuals).toEqual([]);
  });
  it("drops a heading that only repeats the slide title", () => {
    expect(slideBlocks("Lesson", "# Lesson\n\nIntro")).toEqual([{ kind: "paragraph", text: "Intro" }]);
  });
  it("only loads same-origin or https images and safe links", () => {
    expect(isSafeImageSrc("/images/a.png")).toBe(true);
    expect(isSafeImageSrc("https://cdn.example.org/a.png")).toBe(true);
    expect(isSafeImageSrc("javascript:alert(1)")).toBe(false);
    expect(isSafeImageSrc("//evil.example/a.png")).toBe(false);
    expect(isSafeImageSrc("data:image/png;base64,AAA")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("/student/learn")).toBe(true);
  });
});
