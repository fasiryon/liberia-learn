import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUploadLessonAudioToSupabase = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: { findMany: mockFindMany },
    lessonAudio: { update: mockUpdate },
    $disconnect: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseStorage", () => ({
  uploadLessonAudioToSupabase: mockUploadLessonAudioToSupabase,
}));

vi.mock("fs/promises", () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

function pendingLesson(overrides: Record<string, unknown> = {}) {
  return {
    contentId: "english-g5-u1-l1",
    version: "v1",
    payload: {
      body_standard: "This is a readable Grade 5 English lesson body.",
      audioScriptSpecs: [{ script: "Listen to this Grade 5 English narration.", durationTargetSeconds: 42 }],
    },
    audioAssets: [{ id: "audio-1", status: "PENDING", contentVersion: "v1", voice: "alloy", storageUrl: null }],
    ...overrides,
  };
}

describe("processLessonAudioBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("VERCEL_ENV", "");
    mockUpdate.mockImplementation(async (args) => ({ id: args.where.id, ...args.data }));
    mockUploadLessonAudioToSupabase.mockResolvedValue("https://supabase.example/storage/v1/object/public/lesson-audio/grade-5/english/english-g5-u1-l1/alloy.mp3");
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("dry-run performs no writes", async () => {
    mockFindMany.mockResolvedValueOnce([pendingLesson()]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    const result = await processLessonAudioBatch({ grade: 5, subject: "ENGLISH", dryRun: true, limit: 1 });

    expect(result.rows[0]).toMatchObject({ lessonId: "english-g5-u1-l1", status: "DRY_RUN" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("approved run updates a pending row with generated audio URL", async () => {
    mockFindMany.mockResolvedValueOnce([pendingLesson()]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    const result = await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      approved: true,
      limit: 1,
      ttsClient: { generateMp3: vi.fn(async () => Buffer.from("mp3")) },
      storageClient: { upload: vi.fn(async () => "https://cdn.example/audio.mp3") },
    });

    expect(result.rows[0]).toMatchObject({ status: "GENERATED", url: "https://cdn.example/audio.mp3" });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "audio-1" },
      data: expect.objectContaining({ status: "GENERATED", storageUrl: "https://cdn.example/audio.mp3" }),
    }));
  });

  it("uploads to Supabase lesson-audio storage when no test storage is injected", async () => {
    mockFindMany.mockResolvedValueOnce([pendingLesson()]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    const result = await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      approved: true,
      limit: 1,
      ttsClient: { generateMp3: vi.fn(async () => Buffer.from("mp3")) },
    });

    expect(mockUploadLessonAudioToSupabase).toHaveBeenCalledWith({
      grade: 5,
      subject: "ENGLISH",
      contentId: "english-g5-u1-l1",
      voice: "alloy",
      body: Buffer.from("mp3"),
    });
    expect(result.rows[0]).toMatchObject({
      status: "GENERATED",
      url: "https://supabase.example/storage/v1/object/public/lesson-audio/grade-5/english/english-g5-u1-l1/alloy.mp3",
    });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "GENERATED",
        storageUrl: "https://supabase.example/storage/v1/object/public/lesson-audio/grade-5/english/english-g5-u1-l1/alloy.mp3",
      }),
    }));
  });

  it("uses local fallback only when storage env is missing outside production", async () => {
    mockFindMany.mockResolvedValueOnce([pendingLesson()]);
    mockUploadLessonAudioToSupabase.mockRejectedValueOnce(new Error("Supabase storage is not configured"));
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    const result = await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      approved: true,
      limit: 1,
      ttsClient: { generateMp3: vi.fn(async () => Buffer.from("mp3")) },
    });

    expect(result.storage).toContain("local/dev fallback");
    expect(result.rows[0].url).toBe("/generated-audio/english-g5-u1-l1-alloy.mp3");
  });

  it("does not use local fallback when production storage env is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockFindMany.mockResolvedValueOnce([pendingLesson()]);
    mockUploadLessonAudioToSupabase.mockRejectedValueOnce(new Error("Supabase storage is not configured"));
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    const result = await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      approved: true,
      limit: 1,
      ttsClient: { generateMp3: vi.fn(async () => Buffer.from("mp3")) },
    });

    expect(result.rows[0]).toMatchObject({ status: "FAILED", error: "Supabase lesson audio storage is required in production." });
  });

  it("generated rows are skipped unless force is provided", async () => {
    mockFindMany.mockResolvedValueOnce([
      pendingLesson({ audioAssets: [{ id: "audio-1", status: "GENERATED", contentVersion: "v1", voice: "alloy", storageUrl: "old.mp3" }] }),
    ]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    const result = await processLessonAudioBatch({ grade: 5, subject: "ENGLISH", dryRun: true, limit: 1 });

    expect(result.rows[0]).toMatchObject({ status: "SKIPPED", url: "old.mp3" });
  });

  it("failed TTS marks the row failed", async () => {
    mockFindMany.mockResolvedValueOnce([pendingLesson()]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    const result = await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      approved: true,
      limit: 1,
      ttsClient: { generateMp3: vi.fn(async () => { throw new Error("TTS unavailable"); }) },
      storageClient: { upload: vi.fn() },
    });

    expect(result.rows[0]).toMatchObject({ status: "FAILED", error: "TTS unavailable" });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "audio-1" }, data: { status: "FAILED" } });
  });

  it("queries only approved mapped Grade 5 ENGLISH pending rows", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    await processLessonAudioBatch({ grade: 5, subject: "english", dryRun: true, limit: 3 });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        grade: 5,
        subject: "ENGLISH",
        contentType: "lesson",
        status: "APPROVED",
        unitId: { not: null },
        orderInUnit: { not: null },
        audioAssets: { some: { voice: "alloy", status: "PENDING" } },
      }),
      take: 3,
    }));
  });

  it("does not query generated rows unless force is provided", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    await processLessonAudioBatch({ grade: 5, subject: "ENGLISH", dryRun: true, limit: 1 });
    expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        audioAssets: { some: { voice: "alloy", status: "PENDING" } },
      }),
    }));

    mockFindMany.mockResolvedValueOnce([]);
    await processLessonAudioBatch({ grade: 5, subject: "ENGLISH", dryRun: true, limit: 1, force: true });
    expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        audioAssets: { some: { voice: "alloy" } },
      }),
    }));
  });

  it("can explicitly include unmapped, published, and processing rows for resume cleanup", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const { processLessonAudioBatch } = await import("@/scripts/process-lesson-audio");

    await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      dryRun: true,
      limit: 5,
      includeUnmapped: true,
      includePublished: true,
      includeProcessing: true,
    });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        grade: 5,
        subject: "ENGLISH",
        status: { in: ["APPROVED", "published"] },
        audioAssets: { some: { voice: "alloy", status: { in: ["PENDING", "PROCESSING"] } } },
      }),
    }));
    expect(mockFindMany.mock.calls.at(-1)?.[0].where.unitId).toBeUndefined();
    expect(mockFindMany.mock.calls.at(-1)?.[0].where.orderInUnit).toBeUndefined();
  });
});
