import { describe, expect, it } from "vitest";
import fixture from "../../e2e/fullscreen-slides-v2/civics-lesson.json";
import { parseToSlides } from "@/lib/lessons/parseToSlides";
import { slideBlocks } from "@/lib/learner-experience/lessonText";
import { presentationFragments, packPresentationFragments } from "@/lib/learner-experience/presentation";

const sourceSlides = parseToSlides({ title: fixture.source.title, content: fixture.response.payload.body_standard })
  .map(slide => ({ title: slide.title, blocks: slideBlocks(slide.title, slide.content) }));

describe("fullscreen composition of the retrieved Civics revision", () => {
  it("pins the actual 17-slide lesson and its governed revision", () => {
    expect(sourceSlides).toHaveLength(17);
    expect(fixture.source.currentRevisionId).toBe("cmss94h3z03bzvo54hj7c7z8t");
    expect(fixture.response.payload.body_standard).toContain("his grandmother Fatu");
  });

  it("splits long passages without changing a character or source order", () => {
    const fragments = presentationFragments(sourceSlides);
    for (const [sourceIndex, slide] of sourceSlides.entries()) for (const [blockIndex, block] of slide.blocks.entries()) {
      const parts = fragments.filter(fragment => fragment.sourceIndex === sourceIndex && fragment.blockIndex === blockIndex);
      if ("text" in block) expect(parts.map(part => "text" in part.block ? part.block.text : "").join("")).toBe(block.text);
      if (block.kind === "list") expect(parts.map(part => part.block.kind === "list" ? part.block.items.join("") : "").join("")).toBe(block.items.join(""));
    }
    expect(fragments.filter(fragment => fragment.sourceIndex === 1).length).toBeGreaterThan(5);
    expect(presentationFragments(sourceSlides)).toEqual(fragments);
  });

  it("packs measured content by available height without mixing source sections or losing fragments", () => {
    const fragments = presentationFragments(sourceSlides);
    const heights = fragments.map(() => 90);
    const pages = packPresentationFragments(fragments, heights, sourceSlides.map(() => 220));
    expect(pages.flatMap(page => page.fragments)).toEqual(fragments);
    expect(pages.every(page => page.fragments.every(fragment => fragment.sourceIndex === page.sourceIndex))).toBe(true);
    expect(pages.every(page => page.height <= 220)).toBe(true);
    expect(pages.length).toBeGreaterThan(17);
  });

  it("preserves list numbering and every table cell across continuations", () => {
    const fragments = presentationFragments([{ title: "Worked example", blocks: [
      { kind: "list", ordered: true, items: ["First step.", "Second step."] },
      { kind: "table", header: ["Office", "Role"], rows: [["President", "Executive"], ["Senate", "Legislature"]] },
    ] }]);
    expect(fragments.filter(part => part.block.kind === "list").map(part => part.listStart)).toEqual([1, 2]);
    expect(fragments.filter(part => part.block.kind === "table").flatMap(part => part.block.kind === "table" ? part.block.rows : [])).toEqual([["President", "Executive"], ["Senate", "Legislature"]]);
  });

  it("prefers complete sentences instead of splitting a short instructional idea", () => {
    const sentence = "Boima asks his grandmother about voting. ";
    const text = sentence.repeat(9);
    const fragments = presentationFragments([{ title: "Hook", blocks: [{ kind: "paragraph", text }] }]);
    expect(fragments.map(part => "text" in part.block ? part.block.text : "").join("")).toBe(text);
    for (const fragment of fragments) expect("text" in fragment.block && fragment.block.text.trim().endsWith("voting.")).toBe(true);
  });
});
