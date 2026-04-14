"use client";

/**
 * lib/lesson-offline-cache.ts
 * Thin wrapper around lib/offline-cache for lesson content JSON.
 *
 * On first successful load: cacheLessonContent() writes lesson data to IndexedDB.
 * On network failure:       loadCachedLesson() serves the stored pack.
 *
 * Scope key: "lesson" — keeps lesson packs isolated from other cache types.
 * Uses the shared lifecycle policy (7-day TTL, 25 MB cap) from offline-cache.
 */

import { cachePack, getCachedPack } from "@/lib/offline-cache";

const LESSON_SCOPE = "lesson";

export type CachedLessonData = {
  metadata: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
};

/**
 * Write lesson content to the local cache after a successful network fetch.
 * Best-effort: never throws.
 */
export async function cacheLessonContent(
  contentId: string,
  data: CachedLessonData
): Promise<void> {
  try {
    await cachePack(LESSON_SCOPE, contentId, "1", data);
  } catch {
    // IndexedDB unavailable (private browsing, quota exceeded) — silently skip
  }
}

/**
 * Read lesson content from the local cache when the network is unavailable.
 * Returns null if nothing is cached.
 */
export async function loadCachedLesson(
  contentId: string
): Promise<CachedLessonData | null> {
  try {
    return await getCachedPack<CachedLessonData>(LESSON_SCOPE, contentId);
  } catch {
    return null;
  }
}
