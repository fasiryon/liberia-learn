import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLessonAudioIntegrity } from "@/lib/audio/lessonAudioIntegrity";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockIsQueueConfigured = vi.hoisted(() => vi.fn());
const mockLogAIInteraction = vi.hoisted(() => vi.fn());
const mockUploadBinaryToSupabase = vi.hoisted(() => vi.fn());
const mockSpeechCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    lessonAudio: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      update: mockUpdate,
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

vi.mock("@/lib/supabaseStorage", () => ({
  uploadBinaryToSupabase: mockUploadBinaryToSupabase,
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return { audio: { speech: { create: mockSpeechCreate } } };
  }),
}));

describe("lesson audio generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsQueueConfigured.mockReturnValue(true);
    mockUpsert.mockImplementation(async (args) => ({ id: "audio-1", ...args.create, ...args.update }));
    mockUploadBinaryToSupabase.mockImplementation(async (input) => `https://supabase.example/storage/v1/object/public/${input.bucket}/${input.path}`);
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => Buffer.from("mp3").buffer,
    });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  it("reuses generated audio for the current version", async () => {
    const { queueLessonAudioGeneration } = await import("@/lib/lessons/audioGeneration");
    mockFindUnique.mockResolvedValueOnce({
      id: "audio-1",
      status: "GENERATED",
      audioParts: [{
        partNumber: 1,
        status: "GENERATED",
        charLength: "Full lesson text".length,
        ...buildLessonAudioIntegrity({ sourceText: "Full lesson text", audio: Buffer.from("mp3") }),
      }],
    });
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

  it("processes pending audio from learner-safe projected text", async () => {
    mockFindMany.mockResolvedValueOnce([{
      id: "audio-1",
      lessonId: "lesson-1",
      contentVersion: "v1",
      voice: "alloy",
      lesson: {
        contentId: "lesson-1",
        version: "v1",
        grade: 5,
        subject: "ENGLISH",
        payload: {
          body_standard: "## Teacher Guidance\nSECRET ANSWER",
          studentMaterials: {
            learnerMaterial: "Read the learner passage aloud.",
            guidedItems: ["Underline the key sentence."],
            independentItems: ["Write one response."],
            masteryTask: "Explain your evidence.",
          },
        },
      },
    }]);
    mockUpdate.mockResolvedValue({});
    mockFindUnique.mockResolvedValueOnce(null);
    const { processPendingLessonAudio } = await import("@/lib/lessons/audioGeneration");
    const result = await processPendingLessonAudio(1);

    expect(result[0]).toMatchObject({ lessonId: "lesson-1", status: "GENERATED" });
    expect(mockSpeechCreate).toHaveBeenCalled();
    const narration = mockSpeechCreate.mock.calls[0][0].input as string;
    expect(narration).toContain("Read the learner passage aloud.");
    expect(narration).not.toContain("SECRET ANSWER");
  });

  it("generates long lesson audio as multiple parts under 3500 characters", async () => {
    const { generateLessonAudioNow } = await import("@/lib/lessons/audioGeneration");
    mockFindUnique.mockResolvedValueOnce({ audioParts: [] });
    const text = `${"Sentence one has clear narration. ".repeat(120)}\n\n${"Sentence two continues the lesson. ".repeat(120)}`;

    const result = await generateLessonAudioNow({
      lessonId: "long-literacy-lesson",
      contentVersion: "v1",
      text,
      grade: 5,
      subject: "LITERACY",
    });

    const inputs = mockSpeechCreate.mock.calls.map((call) => call[0].input);
    expect(inputs.length).toBeGreaterThan(1);
    expect(inputs.every((input: string) => input.length <= 3500)).toBe(true);
    expect(mockUploadBinaryToSupabase).toHaveBeenCalledWith(expect.objectContaining({
      bucket: "lesson-audio",
      path: expect.stringContaining("grade-5/literacy/long-literacy-lesson/part-1.mp3"),
    }));
    expect(mockUpsert).toHaveBeenLastCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        status: "GENERATED",
        audioParts: expect.arrayContaining([
          expect.objectContaining({ partNumber: 1, status: "GENERATED" }),
        ]),
      }),
    }));
    expect(result.status).toBe("GENERATED");
  });
});
