/**
 * __tests__/offline.submission-queue.test.ts  — NR-14A
 *
 * 11 scenarios covering the offline homework submission pipeline:
 *   1.  enqueueOfflineRequest stores an action retrievable by getQueue
 *   2.  getReadyQueue returns oldest-first (createdAt order)
 *   3.  markSyncSuccess removes items by id
 *   4.  markSyncFailure increments attempts and records lastError
 *   5.  submitWithQueue → "submitted" when fetch succeeds online
 *   6.  submitWithQueue → "queued" when navigator.onLine is false
 *   7.  submitWithQueue → "queued" when fetch throws (network error)
 *   8.  flushSubmissionQueue removes successfully-flushed actions
 *   9.  flushSubmissionQueue dead-letters 4xx after MAX_CLIENT_ERRORS attempts
 *   10. flushSubmissionQueue stops loop on network error
 *   11. Server idempotency: same clientSubmissionId → existing record returned (no duplicate write)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── In-memory idb-keyval mock ─────────────────────────────────────────────────
// vi.hoisted ensures the _store reference is available inside the vi.mock factory.
const _idbStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(_idbStore.get(key))),
  set: vi.fn((key: string, val: unknown) => {
    _idbStore.set(key, val);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    _idbStore.delete(key);
    return Promise.resolve();
  }),
}));

// Predictable session partition so queue key is deterministic in tests
vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: vi.fn(() => ({ key: "test-partition" })),
  detectAndSetActiveSessionPartition: vi.fn(() =>
    Promise.resolve({ key: "test-partition" })
  ),
}));

// ── Prisma mock (for test 11 — server idempotency) ────────────────────────────
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockHomeworkFindFirst = vi.hoisted(() => vi.fn());
const mockRequireRole = vi.hoisted(() => vi.fn());
const mockRequireTenant = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    homeworkSubmission: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
    student: { findFirst: mockStudentFindFirst },
    homework: { findFirst: mockHomeworkFindFirst },
  },
}));
vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/tenant", () => ({ requireTenant: mockRequireTenant }));

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset the in-memory IDB store between tests
  _idbStore.clear();

  // Reset mock call histories (but NOT implementations — vi.mock factories stay intact)
  mockFindUnique.mockReset();
  mockUpsert.mockReset();
  mockStudentFindFirst.mockReset();
  mockHomeworkFindFirst.mockReset();
  mockRequireRole.mockReset();
  mockRequireTenant.mockReset();

  // Restore global fetch and navigator if they were mutated
  vi.unstubAllGlobals();
});

// ── Queue CRUD — tests 1-4 ────────────────────────────────────────────────────

describe("Queue CRUD", () => {
  it("1. enqueueOfflineRequest stores an action retrievable by getQueue", async () => {
    const { enqueueOfflineRequest, getQueue } = await import("@/lib/offline-queue");

    await enqueueOfflineRequest({
      type: "assignment-submission",
      endpoint: "/api/homework/submit",
      payload: { homeworkId: "hw-1", answers: ["a"] },
      dedupeKey: "homework:hw-1",
    });

    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe("assignment-submission");
    expect(queue[0].endpoint).toBe("/api/homework/submit");
    expect(queue[0].status).toBe("pending");
  });

  it("2. getReadyQueue returns oldest-first (createdAt order)", async () => {
    const { enqueueOfflineRequest, getReadyQueue } = await import("@/lib/offline-queue");

    // Enqueue two items — idb-keyval push order determines createdAt
    await enqueueOfflineRequest({
      type: "assignment-submission",
      endpoint: "/api/homework/submit",
      payload: { homeworkId: "hw-OLD", answers: [] },
      dedupeKey: "hw-OLD",
    });
    // Small delay to ensure createdAt differs
    await new Promise((r) => setTimeout(r, 5));
    await enqueueOfflineRequest({
      type: "assignment-submission",
      endpoint: "/api/homework/submit",
      payload: { homeworkId: "hw-NEW", answers: [] },
      dedupeKey: "hw-NEW",
    });

    const ready = await getReadyQueue();
    expect(ready).toHaveLength(2);
    // Oldest (hw-OLD) must come first
    expect((ready[0].payload as any).homeworkId).toBe("hw-OLD");
    expect((ready[1].payload as any).homeworkId).toBe("hw-NEW");
  });

  it("3. markSyncSuccess removes items by id", async () => {
    const { enqueueOfflineRequest, getQueue, markSyncSuccess } = await import(
      "@/lib/offline-queue"
    );

    await enqueueOfflineRequest({
      type: "assignment-submission",
      endpoint: "/api/homework/submit",
      payload: { homeworkId: "hw-2" },
      dedupeKey: "hw-2",
    });

    const [item] = await getQueue();
    expect(item).toBeDefined();

    await markSyncSuccess([item.id]);
    expect(await getQueue()).toHaveLength(0);
  });

  it("4. markSyncFailure increments attempts and records lastError", async () => {
    const { enqueueOfflineRequest, getQueue, markSyncFailure } = await import(
      "@/lib/offline-queue"
    );

    await enqueueOfflineRequest({
      type: "assignment-submission",
      endpoint: "/api/homework/submit",
      payload: { homeworkId: "hw-3" },
      dedupeKey: "hw-3",
    });

    const [item] = await getQueue();
    await markSyncFailure([item.id], "network_timeout");

    const [updated] = await getQueue();
    expect(updated.attempts).toBeGreaterThan(0);
    expect(updated.lastError).toBe("network_timeout");
    expect(updated.status).toBe("pending"); // not dead-lettered yet after one failure
  });
});

// ── submitWithQueue — tests 5-7 ───────────────────────────────────────────────

describe("submitWithQueue", () => {
  it("5. returns {status:'submitted'} when fetch succeeds online", async () => {
    vi.stubGlobal("navigator", { onLine: true, serviceWorker: undefined });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, submission: { id: "sub-1" } }),
      })
    );

    const { submitWithQueue } = await import("@/lib/offline/submitWithQueue");
    const result = await submitWithQueue({
      type: "homework",
      endpoint: "/api/homework/submit",
      body: { homeworkId: "hw-4", answers: ["answer"] },
    });

    expect(result.status).toBe("submitted");
    expect((result as any).data).toMatchObject({ ok: true });
    // Nothing should be in the queue
    const { getQueue } = await import("@/lib/offline-queue");
    expect(await getQueue()).toHaveLength(0);
  });

  it("6. returns {status:'queued'} when navigator.onLine is false", async () => {
    vi.stubGlobal("navigator", { onLine: false, serviceWorker: undefined });
    vi.stubGlobal("fetch", vi.fn()); // fetch should NOT be called

    const { submitWithQueue } = await import("@/lib/offline/submitWithQueue");
    const result = await submitWithQueue({
      type: "homework",
      endpoint: "/api/homework/submit",
      body: { homeworkId: "hw-5", answers: ["answer"] },
    });

    expect(result.status).toBe("queued");
    expect((result as any).clientSubmissionId).toBeDefined();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // Item must be in the queue
    const { getQueue } = await import("@/lib/offline-queue");
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
  });

  it("7. returns {status:'queued'} when fetch throws (network error)", async () => {
    vi.stubGlobal("navigator", { onLine: true, serviceWorker: undefined });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { submitWithQueue } = await import("@/lib/offline/submitWithQueue");
    const result = await submitWithQueue({
      type: "homework",
      endpoint: "/api/homework/submit",
      body: { homeworkId: "hw-6", answers: ["answer"] },
    });

    expect(result.status).toBe("queued");
    expect((result as any).clientSubmissionId).toBeDefined();

    const { getQueue } = await import("@/lib/offline-queue");
    expect(await getQueue()).toHaveLength(1);
  });
});

// ── flushSubmissionQueue — tests 8-10 ────────────────────────────────────────

describe("flushSubmissionQueue", () => {
  async function seedQueue(count = 1) {
    const { enqueueOfflineRequest } = await import("@/lib/offline-queue");
    for (let i = 0; i < count; i++) {
      await enqueueOfflineRequest({
        type: "assignment-submission",
        endpoint: "/api/homework/submit",
        payload: { homeworkId: `hw-flush-${i}`, answers: [] },
        dedupeKey: `hw-flush-${i}`,
      });
    }
  }

  it("8. removes successfully-flushed actions", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    );

    await seedQueue(2);
    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const result = await flushSubmissionQueue();

    expect(result.flushed).toBe(2);
    expect(result.failed).toBe(0);

    const { getQueue } = await import("@/lib/offline-queue");
    expect(await getQueue()).toHaveLength(0);
  });

  it("9. retains 4xx action as a terminal failure for inspection", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({}) })
    );

    const { enqueueOfflineRequest, getQueue } = await import("@/lib/offline-queue");
    await enqueueOfflineRequest({
      type: "assignment-submission",
      endpoint: "/api/homework/submit",
      payload: { homeworkId: "hw-dead", answers: [] },
      dedupeKey: "hw-dead",
    });

    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const result = await flushSubmissionQueue();

    // Client rejection is retained so learner work and the failure reason are inspectable.
    expect(result.flushed).toBe(0);
    expect(result.failed).toBe(1);
    const retained = await getQueue();
    expect(retained).toHaveLength(1);
    expect(retained[0].status).toBe("failed");
    expect(retained[0].syncState).toBe("TERMINAL_FAILURE");
  });

  it("10. stops processing remaining items on network error (loop break)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("net::ERR_CONNECTION_RESET"));
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", mockFetch);

    await seedQueue(3);

    const { flushSubmissionQueue } = await import("@/lib/offline/flushQueue");
    const result = await flushSubmissionQueue();

    // First item throws → loop breaks → only 1 failed, 2 untouched
    expect(result.flushed).toBe(0);
    expect(result.failed).toBe(1);
    // fetch was only called once — proves the loop stopped after the first error
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // All 3 remain in the queue (network error = retry later, not discard)
    const { getQueue } = await import("@/lib/offline-queue");
    expect(await getQueue()).toHaveLength(3);
  });
});

// ── Server idempotency — test 11 ──────────────────────────────────────────────

describe("Server idempotency", () => {
  it("11. same clientSubmissionId twice → returns existing record, no second DB write", async () => {
    const existingSubmission = {
      id: "sub-existing",
      homeworkId: "hw-idem",
      studentId: "student-1",
      answers: ["original answer"],
      clientSubmissionId: "uuid-idempotent-123",
      submittedAt: new Date(),
      aiFeedback: null,
      aiScore: null,
      teacherNotes: null,
      teacherScore: null,
      aiReviewed: false,
    };

    const homeworkWithEnrollment = {
      id: "hw-idem",
      title: "Test HW",
      Class: {
        schoolId: "school-1",
        enrollments: [{ studentId: "student-1" }],
      },
    };

    const makeReq = (body: object) =>
      new NextRequest("http://localhost/api/homework/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    const { POST } = await import("@/app/api/homework/submit/route");

    const body = {
      homeworkId: "hw-idem",
      answers: ["original answer"],
      clientSubmissionId: "uuid-idempotent-123",
    };

    // ── First POST — no existing record → upsert creates it ──────────────────
    mockRequireTenant.mockResolvedValueOnce({ schoolId: "school-1" });
    mockRequireRole.mockResolvedValueOnce({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindFirst.mockResolvedValueOnce({ id: "student-1", userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null); // clientSubmissionId not seen before
    mockHomeworkFindFirst.mockResolvedValueOnce(homeworkWithEnrollment);
    mockUpsert.mockResolvedValueOnce(existingSubmission);

    const res1 = await POST(makeReq(body));
    expect(res1.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    // ── Second POST — same clientSubmissionId → short-circuit, no second write ──
    mockRequireTenant.mockResolvedValueOnce({ schoolId: "school-1" });
    mockRequireRole.mockResolvedValueOnce({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindFirst.mockResolvedValueOnce({ id: "student-1", userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(existingSubmission); // already exists

    const res2 = await POST(makeReq(body));
    expect(res2.status).toBe(200);

    const data2 = await res2.json();
    expect(data2.submission.id).toBe("sub-existing");
    // upsert must NOT have been called a second time — idempotency guard short-circuited
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});
