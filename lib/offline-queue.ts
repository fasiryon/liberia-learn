// lib/offline-queue.ts — Client-side offline completion queue using IndexedDB
"use client";

import { get, set, del } from "idb-keyval";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";
import {
  OFFLINE_SYNC_PROTOCOL_VERSION,
  inferOfflineResource,
  type OfflineOperationType,
  type OfflineResourceType,
} from "@/lib/offline/syncProtocol";

const QUEUE_KEY_PREFIX = "liberialearn_offline_queue::";

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export type QueueItem = {
  id: string;
  operationId: string;
  protocolVersion: number;
  learnerId: string | null;
  schoolId: string | null;
  resourceType: OfflineResourceType | null;
  resourceId: string;
  operationType: OfflineOperationType | null;
  contentId: string | null;
  contentVersion: string | null;
  contentHash: string | null;
  manifestSequence: { revision: number; governance: number } | null;
  clientCreatedAt: string;
  baseServerVersion: string | null;
  idempotencyKey: string;
  dependencyIds: string[];
  /** Only groups still-pending edits; acknowledged operations keep their IDs. */
  coalesceKey?: string | null;
  syncState: "LOCAL_PENDING" | "SENDING" | "ACKNOWLEDGED" | "CONFLICT" | "RETRYABLE_FAILURE" | "AUTH_REQUIRED" | "TERMINAL_FAILURE";
  leaseExpiresAt?: string | null;
  clientEventId?: string;
  originalTimestamp?: string;
  syncReceivedAt?: string | null;
  type?: "lesson-complete" | "assignment-submission" | "homework" | "lab-submission" | "assessment-attempt" | "attendance" | "tutor-interaction";
  endpoint?: string;
  payload?: Record<string, unknown>;
  queuedAt?: string;
  retryCount?: number;
  opId?: string;
  entity?: "studentProgress" | "attendance" | "submission";
  scheduledWorkId: string;
  completedAt: string;
  attempts: number;
  nextRetryAt: string | null;
  status: "pending" | "sending" | "acknowledged" | "failed" | "conflict";
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

export type QueueStats = {
  queuePending: number;
  queueConflicts: number;
  queueDeadLetter: number;
};

function nowIso() {
  return new Date().toISOString();
}

function newOperationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function computeBackoff(attempts: number) {
  const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(backoff, MAX_BACKOFF_MS);
}

function queueKey(partition?: SessionPartitionInput) {
  return `${QUEUE_KEY_PREFIX}${resolveSessionPartition(partition).key}`;
}

let queueMutation: Promise<unknown> = Promise.resolve();

async function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = queueMutation;
  let release!: () => void;
  queueMutation = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      return await navigator.locks.request("liberialearn-offline-queue", fn);
    }
    return await fn();
  } finally {
    release();
  }
}

