import { describe, expect, it, vi } from "vitest";

const mockUploadBinaryToSupabase = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseStorage", () => ({
  uploadBinaryToSupabase: mockUploadBinaryToSupabase,
}));

import {
  MAX_LESSON_VIDEO_BYTES,
  MAX_LESSON_VIDEO_SECONDS,
  canManageLessonVideo,
  lessonVideoStoragePath,
  selectActiveLessonVideo,
  uploadLessonVideoToSupabase,
  validateLessonVideoFile,
} from "@/lib/lessons/videoUpload";

describe("lesson video upload validation", () => {
  it("enforces size limit", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "lesson.mp4",
        contentType: "video/mp4",
        size: MAX_LESSON_VIDEO_BYTES + 1,
        durationSeconds: 60,
      })
    ).toThrow(/500MB/);
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

  it("accepts only supported formats", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "lesson.avi",
        contentType: "video/x-msvideo",
        size: 100,
        durationSeconds: 60,
      })
    ).toThrow(/MP4, WebM, or MOV/);
  });

  it("creates a scoped teacher lesson path", () => {
    const path = lessonVideoStoragePath({
      lessonId: "lesson 1",
      teacherId: "teacher 1",
      filename: "Intro Clip.MP4",
    });
    expect(path).toContain("lessons/video/lesson-1/teacher-1/");
    expect(path.endsWith("intro-clip.mp4")).toBe(true);
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

  it("uses inline storage only when Supabase storage is not configured", async () => {
    mockUploadBinaryToSupabase.mockRejectedValueOnce(new Error("Supabase storage is not configured"));
    const url = await uploadLessonVideoToSupabase({
      lessonId: "lesson-1",
      teacherId: "teacher-1",
      file: new File([new Uint8Array([1, 2, 3])], "intro.webm", { type: "video/webm" }),
    });
    expect(url).toBe("data:video/webm;base64,AQID");
  });
});
