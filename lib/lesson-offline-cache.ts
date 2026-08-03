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
 *
 * Sprint 15 additions:
 *  - MAX_CACHED_LESSONS = 50 (LRU eviction prompt when exceeded)
 *  - listCachedLessons() — enumerate cached content IDs + metadata
 *  - removeCachedLesson() — explicit deletion
 *  - getCachedLessonCount() — how many lessons are cached
 *  - isLessonCached() — quick existence check
 */

import { cachePack, getCachedPack, invalidatePack, getCacheStats, getMetadata } from "@/lib/offline-cache";
import {
  verifyContentAvailabilityManifest,
  type SignedContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";

const LESSON_SCOPE = "lesson";
const LESSON_AUDIO_SCOPE = "lesson-audio";
const LESSON_MANIFEST_SCOPE = "lesson-availability";

export const MAX_CACHED_LESSONS = 50;

export type CachedLessonData = {
  metadata: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  audio?: Record<string, unknown> | null;
};

export type CachedLessonEntry = {
  contentId: string;
  cachedAt: string;
  lastUsedAt: string;
  sizeBytes: number;
};

/**
 * Write lesson content to the local cache after a successful network fetch.
 * Best-effort: never throws.
 * Returns true if the lesson was actually cached, false if an error occurred.
 */
export async function cacheLessonContent(
  contentId: string,
  data: CachedLessonData,
  manifest?: SignedContentAvailabilityManifest | null
): Promise<boolean> {
  try {
    if (!manifest || !(await verifyContentAvailabilityManifest(manifest))) return false;
    if (manifest.payload.contentId !== contentId || manifest.payload.revoked || !manifest.payload.version) return false;
    const contentVersion = typeof data.metadata?.version === "string" ? data.metadata.version : null;
    if (contentVersion !== manifest.payload.version) return false;
    await cachePack(LESSON_SCOPE, contentId, contentVersion, data);
    await cachePack(LESSON_MANIFEST_SCOPE, contentId, contentVersion, manifest);
    return true;
  } catch {
    // IndexedDB unavailable (private browsing, quota exceeded) — silently skip
    return false;
  }
}

export async function cacheLessonAudio(
  contentId: string,
  audio: { storageUrl: string; contentVersion?: string | null; sizeBytes?: number | null }
): Promise<boolean> {
  try {
    await cachePack(LESSON_AUDIO_SCOPE, contentId, audio.contentVersion ?? "1", audio);
    return true;
  } catch {
    return false;
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
    const manifest = await getCachedPack<SignedContentAvailabilityManifest>(LESSON_MANIFEST_SCOPE, contentId);
    if (!manifest || !(await verifyContentAvailabilityManifest(manifest))) {
      await invalidatePack(LESSON_SCOPE, contentId);
      return null;
    }
    if (manifest.payload.contentId !== contentId || manifest.payload.revoked || !manifest.payload.version) {
      await invalidatePack(LESSON_SCOPE, contentId);
      return null;
    }
    const metadata = await getMetadata();
    const lessonMetadata = metadata.find((entry) => entry.scope === LESSON_SCOPE && entry.scopeId === contentId);
    if (!lessonMetadata || lessonMetadata.packVersion !== manifest.payload.version) {
      await invalidatePack(LESSON_SCOPE, contentId);
      return null;
    }
    return await getCachedPack<CachedLessonData>(LESSON_SCOPE, contentId);
  } catch {
    return null;
  }
}

/** Apply a newly fetched signed version or revocation decision to local content. */
export async function refreshLessonAvailability(
  manifest: SignedContentAvailabilityManifest
): Promise<boolean> {
  try {
    if (!(await verifyContentAvailabilityManifest(manifest))) return false;
    const { contentId, version, revoked } = manifest.payload;
    const metadata = await getMetadata();
    const cached = metadata.find((entry) => entry.scope === LESSON_SCOPE && entry.scopeId === contentId);
    if (revoked || !version || (cached && cached.packVersion !== version)) {
      await invalidatePack(LESSON_SCOPE, contentId);
    }
    await cachePack(LESSON_MANIFEST_SCOPE, contentId, version ?? "revoked", manifest);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a lesson is currently cached (quick, no data fetch).
 */
export async function isLessonCached(contentId: string): Promise<boolean> {
  try {
    const pack = await getCachedPack<CachedLessonData>(LESSON_SCOPE, contentId);
    return pack !== null;
  } catch {
    return false;
  }
}

/**
 * Remove a specific lesson from the cache.
 */
export async function removeCachedLesson(contentId: string): Promise<void> {
  try {
    await invalidatePack(LESSON_SCOPE, contentId);
    await invalidatePack(LESSON_MANIFEST_SCOPE, contentId);
  } catch {
    // Best-effort — never throws
  }
}

/**
 * Return a list of all cached lessons with their metadata.
 */
export async function listCachedLessons(): Promise<CachedLessonEntry[]> {
  try {
    const metas = await getMetadata();
    return metas
      .filter((m) => m.scope === LESSON_SCOPE)
      .map((m) => ({
        contentId: m.scopeId,
        cachedAt: m.createdAt,
        lastUsedAt: m.lastUsedAt,
        sizeBytes: m.sizeBytes,
      }))
      .sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt));
  } catch {
    return [];
  }
}

/**
 * Return the number of lessons currently in the cache.
 */
export async function getCachedLessonCount(): Promise<number> {
  try {
    const metas = await getMetadata();
    return metas.filter((m) => m.scope === LESSON_SCOPE).length;
  } catch {
    return 0;
  }
}

/**
 * Return total bytes used by cached lessons.
 */
export async function getCachedLessonBytes(): Promise<number> {
  try {
    const stats = await getCacheStats();
    return stats.cacheBytes;
  } catch {
    return 0;
  }
}

/**
 * Check whether the cache is at capacity (MAX_CACHED_LESSONS).
 * When true, callers should prompt the user to remove older lessons.
 */
export async function isCacheAtCapacity(): Promise<boolean> {
  const count = await getCachedLessonCount();
  return count >= MAX_CACHED_LESSONS;
}
