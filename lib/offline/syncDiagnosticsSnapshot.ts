import type { QueueItem } from "@/lib/offline-queue";
import { DEFAULT_CLIENT_VERSION } from "@/lib/content-availability-manifest";
import { OFFLINE_SYNC_PROTOCOL_VERSION } from "@/lib/offline/syncProtocol";
import {
  MAX_SNAPSHOT_OPERATIONS,
  SYNC_DIAGNOSTIC_SCHEMA_VERSION,
  normalizeCategory,
  normalizeReasonCode,
  sanitizeSyncDiagnosticSnapshot,
  type SyncDiagnosticOperation,
  type SyncDiagnosticSnapshot,
  type SyncOperationCategory,
  type UnacknowledgedQueueState,
} from "@/lib/offline/syncDiagnosticsContract";

type QueueState = UnacknowledgedQueueState | "ACKNOWLEDGED";

/** Older queue rows predate syncState; map their legacy status instead. */
function queueStateOf(item: QueueItem): QueueState {
  if (item.syncState) return item.syncState;
  if (item.status === "acknowledged") return "ACKNOWLEDGED";
  if (item.status === "sending") return "SENDING";
  if (item.status === "failed") return "TERMINAL_FAILURE";
  if (item.status === "conflict") return "CONFLICT";
  return item.nextRetryAt ? "RETRYABLE_FAILURE" : "LOCAL_PENDING";
}

function categoryOf(item: QueueItem): SyncOperationCategory {
  if (item.resourceType) return normalizeCategory(item.resourceType);
  if (item.entity === "studentProgress") return "lesson_progress";
  if (item.entity === "attendance") return "attendance";
  if (item.entity === "submission") return "homework_submission";
  return "legacy_unknown";
}

function createdAtMs(item: QueueItem): number | null {
  const parsed = Date.parse(item.clientCreatedAt ?? item.createdAt);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Summarizes the learner's own device queue for support diagnosis. Reads only
 * queue bookkeeping (state, category, timing, reason code); payloads, content
 * hashes, resource IDs, and conflict state bodies never leave the device.
 */
export function buildSyncDiagnosticSnapshot(
  queue: QueueItem[],
  context: { now: number; online: boolean | null; appRelease: string | null },
): SyncDiagnosticSnapshot | null {
  const counts = {
    unacknowledged: 0,
    localPending: 0,
    sending: 0,
    retryPending: 0,
    authRequired: 0,
    conflict: 0,
    quarantined: 0,
    acknowledgedRetained: 0,
  };
  const categories: Partial<Record<SyncOperationCategory, number>> = {};
  const reasonCodes: Record<string, number> = {};
  const operations: Array<SyncDiagnosticOperation & { createdAt: number }> = [];
  let oldest: number | null = null;
  let maxRetryCount: number | null = null;
  let nextRetryAt: number | null = null;
  let releaseSequence: { revision: number; governance: number } | null = null;

  for (const item of queue) {
    const state = queueStateOf(item);
    if (state === "ACKNOWLEDGED") {
      counts.acknowledgedRetained++;
      continue;
    }
    counts.unacknowledged++;
    if (state === "LOCAL_PENDING") counts.localPending++;
    else if (state === "SENDING") counts.sending++;
    else if (state === "RETRYABLE_FAILURE") counts.retryPending++;
    else if (state === "AUTH_REQUIRED") counts.authRequired++;
    else if (state === "CONFLICT") counts.conflict++;
    else counts.quarantined++;

    const category = categoryOf(item);
    categories[category] = (categories[category] ?? 0) + 1;
    const reasonCode = normalizeReasonCode(state === "CONFLICT" ? item.conflict?.resolutionHint ?? "server_conflict" : item.lastError);
    if (reasonCode) reasonCodes[reasonCode] = (reasonCodes[reasonCode] ?? 0) + 1;

    const created = createdAtMs(item);
    if (created !== null && (oldest === null || created < oldest)) oldest = created;
    const retryCount = item.retryCount ?? item.attempts ?? 0;
    maxRetryCount = Math.max(maxRetryCount ?? 0, retryCount);
    const retryAt = item.nextRetryAt ? Date.parse(item.nextRetryAt) : NaN;
    if (Number.isFinite(retryAt) && (nextRetryAt === null || retryAt < nextRetryAt)) nextRetryAt = retryAt;
    const sequence = item.manifestSequence;
    if (sequence && (!releaseSequence || sequence.revision > releaseSequence.revision ||
      (sequence.revision === releaseSequence.revision && sequence.governance > releaseSequence.governance))) {
      releaseSequence = { revision: sequence.revision, governance: sequence.governance };
    }

    operations.push({
      operationId: item.operationId ?? item.opId ?? item.id,
      category,
      queueState: state,
      reasonCode,
      ageSeconds: created === null ? null : Math.max(0, Math.floor((context.now - created) / 1000)),
      retryCount,
      createdAt: created ?? 0,
    });
  }

  operations.sort((a, b) => a.createdAt - b.createdAt);
  return sanitizeSyncDiagnosticSnapshot({
    schemaVersion: SYNC_DIAGNOSTIC_SCHEMA_VERSION,
    capturedAt: new Date(context.now).toISOString(),
    online: context.online,
    clientVersion: DEFAULT_CLIENT_VERSION,
    appRelease: context.appRelease,
    protocolVersion: OFFLINE_SYNC_PROTOCOL_VERSION,
    counts,
    categories,
    reasonCodes,
    oldestPendingAgeSeconds: oldest === null ? null : Math.max(0, Math.floor((context.now - oldest) / 1000)),
    maxRetryCount,
    nextRetryInSeconds: nextRetryAt === null ? null : Math.max(0, Math.floor((nextRetryAt - context.now) / 1000)),
    releaseSequence,
    operations: operations.slice(0, MAX_SNAPSHOT_OPERATIONS).map(({ createdAt: _createdAt, ...op }) => op),
  });
}
