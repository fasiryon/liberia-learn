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
  markSyncDeferred,
  markSyncTerminalFailure,
  releaseSendingLeases,
  toSyncOperation,
} from "@/lib/offline-queue";
import { resolveSessionPartition } from "@/lib/offline-session";
import { OFFLINE_SYNC_PROTOCOL_VERSION, validateOfflineOperation } from "@/lib/offline/syncProtocol";

export type FlushResult = { flushed: number; failed: number; conflicts: number; blocked: number; deferred: number };

type SyncResult = { status?: string; resolutionHint?: string; entity?: string; serverState?: unknown; clientState?: unknown };

const RETRYABLE_HINTS = new Set(["retryable_server_failure", "concurrent_duplicate_retry"]);

/** Only an explicit per-operation verdict proves the server stored (or had
 * already stored) the operation. Anything else keeps the learner's work. */
function isAcknowledged(result: SyncResult | undefined): boolean {
  if (!result) return false;
  if (result.status === "synced" || result.status === "skipped") return true;
  return result.status === "rejected" && result.resolutionHint === "replay_deduped";
}

let activeFlush: Promise<FlushResult> | null = null;

/** Single-flight: repeated triggers (mount, online, visibility, multiple
 * listeners during network flapping) share one drain instead of racing. */
export function flushSubmissionQueue(
  partition?: Parameters<typeof getReadyQueue>[0],
): Promise<FlushResult> {
  if (activeFlush) return activeFlush;
  activeFlush = drain(partition).finally(() => { activeFlush = null; });
  return activeFlush;
}

async function drain(partition?: Parameters<typeof getReadyQueue>[0]): Promise<FlushResult> {
  const queue = await getReadyQueue(partition);
  const result: FlushResult = { flushed: 0, failed: 0, conflicts: 0, blocked: 0, deferred: 0 };
  if (queue.length === 0) return result;

  await markSyncSending(queue.map((item) => item.id), partition);
  const partitionLearnerId = resolveSessionPartition(partition).userId;

  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    const operation = toSyncOperation(item);
    if (!validateOfflineOperation(operation)) {
      await markSyncTerminalFailure([item.id], "invalid_offline_operation", partition);
      result.failed++;
      continue;
    }
    // Work is replayed only for the learner it was recorded for. Operations
    // captured without a learner identity cannot be attributed safely and
    // are retained for review instead of being sent under this session.
    if (!operation.learnerId || (partitionLearnerId && operation.learnerId !== partitionLearnerId)) {
      await markSyncTerminalFailure([item.id], "learner_identity_unbound", partition);
      result.failed++;
      continue;
    }

    let response: Response;
    try {
      response = await fetch("/api/student/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolVersion: OFFLINE_SYNC_PROTOCOL_VERSION, items: [operation] }),
      });
    } catch {
      // No connectivity: the request may or may not have reached the server,
      // so the operation keeps its ID for idempotent replay. Stop draining and
      // hand the untouched remainder back to the ready set.
      await markSyncDeferred([item.id], "network_unavailable", partition);
      await releaseSendingLeases(queue.slice(index + 1).map((entry) => entry.id), partition);
      result.deferred += queue.length - index;
      break;
    }

    const data = await response.json().catch(() => null);
    const syncResult: SyncResult | undefined = Array.isArray(data?.results) ? data.results[0] : undefined;

    // A redirect (expired session, forced PIN change) is never an answer from
    // the sync endpoint; hold the work until the learner signs in again.
    if (response.redirected || response.status === 401 || response.status === 403) {
      await markSyncAuthRequired([item.id], response.redirected ? "auth_redirected" : `auth_required_${response.status}`, partition);
      result.blocked++;
      continue;
    }

    if (response.ok) {
      if (syncResult?.status === "conflict") {
        await markSyncConflict([{
          id: item.id,
          entity: syncResult.entity,
          serverState: syncResult.serverState,
          clientState: syncResult.clientState ?? item.payload,
          resolutionHint: syncResult.resolutionHint,
        }], partition);
        result.conflicts++;
      } else if (isAcknowledged(syncResult)) {
        await markSyncSuccess([item.id], partition);
        result.flushed++;
      } else if (syncResult?.status === "rejected") {
        if (RETRYABLE_HINTS.has(syncResult.resolutionHint ?? "")) {
          await markSyncFailure([item.id], syncResult.resolutionHint!, partition);
        } else {
          await markSyncTerminalFailure([item.id], syncResult.resolutionHint ?? "server_rejected_operation", partition);
        }
        result.failed++;
      } else {
        await markSyncFailure([item.id], "sync_response_unrecognized", partition);
        result.failed++;
      }
      continue;
    }

    if (response.status === 409 || response.status === 410) {
      await markSyncConflict([{
        id: item.id,
        entity: item.entity,
        serverState: data?.serverState ?? null,
        clientState: item.payload,
        resolutionHint: data?.resolutionHint ?? (response.status === 410 ? "content_revoked_evidence_preserved" : "server_conflict"),
      }], partition);
      result.conflicts++;
    } else if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      await markSyncTerminalFailure([item.id], data?.error ?? `HTTP ${response.status}`, partition);
      result.failed++;
    } else {
      await markSyncFailure([item.id], `HTTP ${response.status}`, partition);
      result.failed++;
    }
  }

  return result;
}
