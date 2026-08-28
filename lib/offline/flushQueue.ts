"use client";

/** Durable IndexedDB outbox drain. One operation is sent per request so a
 * response can always be bound to the exact operation/idempotency key. */
import {
  getReadyQueue,
  markSyncSending,
  markSyncSuccess,
  markSyncFailure,
  markSyncAuthRequired,
  markSyncConflict,
  markSyncTerminalFailure,
  toSyncOperation,
} from "@/lib/offline-queue";
import { OFFLINE_SYNC_PROTOCOL_VERSION, validateOfflineOperation } from "@/lib/offline/syncProtocol";

export type FlushResult = { flushed: number; failed: number; conflicts: number; blocked: number };

export async function flushSubmissionQueue(
  partition?: Parameters<typeof getReadyQueue>[0],
): Promise<FlushResult> {
  const queue = await getReadyQueue(partition);
  if (queue.length === 0) return { flushed: 0, failed: 0, conflicts: 0, blocked: 0 };

  let flushed = 0;
  let failed = 0;
  let conflicts = 0;
  let blocked = 0;
  await markSyncSending(queue.map((item) => item.id), partition);

  for (const item of queue) {
    try {
      const operation = toSyncOperation(item);
      if (!validateOfflineOperation(operation)) {
        await markSyncTerminalFailure([item.id], "invalid_offline_operation", partition);
        failed++;
        continue;
      }

      const response = await fetch("/api/student/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolVersion: OFFLINE_SYNC_PROTOCOL_VERSION, items: [operation] }),
      });
      const data = await response.json().catch(() => null);
      const result = data?.results?.[0];

      if (response.ok) {
        if (result?.status === "conflict") {
          await markSyncConflict([{
            id: item.id,
            entity: result.entity,
            serverState: result.serverState,
            clientState: result.clientState ?? item.payload,
            resolutionHint: result.resolutionHint,
          }], partition);
          conflicts++;
        } else if (result?.status === "rejected" && result?.resolutionHint !== "replay_deduped") {
          if (result?.resolutionHint === "retryable_server_failure" || result?.resolutionHint === "concurrent_duplicate_retry") {
            await markSyncFailure([item.id], result.resolutionHint, partition);
          } else {
            await markSyncTerminalFailure([item.id], result.resolutionHint ?? "server_rejected_operation", partition);
          }
          failed++;
        } else {
          await markSyncSuccess([item.id], partition);
          flushed++;
        }
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        await markSyncAuthRequired([item.id], `auth_required_${response.status}`, partition);
        blocked++;
      } else if (response.status === 409 || response.status === 410) {
        await markSyncConflict([{
          id: item.id,
          entity: item.entity,
          serverState: data?.serverState ?? null,
          clientState: item.payload,
          resolutionHint: data?.resolutionHint ?? (response.status === 410 ? "content_revoked_evidence_preserved" : "server_conflict"),
        }], partition);
        conflicts++;
      } else if (response.status >= 400 && response.status < 500) {
        await markSyncTerminalFailure([item.id], data?.error ?? `HTTP ${response.status}`, partition);
        failed++;
      } else {
        await markSyncFailure([item.id], `HTTP ${response.status}`, partition);
        failed++;
      }
    } catch (error) {
      await markSyncFailure([item.id], error instanceof Error ? error.message : String(error), partition);
      failed++;
      break;
    }
  }

  return { flushed, failed, conflicts, blocked };
}
