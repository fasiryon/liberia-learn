/**
 * __tests__/offline/offlineAcceptance.test.ts
 *
 * RR-7 Offline Acceptance Harness
 *
 * Tests the in-memory offline queue (lib/offline/offlineQueue.ts) against
 * the 8 acceptance scenarios defined in the RR-7 specification.
 *
 * All 8 scenarios must PASS for the offline capability to be declared
 * production-ready per MOE Gate RR-7.
 *
 * The in-memory queue mirrors the production idb-keyval queue contract:
 * - Idempotent enqueue by opType + scheduledWorkId
 * - Exponential backoff (BASE=5s, MAX=5min, MAX_ATTEMPTS=5)
 * - Conflict-protected items immune to markSyncFailure mutations
 * - FIFO ordering via createdAt sort in getReadyQueue
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearQueue,
  enqueue,
  getQueue,
  getQueueStats,
  getReadyQueue,
  markSyncConflict,
  markSyncFailure,
  markSyncSuccess,
  retryConflicts,
} from "@/lib/offline/offlineQueue";

describe("RR-7 Offline Acceptance Harness", () => {
  beforeEach(() => {
    clearQueue();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Scenario 1 ───────────────────────────────────────────────────────────

  it("Scenario 1: lesson completion is queued offline with pending status", () => {
    const item = enqueue("lesson.completed", "sw-101", {
      completedAt: "2026-03-01T08:00:00.000Z",
      studentId: "student-1",
    });

    expect(item.opType).toBe("lesson.completed");
    expect(item.scheduledWorkId).toBe("sw-101");
    expect(item.status).toBe("pending");
    expect(item.attempts).toBe(0);
    expect(item.nextRetryAt).toBeNull();
    expect(item.payload.studentId).toBe("student-1");

    const queue = getQueue();
    expect(queue).toHaveLength(1);
  });

  // ─── Scenario 2 ───────────────────────────────────────────────────────────

  it("Scenario 2: lab session update is queued offline with pending status", () => {
    const item = enqueue("lab.session.update", "lab-session-42", {
      labId: "lab-chemistry-1",
      progressData: { step: 3, answers: { q1: "NaCl" } },
      updatedAt: "2026-03-01T08:00:00.000Z",
    });

    expect(item.opType).toBe("lab.session.update");
    expect(item.scheduledWorkId).toBe("lab-session-42");
    expect(item.status).toBe("pending");
    expect((item.payload.progressData as any).step).toBe(3);

    const queue = getQueue();
    expect(queue).toHaveLength(1);
  });

  // ─── Scenario 3 ───────────────────────────────────────────────────────────

  it("Scenario 3: lesson delivery is queued offline with pending status", () => {
    const item = enqueue("lesson.delivered", "sw-202", {
      deliveredAt: "2026-03-01T08:00:00.000Z",
      teacherId: "teacher-5",
      classFormat: "full_class",
    });

    expect(item.opType).toBe("lesson.delivered");
    expect(item.scheduledWorkId).toBe("sw-202");
    expect(item.status).toBe("pending");
    expect(item.payload.classFormat).toBe("full_class");

    const ready = getReadyQueue();
    expect(ready).toHaveLength(1);
  });

  // ─── Scenario 4 ───────────────────────────────────────────────────────────

  it("Scenario 4: multiple queued items drain in FIFO (createdAt) order", () => {
    enqueue("lesson.completed", "sw-1", { completedAt: "2026-03-01T08:00:00.000Z" });

    vi.setSystemTime(new Date("2026-03-01T08:00:01.000Z"));
    enqueue("lesson.completed", "sw-2", { completedAt: "2026-03-01T08:00:01.000Z" });

    vi.setSystemTime(new Date("2026-03-01T08:00:02.000Z"));
    enqueue("lesson.completed", "sw-3", { completedAt: "2026-03-01T08:00:02.000Z" });

    const ready = getReadyQueue();
    expect(ready).toHaveLength(3);
    expect(ready[0].scheduledWorkId).toBe("sw-1");
    expect(ready[1].scheduledWorkId).toBe("sw-2");
    expect(ready[2].scheduledWorkId).toBe("sw-3");
  });

  // ─── Scenario 5 ───────────────────────────────────────────────────────────

  it("Scenario 5: re-enqueuing same opType + scheduledWorkId is idempotent (no duplicate, payload updated)", () => {
    enqueue("lesson.completed", "sw-101", { completedAt: "2026-03-01T07:55:00.000Z" });
    enqueue("lesson.completed", "sw-101", { completedAt: "2026-03-01T08:00:00.000Z" });

    const queue = getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.completedAt).toBe("2026-03-01T08:00:00.000Z");
  });

  // ─── Scenario 6 ───────────────────────────────────────────────────────────

  it("Scenario 6: successful sync removes item from queue", () => {
    const item = enqueue("lesson.completed", "sw-101", {
      completedAt: "2026-03-01T08:00:00.000Z",
    });

    expect(getQueue()).toHaveLength(1);

    markSyncSuccess([item.id]);

    expect(getQueue()).toHaveLength(0);
    expect(getReadyQueue()).toHaveLength(0);
    expect(getQueueStats().total).toBe(0);
  });

  // ─── Scenario 7 ───────────────────────────────────────────────────────────

  it("Scenario 7: item becomes dead-letter after max failures and is excluded from ready queue", () => {
    const item = enqueue("lesson.completed", "sw-dead", {
      completedAt: "2026-03-01T08:00:00.000Z",
    });

    // Exhaust all 5 attempts — markSyncFailure operates directly on the item by id
    for (let i = 0; i < 5; i++) {
      markSyncFailure([item.id], "network_error");
    }

    const queue = getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("failed");

    // Dead-letter items are excluded from the ready queue
    expect(getReadyQueue()).toHaveLength(0);

    const stats = getQueueStats();
    expect(stats.deadLetter).toBe(1);
    expect(stats.pending).toBe(0);
  });

  // ─── Scenario 8 ───────────────────────────────────────────────────────────

  it("Scenario 8: conflict detected → excluded from ready queue; retryConflicts resets to pending", () => {
    const item = enqueue("lesson.completed", "sw-conflict", {
      completedAt: "2026-03-01T08:00:00.000Z",
    });

    markSyncConflict([
      {
        id: item.id,
        serverState: { completedAt: "2026-03-01T07:58:00.000Z" },
        clientState: { completedAt: "2026-03-01T08:00:00.000Z" },
        resolutionHint: "student_progress_last_write_wins_by_timestamp",
      },
    ]);

    // Conflict item is excluded from the ready queue
    expect(getReadyQueue()).toHaveLength(0);
    expect(getQueueStats().conflicts).toBe(1);

    const conflicted = getQueue()[0];
    expect(conflicted.status).toBe("conflict");
    expect(conflicted.conflict).not.toBeNull();

    // Manual retry resets the item to pending and back into the ready queue
    retryConflicts([item.id]);

    expect(getReadyQueue()).toHaveLength(1);
    expect(getQueue()[0].status).toBe("pending");
    expect(getQueue()[0].conflict).toBeNull();
  });
});
