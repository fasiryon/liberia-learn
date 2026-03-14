/**
 * lib/offline/offlineQueue.ts
 *
 * Compatibility queue for server routes and acceptance tests.
 *
 * Canonical browser offline storage lives in lib/offline-queue.ts
 * (idb-keyval / IndexedDB). This module stays in-memory so Node.js routes
 * and Vitest suites can exercise offline event wiring without importing
 * browser-only storage code.
 *
 * Supported op types (ACTION-OFFLINE-1):
 *   lesson.completed   — student marks a scheduled lesson complete
 *   lab.session.update — student saves lab session progress
 *   lesson.delivered   — teacher marks a scheduled lesson as delivered
 *
 * Idempotent enqueue: re-enqueuing the same opType + scheduledWorkId
 * updates the existing entry — no duplicate is created.
 */

export type OfflineOpType =
  | "lesson.completed"
  | "lab.session.update"
  | "lesson.delivered";

export type OfflineItemStatus = "pending" | "failed" | "conflict";

export interface OfflineItem {
  id: string;
  opType: OfflineOpType;
  scheduledWorkId: string;
  payload: Record<string, unknown>;
  attempts: number;
  status: OfflineItemStatus;
  nextRetryAt: number | null;
  conflict: unknown | null;
  createdAt: number;
}

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;

// In-memory store: keyed by `${opType}::${scheduledWorkId}` for idempotent enqueue.
const _store = new Map<string, OfflineItem>();

let _idSeq = 0;

function nextId(): string {
  return `offline-item-${++_idSeq}`;
}

function calcBackoff(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
}

/**
 * Enqueue an offline operation.
 *
 * Idempotent: re-enqueuing the same opType + scheduledWorkId updates the payload,
 * resets attempts to 0, and resets status to pending — no duplicate entry is created.
 */
export function enqueue(
  opType: OfflineOpType,
  scheduledWorkId: string,
  payload: Record<string, unknown>
): OfflineItem {
  const key = `${opType}::${scheduledWorkId}`;
  const existing = _store.get(key);

  if (existing) {
    const updated: OfflineItem = {
      ...existing,
      payload,
      status: "pending",
      attempts: 0,
      nextRetryAt: null,
      conflict: null,
    };
    _store.set(key, updated);
    return updated;
  }

  const item: OfflineItem = {
    id: nextId(),
    opType,
    scheduledWorkId,
    payload,
    attempts: 0,
    status: "pending",
    nextRetryAt: null,
    conflict: null,
    createdAt: Date.now(),
  };
  _store.set(key, item);
  return item;
}

/** Get all items in the queue. */
export function getQueue(): OfflineItem[] {
  return Array.from(_store.values());
}

/**
 * Get items ready to sync: status=pending, nextRetryAt <= now (or null).
 * Returned in FIFO order (ascending createdAt).
 */
export function getReadyQueue(): OfflineItem[] {
  const now = Date.now();
  return Array.from(_store.values())
    .filter(
      (item) =>
        item.status === "pending" &&
        (item.nextRetryAt === null || item.nextRetryAt <= now)
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Remove successfully synced items by id. */
export function markSyncSuccess(ids: string[]): void {
  for (const [key, item] of _store.entries()) {
    if (ids.includes(item.id)) {
      _store.delete(key);
    }
  }
}

/**
 * Mark items as failed. Applies exponential backoff.
 * After MAX_ATTEMPTS failures → status "failed" (dead-letter).
 * Conflict-status items are never mutated by this function.
 */
export function markSyncFailure(ids: string[], _reason: string): void {
  for (const item of _store.values()) {
    if (!ids.includes(item.id)) continue;
    if (item.status === "conflict") continue;

    const attempts = item.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      item.attempts = attempts;
      item.status = "failed";
      item.nextRetryAt = null;
    } else {
      item.attempts = attempts;
      item.nextRetryAt = Date.now() + calcBackoff(attempts);
    }
  }
}

/**
 * Mark items as conflicted.
 * Conflict items are excluded from getReadyQueue until retryConflicts() resets them.
 */
export function markSyncConflict(
  conflicts: Array<{
    id: string;
    serverState: unknown;
    clientState: unknown;
    resolutionHint?: string;
  }>
): void {
  for (const item of _store.values()) {
    const c = conflicts.find((x) => x.id === item.id);
    if (!c) continue;
    item.status = "conflict";
    item.conflict = {
      serverState: c.serverState,
      clientState: c.clientState,
      resolutionHint: c.resolutionHint,
    };
    item.nextRetryAt = null;
  }
}

/** Reset conflict items to pending for manual retry. */
export function retryConflicts(ids: string[]): void {
  for (const item of _store.values()) {
    if (!ids.includes(item.id)) continue;
    item.status = "pending";
    item.attempts = 0;
    item.conflict = null;
    item.nextRetryAt = null;
  }
}

/** Get queue statistics. */
export function getQueueStats(): {
  pending: number;
  conflicts: number;
  deadLetter: number;
  total: number;
} {
  let pending = 0;
  let conflicts = 0;
  let deadLetter = 0;
  for (const item of _store.values()) {
    if (item.status === "pending") pending++;
    else if (item.status === "conflict") conflicts++;
    else if (item.status === "failed") deadLetter++;
  }
  return { pending, conflicts, deadLetter, total: _store.size };
}

/** Clear all items and reset the ID sequence. Use in tests between scenarios. */
export function clearQueue(): void {
  _store.clear();
  _idSeq = 0;
}
