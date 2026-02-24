// lib/offline-queue.ts — Client-side offline completion queue using IndexedDB
"use client";

import { get, set, del } from "idb-keyval";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";

const QUEUE_KEY_PREFIX = "liberialearn_offline_queue::";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export type QueueItem = {
  id: string;
  opId?: string;
  entity?: "studentProgress" | "attendance" | "submission" | "evidence";
  scheduledWorkId: string;
  completedAt: string;
  attempts: number;
  nextRetryAt: string | null;
  status: "pending" | "failed" | "conflict";
  lastError?: string | null;
  conflict?: {
    entity?: string;
    serverState?: unknown;
    clientState?: unknown;
    resolutionHint?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  /** Client-assigned idempotency key for evidence items. */
  idempotencyKey?: string;
  /** Evidence payload for entity="evidence" items. */
  payload?: unknown;
};

export type QueueStats = {
  queuePending: number;
  queueConflicts: number;
  queueDeadLetter: number;
};

function nowIso() {
  return new Date().toISOString();
}

function computeBackoff(attempts: number) {
  const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(backoff, MAX_BACKOFF_MS);
}

function queueKey(partition?: SessionPartitionInput) {
  return `${QUEUE_KEY_PREFIX}${resolveSessionPartition(partition).key}`;
}

export async function addToQueue(
  scheduledWorkId: string,
  completedAt: string,
  partition?: SessionPartitionInput
): Promise<void> {
  await enqueueCompletion(scheduledWorkId, completedAt, partition);
}

export async function enqueueCompletion(
  scheduledWorkId: string,
  completedAt: string,
  partition?: SessionPartitionInput
): Promise<QueueItem> {
  const queue = await getQueue(partition);
  const existing = queue.find((q) => q.scheduledWorkId === scheduledWorkId && q.status !== "failed");
  if (existing) {
    existing.completedAt = completedAt;
    existing.updatedAt = nowIso();
    await set(queueKey(partition), queue);
    return existing;
  }

  const item: QueueItem = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    opId: undefined,
    entity: "studentProgress",
    scheduledWorkId,
    completedAt,
    attempts: 0,
    nextRetryAt: null,
    status: "pending",
    lastError: null,
    conflict: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  queue.push(item);
  await set(queueKey(partition), queue);
  return item;
}

export async function getQueue(partition?: SessionPartitionInput): Promise<QueueItem[]> {
  return (await get<QueueItem[]>(queueKey(partition))) || [];
}

export async function getReadyQueue(partition?: SessionPartitionInput): Promise<QueueItem[]> {
  const queue = await getQueue(partition);
  const now = Date.now();
  return queue
    .filter((q) => q.status === "pending" && (!q.nextRetryAt || Date.parse(q.nextRetryAt) <= now))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function getConflicts(partition?: SessionPartitionInput): Promise<QueueItem[]> {
  const queue = await getQueue(partition);
  return queue.filter((q) => q.status === "conflict");
}

export async function markSyncSuccess(ids: string[], partition?: SessionPartitionInput): Promise<void> {
  if (ids.length === 0) return;
  const queue = await getQueue(partition);
  const remaining = queue.filter((q) => !ids.includes(q.id));
  await set(queueKey(partition), remaining);
}

export async function markSyncFailure(
  ids: string[],
  error: string,
  partition?: SessionPartitionInput
): Promise<void> {
  if (ids.length === 0) return;
  const queue = await getQueue(partition);
  const now = Date.now();
  for (const item of queue) {
    if (!ids.includes(item.id)) continue;
    if (item.status === "conflict") continue;
    item.attempts += 1;
    item.lastError = error;
    item.updatedAt = nowIso();
    if (item.attempts >= MAX_ATTEMPTS) {
      item.status = "failed";
      item.nextRetryAt = null;
    } else {
      item.status = "pending";
      const backoff = computeBackoff(item.attempts);
      item.nextRetryAt = new Date(now + backoff).toISOString();
    }
  }
  await set(queueKey(partition), queue);
}

export async function markSyncConflict(
  items: Array<{
    id: string;
    entity?: string;
    serverState?: unknown;
    clientState?: unknown;
    resolutionHint?: string;
  }>,
  partition?: SessionPartitionInput
): Promise<void> {
  if (items.length === 0) return;
  const queue = await getQueue(partition);
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const item of queue) {
    const conflict = byId.get(item.id);
    if (!conflict) continue;
    item.status = "conflict";
    item.nextRetryAt = null;
    item.conflict = {
      entity: conflict.entity,
      serverState: conflict.serverState,
      clientState: conflict.clientState,
      resolutionHint: conflict.resolutionHint,
    };
    item.updatedAt = nowIso();
  }
  await set(queueKey(partition), queue);
}

export async function retryConflicts(ids?: string[], partition?: SessionPartitionInput): Promise<void> {
  const queue = await getQueue(partition);
  const targetIds = ids ?? queue.filter((q) => q.status === "conflict").map((q) => q.id);
  for (const item of queue) {
    if (!targetIds.includes(item.id)) continue;
    item.status = "pending";
    item.attempts = 0;
    item.nextRetryAt = null;
    item.conflict = null;
    item.updatedAt = nowIso();
  }
  await set(queueKey(partition), queue);
}

export async function discardConflicts(ids?: string[], partition?: SessionPartitionInput): Promise<void> {
  const queue = await getQueue(partition);
  const targetIds = ids ?? queue.filter((q) => q.status === "conflict").map((q) => q.id);
  const remaining = queue.filter((q) => !targetIds.includes(q.id));
  await set(queueKey(partition), remaining);
}

export async function clearQueue(partition?: SessionPartitionInput): Promise<void> {
  await del(queueKey(partition));
}

export async function purgeQueuePartition(partition?: SessionPartitionInput): Promise<void> {
  await clearQueue(partition);
}

export async function getQueueStats(partition?: SessionPartitionInput): Promise<QueueStats> {
  const queue = await getQueue(partition);
  return {
    queuePending: queue.filter((q) => q.status === "pending").length,
    queueConflicts: queue.filter((q) => q.status === "conflict").length,
    queueDeadLetter: queue.filter((q) => q.status === "failed").length,
  };
}

export async function enqueueEvidence(
  evidencePayload: {
    subject: string;
    strandKey: string;
    correct: number;
    total: number;
    difficulty?: number;
    source: string;
    wasAiAssisted?: boolean;
    timeSpentSec?: number;
  },
  partition?: SessionPartitionInput
): Promise<QueueItem> {
  const queue = await getQueue(partition);
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const item: QueueItem = {
    id: key,
    opId: key,
    entity: "evidence",
    scheduledWorkId: key, // Repurposed as stable ID for type compat
    idempotencyKey: key,
    payload: evidencePayload,
    completedAt: new Date().toISOString(),
    attempts: 0,
    nextRetryAt: null,
    status: "pending",
    lastError: null,
    conflict: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  queue.push(item);
  await set(queueKey(partition), queue);
  return item;
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
