// Phase 4A — deterministic lesson categorization for media strategy.
// VISUAL  -> AI illustration (Fal.ai Flux schnell)
// PHOTO   -> curated real photo (Unsplash / Pexels)
// ABSTRACT-> no media (pure math / grammar / logic / reading comprehension)

import type { ImageCategory, GradeBand } from "./types";

// health / civic-life / cultural cues -> real photography reads better than illustration
const PHOTO_KW =
  /(health|nutrition|food|diet|exercise|hygiene|disease|wellness|community|market|farm|culture|cultural|festival|tradition|citizen|government|election|vote|court|police|constitution|county|liberia|west africa|environment|pollution|recycl|classroom|school life|family|occupation|career|job)/i;

// concrete structures / diagrams -> illustration reads better than a photo
const VISUAL_KW =
  /(cell|organ|organism|plant|animal|ecosystem|anatomy|skeleton|muscle|molecul|atom|reaction|chemical|force|wave|circuit|electric|magnet|mechanic|energy|planet|solar|star|astronom|rock|mineral|volcano|weather|climate|water cycle|photosynthesis|digestion|respiration|blood|heart|leaf|root|map|landform|mountain|river|continent|artifact|pyramid|machine|engine|bridge|structure|gear|lever|pulley)/i;

export function gradeBand(grade: number): GradeBand {
  if (grade <= 3) return "K-3";
  if (grade <= 8) return "4-8";
  return "9-12";
}

/**
 * Categorize a lesson by its (coarse) subject string and title.
 * Subject strings in the DB are free-form; we normalize to upper-case.
 */
export function categorizeLesson(subject: string, title: string | null | undefined): ImageCategory {
  const s = (subject || "").toUpperCase();
  const t = (title || "").toLowerCase();

  // Always abstract
  if (s === "MATH" || s === "LITERACY" || s === "ENGLISH") return "ABSTRACT";
  if (s === "COMPUTER_SCIENCE" || s === "CS") return "ABSTRACT";

  // Science bundle: illustration, except health/nutrition sub-topics -> photo
  if (s === "SCIENCE") return PHOTO_KW.test(t) ? "PHOTO" : "VISUAL";
  if (s === "BIOLOGY" || s === "CHEMISTRY" || s === "PHYSICS") return "VISUAL";

  // Engineering: diagrams / mechanisms
  if (s === "ENGINEERING_FOUNDATIONS" || s === "ENGINEERING") return "VISUAL";

  // Geography / History
  if (s === "GEOGRAPHY") return "VISUAL";
  if (s === "HISTORY") return VISUAL_KW.test(t) ? "VISUAL" : "PHOTO";

  // Economics: mostly abstract, market/trade topics -> photo
  if (s === "ECONOMICS") return PHOTO_KW.test(t) ? "PHOTO" : "ABSTRACT";

  // Civics / social studies -> civic-life photography
  if (s === "CIVICS") return "PHOTO";
  if (s === "SOCIAL_STUDIES") return VISUAL_KW.test(t) ? "VISUAL" : "PHOTO";

  if (s === "ARTS") return "VISUAL";
  if (s === "PE" || s === "CAREER") return "PHOTO";

  // Unknown subject: fall back to keyword signals, else abstract
  if (PHOTO_KW.test(t)) return "PHOTO";
  if (VISUAL_KW.test(t)) return "VISUAL";
  return "ABSTRACT";
}
