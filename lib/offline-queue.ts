// lib/offline-queue.ts — Client-side offline completion queue using IndexedDB
"use client";

import { get, set, del } from "idb-keyval";

const QUEUE_KEY = "liberialearn_offline_queue";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export type QueueItem = {
  id: string;
  opId?: string;
  entity?: "studentProgress" | "attendance" | "submission";
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
};

function nowIso() {
  return new Date().toISOString();
}

function computeBackoff(attempts: number) {
  const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(backoff, MAX_BACKOFF_MS);
}

export async function addToQueue(scheduledWorkId: string, completedAt: string): Promise<void> {
  await enqueueCompletion(scheduledWorkId, completedAt);
}

export async function enqueueCompletion(scheduledWorkId: string, completedAt: string): Promise<QueueItem> {
  const queue = await getQueue();
  const existing = queue.find((q) => q.scheduledWorkId === scheduledWorkId && q.status !== "failed");
  if (existing) {
    existing.completedAt = completedAt;
    existing.updatedAt = nowIso();
    await set(QUEUE_KEY, queue);
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
  await set(QUEUE_KEY, queue);
  return item;
}

export async function getQueue(): Promise<QueueItem[]> {
  return (await get<QueueItem[]>(QUEUE_KEY)) || [];
}

export async function getReadyQueue(): Promise<QueueItem[]> {
  const queue = await getQueue();
  const now = Date.now();
  return queue
    .filter((q) => q.status === "pending" && (!q.nextRetryAt || Date.parse(q.nextRetryAt) <= now))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function getConflicts(): Promise<QueueItem[]> {
  const queue = await getQueue();
  return queue.filter((q) => q.status === "conflict");
}

export async function markSyncSuccess(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const queue = await getQueue();
  const remaining = queue.filter((q) => !ids.includes(q.id));
  await set(QUEUE_KEY, remaining);
}

export async function markSyncFailure(ids: string[], error: string): Promise<void> {
  if (ids.length === 0) return;
  const queue = await getQueue();
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
  await set(QUEUE_KEY, queue);
}

export async function markSyncConflict(
  items: Array<{
    id: string;
    entity?: string;
    serverState?: unknown;
    clientState?: unknown;
    resolutionHint?: string;
  }>
): Promise<void> {
  if (items.length === 0) return;
  const queue = await getQueue();
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
  await set(QUEUE_KEY, queue);
}

export async function retryConflicts(ids?: string[]): Promise<void> {
  const queue = await getQueue();
  const targetIds = ids ?? queue.filter((q) => q.status === "conflict").map((q) => q.id);
  for (const item of queue) {
    if (!targetIds.includes(item.id)) continue;
    item.status = "pending";
    item.attempts = 0;
    item.nextRetryAt = null;
    item.conflict = null;
    item.updatedAt = nowIso();
  }
  await set(QUEUE_KEY, queue);
}

export async function discardConflicts(ids?: string[]): Promise<void> {
  const queue = await getQueue();
  const targetIds = ids ?? queue.filter((q) => q.status === "conflict").map((q) => q.id);
  const remaining = queue.filter((q) => !targetIds.includes(q.id));
  await set(QUEUE_KEY, remaining);
}

export async function clearQueue(): Promise<void> {
  await del(QUEUE_KEY);
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
