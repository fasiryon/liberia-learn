"use client";

/**
 * Durable Lesson Player V2 progress, stored beside the existing lesson
 * progress in IndexedDB and partitioned by the existing offline session
 * partition (shared devices never see another learner's position). This is not
 * a second offline queue: it holds position only and never syncs evidence.
 */
import { del, get, set } from "idb-keyval";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";
import type { ExperienceProgress } from "./progress";

function key(experienceId: string, partition?: SessionPartitionInput) {
  return `liberialearn_experience_progress::${resolveSessionPartition(partition).key}::${experienceId}`;
}

export async function saveExperienceProgress(progress: ExperienceProgress, partition?: SessionPartitionInput): Promise<void> {
  await set(key(progress.experienceId, partition), progress);
}

export async function loadExperienceProgress(experienceId: string, partition?: SessionPartitionInput): Promise<unknown> {
  return (await get(key(experienceId, partition))) ?? null;
}

export async function clearExperienceProgress(experienceId: string, partition?: SessionPartitionInput): Promise<void> {
  await del(key(experienceId, partition));
}
