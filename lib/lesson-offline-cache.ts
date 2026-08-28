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

import {
  cachePack,
  compareAndSwapCachedPack,
  getCachedPack,
  invalidatePack,
  getMetadata,
} from "@/lib/offline-cache";
import {
  acceptsContentAvailabilityManifest,
  acceptsManifestPolicy,
  hashContentAvailabilityData,
  isManifestCompatibleWithClient,
  isManifestExpired,
  isLegacyContentAvailabilityManifest,
  validateContentAvailabilityPayload,
  verifyContentAvailabilityManifest,
  type SignedContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";
import { reportOfflineStorageError } from "@/lib/offline/storageSignals";
import type { SessionPartitionInput } from "@/lib/offline-session";

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
  status: "trusted-current" | "expired" | "revoked" | "update-required" | "incomplete" | "corrupt";
  expiresAt: string | null;
};

function manifestPackVersion(manifest: SignedContentAvailabilityManifest): string {
  const sequence = manifest.payload.sequence;
  return sequence
    ? `revision-${sequence.revision}:governance-${sequence.governance}`
    : manifest.payload.version ?? "legacy-revoked";
}

/**
 * Tell the lifecycle surface when a trusted manifest is blocked specifically
 * because the installed client is too old. Expiry, revocation, malformed
 * manifests, and other trust failures have separate policy/UI semantics.
 */
async function notifyClientUpdateRequired(manifest: SignedContentAvailabilityManifest): Promise<void> {
  if (typeof window === "undefined") return;
  const payload = manifest?.payload;
  if (
    !validateContentAvailabilityPayload(payload) ||
    isLegacyContentAvailabilityManifest(payload) ||
    payload.revoked ||
    isManifestExpired(manifest) ||
    isManifestCompatibleWithClient(manifest)
  ) {
    return;
  }

  let registration: ServiceWorkerRegistration | undefined;
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof navigator.serviceWorker.getRegistration === "function"
  ) {
    registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  }
  window.dispatchEvent(new CustomEvent("liberialearn-pwa-update-required", {
    detail: {
      registration,
      contentId: payload.contentId,
      minClientVersion: payload.minClientVersion,
    },
  }));
}

async function acceptManifestAtomically(
  contentId: string,
  manifest: SignedContentAvailabilityManifest,
  partition?: SessionPartitionInput,
): Promise<boolean> {
  if (!(await verifyContentAvailabilityManifest(manifest))) return false;
  if (!acceptsManifestPolicy(manifest)) {
    await notifyClientUpdateRequired(manifest);
    return false;
  }
  return compareAndSwapCachedPack<SignedContentAvailabilityManifest>(
    LESSON_MANIFEST_SCOPE,
    contentId,
    manifestPackVersion(manifest),
    manifest,
    (current) => acceptsContentAvailabilityManifest(manifest, current),
    partition,
    { retainForTrust: true },
  );
}

async function writeLessonPack(
  contentId: string,
  data: CachedLessonData,
  manifest: SignedContentAvailabilityManifest,
  partition?: SessionPartitionInput,
): Promise<boolean> {
  // Write lesson bytes before the trust reference. An interruption may leave
  // an orphaned untrusted value, but never a trusted manifest pointing at a
  // pack whose completion metadata was not written.
  await cachePack(
    LESSON_SCOPE,
    contentId,
    manifestPackVersion(manifest),
    data,
    partition,
    { complete: true, retentionClass: "downloadable" },
  );
  const metadata = await getMetadata(partition);
  const stored = metadata.find((entry) => entry.scope === LESSON_SCOPE && entry.scopeId === contentId);
  if (!stored || stored.complete === false || stored.packVersion !== manifestPackVersion(manifest)) return false;
  return acceptManifestAtomically(contentId, manifest, partition);
}

/**
 * Write lesson content to the local cache after a successful network fetch.
 * Best-effort: never throws.
 * Returns true if the lesson was actually cached, false if an error occurred.
 */
