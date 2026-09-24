"use client";

import { purgePartitionPacks } from "@/lib/offline-cache";
import { getQueue, purgeQueuePartition } from "@/lib/offline-queue";
import { publishActivePartition } from "@/lib/offline/activePartition";
import {
  clearActiveSessionPartition,
  clearStoredSessionIdentity,
  resolveSessionPartition,
  type SessionPartitionInput,
} from "@/lib/offline-session";

export type SafeLogoutOptions = {
  partition?: SessionPartitionInput;
  flushPendingSyncAttempt?: (() => Promise<void>) | null;
  /**
   * Shared-device policy: privacy wins over keeping the session open. When
   * true, logout completes even with unsynced work. That work stays in the
   * learner's own outbox partition and replays only after the same learner
   * signs in again. Without it, the caller receives a warning first.
   */
  keepPendingWork?: boolean;
};

export type SafeLogoutResult = {
  completed: boolean;
  unsyncedCount: number;
  /** Unsynced operations left on the device under the signed-out learner. */
  preservedCount: number;
};

/** Ends the learner's local session on this device. Never deletes unsynced
 * learner work: it is either synced first or retained under the original
 * learner's partition, which no other learner can read or replay. */
export async function safeLogout(options?: SafeLogoutOptions): Promise<SafeLogoutResult> {
  if (options?.flushPendingSyncAttempt) {
    try {
      await options.flushPendingSyncAttempt();
    } catch {
      // Best-effort flush only.
    }
  }

  const partition = resolveSessionPartition(options?.partition);
  const unsyncedCount = (await getQueue(partition).catch(() => [])).filter((item) => item.status !== "acknowledged").length;
  if (unsyncedCount > 0 && !options?.keepPendingWork) {
    return { completed: false, unsyncedCount, preservedCount: 0 };
  }

  // Only a fully synced outbox is removed. Pending work keeps its partition
  // key (learner, school, device) and its learner binding on every operation.
  if (unsyncedCount === 0) await purgeQueuePartition(partition).catch(() => null);
  // Re-downloadable lesson packs and route references are the learner's
  // local projection; remove them from the shared device either way.
  await purgePartitionPacks(partition).catch(() => null);

  clearActiveSessionPartition();
  clearStoredSessionIdentity();
  // Remove the learner's rendered pages from Cache Storage and unbind the
  // service worker so the next person cannot open them or replay the outbox.
  await publishActivePartition(null);
  return { completed: true, unsyncedCount, preservedCount: unsyncedCount };
}

export function describePendingLogout(count: number): string {
  return `${count} offline item${count === 1 ? " has" : "s have"} not synced yet. If you log out now, ${count === 1 ? "it stays" : "they stay"} saved on this device under your account only and will sync the next time you sign in here. Nobody else can see or send ${count === 1 ? "it" : "them"}.`;
}
