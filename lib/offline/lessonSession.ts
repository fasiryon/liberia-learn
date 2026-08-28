"use client";

import { cachePack, getCachedPack } from "@/lib/offline-cache";
import type { SessionPartitionInput } from "@/lib/offline-session";

type LessonSessionReference = {
  contentId: string;
  contentVersion: string | null;
  contentHash: string | null;
};

/** Cache only the route-to-content reference. Lesson bytes remain in the
 * signed P5-A lesson cache and are revalidated before offline use. */
export async function cacheLessonSession(
  lessonId: string,
  lesson: Record<string, unknown>,
  partition?: SessionPartitionInput,
) {
  if (typeof lesson.contentId !== "string" || !lesson.contentId) return;
  const contentVersion = typeof lesson.contentVersion === "string" ? lesson.contentVersion : null;
  const contentHash = typeof lesson.contentHash === "string" ? lesson.contentHash : null;
  await cachePack(
    "lesson-session",
    lessonId,
    contentVersion ?? "unknown",
    { contentId: lesson.contentId, contentVersion, contentHash } satisfies LessonSessionReference,
    partition,
  );
}

export async function loadCachedLessonSession<T extends Record<string, unknown>>(
  lessonId: string,
  partition?: SessionPartitionInput,
) {
  return getCachedPack<T>("lesson-session", lessonId, partition);
}
