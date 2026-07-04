// Phase 4A — curate a real photo for a PHOTO-category lesson.
// Queries Unsplash + Pexels, ranks by relevance + clarity, selects the top match.
// Curated photos cost $0; attribution is captured for rendering.

import { deriveSearchQuery, keywordTokens } from "./keywords";
import {
  searchUnsplash,
  searchPexels,
  triggerUnsplashDownload,
  type PhotoCandidate,
} from "./photoProviders";
import type { HeroImageMeta } from "./types";

export type ScoredCandidate = PhotoCandidate & { score: number };

/**
 * Pure relevance ranking. Rewards keyword overlap between the lesson tokens and
 * the candidate description, plus a resolution bonus. Higher is better.
 */
export function rankCandidates(candidates: PhotoCandidate[], tokens: string[]): ScoredCandidate[] {
  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()));
  return candidates
    .map((c) => {
      const words = c.description.split(/\s+/).filter(Boolean);
      let overlap = 0;
      const counted = new Set<string>();
      for (const w of words) {
        if (tokenSet.has(w) && !counted.has(w)) {
          overlap += 1;
          counted.add(w);
        }
      }
      const relevance = tokens.length ? overlap / tokens.length : 0;
      const hasDescription = c.description.trim().length > 0 ? 0.1 : 0; // license/description clarity
      const resolution = Math.min(c.width, 4000) / 4000; // 0..1
      const score = relevance * 1.0 + resolution * 0.25 + hasDescription;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);
}

export type CuratedPhoto = {
  imageUrl: string;
  meta: HeroImageMeta;
  provider: "unsplash" | "pexels";
};

/**
 * Find the best curated photo for a lesson. Returns null when no provider
 * returns a usable candidate (caller may then fall back to AI generation).
 */
export async function curatePhoto(input: {
  title?: string | null;
  subject: string;
  topics?: string[] | null;
  altBase?: string;
}): Promise<CuratedPhoto | null> {
  const query = deriveSearchQuery(input);
  const tokens = keywordTokens(input);

  const [unsplash, pexels] = await Promise.all([searchUnsplash(query), searchPexels(query)]);
  const all = [...unsplash, ...pexels];
  if (all.length === 0) return null;

  const ranked = rankCandidates(all, tokens);
  const top = ranked[0];
  if (!top) return null;

  // Respect Unsplash usage guidelines.
  if (top.provider === "unsplash") {
    await triggerUnsplashDownload(top.downloadLocation);
  }

  const alt = input.altBase?.trim()
    ? input.altBase.trim()
    : `${input.title ?? "Lesson"} — ${input.subject.toLowerCase()} illustration photo`;

  const meta: HeroImageMeta = {
    alt,
    caption: top.description ? top.description.slice(0, 140) : null,
    provider: top.provider,
    source: top.pageUrl,
    license: top.license,
    credit: top.credit,
    category: "PHOTO",
  };

  return { imageUrl: top.imageUrl, meta, provider: top.provider };
}

/** Standard visible attribution line for a curated photo. */
export function attributionLine(meta: Pick<HeroImageMeta, "provider" | "credit">): string | null {
  if (meta.provider === "unsplash") return `Photo by ${meta.credit ?? "Unknown"} on Unsplash`;
  if (meta.provider === "pexels") return `Photo by ${meta.credit ?? "Unknown"} on Pexels`;
  return null;
}
