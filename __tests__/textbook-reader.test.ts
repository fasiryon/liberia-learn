import { describe, it, expect } from "vitest";
import { paginateText, readMemory, readingPages, safeAssetUrl } from "@/components/textbooks/model";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { demoBook } from "@/components/textbooks/demoBook";

describe("textbook presentation and reading aids", () => {
  it("keeps every source word in order when paginating large text", () => {
    const input = Array.from({ length: 510 }, (_, i) => `word${i}`).join(" ");
    const pages = paginateText(input);
    expect(pages.length).toBe(3);
    expect(pages.join(" ")).toBe(input);
  });
  it("retains paragraph markdown and rejects missing text", () => {
    expect(paginateText("# Heading\n\nRead **carefully**.")).toEqual(["# Heading\n\nRead **carefully**."]);
    expect(readingPages({}, "Missing", 4)).toEqual([]);
  });
  it("adapts learner-safe text without teacher answer sections", () => {
    const safe = projectStudentLessonPayload({ title: "Fractions", body: "## Reading\nRead about halves.\n\n## Answer Key\nSecret teacher answer", answerKey: ["secret"] });
    const pages = readingPages(safe, "Fractions", 4);
    expect(JSON.stringify(pages)).not.toContain("Secret teacher answer");
    expect(JSON.stringify(pages)).not.toContain("answerKey");
  });
  it("validates device state, bounds positions, removes invalid bookmarks", () => {
    expect(readMemory("bad json", 6)).toEqual({ page: 0, bookmarks: [], size: 1, layout: "spread" });
    expect(readMemory(JSON.stringify({ page: 999, bookmarks: [0, 0, -1, 5, 6, "1"], size: 99, layout: "bad" }), 6)).toEqual({ page: 0, bookmarks: [0, 5], size: 1, layout: "spread" });
  });
  it("rejects unsafe assets", () => {
    expect(safeAssetUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeAssetUrl("//foreign.test/image")).toBeUndefined();
    expect(safeAssetUrl("/\\foreign.test/image")).toBeUndefined();
    expect(safeAssetUrl("https://example.test/image.png")).toBeDefined();
  });
  it("retains supported diagrams and selects the real grade-band wording", () => {
    const projected = { lessonExperience: { scenes: [{ title: "Diagram", content: { body: "Default text", ageVariants: { EARLY_PRIMARY: { body: "Simple words" }, SENIOR_SECONDARY: { body: "Advanced wording" } } }, interaction: { kind: "DIAGRAM_REVEAL", steps: [{ label: "A part", description: "Authored description" }] }, media: [{ kind: "DIAGRAM", ref: "/diagram.png", alt: "An authored diagram" }] }] } };
    expect(readingPages(projected, "Title", 2)[0].body).toBe("Simple words");
    expect(readingPages(projected, "Title", 12)[0].body).toBe("Advanced wording");
    expect(readingPages(projected, "Title", 4)[0].reveals).toEqual([{ label: "A part", text: "Authored description" }]);
    expect(readingPages(projected, "Title", 4)[0].image?.alt).toBe("An authored diagram");
    projected.lessonExperience.scenes[0].media[0].ref = "asset:unresolved";
    expect(readingPages(projected, "Title", 4)[0].image).toEqual({ src: "", alt: "An authored diagram" });
  });
  it("labels the showcase synthetic and keeps the explorer out of real readings", () => {
    expect(demoBook.source).toBe("demonstration");
    expect(readingPages({ body: "Real reading" }, "Real", 4)[0].explorer).toBeUndefined();
  });
});
