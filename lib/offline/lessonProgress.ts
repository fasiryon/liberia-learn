"use client";

import { del, get, set } from "idb-keyval";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";

export type DurableLessonProgress = {
  scrollPosition: number;
  lastReadSection: string;
  savedAt: string;
};

function key(lessonId: string, partition?: SessionPartitionInput) {
  return `liberialearn_lesson_progress::${resolveSessionPartition(partition).key}::${lessonId}`;
}

export async function saveLessonProgress(
  lessonId: string,
  progress: Omit<DurableLessonProgress, "savedAt">,
  partition?: SessionPartitionInput,
) {
  await set(key(lessonId, partition), { ...progress, savedAt: new Date().toISOString() });
}

export async function loadLessonProgress(
  lessonId: string,
  partition?: SessionPartitionInput,
): Promise<DurableLessonProgress | null> {
  return (await get<DurableLessonProgress>(key(lessonId, partition))) ?? null;
}

export async function removeLessonProgress(lessonId: string, partition?: SessionPartitionInput) {
  await del(key(lessonId, partition));
}
