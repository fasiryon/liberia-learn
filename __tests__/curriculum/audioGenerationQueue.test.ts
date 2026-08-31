import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLessonAudioIntegrity } from "@/lib/audio/lessonAudioIntegrity";

const mockCurriculumFindMany = vi.hoisted(() => vi.fn());
const mockAudioFindMany = vi.hoisted(() => vi.fn());
const mockAudioFindUnique = vi.hoisted(() => vi.fn());
const mockAudioUpsert = vi.hoisted(() => vi.fn());
const mockAudioUpdate = vi.hoisted(() => vi.fn());
const mockAudioUpdateMany = vi.hoisted(() => vi.fn());
const mockAudioCount = vi.hoisted(() => vi.fn());
const mockAudioFindFirst = vi.hoisted(() => vi.fn());
const mockAudioAggregate = vi.hoisted(() => vi.fn());
const mockGenerateLessonAudioNow = vi.hoisted(() => vi.fn());
const mockEstimateTtsCostUsd = vi.hoisted(() => vi.fn());
const mockIsTtsGenerationStopped = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: { findMany: mockCurriculumFindMany },
    lessonAudio: {
      findMany: mockAudioFindMany,
      findUnique: mockAudioFindUnique,
      upsert: mockAudioUpsert,
      update: mockAudioUpdate,
      updateMany: mockAudioUpdateMany,
      count: mockAudioCount,
      findFirst: mockAudioFindFirst,
      aggregate: mockAudioAggregate,
    },
  },
}));

vi.mock("@/lib/lessons/audioGeneration", () => ({
  DEFAULT_TTS_VOICE: "alloy",
  estimateTtsCostUsd: mockEstimateTtsCostUsd,
  generateLessonAudioNow: mockGenerateLessonAudioNow,
}));

vi.mock("@/lib/serverFlags", () => ({
  isTtsGenerationStopped: mockIsTtsGenerationStopped,
}));

function approvedLesson(overrides: Record<string, unknown> = {}) {
  return {
    contentId: "english-g5-u1-l1",
    version: "v1",
    payload: {
      body_standard: "Grade 5 English lesson body.",
      audioScriptSpecs: [{ script: "Listen to this narration.", durationTargetSeconds: 30 }],
    },
    audioAssets: [],
    ...overrides,
  };
}

