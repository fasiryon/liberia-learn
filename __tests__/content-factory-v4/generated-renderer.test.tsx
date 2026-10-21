import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeachingBlockView } from "@/components/experience/teaching/TeachingBlocks";
import { authorLesson } from "@/lib/content-factory/v4/lessonAuthor";
import { feedbackReveal } from "@/lib/content-factory/v4/generation";
import { V4_LESSONS, candidateText, v4LearnerProjection } from "@/lib/curriculum/v4/candidates";
import { assertLearnerSafe } from "@/lib/assessment/v2/projection";

describe.each(V4_LESSONS)("generated $key in the actual V4 renderer", lesson => {
  const candidate = authorLesson(lesson);
  it("is generated content, with an isolated learner projection and assessment handoff", () => {
    expect(candidate).not.toEqual(JSON.parse(candidateText(lesson)));
    const projection = v4LearnerProjection(lesson, candidate);
    expect(() => assertLearnerSafe(projection, [])).not.toThrow();
    expect(candidate.scenes.find(s => s.type === "MASTERY_CHECK")?.teaching?.blocks).toEqual([]);
  });
  const blocks = candidate.scenes.flatMap(s => s.teaching?.blocks ?? []);
  it.each(blocks.map((block, index) => ({ block, index })))("renders #$index with the frozen component", ({ block }) => {
    const html = renderToStaticMarkup(<TeachingBlockView block={block} onDone={() => {}} />);
    expect(html.length).toBeGreaterThan(40);
    const visible = html.replace(/<span class="ll5-math-fallback"[^>]*>.*?<\/span>/g, "").replace(/<[^>]+>/g, " ");
    expect(visible).not.toMatch(/\\(frac|times|text|div|cdot)\b/);
    for (const tag of html.match(/<(input|select|textarea)\b[^>]*>/g) ?? []) {
      const id = /\bid="([^"]+)"/.exec(tag)?.[1];
      expect(/aria-label=|type="radio"|type="checkbox"/.test(tag) || Boolean(id && html.includes(`for="${id}"`))).toBe(true);
    }
    if (block.type === "NUMERIC_RESPONSE" || block.type === "MISTAKE_ANALYSIS" || block.type === "PREDICT_OBSERVE") {
      expect(html).not.toContain("ll5-solution");
      expect(feedbackReveal(block)).toBe("AFTER_ATTEMPT");
    }
    if (block.type === "WORKED_SOLUTION") expect(feedbackReveal(block)).toBe("MODEL");
    if (block.type === "WRITING_ORGANIZER" || block.type === "SHAPE_MODEL") expect(feedbackReveal(block)).toBe("NONE");
  });
});
