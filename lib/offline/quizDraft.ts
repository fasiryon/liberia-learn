"use client";

import { del, get, set } from "idb-keyval";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";

function key(lessonId: string, partition?: SessionPartitionInput) {
  return `liberialearn_quiz_draft::${resolveSessionPartition(partition).key}::${lessonId}`;
}

export async function saveQuizDraft(lessonId: string, draft: Record<string, unknown>, partition?: SessionPartitionInput) {
  await set(key(lessonId, partition), { ...draft, savedAt: new Date().toISOString() });
}

export async function loadQuizDraft<T>(lessonId: string, partition?: SessionPartitionInput) {
  return (await get<T & { savedAt?: string }>(key(lessonId, partition))) ?? null;
}

export async function removeQuizDraft(lessonId: string, partition?: SessionPartitionInput) {
  await del(key(lessonId, partition));
}