export async function cacheLessonContent(
  contentId: string,
  data: CachedLessonData,
  manifest?: SignedContentAvailabilityManifest | null,
  partition?: SessionPartitionInput,
): Promise<boolean> {
  const cache = async () => {
    if (!manifest) return false;
    if (manifest.payload.contentId !== contentId || manifest.payload.revoked || !manifest.payload.version) return false;
    const contentVersion = typeof data.metadata?.version === "string" ? data.metadata.version : null;
    if (contentVersion !== manifest.payload.version) return false;
    if (!isLegacyContentAvailabilityManifest(manifest.payload)) {
      const expectedHash = manifest.payload.contents?.find(
        (entry) => entry.contentId === contentId && entry.version === contentVersion,
      )?.sha256;
      const actualHash = await hashContentAvailabilityData({
        contentId,
        version: contentVersion,
        metadata: data.metadata,
        payload: data.payload,
        audio: data.audio,
      });
      if (!expectedHash || !actualHash || expectedHash !== actualHash) return false;
    }
    return writeLessonPack(contentId, data, manifest, partition);
  };

  try {
    return await cache();
  } catch (error) {
    const evicted = await evictSafeCachedLessons({ maxItems: 3, partition }).catch(() => ({ removed: [], freedBytes: 0 }));
    if (evicted.removed.length > 0) {
      try {
        return await cache();
      } catch (retryError) {
        reportOfflineStorageError("cache-lesson", retryError);
        return false;
      }
    }
    reportOfflineStorageError("cache-lesson", error);
    // IndexedDB unavailable (private browsing, quota exceeded).
    return false;
  }
}

export async function cacheLessonAudio(
  contentId: string,
  audio: { storageUrl: string; contentVersion?: string | null; sizeBytes?: number | null },
  partition?: SessionPartitionInput,
): Promise<boolean> {
  try {
    await cachePack(LESSON_AUDIO_SCOPE, contentId, audio.contentVersion ?? "1", audio, partition, {
      retentionClass: "downloadable",
      sizeBytes: audio.sizeBytes ?? undefined,
    });
    return true;
  } catch (error) {
    reportOfflineStorageError("cache-lesson-audio", error);
    return false;
  }
}

/**
 * Read lesson content from the local cache when the network is unavailable.
 * Returns null if nothing is cached.
 */
export async function loadCachedLesson(
  contentId: string,
  partition?: SessionPartitionInput,
): Promise<CachedLessonData | null> {
  try {
    const manifest = await getCachedPack<SignedContentAvailabilityManifest>(LESSON_MANIFEST_SCOPE, contentId, partition);
    if (!manifest || !(await verifyContentAvailabilityManifest(manifest))) {
      await removeCachedLesson(contentId, partition);
      return null;
    }
    if (manifest.payload.contentId !== contentId || manifest.payload.revoked || !manifest.payload.version) {
      await removeCachedLesson(contentId, partition);
      return null;
    }
    if (!acceptsManifestPolicy(manifest)) {
      await notifyClientUpdateRequired(manifest);
      await removeCachedLesson(contentId, partition);
      return null;
    }
    const metadata = await getMetadata(partition);
    const lessonMetadata = metadata.find((entry) => entry.scope === LESSON_SCOPE && entry.scopeId === contentId);
    if (!lessonMetadata || lessonMetadata.complete === false || lessonMetadata.packVersion !== manifestPackVersion(manifest)) {
      await removeCachedLesson(contentId, partition);
      return null;
    }
    const lesson = await getCachedPack<CachedLessonData>(LESSON_SCOPE, contentId, partition);
    if (!lesson) return null;
    if (!isLegacyContentAvailabilityManifest(manifest.payload)) {
      const expectedHash = manifest.payload.contents?.find(
        (entry) => entry.contentId === contentId && entry.version === manifest.payload.version,
      )?.sha256;
      const actualHash = await hashContentAvailabilityData({
        contentId,
        version: manifest.payload.version,
        metadata: lesson.metadata,
        payload: lesson.payload,
        audio: lesson.audio,
      });
      if (!expectedHash || !actualHash || expectedHash !== actualHash) {
        await removeCachedLesson(contentId, partition);
        return null;
      }
    }
    return lesson;
  } catch {
    return null;
  }
}

