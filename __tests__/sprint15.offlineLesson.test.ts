/**
 * Sprint 15: Offline lesson cache extensions
 * Tests list, count, delete, max-cap behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory IndexedDB stub
const store = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key) ?? undefined),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => {
    store.set(key, updater(store.get(key)));
  }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

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
  listCachedLessons,
  removeCachedLesson,
  getCachedLessonCount,
  isLessonCached,
  isCacheAtCapacity,
  MAX_CACHED_LESSONS,
} from "@/lib/lesson-offline-cache";

function signedManifest(contentId: string) {
  return {
    payload: { contentId, version: "1", revoked: false, issuedAt: "2026-08-03T00:00:00.000Z" },
    signature: "test-signature",
    keyId: "test-key",
  };
}

function cacheTestLesson(
  contentId: string,
  data: { metadata: Record<string, unknown> | null; payload: Record<string, unknown> | null }
) {
  return cacheLessonContent(
    contentId,
    { ...data, metadata: { ...(data.metadata ?? {}), version: "1" } },
    signedManifest(contentId)
  );
}

describe("lesson offline cache — Sprint 15 extensions", () => {
  beforeEach(() => {
    store.clear();
  });

  it("isLessonCached returns false before caching", async () => {
    expect(await isLessonCached("abc")).toBe(false);
  });

  it("isLessonCached returns true after caching", async () => {
    await cacheTestLesson("abc", { metadata: null, payload: { title: "Test" } });
    expect(await isLessonCached("abc")).toBe(true);
  });

  it("listCachedLessons returns cached entries", async () => {
    await cacheTestLesson("lesson-1", { metadata: { grade: 7 }, payload: null });
    await cacheTestLesson("lesson-2", { metadata: { grade: 8 }, payload: null });
    const list = await listCachedLessons();
    const ids = list.map((l) => l.contentId);
    expect(ids).toContain("lesson-1");
    expect(ids).toContain("lesson-2");
  });

  it("getCachedLessonCount returns correct count", async () => {
    expect(await getCachedLessonCount()).toBe(0);
    await cacheTestLesson("l1", { metadata: null, payload: null });
    await cacheTestLesson("l2", { metadata: null, payload: null });
    expect(await getCachedLessonCount()).toBe(2);
  });

  it("removeCachedLesson removes the entry", async () => {
    await cacheTestLesson("to-remove", { metadata: null, payload: { title: "Old" } });
    expect(await isLessonCached("to-remove")).toBe(true);
    await removeCachedLesson("to-remove");
    expect(await isLessonCached("to-remove")).toBe(false);
  });

  it("listCachedLessons returns entries with cachedAt and sizeBytes", async () => {
    await cacheTestLesson("rich-lesson", {
      metadata: { grade: 9 },
      payload: { title: "Algebra" },
    });
    const list = await listCachedLessons();
    const entry = list.find((l) => l.contentId === "rich-lesson");
    expect(entry).toBeDefined();
    expect(entry?.cachedAt).toBeTruthy();
    expect(entry?.sizeBytes).toBeGreaterThan(0);
  });

  it("MAX_CACHED_LESSONS is 50 (increased in sprint 11)", () => {
    expect(MAX_CACHED_LESSONS).toBe(50);
  });

  it("isCacheAtCapacity returns false when below limit", async () => {
    await cacheTestLesson("only-one", { metadata: null, payload: null });
    expect(await isCacheAtCapacity()).toBe(false);
  });
});

describe("offline quiz attempts", () => {
  beforeEach(() => {
    store.clear();
  });

  it("saves and retrieves an offline quiz attempt", async () => {
    const { saveOfflineQuizAttempt, getOfflineQuizAttempts } = await import(
      "@/lib/offline-quiz-attempts"
    );
    const attempt = {
      id: "attempt-1",
      contentId: "content-abc",
      answers: { q1: "A", q2: "B" },
      submittedAt: new Date().toISOString(),
    };
    await saveOfflineQuizAttempt(attempt);
    const all = await getOfflineQuizAttempts();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("PENDING_SYNC");
    expect(all[0].contentId).toBe("content-abc");
  });

  it("markQuizAttemptSynced sets status to SYNCED", async () => {
    const {
      saveOfflineQuizAttempt,
      markQuizAttemptSynced,
      getOfflineQuizAttempts,
    } = await import("@/lib/offline-quiz-attempts");
    await saveOfflineQuizAttempt({
      id: "attempt-2",
      contentId: "content-xyz",
      answers: {},
      submittedAt: new Date().toISOString(),
    });
    await markQuizAttemptSynced("attempt-2");
    const all = await getOfflineQuizAttempts();
    expect(all[0].status).toBe("SYNCED");
    expect(all[0].syncedAt).toBeTruthy();
  });

  it("markQuizAttemptFailed sets status to SYNC_FAILED", async () => {
    const {
      saveOfflineQuizAttempt,
      markQuizAttemptFailed,
      getOfflineQuizAttempts,
    } = await import("@/lib/offline-quiz-attempts");
    await saveOfflineQuizAttempt({
      id: "attempt-3",
      contentId: "content-fail",
      answers: {},
      submittedAt: new Date().toISOString(),
    });
    await markQuizAttemptFailed("attempt-3", "network_error");
    const all = await getOfflineQuizAttempts();
    expect(all[0].status).toBe("SYNC_FAILED");
    expect(all[0].syncError).toBe("network_error");
  });

  it("getPendingQuizAttempts returns only PENDING_SYNC entries", async () => {
    const {
      saveOfflineQuizAttempt,
      markQuizAttemptSynced,
      getPendingQuizAttempts,
    } = await import("@/lib/offline-quiz-attempts");
    await saveOfflineQuizAttempt({ id: "a1", contentId: "c1", answers: {}, submittedAt: "" });
    await saveOfflineQuizAttempt({ id: "a2", contentId: "c2", answers: {}, submittedAt: "" });
    await markQuizAttemptSynced("a1");
    const pending = await getPendingQuizAttempts();
    expect(pending.map((a) => a.id)).toEqual(["a2"]);
  });
});
