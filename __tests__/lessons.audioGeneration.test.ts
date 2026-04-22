import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockIsQueueConfigured = vi.hoisted(() => vi.fn());
const mockLogAIInteraction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    lessonAudio: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      upsert: mockUpsert,
    },
  },
}));

vi.mock("@/lib/queue", () => ({
  JobType: { GENERATE_LESSON_AUDIO: "GENERATE_LESSON_AUDIO" },
  enqueueJob: mockEnqueueJob,
  isQueueConfigured: mockIsQueueConfigured,
}));

vi.mock("@/lib/ai/interactionLog", () => ({
  logAIInteraction: mockLogAIInteraction,
}));

describe("lesson audio generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsQueueConfigured.mockReturnValue(true);
    mockUpsert.mockImplementation(async (args) => ({ id: "audio-1", ...args.create, ...args.update }));
  });

  it("reuses generated audio for the current version", async () => {
    const { queueLessonAudioGeneration } = await import("@/lib/lessons/audioGeneration");
    mockFindUnique.mockResolvedValueOnce({ id: "audio-1", status: "GENERATED" });
    const result = await queueLessonAudioGeneration({
      lessonId: "lesson-1",
      contentVersion: "v1",
      text: "Full lesson text",
    });
    expect(result.id).toBe("audio-1");
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("uses async queue path instead of blocking inline generation", async () => {
    const { queueLessonAudioGeneration } = await import("@/lib/lessons/audioGeneration");
    mockFindUnique.mockResolvedValueOnce(null);
    await queueLessonAudioGeneration({
      lessonId: "lesson-1",
      contentVersion: "v1",
      text: "Full lesson text",
    });
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: "PENDING" }),
    }));
    expect(mockEnqueueJob).toHaveBeenCalledWith("GENERATE_LESSON_AUDIO", expect.objectContaining({
      lessonId: "lesson-1",
      contentVersion: "v1",
    }));
  });

  it("logs estimated cost", async () => {
    const { queueLessonAudioGeneration } = await import("@/lib/lessons/audioGeneration");
    mockFindUnique.mockResolvedValueOnce(null);
    await queueLessonAudioGeneration({
      lessonId: "lesson-1",
      contentVersion: "v1",
      text: "a".repeat(1000),
    });
    expect(mockLogAIInteraction).toHaveBeenCalledWith(expect.objectContaining({
      requestType: "tts_generation_queued",
      estimatedCostUSD: expect.any(Number),
    }));
  });

  it("reports stale generated audio when content version changes", async () => {
    const { getCurrentLessonAudio } = await import("@/lib/lessons/audioGeneration");
    mockFindFirst.mockResolvedValueOnce({ id: "audio-1", contentVersion: "old", status: "GENERATED" });
    const result = await getCurrentLessonAudio("lesson-1", "new");
    expect(result.status).toBe("STALE");
  });
});
