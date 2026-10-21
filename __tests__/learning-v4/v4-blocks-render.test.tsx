// Interactive Learning V4: every block of the six candidates renders through the shared TeachingBlockView, with
// mathematics typeset (no raw TeX) and no independent answer shown before the learner has tried.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeachingBlockView } from "@/components/experience/teaching/TeachingBlocks";
import { MathExpression, MathText } from "@/components/experience/MathText";
import { InlineText } from "@/components/experience/LessonText";
import { ShapeDiagram } from "@/components/experience/teaching/v4/MathBlocks";
import { compositionFeedback } from "@/components/experience/teaching/v4/HumanitiesLanguageBlocks";
import { V4_LESSONS, evaluateV4Candidate } from "@/lib/curriculum/v4/candidates";
import type { VisualBlock } from "@/lib/learner-experience/teaching/registry";

const noop = () => undefined;
const visibleText = (html: string) => html.replace(/<span class="ll5-math-fallback"[^>]*>.*?<\/span>/g, "").replace(/<[^>]+>/g, " ");

describe("mathematical notation renders as MathML", () => {
  it("typesets a fraction with a spoken label and a plain-text fallback", () => {
    const html = renderToStaticMarkup(<MathExpression tex="A_{\text{triangle}} = \frac{1}{2} b h" display />);
    expect(html).toContain("<math");
    expect(html).toContain("<mfrac><mn>1</mn><mn>2</mn></mfrac>");
    expect(html).toContain('aria-label="A triangle equals one half b h"');
    expect(html).toContain('class="ll5-math-fallback"');
  });

  it("InlineText typesets math inside Markdown emphasis without breaking either", () => {
    const html = renderToStaticMarkup(<InlineText text="**Area:** $A = l \times w$ and **bold $x^2$ here**" />);
    expect(html).toContain("<strong>Area:</strong>");
    expect(html).toContain("<msup>");
    expect(visibleText(html)).not.toMatch(/\\[a-z]+|\$/i);
  });

  it("legacy prose with bare TeX is repaired", () => {
    expect(visibleText(renderToStaticMarkup(<MathText text="The area is A = l \times w." />))).not.toContain("\\times");
  });
});

describe.each(V4_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s blocks", (_key, lesson) => {
  const candidate = evaluateV4Candidate(lesson).candidate;
  const blocks = candidate.scenes.flatMap((scene) => [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])].map((block) => ({ scene, block: block as VisualBlock })));

  it.each(blocks.map(({ scene, block }, index) => [`${scene.id} ${block.type} #${index}`, scene, block] as const))("%s", (_name, _scene, block) => {
    const html = renderToStaticMarkup(<TeachingBlockView block={block} onDone={noop} />);
    expect(html.length).toBeGreaterThan(40);
    expect(visibleText(html), "no raw TeX visible").not.toMatch(/\\(frac|times|text|div|cdot)\b/);
    // Every form control has an accessible name.
    for (const tag of html.match(/<(input|select|textarea)\b[^>]*>/g) ?? []) {
      const id = /\bid="([^"]+)"/.exec(tag)?.[1];
      const named = /aria-label=|type="radio"|type="checkbox"/.test(tag) || (id && html.includes(`for="${id}"`));
      expect(named, tag).toBeTruthy();
    }
    if (block.type === "NUMERIC_RESPONSE") {
      // Before an attempt the solution is not on the page, and the shape does not state the answers.
      expect(html).not.toContain("ll5-solution");
      for (const part of block.parts) if (part.formativeKey.value >= 10) expect(visibleText(html)).not.toMatch(new RegExp(`\\b${part.formativeKey.value}\\b(?!\\s*(cm|m)\\b(?! ²))`));
    }
    if (block.type === "MISTAKE_ANALYSIS" || block.type === "PREDICT_OBSERVE") expect(html).not.toContain("ll5-solution");
  });
});

describe("shape diagrams", () => {
  it("label measurements but state area and perimeter only when asked to reveal them", () => {
    const shape = { kind: "RECTANGLE", length: 25, width: 16, unit: "m" } as const;
    const hidden = renderToStaticMarkup(<ShapeDiagram shape={shape} views={[]} reveal={false} />);
    expect(hidden).toContain("25 m");
    expect(hidden).not.toContain("400");
    expect(renderToStaticMarkup(<ShapeDiagram shape={shape} views={["AREA"]} reveal />)).toContain("Area 400 square m");
  });

  it("draw a triangle's perpendicular height with its right-angle mark", () => {
    const html = renderToStaticMarkup(<ShapeDiagram shape={{ kind: "TRIANGLE", base: 14, height: 12, apexOffset: 5, unit: "cm", sideLabels: [13, 15] }} views={["HEIGHT"]} reveal={false} />);
    expect(html).toContain("h = 12 cm");
    expect(html).toContain("ll5-shape-right");
  });
});

describe("composition feedback is deterministic and never a grade", () => {
  const source = "Some families gave money, some gave rope, and some gave their time.";
  it("checks that evidence is quoted from the text", () => {
    expect(compositionFeedback({ id: "evidence", label: "Evidence", minWords: 6 }, 'The story says "some gave rope, and some gave their time."', source)).toContain("Evidence: your quotation matches the text. Good.");
    expect(compositionFeedback({ id: "evidence", label: "Evidence", minWords: 6 }, "Everyone helped with the pump a lot.", source)[0]).toMatch(/quotation marks/);
  });
  it("asks for a link from evidence to claim", () => {
    expect(compositionFeedback({ id: "explanation", label: "Explanation", minWords: 3 }, "The town was good at fixing.", null)[0]).toMatch(/This shows/);
  });
});
