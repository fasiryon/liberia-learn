import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { cachePack, configureCacheLifecycle, getCacheStats, getCachedPack, purgeExpiredPacks } from "@/lib/offline-cache";
import { enqueueCompletion, getQueue } from "@/lib/offline-queue";
import { safeLogout } from "@/lib/safe-logout";

const partitionA = { userId: "student-a", schoolId: "school-1", deviceId: "device-x" };
const partitionB = { userId: "student-b", schoolId: "school-1", deviceId: "device-x" };

describe("offline cache/session primitives", () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));
    configureCacheLifecycle({
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      maxStorageBytes: 25 * 1024 * 1024,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cache TTL purge removes expired packs", async () => {
    configureCacheLifecycle({ ttlMs: 1000 });
    await cachePack("scheduledWork", "sw-1", "v1", { title: "Pack A" }, partitionA);

    vi.setSystemTime(new Date("2026-02-20T12:00:03.000Z"));
    const purged = await purgeExpiredPacks(partitionA);
    const stats = await getCacheStats(partitionA);

    expect(purged).toBe(1);
    expect(stats.cachePacksCount).toBe(0);
    expect(stats.cacheBytes).toBe(0);
  });

  it("partitioning prevents cross-user leakage", async () => {
    await enqueueCompletion("sw-a", "2026-02-20T10:00:00.000Z", partitionA);
    await enqueueCompletion("sw-b", "2026-02-20T10:01:00.000Z", partitionB);
    await cachePack("scheduledWork", "sw-a", "v1", { body: "A" }, partitionA);

    const queueA = await getQueue(partitionA);
    const queueB = await getQueue(partitionB);
    const cacheA = await getCachedPack<{ body: string }>("scheduledWork", "sw-a", partitionA);
    const cacheB = await getCachedPack<{ body: string }>("scheduledWork", "sw-a", partitionB);

    expect(queueA).toHaveLength(1);
    expect(queueA[0].scheduledWorkId).toBe("sw-a");
    expect(queueB).toHaveLength(1);
    expect(queueB[0].scheduledWorkId).toBe("sw-b");
    expect(cacheA?.body).toBe("A");
    expect(cacheB).toBeNull();
  });

  it("safeLogout retains unsynced work and isolates the other partition", async () => {
    await enqueueCompletion("sw-a", "2026-02-20T10:00:00.000Z", partitionA);
    await enqueueCompletion("sw-b", "2026-02-20T10:01:00.000Z", partitionB);
    await cachePack("scheduledWork", "sw-a", "v1", { body: "A" }, partitionA);
    await cachePack("scheduledWork", "sw-b", "v1", { body: "B" }, partitionB);

    const result = await safeLogout({ partition: partitionA });

    const queueAfterA = await getQueue(partitionA);
    const queueAfterB = await getQueue(partitionB);
    const cacheAfterA = await getCacheStats(partitionA);
    const cacheAfterB = await getCacheStats(partitionB);

    expect(result).toEqual({ completed: false, unsyncedCount: 1 });
    expect(queueAfterA).toHaveLength(1);
    expect(cacheAfterA.cachePacksCount).toBe(1);
    expect(queueAfterB).toHaveLength(1);
    expect(cacheAfterB.cachePacksCount).toBe(1);
  });
});

