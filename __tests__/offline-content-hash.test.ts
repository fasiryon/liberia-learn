import "fake-indexeddb/auto";
import { clear } from "idb-keyval";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNr12GenerationPlan } from "@/lib/curriculum/nr12GradeDeserts";
import { buildNr13GenerationPlan } from "@/lib/curriculum/nr13Grades58";
import { clearQueue, enqueueOfflineOperation, getQueue, getReadyQueue, retryFailedOperations, toSyncOperation } from "@/lib/offline-queue";
import { safeLogout } from "@/lib/safe-logout";
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
import { validateOfflineOperation } from "@/lib/offline/syncProtocol";

const partition = { userId: "learner-hash", schoolId: "school-hash", deviceId: "device-hash" };
const lessons = [
  { writer: "NR12", ...buildNr12GenerationPlan(2, "MATH")[0] },
  { writer: "NR13", ...buildNr13GenerationPlan(5, "MATH")[0] },
];

async function enqueueHash(contentHash: string | null) {
  return enqueueOfflineOperation({
    resourceType: "lesson_progress",
    resourceId: "scheduled-hash-lesson",
    operationType: "progress.complete",
    contentId: "hash-lesson",
    contentVersion: "1",
    contentHash,
    payload: { scheduledWorkId: "scheduled-hash-lesson", completedAt: "2026-11-14T15:00:00.000Z" },
    clientCreatedAt: "2026-11-14T15:00:00.000Z",
  }, partition);
}

beforeEach(async () => { await clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("offline completion content hash compatibility", () => {
  it.each(lessons)("dispatches a real $writer hash unchanged and retains work until acknowledgement", async lesson => {
    expect(lesson.hash).toMatch(/^[0-9a-f]{40}$/);
    const queued = await enqueueOfflineOperation({
      resourceType: "lesson_progress", resourceId: "scheduled-hash-lesson", operationType: "progress.complete",
      contentId: lesson.contentId, contentVersion: lesson.version, contentHash: lesson.hash,
      payload: { scheduledWorkId: "scheduled-hash-lesson", completedAt: "2026-11-14T15:00:00.000Z" },
      clientCreatedAt: "2026-11-14T15:00:00.000Z",
    }, partition);
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ status: "synced" }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect((await flushSubmissionQueue(partition)).deferred).toBe(1);
    expect((await getQueue(partition))[0]).toMatchObject({ contentHash: lesson.hash, syncState: "RETRYABLE_FAILURE" });
    expect((await flushSubmissionQueue(partition)).flushed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body).items[0];
    const retry = JSON.parse(fetchMock.mock.calls[1][1].body).items[0];
    expect(first).toMatchObject({ operationId: queued.operationId, contentHash: lesson.hash, contentId: lesson.contentId });
    expect(retry).toEqual(first);
    expect(await getQueue(partition)).toHaveLength(0);
  });

  it.each(["b".repeat(40), "c".repeat(16), "synthetic-legacy-hash"])("RED: dispatches a stored legacy hash %s for exact server comparison", async hash => {
    await enqueueHash(hash);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ status: "synced" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await flushSubmissionQueue(partition);
    expect(result.flushed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["b".repeat(40), "c".repeat(16), "synthetic-legacy-hash"])("observes retained failure, explicit retry, logout and deletion for %s", async hash => {
    const original = await enqueueHash(hash);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await flushSubmissionQueue(partition)).failed).toBe(1);
    expect((await getQueue(partition))[0]).toMatchObject({ operationId: original.operationId, contentHash: hash, syncState: "TERMINAL_FAILURE", status: "failed", lastError: "invalid_offline_operation" });
    expect(await getReadyQueue(partition)).toHaveLength(0);
    expect((await flushSubmissionQueue(partition)).failed).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await safeLogout({ partition })).toMatchObject({ completed: false, unsyncedCount: 1 });
    expect(await safeLogout({ partition, keepPendingWork: true })).toMatchObject({ completed: true, preservedCount: 1 });
    expect((await getQueue(partition))[0].operationId).toBe(original.operationId);
    expect(await retryFailedOperations([original.id], partition)).toBe(1);
    expect((await getReadyQueue(partition))[0]).toMatchObject({ operationId: original.operationId, contentHash: hash, status: "pending" });
    expect((await flushSubmissionQueue(partition)).failed).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    await clearQueue(partition);
    expect(await getQueue(partition)).toHaveLength(0);
  });

  it.each([null, "a".repeat(64)])("preserves existing accepted hash %s", async hash => {
    expect(validateOfflineOperation(toSyncOperation(await enqueueHash(hash)))).toBe(true);
  });

  it.each(["", "a".repeat(39), "a".repeat(41), "a".repeat(63), "a".repeat(65), "A".repeat(40), "A".repeat(64), "g".repeat(40), ` ${"a".repeat(40)}`, `${"a".repeat(40)}\n`])(
    "retains malformed hash %s as terminal without dispatch", async hash => {
      await enqueueHash(hash);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      expect((await flushSubmissionQueue(partition)).failed).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
      expect((await getQueue(partition))[0]).toMatchObject({ contentHash: hash, syncState: "TERMINAL_FAILURE", lastError: "invalid_offline_operation" });
    },
  );
});