describe("audioGenerationQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEstimateTtsCostUsd.mockReturnValue(0.000015);
    mockAudioUpsert.mockResolvedValue({ id: "audio-1", status: "PENDING" });
    mockAudioUpdate.mockResolvedValue({});
    mockAudioUpdateMany.mockResolvedValue({ count: 1 });
    mockIsTtsGenerationStopped.mockReturnValue(false);
  });

  describe("enqueueLessonAudio", () => {
    it("creates PENDING rows for approved lessons with text", async () => {
      mockCurriculumFindMany.mockResolvedValueOnce([approvedLesson()]);
      const { enqueueLessonAudio } = await import("@/lib/audio/audioGenerationQueue");

      const result = await enqueueLessonAudio({ grade: 5, subject: "ENGLISH" });

      expect(result).toMatchObject({ queued: 1, skipped: 0, total: 1 });
      expect(mockAudioUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { lessonId_contentVersion_voice: { lessonId: "english-g5-u1-l1", contentVersion: "v1", voice: "alloy" } },
          update: { status: "PENDING", estimatedCostUsd: 0.000015 },
          create: expect.objectContaining({ status: "PENDING", voice: "alloy" }),
        })
      );
    });

    it("skips lessons that already have a GENERATED audio for the current version", async () => {
      mockCurriculumFindMany.mockResolvedValueOnce([
        approvedLesson({
          audioAssets: [{
            status: "GENERATED",
            contentVersion: "v1",
            audioParts: [{
              partNumber: 1,
              status: "GENERATED",
              charLength: "Grade 5 English lesson body.".length,
              ...buildLessonAudioIntegrity({
                sourceText: "Grade 5 English lesson body.",
                audio: Buffer.from("mp3"),
              }),
            }],
          }],
        }),
      ]);
      const { enqueueLessonAudio } = await import("@/lib/audio/audioGenerationQueue");

      const result = await enqueueLessonAudio({ grade: 5, subject: "ENGLISH" });

      expect(result).toMatchObject({ queued: 0, skipped: 1, total: 1 });
      expect(mockAudioUpsert).not.toHaveBeenCalled();
    });

    it("skips lessons with no readable text", async () => {
      mockCurriculumFindMany.mockResolvedValueOnce([
        approvedLesson({ payload: { body: "" } }),
      ]);
      const { enqueueLessonAudio } = await import("@/lib/audio/audioGenerationQueue");

      const result = await enqueueLessonAudio({ grade: 5, subject: "ENGLISH" });

      expect(result).toMatchObject({ queued: 0, skipped: 1, total: 1 });
    });

    it("normalises subject to uppercase before querying", async () => {
      mockCurriculumFindMany.mockResolvedValueOnce([]);
      const { enqueueLessonAudio } = await import("@/lib/audio/audioGenerationQueue");

      await enqueueLessonAudio({ grade: 5, subject: "english" });

      expect(mockCurriculumFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subject: "ENGLISH" }),
        })
      );
    });
  });

  describe("claimNextAudioJobs", () => {
    it("marks PENDING rows as PROCESSING and returns them", async () => {
      const pendingJobs = [
        { id: "audio-1", lessonId: "lesson-1", voice: "alloy", contentVersion: "v1" },
        { id: "audio-2", lessonId: "lesson-2", voice: "alloy", contentVersion: "v1" },
      ];
      mockAudioFindMany.mockResolvedValueOnce(pendingJobs);
      // Each job is claimed individually (optimistic lock per row)
      mockAudioUpdateMany.mockResolvedValue({ count: 1 });
      const { claimNextAudioJobs } = await import("@/lib/audio/audioGenerationQueue");

      const result = await claimNextAudioJobs({ limit: 5 });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "audio-1", lessonId: "lesson-1" });
      expect(mockAudioUpdateMany).toHaveBeenCalledTimes(2);
      expect(mockAudioUpdateMany).toHaveBeenCalledWith({
        where: { id: "audio-1", status: "PENDING" },
        data: expect.objectContaining({ status: "PROCESSING" }),
      });
      expect(mockAudioUpdateMany).toHaveBeenCalledWith({
        where: { id: "audio-2", status: "PENDING" },
        data: expect.objectContaining({ status: "PROCESSING" }),
      });
    });

    it("returns empty array when no PENDING jobs exist", async () => {
      mockAudioFindMany.mockResolvedValueOnce([]);
      const { claimNextAudioJobs } = await import("@/lib/audio/audioGenerationQueue");

      const result = await claimNextAudioJobs({ limit: 3 });

      expect(result).toHaveLength(0);
      expect(mockAudioUpdateMany).not.toHaveBeenCalled();
    });

    it("caps batch at MAX_BATCH_SIZE (5)", async () => {
      mockAudioFindMany.mockResolvedValueOnce([]);
      const { claimNextAudioJobs } = await import("@/lib/audio/audioGenerationQueue");

      await claimNextAudioJobs({ limit: 999 });

      expect(mockAudioFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe("processAudioJob", () => {
    it("calls generateLessonAudioNow and returns GENERATED with storageUrl", async () => {
      mockAudioFindUnique.mockResolvedValueOnce({
        id: "audio-1",
        lessonId: "lesson-1",
        voice: "alloy",
        contentVersion: "v1",
        lesson: {
          contentId: "lesson-1",
          version: "v1",
          grade: 5,
          subject: "ENGLISH",
          payload: { body_standard: "Lesson text here." },
        },
      });
      mockGenerateLessonAudioNow.mockResolvedValueOnce({
        storageUrl: "https://supabase.example/storage/v1/object/public/lesson-audio/lesson-1/v1.mp3",
      });
      const { processAudioJob } = await import("@/lib/audio/audioGenerationQueue");

      const result = await processAudioJob("audio-1");

      expect(result).toMatchObject({ jobId: "audio-1", lessonId: "lesson-1", status: "GENERATED" });
      expect(mockGenerateLessonAudioNow).toHaveBeenCalledWith(
        expect.objectContaining({ lessonId: "lesson-1", voice: "alloy", text: "Lesson text here." })
      );
      expect(mockGenerateLessonAudioNow).toHaveBeenCalledWith(
        expect.objectContaining({ grade: 5, subject: "ENGLISH" })
      );
    });

    it("marks the row FAILED when TTS throws", async () => {
      mockAudioFindUnique.mockResolvedValueOnce({
        id: "audio-1",
        lessonId: "lesson-1",
        voice: "alloy",
        contentVersion: "v1",
        lesson: { contentId: "lesson-1", version: "v1", payload: { body: "Some text." } },
      });
      mockGenerateLessonAudioNow.mockRejectedValueOnce(new Error("OpenAI TTS unavailable"));
      const { processAudioJob } = await import("@/lib/audio/audioGenerationQueue");

      const result = await processAudioJob("audio-1");

      expect(result).toMatchObject({ status: "FAILED", error: "OpenAI TTS unavailable" });
      expect(mockAudioUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "FAILED" } })
      );
    });

    it("marks FAILED when job has no readable text", async () => {
      mockAudioFindUnique.mockResolvedValueOnce({
        id: "audio-1",
        lessonId: "lesson-1",
        voice: "alloy",
        contentVersion: "v1",
        lesson: { contentId: "lesson-1", version: "v1", payload: { body: "" } },
      });
      const { processAudioJob } = await import("@/lib/audio/audioGenerationQueue");

      const result = await processAudioJob("audio-1");

      expect(result).toMatchObject({ status: "FAILED", error: "Lesson has no readable text." });
      expect(mockGenerateLessonAudioNow).not.toHaveBeenCalled();
    });

    it("narrates the learner projection rather than teacher-only payload text", async () => {
      mockAudioFindUnique.mockResolvedValueOnce({
        id: "audio-1",
        lessonId: "lesson-1",
        voice: "alloy",
        contentVersion: "v1",
        lesson: {
          contentId: "lesson-1",
          version: "v1",
          grade: 5,
          subject: "ENGLISH",
          payload: {
            body_standard: "## Teacher Guidance\nSECRET ANSWER AND TEACHER SCRIPT",
            studentMaterials: {
              learnerMaterial: "Read the passage and cite two details.",
              guidedItems: ["Underline the supporting details."],
              independentItems: ["Write the central idea."],
              masteryTask: "Explain your evidence.",
            },
          },
        },
      });
      mockGenerateLessonAudioNow.mockResolvedValueOnce({ storageUrl: "audio.mp3" });
      const { processAudioJob } = await import("@/lib/audio/audioGenerationQueue");

      await processAudioJob("audio-1");

      expect(mockGenerateLessonAudioNow).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining("Read the passage and cite two details."),
      }));
      expect(mockGenerateLessonAudioNow.mock.calls[0][0].text).not.toContain("SECRET ANSWER");
    });

    it("does not generate a queued job after the lesson version changes", async () => {
      mockAudioFindUnique.mockResolvedValueOnce({
        id: "audio-1",
        lessonId: "lesson-1",
        voice: "alloy",
        contentVersion: "v1",
        audioParts: [],
        lesson: {
          contentId: "lesson-1",
          version: "v2",
          grade: 5,
          subject: "ENGLISH",
          payload: { body: "Current learner text." },
        },
      });
      const { processAudioJob } = await import("@/lib/audio/audioGenerationQueue");

      const result = await processAudioJob("audio-1");

      expect(result).toMatchObject({ status: "STALE", lessonId: "lesson-1" });
      expect(mockGenerateLessonAudioNow).not.toHaveBeenCalled();
      expect(mockAudioUpdate).toHaveBeenCalledWith({ where: { id: "audio-1" }, data: { status: "STALE" } });
    });

    it("returns FAILED when job id does not exist", async () => {
      mockAudioFindUnique.mockResolvedValueOnce(null);
      const { processAudioJob } = await import("@/lib/audio/audioGenerationQueue");

      const result = await processAudioJob("nonexistent");

      expect(result).toMatchObject({ status: "FAILED", error: "Job not found." });
    });
  });

  describe("retryFailedJobs", () => {
    it("resets FAILED rows to PENDING", async () => {
      mockAudioFindMany.mockResolvedValueOnce([{ id: "audio-1" }, { id: "audio-2" }]);
      const { retryFailedJobs } = await import("@/lib/audio/audioGenerationQueue");

      const result = await retryFailedJobs();

      expect(result).toMatchObject({ retried: 2 });
      expect(mockAudioUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ["audio-1", "audio-2"] } },
        data: { status: "PENDING" },
      });
    });

    it("returns zero when no FAILED rows exist", async () => {
      mockAudioFindMany.mockResolvedValueOnce([]);
      const { retryFailedJobs } = await import("@/lib/audio/audioGenerationQueue");

      const result = await retryFailedJobs();

      expect(result).toMatchObject({ retried: 0 });
      expect(mockAudioUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("getAudioQueueStatus", () => {
    it("returns counts and cost summary", async () => {
      mockAudioCount
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(2)  // processing
        .mockResolvedValueOnce(45) // generated
        .mockResolvedValueOnce(3); // failed
      mockAudioFindFirst.mockResolvedValueOnce({ generatedAt: new Date("2026-04-29T10:00:00Z") });
      mockAudioAggregate.mockResolvedValueOnce({ _sum: { estimatedCostUsd: 0.123456 } });

      const { getAudioQueueStatus } = await import("@/lib/audio/audioGenerationQueue");
      const result = await getAudioQueueStatus({ grade: 5, subject: "ENGLISH" });

      expect(result).toMatchObject({
        pending: 10,
        processing: 2,
        generated: 45,
        failed: 3,
        lastProcessed: "2026-04-29T10:00:00.000Z",
        totalCostUsd: 0.123456,
      });
    });
  });

  describe("stop flag", () => {
    it("claimNextAudioJobs returns empty array when TTS_STOP_GENERATION is active", async () => {
      mockIsTtsGenerationStopped.mockReturnValue(true);
      const { claimNextAudioJobs } = await import("@/lib/audio/audioGenerationQueue");
      const result = await claimNextAudioJobs({ limit: 5 });
      expect(result).toHaveLength(0);
      expect(mockAudioFindMany).not.toHaveBeenCalled();
    });

    it("claimNextAudioJobs proceeds normally when stop flag is inactive", async () => {
      mockIsTtsGenerationStopped.mockReturnValue(false);
      mockAudioFindMany.mockResolvedValueOnce([]);
      const { claimNextAudioJobs } = await import("@/lib/audio/audioGenerationQueue");
      await claimNextAudioJobs({ limit: 5 });
      expect(mockAudioFindMany).toHaveBeenCalled();
    });
  });
});
