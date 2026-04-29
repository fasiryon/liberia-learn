import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockUpdateMany = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockAggregate = vi.hoisted(() => vi.fn());
const mockCompileTextbook = vi.hoisted(() => vi.fn());
const mockRenderTextbookPdfStream = vi.hoisted(() => vi.fn());
const mockUploadLessonPdfToSupabase = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    textbookGenerationJob: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      findMany: mockFindMany,
      updateMany: mockUpdateMany,
      update: mockUpdate,
      count: mockCount,
      findFirst: mockFindFirst,
      aggregate: mockAggregate,
    },
  },
}));

vi.mock("@/lib/ai/textbook/textbookCompiler", () => ({
  compileTextbook: mockCompileTextbook,
}));

vi.mock("@/lib/ai/textbook/textbookPdf", () => ({
  renderTextbookPdfStream: mockRenderTextbookPdfStream,
}));

vi.mock("@/lib/supabaseStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabaseStorage")>();
  return {
    ...actual,
    uploadLessonPdfToSupabase: mockUploadLessonPdfToSupabase,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("textbookGenerationQueue", () => {
  it("enqueueTextbook creates a PENDING job", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockUpsert.mockResolvedValueOnce({ id: "job-1", status: "PENDING" });
    const { enqueueTextbook } = await import("@/lib/textbooks/textbookGenerationQueue");

    const result = await enqueueTextbook({ grade: 5, subject: "english", format: "student" });

    expect(result).toMatchObject({ queued: 1, skipped: 0, jobId: "job-1" });
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ grade: 5, subject: "ENGLISH", format: "student", status: "PENDING" }),
    }));
  });

  it("processTextbookJob generates a PDF and uploads it to Supabase", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "job-1",
      grade: 5,
      subject: "ENGLISH",
      format: "student",
      version: "v1",
      status: "PROCESSING",
      storageUrl: null,
      force: false,
    });
    mockCompileTextbook.mockResolvedValueOnce({ title: "English", units: [], totalLessons: 0 });
    mockRenderTextbookPdfStream.mockResolvedValueOnce(Readable.from([Buffer.from("%PDF-1.4")]));
    mockUploadLessonPdfToSupabase.mockResolvedValueOnce("https://supabase.example/storage/v1/object/public/lesson-pdf/textbooks/grade-5/english/student/v1.pdf");
    mockUpdate.mockResolvedValueOnce({});
    const { processTextbookJob } = await import("@/lib/textbooks/textbookGenerationQueue");

    const result = await processTextbookJob("job-1");

    expect(result).toMatchObject({ jobId: "job-1", status: "GENERATED" });
    expect(mockCompileTextbook).toHaveBeenCalledWith({ subject: "ENGLISH", gradeLevel: 5, format: "student" });
    expect(mockUploadLessonPdfToSupabase).toHaveBeenCalledWith(
      expect.any(Buffer),
      "textbooks/grade-5/english/student/v1.pdf"
    );
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "GENERATED" }),
    }));
  });

  it("retryFailed moves FAILED jobs back to PENDING", async () => {
    mockFindMany.mockResolvedValueOnce([{ id: "job-1" }, { id: "job-2" }]);
    mockUpdateMany.mockResolvedValueOnce({ count: 2 });
    const { retryFailed } = await import("@/lib/textbooks/textbookGenerationQueue");

    const result = await retryFailed({ grade: 5, subject: "ENGLISH" });

    expect(result).toEqual({ retried: 2 });
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "PENDING", errorMessage: null },
    }));
  });
});
