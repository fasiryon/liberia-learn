import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const store = new Map<string, any>();

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: any) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

import {
  enqueueCompletion,
  getQueue,
  getReadyQueue,
  getConflicts,
  markSyncFailure,
  markSyncSuccess,
  markSyncConflict,
  retryConflicts,
  discardConflicts,
  getQueueStats,
} from "@/lib/offline-queue";

describe("offline queue", () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ----------------------------------------------------------------
  // Core enqueue behaviour
  // ----------------------------------------------------------------

  it("is idempotent for the same scheduledWorkId", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    await enqueueCompletion("sw-1", "2026-02-20T11:00:00.000Z");

    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].completedAt).toBe("2026-02-20T11:00:00.000Z");
  });

  it("returns ready items in createdAt order", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    vi.setSystemTime(new Date("2026-02-20T12:00:01.000Z"));
    await enqueueCompletion("sw-2", "2026-02-20T10:01:00.000Z");

    const ready = await getReadyQueue();
    expect(ready.map((q) => q.scheduledWorkId)).toEqual(["sw-1", "sw-2"]);
  });

  it("enqueues multiple distinct items", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    await enqueueCompletion("sw-2", "2026-02-20T10:01:00.000Z");
    await enqueueCompletion("sw-3", "2026-02-20T10:02:00.000Z");

    const queue = await getQueue();
    expect(queue).toHaveLength(3);
  });

  // ----------------------------------------------------------------
  // Retry / backoff
  // ----------------------------------------------------------------

  it("backs off and marks failed after max attempts", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    let queue = await getQueue();
    const id = queue[0].id;

    for (let i = 0; i < 2; i++) {
      await markSyncFailure([id], "network_error");
    }
    queue = await getQueue();
    expect(queue[0].status).toBe("pending");
    expect(queue[0].nextRetryAt).toBeTruthy();

    await markSyncFailure([id], "network_error");
    queue = await getQueue();
    expect(queue[0].status).toBe("failed");
    expect(queue[0].nextRetryAt).toBe(null);
  });

  it("respects nextRetryAt backoff window — item hidden until window expires", async () => {
    vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    const id = queue[0].id;

    // One failure → nextRetryAt is set ~5s in the future (BASE_BACKOFF_MS = 5000)
    await markSyncFailure([id], "transient_error");

    // Still within backoff window at t=0
    const readyNow = await getReadyQueue();
    expect(readyNow).toHaveLength(0);

    // Advance time past the 5-second backoff
    vi.setSystemTime(new Date("2026-02-20T12:00:06.000Z"));
    const readyLater = await getReadyQueue();
    expect(readyLater).toHaveLength(1);
  });

  it("does not increment attempts for conflict-status items on markSyncFailure", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    const id = queue[0].id;

    await markSyncConflict([
      { id, entity: "studentProgress", serverState: {}, clientState: {}, resolutionHint: "test" },
    ]);

    const attemptsBefore = (await getQueue())[0].attempts;
    await markSyncFailure([id], "network_error");
    const attemptsAfter = (await getQueue())[0].attempts;

    // Conflict status must protect from being mutated by failure handler
    expect(attemptsAfter).toBe(attemptsBefore);
    expect((await getQueue())[0].status).toBe("conflict");
  });

  // ----------------------------------------------------------------
  // Success removal
  // ----------------------------------------------------------------

  it("removes items after successful sync", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    await markSyncSuccess([queue[0].id]);
    const after = await getQueue();
    expect(after).toHaveLength(0);
  });

  it("only removes successfully-synced IDs and preserves others", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    vi.setSystemTime(new Date("2026-02-20T12:00:01.000Z"));
    await enqueueCompletion("sw-2", "2026-02-20T10:01:00.000Z");

    const queue = await getQueue();
    await markSyncSuccess([queue[0].id]);

    const after = await getQueue();
    expect(after).toHaveLength(1);
    expect(after[0].scheduledWorkId).toBe("sw-2");
  });

  // ----------------------------------------------------------------
  // Conflict state
  // ----------------------------------------------------------------

  it("moves items to conflict state and excludes from ready queue", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    await markSyncConflict([
      { id: queue[0].id, entity: "studentProgress", serverState: {}, clientState: {}, resolutionHint: "test" },
    ]);

    const conflicts = await getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].status).toBe("conflict");

    const ready = await getReadyQueue();
    expect(ready).toHaveLength(0);

    await markSyncFailure([queue[0].id], "network_error");
    const after = await getQueue();
    expect(after[0].status).toBe("conflict");
  });

  it("retries conflicts by resetting them to pending", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    const id = queue[0].id;

    await markSyncConflict([{ id, entity: "studentProgress", serverState: {}, clientState: {} }]);
    await retryConflicts([id]);

    const after = await getQueue();
    expect(after[0].status).toBe("pending");
    expect(after[0].attempts).toBe(0);
    expect(after[0].conflict).toBeNull();
    expect(after[0].nextRetryAt).toBeNull();
  });

  it("discards conflicts by removing them from the queue", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    const id = queue[0].id;

    await markSyncConflict([{ id, entity: "studentProgress", serverState: {}, clientState: {} }]);
    await discardConflicts([id]);

    const after = await getQueue();
    expect(after).toHaveLength(0);
  });

  // ----------------------------------------------------------------
  // Dead-letter (failed) items
  // ----------------------------------------------------------------

  it("excludes failed (dead-letter) items from ready queue", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    const id = queue[0].id;

    // Exhaust all 5 attempts
    for (let i = 0; i < 5; i++) {
      await markSyncFailure([id], "persistent_error");
    }

    const ready = await getReadyQueue();
    expect(ready).toHaveLength(0); // Dead-letter excluded from ready queue

    const full = await getQueue();
    expect(full).toHaveLength(1); // Still present in full queue for inspection
    expect(full[0].status).toBe("failed");
  });

  // ----------------------------------------------------------------
  // Queue stats
  // ----------------------------------------------------------------

  it("getQueueStats reports correct pending, conflict, and dead-letter counts", async () => {
    // pending item
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    vi.setSystemTime(new Date("2026-02-20T12:00:01.000Z"));

    // conflict item
    await enqueueCompletion("sw-2", "2026-02-20T10:01:00.000Z");
    const q2 = await getQueue();
    const sw2id = q2.find((q) => q.scheduledWorkId === "sw-2")!.id;
    await markSyncConflict([{ id: sw2id, entity: "studentProgress", serverState: {}, clientState: {} }]);

    vi.setSystemTime(new Date("2026-02-20T12:00:02.000Z"));

    // dead-letter item
    await enqueueCompletion("sw-3", "2026-02-20T10:02:00.000Z");
    const q3 = await getQueue();
    const sw3id = q3.find((q) => q.scheduledWorkId === "sw-3")!.id;
    for (let i = 0; i < 5; i++) {
      await markSyncFailure([sw3id], "error");
    }

    const stats = await getQueueStats();
    expect(stats.queuePending).toBe(1);
    expect(stats.queueConflicts).toBe(1);
    expect(stats.queueDeadLetter).toBe(1);
  });
});