/** Apply a newly fetched signed version or revocation decision to local content. */
export async function refreshLessonAvailability(
  manifest: SignedContentAvailabilityManifest,
  partition?: SessionPartitionInput,
): Promise<boolean> {
  try {
    const { contentId } = manifest.payload;
    if (!(await acceptManifestAtomically(contentId, manifest, partition))) return false;
    const { version, revoked } = manifest.payload;
    const metadata = await getMetadata(partition);
    const cached = metadata.find((entry) => entry.scope === LESSON_SCOPE && entry.scopeId === contentId);
    if (revoked || !version || (cached && cached.packVersion !== manifestPackVersion(manifest))) {
      await removeCachedLesson(contentId, partition);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a lesson is currently cached (quick, no data fetch).
 */
export async function isLessonCached(contentId: string, partition?: SessionPartitionInput): Promise<boolean> {
  try {
    const pack = await getCachedPack<CachedLessonData>(LESSON_SCOPE, contentId, partition);
    if (!pack) return false;
    const manifest = await getCachedPack<SignedContentAvailabilityManifest>(LESSON_MANIFEST_SCOPE, contentId, partition);
    if (!manifest || !(await verifyContentAvailabilityManifest(manifest))) {
      await removeCachedLesson(contentId, partition);
      return false;
    }
    if (manifest.payload.contentId !== contentId || manifest.payload.revoked || !manifest.payload.version) {
      await removeCachedLesson(contentId, partition);
      return false;
    }
    if (!acceptsManifestPolicy(manifest)) {
      await notifyClientUpdateRequired(manifest);
      await removeCachedLesson(contentId, partition);
      return false;
    }
    const metadata = await getMetadata(partition);
    const lessonMetadata = metadata.find((entry) => entry.scope === LESSON_SCOPE && entry.scopeId === contentId);
    if (!lessonMetadata || lessonMetadata.complete === false || lessonMetadata.packVersion !== manifestPackVersion(manifest)) {
      await removeCachedLesson(contentId, partition);
      return false;
    }
    if (!isLegacyContentAvailabilityManifest(manifest.payload)) {
      const expectedHash = manifest.payload.contents?.find(
        (entry) => entry.contentId === contentId && entry.version === manifest.payload.version,
      )?.sha256;
      const actualHash = await hashContentAvailabilityData({
        contentId,
        version: manifest.payload.version,
        metadata: pack.metadata,
        payload: pack.payload,
        audio: pack.audio,
      });
      if (!expectedHash || !actualHash || expectedHash !== actualHash) {
        await removeCachedLesson(contentId, partition);
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a specific lesson from the cache.
 */
export async function removeCachedLesson(contentId: string, partition?: SessionPartitionInput): Promise<boolean> {
  try {
    await invalidatePack(LESSON_SCOPE, contentId, partition);
    await invalidatePack(LESSON_AUDIO_SCOPE, contentId, partition);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return a list of all cached lessons with their metadata.
 */
async function inspectCachedLesson(
  meta: { scopeId: string; packVersion: string; complete?: boolean },
  partition?: SessionPartitionInput,
): Promise<CachedLessonEntry["status"]> {
  if (meta.complete === false) return "incomplete";
  // getCachedPack updates lastUsedAt in shared metadata. Sequential reads
  // avoid losing one read's recency update to another concurrent write.
  const pack = await getCachedPack<CachedLessonData>(LESSON_SCOPE, meta.scopeId, partition);
  const manifest = await getCachedPack<SignedContentAvailabilityManifest>(LESSON_MANIFEST_SCOPE, meta.scopeId, partition);
  if (!pack || !manifest) return "incomplete";
  if (!(await verifyContentAvailabilityManifest(manifest)) || !validateContentAvailabilityPayload(manifest.payload)) {
    return "corrupt";
  }
  if (manifest.payload.revoked) return "revoked";
  if (!manifest.payload.version || meta.packVersion !== manifestPackVersion(manifest)) return "incomplete";
  if (isManifestExpired(manifest)) return "expired";
  if (!isLegacyContentAvailabilityManifest(manifest.payload) && !isManifestCompatibleWithClient(manifest)) {
    return "update-required";
  }
  return "trusted-current";
}

export async function listCachedLessons(partition?: SessionPartitionInput): Promise<CachedLessonEntry[]> {
  try {
    const metas = (await getMetadata(partition)).filter((m) =>
      m.scope === LESSON_SCOPE && typeof m.scopeId === "string" && Number.isFinite(Number(m.sizeBytes))
    );
    const audioSizes = new Map(
      (await getMetadata(partition))
        .filter((m) => m.scope === LESSON_AUDIO_SCOPE)
        .map((m) => [m.scopeId, Math.max(0, Number(m.sizeBytes) || 0)]),
    );
    const entries: CachedLessonEntry[] = [];
    for (const m of metas) {
      const manifest = await getCachedPack<SignedContentAvailabilityManifest>(LESSON_MANIFEST_SCOPE, m.scopeId, partition);
      entries.push({
        contentId: m.scopeId,
        cachedAt: typeof m.createdAt === "string" ? m.createdAt : "",
        lastUsedAt: typeof m.lastUsedAt === "string" ? m.lastUsedAt : m.createdAt,
        sizeBytes: Math.max(0, Number(m.sizeBytes) || 0) + (audioSizes.get(m.scopeId) ?? 0),
        status: await inspectCachedLesson(m, partition),
        expiresAt: manifest && validateContentAvailabilityPayload(manifest.payload)
          ? (typeof manifest.payload.expiresAt === "string" ? manifest.payload.expiresAt : null)
          : null,
      });
    }
    return entries.sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt));
  } catch {
    return [];
  }
}

/**
 * Return the number of lessons currently in the cache.
 */
export async function getCachedLessonCount(partition?: SessionPartitionInput): Promise<number> {
  try {
    const metas = await getMetadata(partition);
    return metas.filter((m) => m.scope === LESSON_SCOPE).length;
  } catch {
    return 0;
  }
}

/**
 * Return total bytes used by cached lessons.
 */
export async function getCachedLessonBytes(partition?: SessionPartitionInput): Promise<number> {
  try {
    const lessons = await listCachedLessons(partition);
    return lessons.reduce((total, lesson) => total + lesson.sizeBytes, 0);
  } catch {
    return 0;
  }
}

export async function evictSafeCachedLessons(input: {
  maxItems?: number;
  targetBytes?: number;
  partition?: SessionPartitionInput;
} = {}): Promise<{ removed: string[]; freedBytes: number }> {
  const lessons = await listCachedLessons(input.partition);
  const priority: Record<CachedLessonEntry["status"], number> = {
    revoked: 0,
    expired: 1,
    corrupt: 2,
    incomplete: 3,
    "update-required": 4,
    "trusted-current": 5,
  };
  const candidates = lessons.sort((a, b) =>
    priority[a.status] - priority[b.status] ||
    Date.parse(a.lastUsedAt) - Date.parse(b.lastUsedAt)
  );
  const removed: string[] = [];
  let freedBytes = 0;
  const maxItems = input.maxItems ?? Number.POSITIVE_INFINITY;
  const targetBytes = input.targetBytes ?? Number.POSITIVE_INFINITY;
  for (const lesson of candidates) {
    if (removed.length >= maxItems || freedBytes >= targetBytes) break;
    if (await removeCachedLesson(lesson.contentId, input.partition)) {
      removed.push(lesson.contentId);
      freedBytes += lesson.sizeBytes;
    }
  }
  return { removed, freedBytes };
}

/**
 * Check whether the cache is at capacity (MAX_CACHED_LESSONS).
 * When true, callers should prompt the user to remove older lessons.
 */
export async function isCacheAtCapacity(partition?: SessionPartitionInput): Promise<boolean> {
  const count = await getCachedLessonCount(partition);
  return count >= MAX_CACHED_LESSONS;
}