export async function enqueueOfflineRequest(
  item: {
    type: "lesson-complete" | "assignment-submission" | "homework" | "lab-submission" | "assessment-attempt" | "attendance" | "tutor-interaction";
    endpoint: string;
    payload: Record<string, unknown>;
    dedupeKey: string;
    operationId?: string;
    resourceType?: OfflineResourceType;
    resourceId?: string;
    operationType?: OfflineOperationType;
    contentId?: string | null;
    contentVersion?: string | null;
    contentHash?: string | null;
    manifestSequence?: { revision: number; governance: number } | null;
    baseServerVersion?: string | null;
    dependencyIds?: string[];
    clientEventId?: string;
    originalTimestamp?: string;
    clientCreatedAt?: string;
    coalesceKey?: string;
  },
  partition?: SessionPartitionInput
): Promise<QueueItem> {
  return withQueueLock(async () => {
    const queue = await getQueue(partition);
    const requestedOperationId = item.operationId ?? newOperationId();
    const inferred = inferOfflineResource(item.type);
    const resourceType = item.resourceType ?? inferred?.resourceType ?? null;
    const operationType = item.operationType ?? inferred?.operationType ?? null;
    const resourceId = item.resourceId ?? String(item.payload.scheduledWorkId ?? item.payload.assignmentId ?? item.payload.homeworkId ?? item.payload.sessionId ?? requestedOperationId);
    const existing = queue.find((entry) =>
      item.coalesceKey && entry.coalesceKey === item.coalesceKey &&
      entry.status !== "failed" && entry.status !== "acknowledged" && entry.status !== "conflict",
    );
    const operationId = existing?.operationId ?? requestedOperationId;
    const clientEventId = item.clientEventId ?? operationId;
    const originalTimestamp = item.clientCreatedAt ?? item.originalTimestamp ?? String(item.payload.originalTimestamp ?? item.payload.completedAt ?? item.payload.clientUpdatedAt ?? nowIso());
    const common = {
      operationId,
      protocolVersion: OFFLINE_SYNC_PROTOCOL_VERSION,
      learnerId: resolveSessionPartition(partition).userId,
      schoolId: resolveSessionPartition(partition).schoolId === "unknown-school" ? null : resolveSessionPartition(partition).schoolId,
      resourceType,
      resourceId,
      operationType,
      contentId: item.contentId ?? (typeof item.payload.contentId === "string" ? item.payload.contentId : null),
      contentVersion: item.contentVersion ?? (typeof item.payload.contentVersion === "string" ? item.payload.contentVersion : null),
      contentHash: item.contentHash ?? (typeof item.payload.contentHash === "string" ? item.payload.contentHash : null),
      manifestSequence: item.manifestSequence ?? null,
      clientCreatedAt: originalTimestamp,
      baseServerVersion: item.baseServerVersion ?? null,
      idempotencyKey: operationId,
      dependencyIds: item.dependencyIds ?? [],
      coalesceKey: item.coalesceKey ?? null,
    };
    if (existing) {
      existing.payload = { ...item.payload, clientEventId: existing.clientEventId, originalTimestamp: existing.originalTimestamp };
      Object.assign(existing, common);
      existing.retryCount = 0;
      existing.attempts = 0;
      existing.updatedAt = nowIso();
      existing.nextRetryAt = null;
      existing.status = "pending";
      existing.syncState = "LOCAL_PENDING";
      existing.leaseExpiresAt = null;
      await set(queueKey(partition), queue);
      return existing;
    }
    const createdAt = nowIso();
    const created: QueueItem = {
      id: newOperationId(),
      ...common,
      clientEventId,
      originalTimestamp,
      syncReceivedAt: null,
      type: item.type,
      endpoint: item.endpoint,
      payload: { ...item.payload, clientEventId, originalTimestamp },
      queuedAt: createdAt,
      retryCount: 0,
      opId: operationId,
      entity: resourceType === "lesson_progress" ? "studentProgress" : resourceType === "attendance" ? "attendance" : resourceType === "homework_submission" ? "submission" : "submission",
      scheduledWorkId: resourceId,
      completedAt: String(item.payload.completedAt ?? createdAt),
      attempts: 0,
      nextRetryAt: null,
      status: "pending",
      syncState: "LOCAL_PENDING",
      leaseExpiresAt: null,
      lastError: null,
      conflict: null,
      createdAt,
      updatedAt: createdAt,
    };
    queue.push(created);
    await set(queueKey(partition), queue);
    return created;
  });
}

