// Phase 4A — shared per-lesson media processing used by the batch script and
// the admin regenerate endpoint. Performs curation / generation + blob upload
// and returns the Prisma update payload. Caller persists + logs telemetry.

import { categorizeLesson, gradeBand } from "./categorize";
import { curatePhoto } from "./photoCuration";
import { generateLessonIllustration } from "./generateIllustration";
import { planInlineIllustrations } from "./inlinePlan";
import { lessonMediaPath, uploadLessonImage } from "./blobStorage";
import type { HeroImageMeta, InlineIllustration, ImageCategory } from "./types";

export type LessonMediaInput = {
  contentId: string;
  title: string | null;
  subject: string;
  grade: number;
  body: string;
  topics?: string[] | null;
};

export type LessonMediaOutcome = {
  category: ImageCategory;
  status: "GENERATED" | "CURATED" | "SKIPPED" | "FAILED" | "PENDING";
  cost: number;
  provider: string | null;
  inlineCount: number;
  reason?: string;
  /** Prisma update payload for CurriculumContent (undefined when nothing to write). */
  update: Record<string, unknown>;
};

export type ProcessOptions = {
  heroesOnly?: boolean;
  dryRun?: boolean;
  /** Remaining USD budget; inline generation stops when exhausted. */
  budgetRemaining?: number;
  /**
   * When a PHOTO lesson finds no curated match, do NOT fall back to AI
   * generation. Returns status "PENDING" with an empty update so the lesson
   * can be retried later (e.g. after a rate-limit cooldown). Used by the
   * photo-only batch when Fal is unavailable.
   */
  disableAiFallback?: boolean;
};

export async function processLessonMedia(
  input: LessonMediaInput,
  opts: ProcessOptions = {}
): Promise<LessonMediaOutcome> {
  const category = categorizeLesson(input.subject, input.title);
  const band = gradeBand(input.grade);
  const altBase = `${input.title ?? "Lesson"} — ${input.subject.toLowerCase().replace(/_/g, " ")}`;
  const dryRun = opts.dryRun ?? false;
  let budget = opts.budgetRemaining ?? Infinity;

  if (category === "ABSTRACT") {
    return {
      category, status: "SKIPPED", cost: 0, provider: null, inlineCount: 0,
      update: { imageCategory: "ABSTRACT", imageGenerationStatus: "SKIPPED" },
    };
  }

  // PHOTO -> curate (free); fall back to AI photorealistic on no match.
  if (category === "PHOTO") {
    const curated = await curatePhoto({ title: input.title, subject: input.subject, topics: input.topics, altBase });
    if (curated) {
      return {
        category, status: "CURATED", cost: 0, provider: curated.provider, inlineCount: 0,
        update: {
          heroImageUrl: curated.imageUrl, heroImageMeta: curated.meta as any,
          inlineIllustrations: null,
          imageCategory: "PHOTO", imageGenerationStatus: "CURATED", imageGenerationCost: 0,
        },
      };
    }
    // No curated match: retry later instead of burning an AI fallback when disabled.
    if (opts.disableAiFallback) {
      return { category, status: "PENDING", cost: 0, provider: null, inlineCount: 0, update: {} };
    }
  }

  // VISUAL (or PHOTO fallback) -> generate hero
  const photoreal = category === "PHOTO";
  const hero = await generateLessonIllustration({ subjectFocus: input.title ?? input.subject, subject: input.subject, band, photoreal });
  budget -= hero.cost;
  if (!hero.ok) {
    return {
      category, status: "FAILED", cost: hero.cost, provider: "fal", inlineCount: 0,
      reason: "reason" in hero ? hero.reason : "unknown",
      update: { imageCategory: category, imageGenerationStatus: "FAILED", imageGenerationCost: hero.cost },
    };
  }

  const heroPath = lessonMediaPath({ lessonId: input.contentId, kind: "hero", ext: "jpg" });
  const heroUrl = dryRun
    ? `dryrun://${heroPath}`
    : await uploadLessonImage({ path: heroPath, data: hero.bytes, contentType: hero.contentType });
  const heroMeta: HeroImageMeta = {
    alt: altBase, caption: null, provider: "fal", source: null,
    license: "AI-generated (Flux schnell)", credit: null, category,
  };

  let cost = hero.cost;
  const inline: InlineIllustration[] = [];
  if (category === "VISUAL" && !opts.heroesOnly) {
    const specs = planInlineIllustrations({ title: input.title, body: input.body });
    for (const spec of specs) {
      if (budget <= 0) break;
      const ill = await generateLessonIllustration({ subjectFocus: spec.subjectFocus, subject: input.subject, band, isDiagram: true });
      cost += ill.cost;
      budget -= ill.cost;
      if (!ill.ok) continue;
      const p = lessonMediaPath({ lessonId: input.contentId, kind: "inline", index: inline.length, ext: "jpg" });
      const url = dryRun ? `dryrun://${p}` : await uploadLessonImage({ path: p, data: ill.bytes, contentType: ill.contentType });
      inline.push({ position: spec.position, url, alt: spec.subjectFocus, provider: "fal", license: "AI-generated (Flux schnell)" });
    }
  }

  return {
    category, status: "GENERATED", cost, provider: "fal", inlineCount: inline.length,
    update: {
      heroImageUrl: heroUrl, heroImageMeta: heroMeta as any,
      inlineIllustrations: inline.length ? (inline as any) : null,
      imageCategory: category, imageGenerationStatus: "GENERATED", imageGenerationCost: cost,
    },
  };
}
