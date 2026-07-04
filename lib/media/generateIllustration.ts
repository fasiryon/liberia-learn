// Phase 4A — orchestrate one illustration: prompt -> Fal -> QA -> retry-once.

import { buildIllustrationPrompt } from "./stylePrompts";
import { generateFalImage, fetchImageBytes, FAL_COST_PER_IMAGE } from "./falClient";
import { structuralGate, visionQualityCheck } from "./imageQA";
import type { GradeBand } from "./types";

export type IllustrationResult = {
  ok: true;
  bytes: Buffer;
  contentType: string;
  prompt: string;
  attempts: number;
  cost: number; // USD spent (counts every generation attempt)
};

export type IllustrationRejection = {
  ok: false;
  bytes: null;
  reason: string;
  attempts: number;
  cost: number; // USD spent on failed attempts
};

/**
 * Generate one illustration with a single retry. Every Fal call is billed, so
 * `cost` accumulates across attempts regardless of outcome. Returns bytes on
 * success, or a rejection with the reason (for the rejection log).
 */
export async function generateLessonIllustration(input: {
  subjectFocus: string;
  subject: string;
  band: GradeBand;
  isDiagram?: boolean;
  photoreal?: boolean;
}): Promise<IllustrationResult | IllustrationRejection> {
  let cost = 0;
  let lastReason = "unknown";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = buildIllustrationPrompt({
      subjectFocus: input.subjectFocus,
      subject: input.subject,
      band: input.band,
      isDiagram: input.isDiagram ?? input.band === "9-12",
      retry: attempt === 2,
      photoreal: input.photoreal,
    });

    let image;
    try {
      image = await generateFalImage({ prompt });
      cost += FAL_COST_PER_IMAGE;
    } catch (e: any) {
      lastReason = e?.message ?? "generation failed";
      continue; // retry (no cost added — request failed)
    }

    let bytes: Buffer;
    try {
      bytes = await fetchImageBytes(image.url);
    } catch (e: any) {
      lastReason = e?.message ?? "download failed";
      continue;
    }

    const structural = structuralGate(bytes);
    if (!structural.ok) {
      lastReason = structural.reason ?? "structural gate failed";
      continue;
    }

    const vision = await visionQualityCheck({ imageUrl: image.url, subjectFocus: input.subjectFocus });
    if (!vision.ok) {
      lastReason = vision.reason ?? "vision gate failed";
      continue;
    }

    return { ok: true, bytes, contentType: image.contentType, prompt, attempts: attempt, cost };
  }

  return { ok: false, bytes: null, reason: lastReason, attempts: 2, cost };
}
