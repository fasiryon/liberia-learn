import { describe, expect, it, vi } from "vitest";

const mockPut = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob", () => ({
  put: mockPut,
}));

import {
  MAX_LESSON_VIDEO_BYTES,
  MAX_LESSON_VIDEO_SECONDS,
  canManageLessonVideo,
  lessonVideoStoragePath,
  selectActiveLessonVideo,
  uploadLessonVideoToVercelBlob,
  validateLessonVideoFile,
} from "@/lib/lessons/videoUpload";

describe("lesson video upload validation", () => {
  it("enforces 200MB size limit", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "lesson.mp4",
        contentType: "video/mp4",
        size: MAX_LESSON_VIDEO_BYTES + 1,
        durationSeconds: 60,
      })
    ).toThrow(/200MB/);
  });

  it("enforces duration limit", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "lesson.mp4",
        contentType: "video/mp4",
        size: 100,
        durationSeconds: MAX_LESSON_VIDEO_SECONDS + 1,
      })
    ).toThrow(/15 minutes/);
  });

  it("accepts only supported formats (MP4, WebM)", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "lesson.avi",
        contentType: "video/x-msvideo",
        size: 100,
        durationSeconds: 60,
      })
    ).toThrow(/MP4 or WebM/);
  });

  it("creates a scoped lesson path", () => {
    const path = lessonVideoStoragePath({
      lessonId: "lesson 1",
      teacherId: "teacher 1",
      filename: "Intro Clip.MP4",
    });
    expect(path).toContain("lessons/lesson-1/");
  });

  it("allows only the uploading teacher or an admin to manage a video", () => {
    const video = { uploadedBy: "teacher-1" };
    expect(canManageLessonVideo({ user: { id: "teacher-1", role: "TEACHER" }, video })).toBe(true);
    expect(canManageLessonVideo({ user: { id: "teacher-2", role: "TEACHER" }, video })).toBe(false);
    expect(canManageLessonVideo({ user: { id: "admin-1", role: "ADMIN" }, video })).toBe(true);
  });

  it("selects only the latest active video for students", () => {
    const selected = selectActiveLessonVideo([
      { id: "inactive", isActive: false, uploadedAt: "2026-04-01T00:00:00.000Z" },
      { id: "older", isActive: true, uploadedAt: "2026-04-02T00:00:00.000Z" },
      { id: "newer", isActive: true, uploadedAt: "2026-04-03T00:00:00.000Z" },
    ]);
    expect(selected?.id).toBe("newer");
  });

  it("uploads to Vercel Blob and returns the URL", async () => {
    mockPut.mockResolvedValueOnce({ url: "https://blob.vercel.app/lessons/test.mp4" });
    const url = await uploadLessonVideoToVercelBlob({
      lessonId: "lesson-1",
      teacherId: "teacher-1",
      file: new File([new Uint8Array([1, 2, 3])], "intro.mp4", { type: "video/mp4" }),
    });
    expect(url).toBe("https://blob.vercel.app/lessons/test.mp4");
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining("lessons/lesson-1/"),
      expect.any(Buffer),
      expect.objectContaining({ access: "private", contentType: "video/mp4" })
    );
  });
});
