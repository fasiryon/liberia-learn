import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ audit: vi.fn(), deleteChunks: vi.fn(), provider: vi.fn(), deletionAvailable: true }));
vi.mock("@/lib/db", () => ({ prisma: { get ragChunk() { return h.deletionAvailable ? { deleteMany: h.deleteChunks } : undefined; } } }));
vi.mock("@/lib/audit", () => ({ logAuditRequired: h.audit }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedEmbedding: h.provider }));
vi.mock("@/lib/ai/rag/embeddingService", () => ({ getCurriculumBody: vi.fn(), getLessonEmbeddingSource: vi.fn(), toVectorLiteral: vi.fn() }));
// Keep the actual ragIngestionService delete helper. Its database failure path
// is the review concern; replacing that helper would conceal it.
import { deferLessonEmbedding } from "@/lib/ai/rag/embeddingDeferral";

describe("R3 independent review: required stale-chunk removal", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
    h.deletionAvailable = true;
    h.audit.mockResolvedValue(undefined);
  });
  afterAll(() => vi.unstubAllGlobals());
  it("refuses successful deferral if the actual chunk deletion fails", async () => {
    h.deleteChunks.mockRejectedValue(Error("Synthetic SQL deletion refused"));
    await expect(deferLessonEmbedding({ lessonId: "synthetic-row", contentId: "synthetic-content", source: "admin.curriculum.approve", removeStaleChunks: true })).rejects.toThrow();
    expect(h.audit).not.toHaveBeenCalled(); expect(h.provider).not.toHaveBeenCalled();
  });
  it("control: confirmed deletion records its actual count without a provider call", async () => {
    h.deleteChunks.mockResolvedValue({ count: 2 });
    await deferLessonEmbedding({ lessonId: "synthetic-row", contentId: "synthetic-content", source: "admin.curriculum.approve", removeStaleChunks: true });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ staleChunksRemoved: 2, status: "DEFERRED" }) }));
    expect(h.provider).not.toHaveBeenCalled();
  });
  it("missing deletion capability refuses a successful cleanup audit", async () => {
    h.deletionAvailable = false;
    await expect(deferLessonEmbedding({ lessonId: "synthetic-row", contentId: "synthetic-content", source: "admin.curriculum.approve", removeStaleChunks: true })).rejects.toThrow();
    expect(h.audit).not.toHaveBeenCalled(); expect(h.provider).not.toHaveBeenCalled();
  });
  it("control: confirmed zero-row deletion is a valid cleanup result", async () => {
    h.deleteChunks.mockResolvedValue({ count: 0 });
    await deferLessonEmbedding({ lessonId: "synthetic-row", contentId: "synthetic-content", source: "admin.curriculum.approve", removeStaleChunks: true });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ staleChunksRemoved: 0 }) }));
  });
});
