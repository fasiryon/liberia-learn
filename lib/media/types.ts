// Phase 4A — Hybrid Lesson Media shared types & constants.

export const IMAGE_CATEGORIES = ["VISUAL", "PHOTO", "ABSTRACT"] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export const IMAGE_STATUSES = [
  "PENDING",
  "GENERATED",
  "CURATED",
  "SKIPPED",
  "FAILED",
] as const;
export type ImageGenerationStatus = (typeof IMAGE_STATUSES)[number];

export const GRADE_BANDS = ["K-3", "4-8", "9-12"] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

/** Attribution + descriptive metadata attached to a hero image. */
export type HeroImageMeta = {
  alt: string;
  caption?: string | null;
  /** Where the image came from: fal | unsplash | pexels */
  provider: string;
  /** Original source page URL (for curated photos). */
  source?: string | null;
  /** License descriptor, e.g. "Unsplash License" / "Pexels License" / "AI-generated". */
  license?: string | null;
  /** Human credit line, e.g. "Jane Doe". */
  credit?: string | null;
  category: ImageCategory;
};

/** One inline illustration positioned within a lesson body. */
export type InlineIllustration = {
  /** Anchor: slide index, paragraph index, or heading slug. */
  position: number | string;
  url: string;
  alt: string;
  caption?: string | null;
  provider: string;
  source?: string | null;
  license?: string | null;
  credit?: string | null;
};

export function isImageCategory(v: unknown): v is ImageCategory {
  return typeof v === "string" && (IMAGE_CATEGORIES as readonly string[]).includes(v);
}
