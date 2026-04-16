import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock idb-keyval so tests run in Node without IndexedDB
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

// offline-session uses localStorage — stub it
vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: vi.fn(() => ({ key: "default" })),
  detectAndSetActiveSessionPartition: vi.fn(() => null),
}));

import { cacheLessonContent, loadCachedLesson } from "@/lib/lesson-offline-cache";

describe("lesson offline cache", () => {
  beforeEach(() => {
    store.clear();
  });

  it("caches lesson content and loads it back", async () => {
    const data = {
      metadata: { grade: 7, subject: "MATH" },
      payload: { title: "Algebra Intro", body: "Learn algebra basics" },
    };

    await cacheLessonContent("content-abc", data);
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
      metadata: { grade: 7, subject: "MATH" },
      payload: { title: "Old title" },
    });
    await cacheLessonContent("content-1", {
      metadata: { grade: 8, subject: "SCIENCE" },
      payload: { title: "New title" },
    });

    const loaded = await loadCachedLesson("content-1");
    expect(loaded?.payload?.title).toBe("New title");
  });

  it("does not throw when cacheLessonContent encounters an error", async () => {
    // Simulate storage failure without throwing
    const { set } = await import("idb-keyval");
    vi.mocked(set).mockRejectedValueOnce(new Error("QuotaExceededError"));

    // Returns false (not true) when storage fails — does not throw
    await expect(
      cacheLessonContent("content-2", { metadata: null, payload: null })
    ).resolves.toBe(false);
  });

  it("returns null when loadCachedLesson encounters an error", async () => {
    const { get } = await import("idb-keyval");
    vi.mocked(get).mockRejectedValueOnce(new Error("IDB unavailable"));

    const result = await loadCachedLesson("content-3");
    expect(result).toBeNull();
  });
});
