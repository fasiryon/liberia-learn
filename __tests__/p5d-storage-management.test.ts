import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { set as idbSet } from "idb-keyval";

const store = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => {
    store.set(key, updater(store.get(key)));
  }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: vi.fn((partition?: { userId?: string | null; schoolId?: string | null; deviceId?: string | null }) => ({
    userId: partition?.userId ?? "student-1",
    schoolId: partition?.schoolId ?? "school-1",
    deviceId: partition?.deviceId ?? "device-1",
    key: `u:${partition?.userId ?? "student-1"}|s:${partition?.schoolId ?? "school-1"}|d:${partition?.deviceId ?? "device-1"}`,
  })),
}));

vi.mock("@/lib/content-availability-manifest", () => ({
  acceptsContentAvailabilityManifest: vi.fn(() => true),
  acceptsManifestPolicy: vi.fn(() => true),
  hashContentAvailabilityData: vi.fn(async (input: { contentId: string; version: string }) => `${input.contentId}:${input.version}`),
  isLegacyContentAvailabilityManifest: vi.fn((payload: { policy?: boolean }) => !payload.policy),
  isManifestCompatibleWithClient: vi.fn((manifest: { payload: { minClientVersion?: string } }) => manifest.payload.minClientVersion !== "99.0.0"),
  isManifestExpired: vi.fn((manifest: { payload: { expiresAt?: string } }) => manifest.payload.expiresAt === "expired"),
  validateContentAvailabilityPayload: vi.fn(() => true),
  verifyContentAvailabilityManifest: vi.fn(async () => true),
}));

import { cachePack, configureCacheLifecycle, getCachedPack, getMetadata } from "@/lib/offline-cache";
import { enqueueCompletion, getQueue, markOperationAcknowledged } from "@/lib/offline-queue";
import {
  cacheLessonAudio,
  evictSafeCachedLessons,
  listCachedLessons,
  removeCachedLesson,
} from "@/lib/lesson-offline-cache";
import {
  getBrowserStorageEstimate,
  getOfflineStorageSnapshot,
  storageUsagePercent,
} from "@/lib/offline/storageManagement";
import { hashContentAvailabilityData } from "@/lib/content-availability-manifest";

const partition = { userId: "student-1", schoolId: "school-1", deviceId: "device-1" };

function manifest(contentId: string, options: { revoked?: boolean; expiresAt?: string; minClientVersion?: string } = {}) {
  return {
    payload: {
      contentId,
      version: options.revoked ? null : "1",
      revoked: options.revoked ?? false,
      issuedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: options.expiresAt ?? "2026-09-01T00:00:00.000Z",
      minClientVersion: options.minClientVersion ?? "1.0.0",
      sequence: { revision: 1, governance: 1 },
      contents: options.revoked ? [] : [{ contentId, version: "1", sha256: `${contentId}:1` }],
      policy: true,
    },
    signature: "signature",
    keyId: "key",
  };
}

