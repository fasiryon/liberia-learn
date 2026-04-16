"use client";

/**
 * lib/offline-quiz-attempts.ts
 *
 * IndexedDB store for quiz attempts captured while offline.
 * Status lifecycle: PENDING_SYNC → SYNCED | SYNC_FAILED
 *
 * Auto-sync is triggered by SyncManager on reconnection;
 * these records are submitted to /api/student/sync with type "quiz-attempt".
 */

import { get, set } from "idb-keyval";

const STORE_KEY = "liberialearn_offline_quiz_attempts";

export type OfflineQuizAttemptStatus = "PENDING_SYNC" | "SYNCED" | "SYNC_FAILED";

export type OfflineQuizAttempt = {
  id: string;
  contentId: string;
  scheduledWorkId?: string;
  answers: Record<string, unknown>;
  score?: number;
  submittedAt: string;
  status: OfflineQuizAttemptStatus;
  syncedAt?: string | null;
  syncError?: string | null;
};

async function readAll(): Promise<OfflineQuizAttempt[]> {
  return (await get<OfflineQuizAttempt[]>(STORE_KEY)) ?? [];
}

async function writeAll(attempts: OfflineQuizAttempt[]): Promise<void> {
  await set(STORE_KEY, attempts);
}

/**
 * Save a new quiz attempt captured while offline.
 * Idempotent: if an attempt with the same id already exists, it is replaced.
 */
export async function saveOfflineQuizAttempt(
  attempt: Omit<OfflineQuizAttempt, "status" | "syncedAt" | "syncError">
): Promise<OfflineQuizAttempt> {
  const all = await readAll();
  const entry: OfflineQuizAttempt = {
    ...attempt,
    status: "PENDING_SYNC",
    syncedAt: null,
    syncError: null,
  };
  const existing = all.findIndex((a) => a.id === attempt.id);
  if (existing >= 0) {
    all[existing] = entry;
  } else {
    all.push(entry);
  }
  await writeAll(all);
  return entry;
}

/** Return all offline quiz attempts. */
export async function getOfflineQuizAttempts(): Promise<OfflineQuizAttempt[]> {
  return readAll();
}

/** Return only attempts that still need syncing. */
export async function getPendingQuizAttempts(): Promise<OfflineQuizAttempt[]> {
  const all = await readAll();
  return all.filter((a) => a.status === "PENDING_SYNC");
}

/** Mark an attempt as successfully synced. */
export async function markQuizAttemptSynced(id: string): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status: "SYNCED", syncedAt: new Date().toISOString(), syncError: null };
  await writeAll(all);
}

/** Mark an attempt as failed to sync. */
export async function markQuizAttemptFailed(id: string, error: string): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status: "SYNC_FAILED", syncError: error };
  await writeAll(all);
}

/** Remove a specific attempt (e.g. after confirmed server-side save). */
export async function removeOfflineQuizAttempt(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((a) => a.id !== id));
}

/** Clear all offline quiz attempts. */
export async function clearOfflineQuizAttempts(): Promise<void> {
  await writeAll([]);
}
