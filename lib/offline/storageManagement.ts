"use client";

import { getCacheStats } from "@/lib/offline-cache";
import {
  getQueue,
  getQueueStats,
  type QueueItem,
  type QueueStats,
} from "@/lib/offline-queue";
import {
  listCachedLessons,
  type CachedLessonEntry,
} from "@/lib/lesson-offline-cache";
import type { SessionPartitionInput } from "@/lib/offline-session";

export type BrowserStorageEstimate = {
  supported: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
};

export type OfflineStorageSnapshot = {
  estimate: BrowserStorageEstimate;
  cachePacksCount: number;
  cacheBytes: number;
  downloadedLessons: CachedLessonEntry[];
  downloadedContentBytes: number;
  queue: QueueStats;
  unsyncedWorkCount: number;
  pendingContentIds: string[];
  storageError: boolean;
};

export async function getBrowserStorageEstimate(): Promise<BrowserStorageEstimate> {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.estimate) {
    return { supported: false, usageBytes: null, quotaBytes: null };
  }
  try {
    const result = await storage.estimate();
    return {
      supported: true,
      usageBytes: typeof result.usage === "number" ? result.usage : null,
      quotaBytes: typeof result.quota === "number" ? result.quota : null,
    };
  } catch {
    return { supported: true, usageBytes: null, quotaBytes: null };
  }
}

function isUnsynced(item: QueueItem): boolean {
  return item.status !== "acknowledged" && item.syncState !== "ACKNOWLEDGED";
}

/**
 * Aggregate storage information without exposing queue payloads. Every read
 * is best effort so unsupported browser storage APIs never disable learning.
 */
export async function getOfflineStorageSnapshot(
  partition?: SessionPartitionInput,
): Promise<OfflineStorageSnapshot> {
  let storageError = false;
  const estimate = await getBrowserStorageEstimate();
  // Both cache readers may update lastUsedAt in the shared metadata record.
  // Keep them ordered so an inventory read cannot overwrite another reader's
  // recency update with a stale metadata snapshot.
  const cache = await getCacheStats(partition).catch(() => {
    storageError = true;
    return { cachePacksCount: 0, cacheBytes: 0 };
  });
  const lessons = await listCachedLessons(partition).catch(() => {
    storageError = true;
    return [] as CachedLessonEntry[];
  });
  const [queue, queueItems] = await Promise.all([
    getQueueStats(partition).catch(() => {
      storageError = true;
      return { queuePending: 0, queueConflicts: 0, queueDeadLetter: 0 };
    }),
    getQueue(partition).catch(() => {
      storageError = true;
      return [] as QueueItem[];
    }),
  ]);
  const unsynced = queueItems.filter(isUnsynced);
  return {
    estimate,
    cachePacksCount: cache.cachePacksCount,
    cacheBytes: cache.cacheBytes,
    downloadedLessons: lessons,
    downloadedContentBytes: lessons.reduce((total, lesson) => total + lesson.sizeBytes, 0),
    queue,
    unsyncedWorkCount: unsynced.length,
    pendingContentIds: [...new Set(unsynced.map((item) => item.contentId).filter((id): id is string => Boolean(id)))],
    storageError,
  };
}

export function storageUsagePercent(estimate: BrowserStorageEstimate): number | null {
  if (estimate.usageBytes == null || estimate.quotaBytes == null || estimate.quotaBytes <= 0) return null;
  return Math.min(100, Math.max(0, (estimate.usageBytes / estimate.quotaBytes) * 100));
}
