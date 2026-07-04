/**
 * __tests__/media/lessonRendering.test.tsx — Phase 4A Deliverable 4
 * Hero + inline illustration rendering (SSR markup assertions).
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonHero } from "@/components/lesson/LessonImage";
import { LessonBody } from "@/components/lesson/LessonBody";

describe("LessonHero", () => {
  it("renders the image with alt text and a Pexels attribution link", () => {
    const html = renderToStaticMarkup(
      <LessonHero
        url="https://cdn/photo.jpg"
        meta={{ alt: "A djembe drum", provider: "pexels", credit: "Kofi A", source: "https://pexels.com/p/1", category: "PHOTO" }}
      />
    );
    expect(html).toContain("https://cdn/photo.jpg");
    expect(html).toContain('alt="A djembe drum"');
    expect(html).toContain("Photo by Kofi A on Pexels");
    expect(html).toContain("https://pexels.com/p/1");
  });

  it("labels AI-generated heroes", () => {
    const html = renderToStaticMarkup(
      <LessonHero url="https://blob/hero.jpg" meta={{ alt: "A cell", provider: "fal", category: "VISUAL" }} />
    );
    expect(html).toContain("AI-generated illustration");
  });
});

describe("LessonBody", () => {
  it("renders a single prose block when there are no inline illustrations", () => {
    const html = renderToStaticMarkup(<LessonBody renderedBody={"Para one\n\nPara two"} inline={[]} />);
    expect(html).toContain("Para one");
    expect(html).toContain("Para two");
    expect(html).not.toContain("<figure");
  });

  it("interleaves an inline illustration at its paragraph position", () => {
    const body = ["First paragraph about cells.", "Second paragraph about the nucleus.", "Third paragraph."].join("\n\n");
    const html = renderToStaticMarkup(
      <LessonBody
        renderedBody={body}
        inline={[{ position: 1, url: "https://blob/i0.jpg", alt: "nucleus diagram", provider: "fal" }]}
      />
    );
    expect(html).toContain("nucleus diagram");
    expect(html).toContain("<figure");
    // illustration appears after the second paragraph, before the third
    const idxSecond = html.indexOf("Second paragraph");
    const idxFig = html.indexOf("nucleus diagram");
    const idxThird = html.indexOf("Third paragraph");
    expect(idxSecond).toBeLessThan(idxFig);
    expect(idxFig).toBeLessThan(idxThird);
  });

  it("clamps out-of-range positions into the body", () => {
    const html = renderToStaticMarkup(
      <LessonBody
        renderedBody={"Only one paragraph."}
        inline={[{ position: 99, url: "https://blob/i.jpg", alt: "far diagram", provider: "fal" }]}
      />
    );
    expect(html).toContain("far diagram");
  });
});
