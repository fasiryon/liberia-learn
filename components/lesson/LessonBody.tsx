"use client";

// Phase 4A — render a lesson body, interleaving inline illustrations at their
// stored paragraph positions. Falls back to a single render when there are none,
// preserving the previous behavior exactly.

import { renderSimpleMarkdown } from "@/lib/lessons";
import { LessonInlineImage, type InlineIllustrationLike } from "./LessonImage";

const PROSE_CLASS =
  "prose prose-invert max-w-none overflow-y-auto rounded-lg prose-headings:text-[var(--ll-text)] prose-h2:text-xl prose-h3:text-base prose-p:text-[var(--ll-text)] prose-p:text-[1rem] prose-p:leading-8 prose-li:text-[var(--ll-text)] prose-li:text-[1rem] prose-li:leading-8";

export function LessonBody({
  renderedBody,
  inline,
}: {
  renderedBody: string;
  inline?: InlineIllustrationLike[] | null;
}) {
  const numericInline = (inline ?? []).filter((i) => typeof i.position === "number") as (InlineIllustrationLike & {
    position: number;
  })[];

  // No inline illustrations -> original single-blob render (zero regression).
  if (numericInline.length === 0) {
    return (
      <div
        className={PROSE_CLASS}
        style={{ maxHeight: "65vh", minHeight: "300px" }}
        dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(renderedBody) }}
      />
    );
  }

  const paragraphs = renderedBody.split(/\n{2,}/);
  const byPosition = new Map<number, InlineIllustrationLike[]>();
  for (const ill of numericInline) {
    const pos = Math.max(0, Math.min(ill.position, paragraphs.length - 1));
    const list = byPosition.get(pos) ?? [];
    list.push(ill);
    byPosition.set(pos, list);
  }

  return (
    <div className="overflow-y-auto rounded-lg" style={{ maxHeight: "65vh", minHeight: "300px" }}>
      {paragraphs.map((para, idx) => (
        <div key={idx}>
          <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(para) }} />
          {(byPosition.get(idx) ?? []).map((ill, j) => (
            <LessonInlineImage key={`ill-${idx}-${j}`} illustration={ill} />
          ))}
        </div>
      ))}
    </div>
  );
}
