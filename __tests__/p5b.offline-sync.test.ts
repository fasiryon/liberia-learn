import "fake-indexeddb/auto";
import { clear } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";

import {
  enqueueOfflineOperation,
  enqueueOfflineRequest,
  getQueue,
  getReadyQueue,
  markSyncConflict,
  markSyncFailure,
  markSyncSending,
} from "@/lib/offline-queue";
import {
  OFFLINE_SYNC_PROTOCOL_VERSION,
  offlineOperationFingerprint,
  validateOfflineOperation,
  type OfflineOperation,
} from "@/lib/offline/syncProtocol";

const partitionA = { userId: "learner-a", schoolId: "school-a", deviceId: "device-a" };
const partitionB = { userId: "learner-b", schoolId: "school-a", deviceId: "device-a" };

function operation(overrides: Partial<OfflineOperation> = {}): OfflineOperation {
  return {
    protocolVersion: OFFLINE_SYNC_PROTOCOL_VERSION,
    operationId: "operation-0001",
    learnerId: "learner-a",
    schoolId: "school-a",
    resourceType: "assessment_attempt",
    resourceId: "quiz-1",
    contentId: "content-1",
    contentVersion: "1",
    contentHash: null,
    manifestSequence: null,
    operationType: "assessment_attempt.append",
    payload: { quizId: "quiz-1", answers: [1, 0] },
    clientCreatedAt: "2026-08-27T12:00:00.000Z",
    baseServerVersion: null,
    idempotencyKey: "operation-0001",
    dependencyIds: [],
    ...overrides,
  };
}

describe("P5-B durable outbox on IndexedDB", () => {
  beforeEach(async () => {
    await clear();
  });

  it("survives a read after the producing operation and isolates learner partitions", async () => {
    await enqueueOfflineOperation(operation(), partitionA);
    await enqueueOfflineOperation(
      operation({ operationId: "operation-0002", idempotencyKey: "operation-0002", learnerId: "learner-b" }),
      partitionB,
    );

    const reopenedA = await getQueue(partitionA);
    const reopenedB = await getQueue(partitionB);
    expect(reopenedA).toHaveLength(1);
    expect(reopenedA[0].syncState).toBe("LOCAL_PENDING");
    expect(reopenedA[0].operationId).toBe("operation-0001");
    expect(reopenedB).toHaveLength(1);
    expect(reopenedB[0].learnerId).toBe("learner-b");
  });

  it("retains a malformed or failed operation instead of silently deleting learner work", async () => {
    const queued = await enqueueOfflineOperation(operation(), partitionA);
    await markSyncSending([queued.id], partitionA);
    await markSyncFailure([queued.id], "temporary network failure", partitionA);
    const retryable = await getQueue(partitionA);
    expect(retryable[0].syncState).toBe("RETRYABLE_FAILURE");

    await markSyncConflict(
      [{ id: queued.id, entity: "assessmentAttempt", clientState: queued.payload, resolutionHint: "review_required" }],
      partitionA,
    );
    const conflict = await getQueue(partitionA);
    expect(conflict[0].status).toBe("conflict");
    expect(conflict[0].conflict?.resolutionHint).toBe("review_required");
    expect(await getReadyQueue(partitionA)).toHaveLength(0);
  });

  it("holds dependent operations until their prerequisite is acknowledged", async () => {
    const prerequisite = await enqueueOfflineOperation(operation({ operationId: "operation-0003", idempotencyKey: "operation-0003" }), partitionA);
    await enqueueOfflineOperation(
      operation({ operationId: "operation-0004", idempotencyKey: "operation-0004", dependencyIds: [prerequisite.operationId] }),
      partitionA,
    );
    expect((await getReadyQueue(partitionA)).map((item) => item.operationId)).toEqual(["operation-0003"]);
  });

  it("rejects protocol, key, timestamp, and payload violations before dispatch", () => {
    expect(validateOfflineOperation(operation())).toBe(true);
    expect(validateOfflineOperation(operation({ protocolVersion: 2 }))).toBe(false);
    expect(validateOfflineOperation(operation({ idempotencyKey: "other-key" }))).toBe(false);
    expect(validateOfflineOperation(operation({ clientCreatedAt: "yesterday" }))).toBe(false);
    expect(validateOfflineOperation(operation({ payload: { answer: Number.NaN } }))).toBe(false);
  });

  it("fingerprints semantic identity deterministically", () => {
    const first = operation({ payload: { b: 2, a: 1 } });
    const second = operation({ payload: { a: 1, b: 2 } });
    expect(offlineOperationFingerprint(first)).toBe(offlineOperationFingerprint(second));
    expect(offlineOperationFingerprint(operation({ payload: { a: 3 } }))).not.toBe(offlineOperationFingerprint(first));
  });

  it("coalesces only pending lesson edits and allocates a new operation after acknowledgement", async () => {
    const first = await enqueueOfflineRequest({
      type: "lesson-complete",
      endpoint: "/api/student/sync",
      payload: { scheduledWorkId: "lesson-1", completedAt: "2026-08-27T12:00:00.000Z" },
      dedupeKey: "lesson:lesson-1",
      resourceType: "lesson_progress",
      resourceId: "lesson-1",
      operationType: "progress.complete",
      coalesceKey: "lesson_progress:lesson-1",
    }, partitionA);
    const pendingReplacement = await enqueueOfflineRequest({
      type: "lesson-complete",
      endpoint: "/api/student/sync",
      payload: { scheduledWorkId: "lesson-1", completedAt: "2026-08-27T12:01:00.000Z" },
      dedupeKey: "lesson:lesson-1",
      resourceType: "lesson_progress",
      resourceId: "lesson-1",
      operationType: "progress.complete",
      coalesceKey: "lesson_progress:lesson-1",
    }, partitionA);
    expect(pendingReplacement.operationId).toBe(first.operationId);

    const { markSyncSuccess } = await import("@/lib/offline-queue");
    await markSyncSuccess([first.id], partitionA);
    const laterSubmission = await enqueueOfflineRequest({
      type: "lesson-complete",
      endpoint: "/api/student/sync",
      payload: { scheduledWorkId: "lesson-1", completedAt: "2026-08-27T12:02:00.000Z" },
      dedupeKey: "lesson:lesson-1",
      resourceType: "lesson_progress",
      resourceId: "lesson-1",
      operationType: "progress.complete",
      coalesceKey: "lesson_progress:lesson-1",
    }, partitionA);
    expect(laterSubmission.operationId).not.toBe(first.operationId);
  });
});