describe("P5-D storage management", () => {
  let originalNavigator: PropertyDescriptor | undefined;

  beforeEach(() => {
    store.clear();
    vi.mocked(hashContentAvailabilityData).mockImplementation(async (input: { contentId: string; version: string }) => `${input.contentId}:${input.version}`);
    vi.mocked(idbSet).mockImplementation(async (key: string, value: unknown) => { store.set(key, value); });
    configureCacheLifecycle({ ttlMs: 7 * 24 * 60 * 60 * 1000, maxStorageBytes: 25 * 1024 * 1024 });
    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  });

  afterEach(() => {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  });

  it("returns supported browser storage estimates and a bounded usage percentage", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { storage: { estimate: vi.fn(async () => ({ usage: 80, quota: 100 })) } },
    });
    await expect(getBrowserStorageEstimate()).resolves.toEqual({ supported: true, usageBytes: 80, quotaBytes: 100 });
    expect(storageUsagePercent({ supported: true, usageBytes: 80, quotaBytes: 100 })).toBe(80);
    expect(storageUsagePercent({ supported: true, usageBytes: 200, quotaBytes: 100 })).toBe(100);
  });

  it("degrades cleanly when storage estimates are unsupported or fail", async () => {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
    await expect(getBrowserStorageEstimate()).resolves.toEqual({ supported: false, usageBytes: null, quotaBytes: null });
    expect(storageUsagePercent({ supported: false, usageBytes: null, quotaBytes: null })).toBeNull();

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { storage: { estimate: vi.fn(async () => { throw new Error("quota unavailable"); }) } },
    });
    await expect(getBrowserStorageEstimate()).resolves.toEqual({ supported: true, usageBytes: null, quotaBytes: null });
  });

  it("classifies trusted, expired, revoked, and incompatible downloads", async () => {
    await cachePack("lesson", "current", "revision-1:governance-1", { body: "current" }, partition);
    await cachePack("lesson-availability", "current", "revision-1:governance-1", manifest("current"), partition);
    await cachePack("lesson", "expired", "revision-1:governance-1", { body: "expired" }, partition);
    await cachePack("lesson-availability", "expired", "revision-1:governance-1", manifest("expired", { expiresAt: "expired" }), partition);
    await cachePack("lesson", "revoked", "revision-1:governance-1", { body: "revoked" }, partition);
    await cachePack("lesson-availability", "revoked", "revision-1:governance-2", manifest("revoked", { revoked: true }), partition);
    await cachePack("lesson", "incompatible", "revision-1:governance-1", { body: "incompatible" }, partition);
    await cachePack("lesson-availability", "incompatible", "revision-1:governance-1", manifest("incompatible", { minClientVersion: "99.0.0" }), partition);

    const entries = await listCachedLessons(partition);
    expect(Object.fromEntries(entries.map((entry) => [entry.contentId, entry.status]))).toEqual({
      current: "trusted-current",
      expired: "expired",
      revoked: "revoked",
      incompatible: "update-required",
    });
  });

  it("evicts revoked/expired content before current content and never touches outbox work", async () => {
    await cachePack("lesson", "current", "revision-1:governance-1", { body: "current" }, partition);
    await cachePack("lesson-availability", "current", "revision-1:governance-1", manifest("current"), partition);
    await cachePack("lesson", "revoked", "revision-1:governance-1", { body: "revoked" }, partition);
    await cachePack("lesson-availability", "revoked", "revision-1:governance-2", manifest("revoked", { revoked: true }), partition);
    await enqueueCompletion("scheduled-1", "2026-08-28T10:00:00.000Z", partition);

    const result = await evictSafeCachedLessons({ maxItems: 1, partition });
    expect(result.removed).toEqual(["revoked"]);
    expect(await getCachedPack("lesson", "current", partition)).toEqual({ body: "current" });
    expect(await getQueue(partition)).toHaveLength(1);
  });

  it("reports downloaded content and unsynced work without exposing payloads", async () => {
    await cachePack("lesson", "content-1", "revision-1:governance-1", { body: "lesson" }, partition);
    await cachePack("lesson-availability", "content-1", "revision-1:governance-1", manifest("content-1"), partition);
    await enqueueCompletion("scheduled-1", "2026-08-28T10:00:00.000Z", partition);

    const snapshot = await getOfflineStorageSnapshot(partition);
    expect(snapshot.downloadedLessons).toHaveLength(1);
    expect(snapshot.downloadedContentBytes).toBeGreaterThan(0);
    expect(snapshot.unsyncedWorkCount).toBe(1);
    expect(snapshot.pendingContentIds).toEqual([]);
    expect(snapshot).not.toHaveProperty("payload");
  });

  it("ignores malformed cache metadata instead of treating it as trusted storage", async () => {
    store.set("liberialearn_cache_meta::u:student-1|s:school-1|d:device-1", [
      null,
      { scope: "lesson", scopeId: "missing-version", sizeBytes: "not-a-number" },
      { scope: "lesson", scopeId: "valid", packVersion: "v1", sizeBytes: 24, createdAt: "2026-08-28T00:00:00.000Z", lastUsedAt: "2026-08-28T00:00:00.000Z" },
      { scope: "lesson", scopeId: "bad-date", packVersion: "v1", sizeBytes: 24, createdAt: "not-a-date", lastUsedAt: "2026-08-28T00:00:00.000Z" },
    ]);

    await expect(getMetadata(partition)).resolves.toEqual([
      expect.objectContaining({ scope: "lesson", scopeId: "valid", sizeBytes: 24 }),
    ]);
    await expect(listCachedLessons(partition)).resolves.toEqual([
      expect.objectContaining({ contentId: "valid", status: "incomplete" }),
    ]);
  });

  it("does not touch LRU timestamps while inspecting the storage inventory", async () => {
    await cachePack("lesson", "lru-lesson", "revision-1:governance-1", { body: "lesson" }, partition);
    await cachePack("lesson-availability", "lru-lesson", "revision-1:governance-1", manifest("lru-lesson"), partition);
    const oldLastUsedAt = "2026-08-27T00:00:00.000Z";
    const metadata = await getMetadata(partition);
    await idbSet(
      "liberialearn_cache_meta::u:student-1|s:school-1|d:device-1",
      metadata.map((entry) => entry.scope === "lesson" ? { ...entry, lastUsedAt: oldLastUsedAt } : entry),
    );

    await listCachedLessons(partition);

    expect((await getMetadata(partition)).find((entry) => entry.scope === "lesson")?.lastUsedAt).toBe(oldLastUsedAt);
  });

  it("classifies lesson bytes as corrupt when their signed content hash no longer matches", async () => {
    await cachePack("lesson", "tampered", "revision-1:governance-1", { body: "tampered" }, partition);
    await cachePack("lesson-availability", "tampered", "revision-1:governance-1", manifest("tampered"), partition);
    vi.mocked(hashContentAvailabilityData).mockResolvedValue("not-the-signed-hash");

    await expect(listCachedLessons(partition)).resolves.toEqual([
      expect.objectContaining({ contentId: "tampered", status: "corrupt" }),
    ]);
  });

  it("keeps an incomplete content pack out of trusted lesson inventory", async () => {
    await cachePack(
      "lesson",
      "partial",
      "revision-1:governance-1",
      { body: "partial" },
      partition,
      { complete: false, retentionClass: "downloadable" },
    );

    const entries = await listCachedLessons(partition);
    expect(entries).toEqual([
      expect.objectContaining({ contentId: "partial", status: "incomplete" }),
    ]);
    expect(await evictSafeCachedLessons({ maxItems: 1, partition })).toEqual({
      removed: ["partial"],
      freedBytes: expect.any(Number),
    });
  });

  it("does not serve a pack whose byte write fails after incomplete metadata is recorded", async () => {
    vi.mocked(idbSet)
      .mockImplementationOnce(async (key: string, value: unknown) => { store.set(key, value); })
      .mockRejectedValueOnce(new Error("QuotaExceededError"));

    await expect(cachePack("lesson", "failed", "v1", { body: "partial" }, partition)).rejects.toThrow("QuotaExceededError");
    expect(await getCachedPack("lesson", "failed", partition)).toBeNull();
    expect(await getMetadata(partition)).toEqual([
      expect.objectContaining({ scope: "lesson", scopeId: "failed", complete: false }),
    ]);
  });

  it("removes separately cached lesson audio and includes it in content accounting", async () => {
    await cachePack("lesson", "with-audio", "v1", { body: "lesson" }, partition);
    await cachePack("lesson-availability", "with-audio", "v1", manifest("with-audio"), partition);
    await cacheLessonAudio("with-audio", { storageUrl: "https://example.test/audio.mp3", sizeBytes: 500 }, partition);

    const entry = (await listCachedLessons(partition)).find((item) => item.contentId === "with-audio");
    expect(entry?.sizeBytes).toBeGreaterThan(500);
    expect(await removeCachedLesson("with-audio", partition)).toBe(true);
    expect(await getCachedPack("lesson-audio", "with-audio", partition)).toBeNull();
  });

  it("does not count acknowledged evidence as unsynced work", async () => {
    const item = await enqueueCompletion("scheduled-ack", "2026-08-28T10:00:00.000Z", partition);
    await markOperationAcknowledged([item.id], partition);
    const snapshot = await getOfflineStorageSnapshot(partition);
    expect(snapshot.unsyncedWorkCount).toBe(0);
  });
});