export async function enqueueOfflineOperation(
  operation: {
    operationId?: string;
    resourceType: OfflineResourceType;
    resourceId: string;
    operationType: OfflineOperationType;
    payload: Record<string, unknown>;
    contentId?: string | null;
    contentVersion?: string | null;
    contentHash?: string | null;
    manifestSequence?: { revision: number; governance: number } | null;
    baseServerVersion?: string | null;
    dependencyIds?: string[];
    clientCreatedAt?: string;
  },
  partition?: SessionPartitionInput,
): Promise<QueueItem> {
  const operationId = operation.operationId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  return enqueueOfflineRequest({
    type: operation.resourceType === "assessment_attempt" ? "assessment-attempt" : operation.resourceType === "lab_session" ? "lab-submission" : operation.resourceType === "assignment_submission" ? "assignment-submission" : operation.resourceType === "homework_submission" ? "homework" : operation.resourceType === "attendance" ? "attendance" : "lesson-complete",
    endpoint: "/api/student/sync",
    payload: operation.payload,
    dedupeKey: operationId,
    operationId,
    resourceType: operation.resourceType,
    resourceId: operation.resourceId,
    operationType: operation.operationType,
    contentId: operation.contentId,
    contentVersion: operation.contentVersion,
    contentHash: operation.contentHash,
    manifestSequence: operation.manifestSequence,
    baseServerVersion: operation.baseServerVersion,
    dependencyIds: operation.dependencyIds,
    originalTimestamp: operation.clientCreatedAt,
    coalesceKey: operation.resourceType === "lesson_progress"
      ? `${operation.resourceType}:${operation.resourceId}`
      : undefined,
  }, partition);
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
  const entry = await enqueueOfflineRequest(
    {
      type: "lesson-complete",
      endpoint: "/api/student/sync",
      payload: { scheduledWorkId, completedAt },
      dedupeKey: `lesson-complete:${scheduledWorkId}`,
      coalesceKey: `lesson-progress:${scheduledWorkId}`,
    },
    partition
  );
  entry.entity = "studentProgress";
  entry.scheduledWorkId = scheduledWorkId;
  entry.completedAt = completedAt;
  return entry;
}

export async function getQueue(partition?: SessionPartitionInput): Promise<QueueItem[]> {
  return (await get<QueueItem[]>(queueKey(partition))) || [];
}

