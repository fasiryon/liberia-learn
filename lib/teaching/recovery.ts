import type { CachedLessonData } from "@/lib/lesson-offline-cache";
import { getLessonNarration, getLessonSlides } from "@/lib/teaching/lessonContent";

export interface AudioOnlyFallback {
  narration: string;
  audioUrl: string | null;
}

export interface PrintableWorksheet {
  title: string;
  objectives: string[];
  sections: { heading: string; bullets: string[] }[];
}

function cachedAudioUrl(cached: CachedLessonData): string | null {
  const storageUrl = cached.audio?.storageUrl;
  return typeof storageUrl === "string" && storageUrl.trim() ? storageUrl : null;
}

/**
 * Pure formatter for projector failure. Cache access remains in the browser
 * adapter so this module is safe to test without pretending a server can read
 * device IndexedDB.
 */
export function buildAudioOnlyFallback(cached: CachedLessonData): AudioOnlyFallback {
  return {
    narration: getLessonNarration(cached.payload),
    audioUrl: cachedAudioUrl(cached),
  };
}

/**
 * Pure formatter for a facilitator-readable worksheet built from an already
 * cached lesson pack.
 */
export function buildPrintableWorksheet(cached: CachedLessonData): PrintableWorksheet {
  const payload = (cached.payload ?? {}) as Record<string, unknown>;
  const objectives = Array.isArray(payload.objectives)
    ? payload.objectives.filter((value): value is string => typeof value === "string")
    : [];
  const slides = getLessonSlides(cached.payload);

  return {
    title: typeof payload.title === "string" ? payload.title : "Lesson",
    objectives,
    sections: slides.map((slide) => ({
      heading: slide.title,
      bullets: slide.bullets,
    })),
  };
}
