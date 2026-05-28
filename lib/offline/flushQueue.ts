"use client";

/**
 * lib/offline/flushQueue.ts  — NR-14A
 *
 * Extracted, testable flush function shared by:
 *   - SyncManager (online-event handler)
 *   - SW message handler (BackgroundSync path)
 *
 * On network error the loop stops immediately — items stay pending
 * so the next online/sync event retries them. 4xx errors beyond
 * MAX_CLIENT_ERRORS attempts are dead-lettered (assignment closed, etc.).
 */

import {
  getReadyQueue,
  markSyncSuccess,
  markSyncFailure,
  type QueueItem,
} from "@/lib/offline-queue";

const MAX_CLIENT_ERRORS = 5;

export type FlushResult = { flushed: number; failed: number };

export async function flushSubmissionQueue(
  partition?: Parameters<typeof getReadyQueue>[0]
): Promise<FlushResult> {
  const queue = await getReadyQueue(partition);
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.endpoint ?? "/api/student/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload ?? {}),
      });

      if (res.ok) {
        await markSyncSuccess([item.id], partition);
        flushed++;
      } else if (res.status >= 400 && res.status < 500) {
        // Client error (assignment closed, auth expired, etc.) — remove immediately.
        // These won't succeed on retry; keeping them in the queue forever is wrong.
        await markSyncSuccess([item.id], partition);
        failed++;
      } else {
        // 5xx — keep retrying with backoff
        await markSyncFailure([item.id], `HTTP ${res.status}`, partition);
        failed++;
      }
    } catch (err) {
      // Network gone again — stop draining, retry on next sync event
      await markSyncFailure([item.id], String(err), partition);
      failed++;
      break;
    }
  }

  return { flushed, failed };
}
