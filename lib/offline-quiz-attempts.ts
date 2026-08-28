"use client";

/** Compatibility view over the canonical offline outbox. Quiz attempts are
 * append-only operations; they do not have a second IndexedDB queue. */
import {
  enqueueOfflineOperation,
  getQueue,
  markOperationAcknowledged,
  markSyncSuccess,
  markSyncTerminalFailure,
} from "@/lib/offline-queue";

export type OfflineQuizAttemptStatus = "PENDING_SYNC" | "SYNCED" | "SYNC_FAILED";

export type OfflineQuizAttempt = {
  id: string;
  contentId: string;
  quizId?: string;
  contentVersion?: string | null;
  contentHash?: string | null;
  scheduledWorkId?: string;
  answers: Record<string, unknown>;
  score?: number;
  submittedAt: string;
  status: OfflineQuizAttemptStatus;
  syncedAt?: string | null;
  syncError?: string | null;
};

function toAttempt(item: Awaited<ReturnType<typeof getQueue>>[number]): OfflineQuizAttempt {
  const payload = item.payload ?? {};
  return {
    id: item.operationId,
    contentId: item.contentId ?? String(payload.contentId ?? ""),
    scheduledWorkId: typeof payload.scheduledWorkId === "string" ? payload.scheduledWorkId : undefined,
    quizId: typeof payload.quizId === "string" ? payload.quizId : undefined,
    contentVersion: item.contentVersion,
    contentHash: item.contentHash,
    answers: (payload.answers ?? {}) as Record<string, unknown>,
    score: typeof payload.score === "number" ? payload.score : undefined,
    submittedAt: item.clientCreatedAt,
    status: item.status === "acknowledged" ? "SYNCED" : item.status === "failed" ? "SYNC_FAILED" : "PENDING_SYNC",
    syncedAt: item.status === "acknowledged" ? item.syncReceivedAt : null,
    syncError: item.lastError ?? null,
  };
}

async function attemptItems() {
  return (await getQueue()).filter((item) => item.resourceType === "assessment_attempt");
}

export async function saveOfflineQuizAttempt(
  attempt: Omit<OfflineQuizAttempt, "status" | "syncedAt" | "syncError">,
): Promise<OfflineQuizAttempt> {
  await enqueueOfflineOperation({
    operationId: attempt.id,
    resourceType: "assessment_attempt",
    resourceId: attempt.quizId ?? attempt.id,
    operationType: "assessment_attempt.append",
    contentId: attempt.contentId,
    contentVersion: attempt.contentVersion,
    contentHash: attempt.contentHash,
    payload: {
      id: attempt.id,
      quizId: attempt.quizId,
      contentId: attempt.contentId,
      scheduledWorkId: attempt.scheduledWorkId,
      answers: attempt.answers,
      score: attempt.score,
    },
    clientCreatedAt: attempt.submittedAt,
  });
  const item = (await attemptItems()).find((candidate) => candidate.operationId === attempt.id);
  return item ? toAttempt(item) : { ...attempt, status: "PENDING_SYNC", syncedAt: null, syncError: null };
}

export async function getOfflineQuizAttempts() {
  return (await attemptItems()).map(toAttempt);
}

export async function getPendingQuizAttempts() {
  return (await getOfflineQuizAttempts()).filter((attempt) => attempt.status === "PENDING_SYNC");
}

export async function markQuizAttemptSynced(id: string) {
  const item = (await attemptItems()).find((candidate) => candidate.operationId === id);
  if (item) await markOperationAcknowledged([item.id]);
}

export async function markQuizAttemptFailed(id: string, error: string) {
  const item = (await attemptItems()).find((candidate) => candidate.operationId === id);
  if (item) await markSyncTerminalFailure([item.id], error);
}

export async function removeOfflineQuizAttempt(id: string) {
  const item = (await attemptItems()).find((candidate) => candidate.operationId === id);
  if (item) await markSyncSuccess([item.id]);
}

export async function clearOfflineQuizAttempts() {
  const items = await attemptItems();
  await markSyncSuccess(items.map((item) => item.id));
}
