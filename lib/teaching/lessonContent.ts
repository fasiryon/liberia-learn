export interface LessonSlide {
  title: string;
  bullets: string[];
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim();
}

/**
 * Mirrors app/student/lesson/[contentId]/page.tsx's narration derivation
 * (body_standard/body_block/body fallback chain, HTML stripped when
 * detected). Kept as a standalone pure copy rather than a shared import from
 * the client page, to avoid regression risk on a live student-facing route.
 */
export function getLessonNarration(payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  const standard = typeof p.body_standard === "string" ? p.body_standard : "";
  const block = typeof p.body_block === "string" ? p.body_block : "";
  const legacy = typeof p.body === "string" ? p.body : "";
  const narration = standard || block || legacy;
  if (!narration) return "No lesson narration is available yet.";
  return looksLikeHtml(narration) ? stripHtml(narration) : narration;
}

export function getLessonSlides(payload: unknown): LessonSlide[] {
  const p = (payload ?? {}) as Record<string, unknown>;
  const deckSpecs = Array.isArray(p.slideDeckSpecs) ? p.slideDeckSpecs : [];
  const firstDeck = deckSpecs[0] as { slides?: unknown } | undefined;
  const slides = Array.isArray(firstDeck?.slides) ? (firstDeck!.slides as LessonSlide[]) : null;
  if (slides && slides.length > 0) return slides;

  const objectives = Array.isArray(p.objectives) ? (p.objectives as string[]) : [];
  return [
    {
      title: typeof p.title === "string" ? p.title : "Lesson Overview",
      bullets: objectives.length > 0 ? objectives : [getLessonNarration(payload).slice(0, 200)],
    },
  ];
}
