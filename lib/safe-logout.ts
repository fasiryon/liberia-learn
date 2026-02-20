"use client";

import { purgePartitionPacks } from "@/lib/offline-cache";
import { purgeQueuePartition } from "@/lib/offline-queue";
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

export async function safeLogout(options?: SafeLogoutOptions): Promise<void> {
  if (options?.flushPendingSyncAttempt) {
    try {
      await options.flushPendingSyncAttempt();
    } catch {
      // Best-effort flush only.
    }
  }

  const partition = resolveSessionPartition(options?.partition);
  await purgeQueuePartition(partition);
  await purgePartitionPacks(partition);

  clearActiveSessionPartition();
  clearStoredSessionIdentity();
}

