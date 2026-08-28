"use client";

import { purgePartitionPacks } from "@/lib/offline-cache";
import { getQueue, purgeQueuePartition } from "@/lib/offline-queue";
import {
  clearActiveSessionPartition,
  clearStoredSessionIdentity,
  resolveSessionPartition,
  type SessionPartitionInput,
} from "@/lib/offline-session";

export type SafeLogoutOptions = {
  partition?: SessionPartitionInput;
  flushPendingSyncAttempt?: (() => Promise<void>) | null;
};

export type SafeLogoutResult = {
  completed: boolean;
  unsyncedCount: number;
};

export async function safeLogout(options?: SafeLogoutOptions): Promise<SafeLogoutResult> {
  if (options?.flushPendingSyncAttempt) {
    try {
      await options.flushPendingSyncAttempt();
    } catch {
      // Best-effort flush only.
    }
  }

  const partition = resolveSessionPartition(options?.partition);
  const unsyncedCount = (await getQueue(partition)).filter((item) => item.status !== "acknowledged").length;
  if (unsyncedCount > 0) {
    return { completed: false, unsyncedCount };
  }

  await purgeQueuePartition(partition);
  await purgePartitionPacks(partition);

  clearActiveSessionPartition();
  clearStoredSessionIdentity();
  return { completed: true, unsyncedCount: 0 };
}

