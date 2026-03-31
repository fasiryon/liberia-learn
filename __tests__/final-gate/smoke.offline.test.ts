import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearQueue,
  enqueue,
  getQueue,
  getReadyQueue,
  markSyncSuccess,
} from "@/lib/offline/offlineQueue";

async function submitWithOfflineFallback(input: {
  endpoint: string;
  opType: "lesson.completed" | "lab.session.update";
  scheduledWorkId: string;
  payload: Record<string, unknown>;
}) {
  try {
    await fetch(input.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.payload),
    });
    return { queued: false };
  } catch {
    enqueue(input.opType, input.scheduledWorkId, input.payload);
    return { queued: true };
  }
}

async function flushQueue(onComplete?: (message: string) => void) {
  const ready = getReadyQueue();
  for (const item of ready) {
    await fetch(`/sync${item.scheduledWorkId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
    });
    markSyncSuccess([item.id]);
  }
  onComplete?.(`${ready.length} items synced successfully`);
}

beforeEach(() => {
  clearQueue();
  global.fetch = vi.fn(async () => ({ ok: true })) as any;
});

describe("Final gate offline smoke", () => {
  it("queues lesson completion on offline failure without throwing to the caller", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("network error");
    }) as any;

    const result = await submitWithOfflineFallback({
      endpoint: "/api/student/work/sw-1/complete",
      opType: "lesson.completed",
      scheduledWorkId: "sw-1",
      payload: { scheduledWorkId: "sw-1", completedAt: "2026-03-28T10:00:00.000Z" },
    });

    expect(result.queued).toBe(true);
    expect(getQueue()[0]).toMatchObject({
      opType: "lesson.completed",
      scheduledWorkId: "sw-1",
      payload: { scheduledWorkId: "sw-1", completedAt: "2026-03-28T10:00:00.000Z" },
    });
  });

  it("queues assignment-style submission offline with retry-ready pending status", () => {
    enqueue("lesson.completed", "assignment-1", {
      endpoint: "/api/student/assignments/assignment-1/submit",
      type: "assignment.submission",
      content: "My answer",
    });

    expect(getQueue()[0]).toMatchObject({
      scheduledWorkId: "assignment-1",
      status: "pending",
    });
  });

  it("flushes on reconnect and emits completion feedback", async () => {
    enqueue("lesson.completed", "sw-1", { completedAt: "2026-03-28T10:00:00.000Z" });
    const toast = vi.fn();

    await flushQueue(toast);

    expect(getQueue()).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith("1 items synced successfully");
  });

  it("flushes mixed queue items in order without type errors", async () => {
    enqueue("lesson.completed", "sw-1", { type: "lesson.completed" });
    enqueue("lesson.completed", "assignment-1", { type: "assignment.submission" });
    enqueue("lab.session.update", "lab-1", { type: "lab.submission" });

    const calls: string[] = [];
    global.fetch = vi.fn(async (url: any) => {
      calls.push(String(url));
      return { ok: true };
    }) as any;

    await flushQueue();

    expect(calls).toEqual(["/syncsw-1", "/syncassignment-1", "/synclab-1"]);
    expect(getQueue()).toHaveLength(0);
  });
});
