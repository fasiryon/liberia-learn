// Founder decision 2026-11-13 (AWS suspension): DEFER embeddings when the queue rejects them.
// The deferral is durable (required audit), visible to administrators (audit log), makes no provider call,
// never schedules a replay, and removes stale retrieval chunks only when asked.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ auditRequired: vi.fn(), deleteChunks: vi.fn(), routedEmbedding: vi.fn(), enqueue: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAuditRequired: h.auditRequired }));
vi.mock("@/lib/ai/rag/ragIngestionService", () => ({ deleteCurriculumContentRagChunks: h.deleteChunks }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedEmbedding: h.routedEmbedding }));
vi.mock("@/lib/queue", () => ({ enqueueJob: h.enqueue, JobType: { GENERATE_EMBEDDINGS: "GENERATE_EMBEDDINGS" } }));

import { EMBEDDING_DEFERRED_ACTION, deferLessonEmbedding } from "@/lib/ai/rag/embeddingDeferral";

describe("deferLessonEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.auditRequired.mockResolvedValue(undefined);
    h.deleteChunks.mockResolvedValue(2);
  });

  it("records a durable, administrator-visible DEFERRED entry with recovery information", async () => {
    await deferLessonEmbedding({ lessonId: "row-1", contentId: "C-1", actorUserId: "u-1", schoolId: "s-1", source: "admin.curriculum.approve" });
    expect(h.auditRequired).toHaveBeenCalledOnce();
    expect(h.auditRequired).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u-1",
      schoolId: "s-1",
      action: EMBEDDING_DEFERRED_ACTION,
      resourceType: "curriculum_content",
      resourceId: "row-1",
      details: expect.objectContaining({
        status: "DEFERRED",
        contentId: "C-1",
        jobType: "GENERATE_EMBEDDINGS",
        reason: "QUEUE_UNAVAILABLE",
        source: "admin.curriculum.approve",
        replay: "MANUAL_APPROVED_PLAN_ONLY",
      }),
    }));
  });

  it("makes no provider call and schedules no replay", async () => {
    await deferLessonEmbedding({ lessonId: "row-1", contentId: "C-1", source: "teacher.lessons", removeStaleChunks: true });
    expect(h.routedEmbedding).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("removes stale retrieval chunks only when asked, and records how many", async () => {
    await deferLessonEmbedding({ lessonId: "row-1", contentId: "C-1", source: "admin.curriculum.approve", removeStaleChunks: true });
    expect(h.deleteChunks).toHaveBeenCalledWith("row-1");
    expect(h.auditRequired.mock.calls[0][0].details).toMatchObject({ staleChunksRemoved: 2 });

    vi.clearAllMocks(); h.auditRequired.mockResolvedValue(undefined);
    await deferLessonEmbedding({ lessonId: "row-2", contentId: "C-2", source: "teacher.lessons" });
    expect(h.deleteChunks).not.toHaveBeenCalled();
    expect(h.auditRequired.mock.calls[0][0].details).toMatchObject({ staleChunksRemoved: 0 });
  });

  it("fails visibly when the deferral cannot be recorded (never a silent success)", async () => {
    h.auditRequired.mockRejectedValue(new Error("audit store unavailable"));
    await expect(deferLessonEmbedding({ lessonId: "row-1", contentId: "C-1", source: "admin.curriculum.generate" })).rejects.toThrow("audit store unavailable");
  });
});
