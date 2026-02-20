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

  it("backs off and marks failed after max attempts", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    let queue = await getQueue();
    const id = queue[0].id;

    for (let i = 0; i < 4; i++) {
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

  it("removes items after successful sync", async () => {
    await enqueueCompletion("sw-1", "2026-02-20T10:00:00.000Z");
    const queue = await getQueue();
    await markSyncSuccess([queue[0].id]);
    const after = await getQueue();
    expect(after).toHaveLength(0);
  });

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
});
