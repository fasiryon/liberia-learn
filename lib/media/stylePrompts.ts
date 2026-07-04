// Phase 4A — grade-banded style prompts for AI illustration generation.

import type { GradeBand } from "./types";

const STYLE_BY_BAND: Record<GradeBand, string> = {
  "K-3":
    "children's book illustration, bright cheerful colors, simple cartoon style, friendly, rounded shapes",
  "4-8":
    "clean vector illustration, flat design, educational textbook style, bright but professional colors",
  "9-12":
    "detailed scientific diagram, technical illustration style, precise, textbook accuracy, clean labeled structure",
};

// Baked-in negative guidance: Flux schnell has no separate negative prompt.
// Avoid the failure modes the quality gate rejects.
const NEGATIVE_GUIDANCE =
  "no text, no words, no letters, no captions, no watermark, no signature, " +
  "no human faces, no hands, no identifiable people";

/**
 * Build the full generation prompt for a lesson illustration.
 * `subjectFocus` is the concrete thing to depict (lesson title, or a specific
 * structure name for an inline illustration).
 */
export function buildIllustrationPrompt(input: {
  subjectFocus: string;
  subject: string;
  band: GradeBand;
  isDiagram?: boolean;
  retry?: boolean;
  /** PHOTO-fallback: render a generic photorealistic scene (no identifiable people). */
  photoreal?: boolean;
}): string {
  const style = input.photoreal
    ? "photorealistic, natural lighting, documentary photography, realistic scene"
    : STYLE_BY_BAND[input.band];
  const subjectHint = input.subject ? `${input.subject.toLowerCase().replace(/_/g, " ")} topic: ` : "";
  const diagramHint = input.isDiagram ? "clear educational diagram of " : "illustration of ";
  // On retry, simplify and re-emphasize the no-text / no-people constraints.
  const retryHint = input.retry
    ? "simple, single clear subject, centered composition, plain background, "
    : "";
  return [
    `${diagramHint}${input.subjectFocus.trim()}`,
    `${subjectHint}${style}`,
    retryHint + NEGATIVE_GUIDANCE,
  ]
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();
}

export function styleForBand(band: GradeBand): string {
  return STYLE_BY_BAND[band];
}
