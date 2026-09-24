/**
 * Offline + low-end Android + sync hardening V1 — client outbox behavior.
 *
 * Hostile scenarios against the canonical IndexedDB outbox and its drain:
 * lost responses, flapping networks, expired auth, unknown replies, tampered
 * records, conflicts, stale releases, shared devices, and restarts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const idb = vi.hoisted(() => new Map<string, unknown>());

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => structuredClone(idb.get(key))),
  set: vi.fn(async (key: string, value: unknown) => { idb.set(key, structuredClone(value)); }),
  del: vi.fn(async (key: string) => { idb.delete(key); }),
}));

vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: vi.fn((partition?: { userId?: string }) => {
    const userId = partition?.userId ?? "learner-a";
    return { userId, kioskStudentId: null, schoolId: "school-1", deviceId: "device-1", key: `u:${userId}|s:school-1|d:device-1` };
  }),
}));

const A = { userId: "learner-a" };
const B = { userId: "learner-b" };

function verdict(result: Record<string, unknown>, init: { status?: number; redirected?: boolean } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    redirected: init.redirected ?? false,
    json: async () => ({ results: [result] }),
  };
}

async function enqueueProgress(resourceId: string, partition = A, extra: Record<string, unknown> = {}) {
  const { enqueueOfflineOperation } = await import("@/lib/offline-queue");
  return enqueueOfflineOperation({
    resourceType: "lesson_progress",
    resourceId,
    operationType: "progress.complete",
    payload: { scheduledWorkId: resourceId, completedAt: "2026-09-23T10:00:00.000Z", ...extra },
    clientCreatedAt: "2026-09-23T10:00:00.000Z",
  }, partition);
}

function sentOperationIds(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).items[0].operationId);
}

beforeEach(() => {
  idb.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal("navigator", { onLine: true });
});

describe("hardening V1 — idempotent replay", () => {
  it("a lost response is replayed with the same operation ID and acknowledged once", async () => {
    await enqueueProgress("sw-1");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("connection reset after send"))
      .mockResolvedValueOnce(verdict({ status: "rejected", resolutionHint: "replay_deduped" }));
    vi.stubGlobal("fetch", fetchMock);
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue } = await import("@/lib/offline-queue");

    expect((await flushSubmissionQueue(A)).deferred).toBe(1);
    expect((await flushSubmissionQueue(A)).flushed).toBe(1);
    const [first, second] = sentOperationIds(fetchMock);
    expect(second).toBe(first);
    expect(await getQueue(A)).toHaveLength(0);
  });

  it("concurrent triggers (online + visibility + SW message) share one drain", async () => {
    await enqueueProgress("sw-1");
    await enqueueProgress("sw-2");
    const fetchMock = vi.fn().mockResolvedValue(verdict({ status: "synced" }));
    vi.stubGlobal("fetch", fetchMock);
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    await Promise.all([flushSubmissionQueue(A), flushSubmissionQueue(A), flushSubmissionQueue(A)]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a new edit never reuses the ID of an operation already in flight", async () => {
    const first = await enqueueProgress("sw-1");
    const { markSyncSending, getQueue } = await import("@/lib/offline-queue");
    await markSyncSending([first.id], A);
    const second = await enqueueProgress("sw-1", A, { completedAt: "2026-09-23T10:05:00.000Z" });
    expect(second.operationId).not.toBe(first.operationId);
    expect(await getQueue(A)).toHaveLength(2);
  });

  it("an edit after a lost response creates a new operation instead of a payload mismatch", async () => {
    const first = await enqueueProgress("sw-1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    await flushSubmissionQueue(A);
    const second = await enqueueProgress("sw-1", A, { completedAt: "2026-09-23T10:05:00.000Z" });
    expect(second.operationId).not.toBe(first.operationId);
  });

  it("edits made before any send are coalesced into one operation", async () => {
    const first = await enqueueProgress("sw-1");
    const second = await enqueueProgress("sw-1", A, { completedAt: "2026-09-23T10:05:00.000Z" });
    expect(second.operationId).toBe(first.operationId);
  });
});

describe("hardening V1 — connectivity transitions", () => {
  it("network flapping never quarantines work or spends the retry budget", async () => {
    await enqueueProgress("sw-1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue, getReadyQueue } = await import("@/lib/offline-queue");
    for (let index = 0; index < 8; index++) await flushSubmissionQueue(A);
    const [item] = await getQueue(A);
    expect(item.status).toBe("pending");
    expect(item.attempts).toBe(0);
    expect(item.networkDeferrals).toBe(8);
    expect(await getReadyQueue(A)).toHaveLength(1);
  });

  it("a flush interrupted mid-queue returns unsent items to the ready set immediately (restart safe)", async () => {
    await enqueueProgress("sw-1");
    await enqueueProgress("sw-2");
    await enqueueProgress("sw-3");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(verdict({ status: "synced" }))
      .mockRejectedValueOnce(new TypeError("offline")));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getReadyQueue } = await import("@/lib/offline-queue");
    const result = await flushSubmissionQueue(A);
    expect(result).toMatchObject({ flushed: 1, deferred: 2 });
    expect((await getReadyQueue(A)).map((item) => item.resourceId)).toEqual(["sw-2", "sw-3"]);
  });

  it("an app killed mid-send recovers the operation after its lease expires", async () => {
    const item = await enqueueProgress("sw-1");
    const { markSyncSending, getReadyQueue } = await import("@/lib/offline-queue");
    await markSyncSending([item.id], A);
    expect(await getReadyQueue(A)).toHaveLength(0);
    vi.useFakeTimers({ now: Date.now() + 61_000, toFake: ["Date"] });
    try {
      expect(await getReadyQueue(A)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("hardening V1 — auth, unknown replies, tampering", () => {
  it("expired auth holds work without consuming retries", async () => {
    await enqueueProgress("sw-1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, redirected: false, json: async () => ({ error: "Unauthorized" }) }));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue, getReadyQueue, getQueueStats } = await import("@/lib/offline-queue");
    expect((await flushSubmissionQueue(A)).blocked).toBe(1);
    const [item] = await getQueue(A);
    expect(item.syncState).toBe("AUTH_REQUIRED");
    expect(item.attempts).toBe(0);
    expect(await getReadyQueue(A)).toHaveLength(0);
    expect((await getQueueStats(A)).queueAuthRequired).toBe(1);
  });

  it("a redirect to a login or PIN page is never mistaken for a successful sync", async () => {
    await enqueueProgress("sw-1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, redirected: true, json: async () => { throw new SyntaxError("HTML"); } }));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue } = await import("@/lib/offline-queue");
    const result = await flushSubmissionQueue(A);
    expect(result.flushed).toBe(0);
    expect((await getQueue(A))[0].syncState).toBe("AUTH_REQUIRED");
  });

  it("a tampered local record is quarantined without being sent", async () => {
    await enqueueProgress("sw-1");
    const key = [...idb.keys()][0];
    const queue = idb.get(key) as Array<Record<string, unknown>>;
    queue[0].clientCreatedAt = "not-a-date";
    queue[0].idempotencyKey = "different-key";
    idb.set(key, queue);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue } = await import("@/lib/offline-queue");
    await flushSubmissionQueue(A);
    expect(fetchMock).not.toHaveBeenCalled();
    const [item] = await getQueue(A);
    expect(item.syncState).toBe("TERMINAL_FAILURE");
    expect(item.lastError).toBe("invalid_offline_operation");
  });

  it("quarantined work stays visible and can be explicitly retried with a fresh budget", async () => {
    await enqueueProgress("sw-1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(verdict({ status: "rejected", resolutionHint: "scheduled_work_tenant_or_content_mismatch" })));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue, retryFailedOperations, getReadyQueue } = await import("@/lib/offline-queue");
    await flushSubmissionQueue(A);
    expect((await getQueue(A))[0].syncState).toBe("TERMINAL_FAILURE");
    expect(await retryFailedOperations(undefined, A)).toBe(1);
    const ready = await getReadyQueue(A);
    expect(ready).toHaveLength(1);
    expect(ready[0].attempts).toBe(0);
  });
});

describe("hardening V1 — conflicts and stale releases", () => {
  it("a release changed while offline is retained as a conflict, never dropped", async () => {
    await enqueueProgress("sw-1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(verdict({
      status: "conflict",
      entity: "studentProgress",
      serverState: { version: "2026.2" },
      resolutionHint: "content_version_changed",
    })));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue, getReadyQueue } = await import("@/lib/offline-queue");
    expect((await flushSubmissionQueue(A)).conflicts).toBe(1);
    const [item] = await getQueue(A);
    expect(item.status).toBe("conflict");
    expect(item.conflict?.resolutionHint).toBe("content_version_changed");
    expect(await getReadyQueue(A)).toHaveLength(0);
  });

  it("partial sync success keeps exactly the unacknowledged operations", async () => {
    await enqueueProgress("sw-1");
    await enqueueProgress("sw-2");
    await enqueueProgress("sw-3");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(verdict({ status: "synced" }))
      .mockResolvedValueOnce(verdict({ status: "conflict", resolutionHint: "assignment_graded_server_wins" }))
      .mockResolvedValueOnce({ ok: false, status: 503, redirected: false, json: async () => ({}) }));
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue } = await import("@/lib/offline-queue");
    await flushSubmissionQueue(A);
    const remaining = await getQueue(A);
    expect(remaining.map((item) => [item.resourceId, item.status])).toEqual([
      ["sw-2", "conflict"],
      ["sw-3", "pending"],
    ]);
  });
});

describe("hardening V1 — learner binding", () => {
  it("work recorded without a learner identity is retained and never sent under the current session", async () => {
    await enqueueProgress("sw-1");
    const key = [...idb.keys()][0];
    const queue = idb.get(key) as Array<Record<string, unknown>>;
    queue[0].learnerId = null;
    idb.set(key, queue);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue } = await import("@/lib/offline-queue");
    await flushSubmissionQueue(A);
    expect(fetchMock).not.toHaveBeenCalled();
    const [item] = await getQueue(A);
    expect(item.lastError).toBe("learner_identity_unbound");
    expect(item.status).toBe("failed");
  });

  it("work bound to another learner is never replayed even if it lands in this partition", async () => {
    await enqueueProgress("sw-1");
    const key = [...idb.keys()][0];
    const queue = idb.get(key) as Array<Record<string, unknown>>;
    queue[0].learnerId = "learner-b";
    idb.set(key, queue);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    await flushSubmissionQueue(A);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("hardening V1 — low storage", () => {
  it("a quota failure rejects the save instead of reporting queued work", async () => {
    const keyval = await import("idb-keyval");
    (keyval.set as any).mockRejectedValueOnce(Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" }));
    await expect(enqueueProgress("sw-1")).rejects.toThrow("QuotaExceededError");
    const { getQueue } = await import("@/lib/offline-queue");
    expect(await getQueue(A)).toHaveLength(0);
  });

  it("an offline quiz attempt that cannot be stored is not reported as saved", async () => {
    const keyval = await import("idb-keyval");
    (keyval.set as any).mockRejectedValueOnce(Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" }));
    const { saveOfflineQuizAttempt } = await import("@/lib/offline-quiz-attempts");
    await expect(saveOfflineQuizAttempt({
      id: "3f2b8c1e-9a4d-4e21-b7c5-0d6e8f1a2b3c",
      contentId: "content-1",
      quizId: "quiz-1",
      answers: { q1: 0 },
      submittedAt: "2026-09-23T10:00:00.000Z",
    })).rejects.toThrow();
  });
});

describe("hardening V1 — shared device", () => {
  it("one learner's outbox is invisible to and never drained by another learner", async () => {
    await enqueueProgress("sw-a", A);
    const fetchMock = vi.fn().mockResolvedValue(verdict({ status: "synced" }));
    vi.stubGlobal("fetch", fetchMock);
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const { getQueue } = await import("@/lib/offline-queue");
    expect(await getQueue(B)).toHaveLength(0);
    await flushSubmissionQueue(B);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getQueue(A)).toHaveLength(1);
  });

  it("queue writes announce themselves so status UI needs no polling", async () => {
    const listener = vi.fn();
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const { subscribeToQueueChanges } = await import("@/lib/offline-queue");
    const unsubscribe = subscribeToQueueChanges(listener);
    await enqueueProgress("sw-1");
    unsubscribe();
    expect(listener).toHaveBeenCalled();
  });
});