export async function getReadyQueue(partition?: SessionPartitionInput): Promise<QueueItem[]> {
  const queue = await getQueue(partition);
  const now = Date.now();
  const unresolved = new Set(
    queue
      .filter((q) => q.status !== "acknowledged")
      .flatMap((q) => [q.id, q.operationId]),
  );
  return queue
    .filter((q) =>
      (q.status === "pending" || (q.status === "sending" && !!q.leaseExpiresAt && Date.parse(q.leaseExpiresAt) <= now)) &&
      q.syncState !== "AUTH_REQUIRED" &&
      (!q.nextRetryAt || Date.parse(q.nextRetryAt) <= now) &&
      !(q.dependencyIds ?? []).some((dependencyId) => unresolved.has(dependencyId)),
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function markSyncSending(ids: string[], partition?: SessionPartitionInput): Promise<void> {
  if (ids.length === 0) return;
  await withQueueLock(async () => {
    const queue = await getQueue(partition);
    const lease = new Date(Date.now() + 60_000).toISOString();
    for (const item of queue) if (ids.includes(item.id) && item.status === "pending") {
      item.status = "sending";
      item.syncState = "SENDING";
      item.leaseExpiresAt = lease;
      item.updatedAt = nowIso();
    }
    await set(queueKey(partition), queue);
  });
}

export function toSyncOperation(item: QueueItem) {
  return {
    protocolVersion: item.protocolVersion ?? OFFLINE_SYNC_PROTOCOL_VERSION,
    operationId: item.operationId ?? item.opId ?? item.id,
    learnerId: item.learnerId ?? null,
    schoolId: item.schoolId ?? null,
    resourceType: item.resourceType ?? (item.entity === "studentProgress" ? "lesson_progress" : item.entity === "attendance" ? "attendance" : item.entity === "submission" ? "homework_submission" : null),
    resourceId: item.resourceId ?? item.scheduledWorkId,
    contentId: item.contentId ?? null,
    contentVersion: item.contentVersion ?? null,
    contentHash: item.contentHash ?? null,
    manifestSequence: item.manifestSequence ?? null,
    operationType: item.operationType ?? inferOfflineResource(item.type ?? "")?.operationType,
    payload: item.payload ?? {},
    clientCreatedAt: item.clientCreatedAt ?? item.originalTimestamp ?? item.createdAt,
    baseServerVersion: item.baseServerVersion ?? null,
    idempotencyKey: item.idempotencyKey ?? item.opId ?? item.id,
    dependencyIds: item.dependencyIds ?? [],
  };
}

export async function getConflicts(partition?: SessionPartitionInput): Promise<QueueItem[]> {
  const queue = await getQueue(partition);
  return queue.filter((q) => q.status === "conflict");
}

export async function markSyncSuccess(ids: string[], partition?: SessionPartitionInput): Promise<void> {
  if (ids.length === 0) return;
  await withQueueLock(async () => {
    const queue = await getQueue(partition);
    const remaining = queue.filter((q) => !ids.includes(q.id));
    await set(queueKey(partition), remaining);
  });
}

/** Retain an acknowledged append-only evidence record for the learner's
 * local history. Ordinary projections are removed by markSyncSuccess. */
export async function markOperationAcknowledged(ids: string[], partition?: SessionPartitionInput): Promise<void> {
  if (ids.length === 0) return;
  await withQueueLock(async () => {
    const queue = await getQueue(partition);
    for (const item of queue) if (ids.includes(item.id)) {
      item.status = "acknowledged";
      item.syncState = "ACKNOWLEDGED";
      item.leaseExpiresAt = null;
      item.syncReceivedAt = nowIso();
      item.updatedAt = nowIso();
    }
    await set(queueKey(partition), queue);
  });
}

export async function markSyncFailure(
  ids: string[],
  error: string,
  partition?: SessionPartitionInput
): Promise<void> {
  if (ids.length === 0) return;
  await withQueueLock(async () => {
    const queue = await getQueue(partition);
    const now = Date.now();
    for (const item of queue) {
    if (!ids.includes(item.id)) continue;
    if (item.status === "conflict") continue;
    item.syncReceivedAt = nowIso();
    item.attempts += 1;
    item.retryCount = (item.retryCount ?? item.attempts) + 1;
    item.lastError = error;
    item.updatedAt = nowIso();
    if ((item.retryCount ?? item.attempts) >= 3) {
      item.status = "failed";
      item.syncState = "TERMINAL_FAILURE";
      item.nextRetryAt = null;
    } else {
      item.status = "pending";
      item.syncState = "RETRYABLE_FAILURE";
      const backoff = computeBackoff(item.retryCount ?? item.attempts);
      item.nextRetryAt = new Date(now + backoff).toISOString();
    }
    }
    await set(queueKey(partition), queue);
  });
}

/** Hold work after auth expiry without consuming the retry budget. */
export async function markSyncAuthRequired(ids: string[], error: string, partition?: SessionPartitionInput): Promise<void> {
  if (ids.length === 0) return;
  await withQueueLock(async () => {
    const queue = await getQueue(partition);
    for (const item of queue) {
      if (!ids.includes(item.id) || item.status === "conflict") continue;
      item.status = "pending";
      item.syncState = "AUTH_REQUIRED";
      item.lastError = error;
      item.nextRetryAt = null;
      item.leaseExpiresAt = null;
      item.updatedAt = nowIso();
    }
    await set(queueKey(partition), queue);
  });
}

export async function releaseAuthBlockedOperations(partition?: SessionPartitionInput): Promise<void> {
  await withQueueLock(async () => {
    const queue = await getQueue(partition);
    for (const item of queue) {
      if (item.syncState !== "AUTH_REQUIRED") continue;
      item.syncState = "LOCAL_PENDING";
      item.lastError = null;
      item.updatedAt = nowIso();
    }
    await set(queueKey(partition), queue);
  });
}

export async function markSyncTerminalFailure(ids: string[], error: string, partition?: SessionPartitionInput): Promise<void> {
  if (ids.length === 0) return;
  await withQueueLock(async () => {
    const queue = await getQueue(partition);
    for (const item of queue) {
      if (!ids.includes(item.id) || item.status === "conflict") continue;
      item.status = "failed";
      item.syncState = "TERMINAL_FAILURE";
      item.lastError = error;
      item.nextRetryAt = null;
      item.leaseExpiresAt = null;
      item.updatedAt = nowIso();
    }
    await set(queueKey(partition), queue);
  });
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
    item.syncState = "CONFLICT";
    item.syncReceivedAt = nowIso();
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
    item.syncState = "LOCAL_PENDING";
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

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
