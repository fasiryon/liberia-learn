import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock idb-keyval so tests run in Node without IndexedDB
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => {
    store.set(key, updater(store.get(key)));
  }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

// offline-session uses localStorage — stub it
vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: vi.fn(() => ({ key: "default" })),
  detectAndSetActiveSessionPartition: vi.fn(() => null),
}));
vi.mock("@/lib/content-availability-manifest", () => ({
  acceptsContentAvailabilityManifest: vi.fn(() => true),
  verifyContentAvailabilityManifest: vi.fn(async () => true),
}));

import {
  cacheLessonContent,
  loadCachedLesson,
  refreshLessonAvailability,
} from "@/lib/lesson-offline-cache";

function manifest(contentId: string, version = "1") {
  return {
    payload: { contentId, version, revoked: false, issuedAt: "2026-08-03T00:00:00.000Z" },
    signature: "test-signature",
    keyId: "test-key",
  };
}

describe("lesson offline cache", () => {
  beforeEach(() => {
    store.clear();
  });

  it("caches lesson content and loads it back", async () => {
    const data = {
      metadata: { grade: 7, subject: "MATH", version: "1" },
      payload: { title: "Algebra Intro", body: "Learn algebra basics" },
    };

    await cacheLessonContent("content-abc", data, manifest("content-abc"));
    const loaded = await loadCachedLesson("content-abc");

    expect(loaded).not.toBeNull();
    expect(loaded?.metadata?.grade).toBe(7);
    expect(loaded?.payload?.title).toBe("Algebra Intro");
  });

  it("returns null when nothing is cached", async () => {
    const result = await loadCachedLesson("content-missing");
    expect(result).toBeNull();
  });

  it("overwrites cached content with newer data", async () => {
    await cacheLessonContent("content-1", {
      metadata: { grade: 7, subject: "MATH", version: "1" },
      payload: { title: "Old title" },
    }, manifest("content-1"));
    await cacheLessonContent("content-1", {
      metadata: { grade: 8, subject: "SCIENCE", version: "1" },
      payload: { title: "New title" },
    }, manifest("content-1"));

    const loaded = await loadCachedLesson("content-1");
    expect(loaded?.payload?.title).toBe("New title");
  });

  it("does not throw when cacheLessonContent encounters an error", async () => {
    // Simulate storage failure without throwing
    const { set } = await import("idb-keyval");
    vi.mocked(set).mockRejectedValueOnce(new Error("QuotaExceededError"));

    // Returns false (not true) when storage fails — does not throw
    await expect(
      cacheLessonContent(
        "content-2",
        { metadata: { version: "1" }, payload: null },
        manifest("content-2")
      )
    ).resolves.toBe(false);
  });

  it("returns null when loadCachedLesson encounters an error", async () => {
    const { get } = await import("idb-keyval");
    vi.mocked(get).mockRejectedValueOnce(new Error("IDB unavailable"));

    const result = await loadCachedLesson("content-3");
    expect(result).toBeNull();
  });

  it("evicts cached content after a signed revocation manifest refresh", async () => {
    await cacheLessonContent(
      "content-revoked",
      { metadata: { version: "1" }, payload: { title: "Withdrawn lesson" } },
      manifest("content-revoked")
    );

    await refreshLessonAvailability({
      ...manifest("content-revoked"),
      payload: {
        ...manifest("content-revoked").payload,
        version: null,
        revoked: true,
      },
    });

    expect(await loadCachedLesson("content-revoked")).toBeNull();
  });

  it("evicts a stale cached version after a signed version refresh", async () => {
    await cacheLessonContent(
      "content-versioned",
      { metadata: { version: "1" }, payload: { title: "Version one" } },
      manifest("content-versioned", "1")
    );

    await refreshLessonAvailability(manifest("content-versioned", "2"));

    expect(await loadCachedLesson("content-versioned")).toBeNull();
  });
});
