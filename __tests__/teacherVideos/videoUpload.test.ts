/**
 * __tests__/teacherVideos/videoUpload.test.ts
 * Unit tests for lib/lessons/videoUpload.ts pure functions.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  validateLessonVideoFile,
  canManageLessonVideo,
  selectActiveLessonVideo,
  lessonVideoStoragePath,
  MAX_LESSON_VIDEO_BYTES,
  MAX_LESSON_VIDEO_SECONDS,
} from "@/lib/lessons/videoUpload";

// ── validateLessonVideoFile ───────────────────────────────────────────────────

describe("validateLessonVideoFile", () => {
  it("accepts video/mp4", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "lesson.mp4",
        contentType: "video/mp4",
        size: 1024,
        durationSeconds: 60,
      })
    ).not.toThrow();
  });

  it("accepts video/webm", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "lesson.webm",
        contentType: "video/webm",
        size: 1024,
        durationSeconds: 60,
      })
    ).not.toThrow();
  });

  it("rejects unknown MIME type video/avi (no accepted extension)", () => {
    let err: any;
    try {
      validateLessonVideoFile({
        fileName: "lesson.avi",
        contentType: "video/avi",
        size: 1024,
        durationSeconds: 60,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status).toBe(400);
  });

  it("rejects file size > 200MB (throws status 413)", () => {
    let err: any;
    try {
      validateLessonVideoFile({
        fileName: "large.mp4",
        contentType: "video/mp4",
        size: MAX_LESSON_VIDEO_BYTES + 1,
        durationSeconds: 60,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status).toBe(413);
  });

  it("rejects durationSeconds > 900 (throws status 400)", () => {
    let err: any;
    try {
      validateLessonVideoFile({
        fileName: "long.mp4",
        contentType: "video/mp4",
        size: 1024,
        durationSeconds: MAX_LESSON_VIDEO_SECONDS + 1,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status).toBe(400);
  });

  it("accepts boundary: exactly 200MB passes", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "boundary.mp4",
        contentType: "video/mp4",
        size: MAX_LESSON_VIDEO_BYTES,
        durationSeconds: 60,
      })
    ).not.toThrow();
  });

  it("accepts boundary: exactly 900s passes", () => {
    expect(() =>
      validateLessonVideoFile({
        fileName: "boundary.mp4",
        contentType: "video/mp4",
        size: 1024,
        durationSeconds: MAX_LESSON_VIDEO_SECONDS,
      })
    ).not.toThrow();
  });
});

// ── canManageLessonVideo ──────────────────────────────────────────────────────

describe("canManageLessonVideo", () => {
  it("ADMIN can manage a video uploaded within their own school (different uploadedBy)", () => {
    expect(
      canManageLessonVideo({
        user: { id: "admin-1", role: "ADMIN", schoolId: "school-1" },
        video: { uploadedBy: "teacher-99", schoolId: "school-1" },
      })
    ).toBe(true);
  });

  it("ADMIN cannot manage a video uploaded in a different school", () => {
    expect(
      canManageLessonVideo({
        user: { id: "admin-1", role: "ADMIN", schoolId: "school-1" },
        video: { uploadedBy: "teacher-99", schoolId: "school-2" },
      })
    ).toBe(false);
  });

  it("platform admin can manage a video in any school", () => {
    expect(
      canManageLessonVideo({
        user: { id: "platform-1", role: "ADMIN", isPlatformAdmin: true },
        video: { uploadedBy: "teacher-99", schoolId: "school-2" },
      })
    ).toBe(true);
  });

  it("TEACHER can manage own video (same id)", () => {
    expect(
      canManageLessonVideo({
        user: { id: "teacher-1", role: "TEACHER" },
        video: { uploadedBy: "teacher-1" },
      })
    ).toBe(true);
  });

  it("TEACHER cannot manage another teacher's video", () => {
    expect(
      canManageLessonVideo({
        user: { id: "teacher-1", role: "TEACHER" },
        video: { uploadedBy: "teacher-2" },
      })
    ).toBe(false);
  });
});

// ── selectActiveLessonVideo ───────────────────────────────────────────────────

describe("selectActiveLessonVideo", () => {
  it("returns null on empty array", () => {
    expect(selectActiveLessonVideo([])).toBeNull();
  });

  it("returns null when no isActive videos", () => {
    const videos = [
      { isActive: false, uploadedAt: new Date("2026-01-01") },
      { isActive: false, uploadedAt: new Date("2026-01-02") },
    ];
    expect(selectActiveLessonVideo(videos)).toBeNull();
  });

  it("returns the active video when one is active", () => {
    const active = { isActive: true, uploadedAt: new Date("2026-01-02") };
    const inactive = { isActive: false, uploadedAt: new Date("2026-01-03") };
    expect(selectActiveLessonVideo([inactive, active])).toBe(active);
  });

  it("returns most recently uploaded when multiple active (sort by uploadedAt desc)", () => {
    const older = { isActive: true, uploadedAt: new Date("2026-01-01") };
    const newer = { isActive: true, uploadedAt: new Date("2026-01-10") };
    expect(selectActiveLessonVideo([older, newer])).toBe(newer);
  });
});

// ── lessonVideoStoragePath ────────────────────────────────────────────────────

describe("lessonVideoStoragePath", () => {
  it("returns a string containing the lessonId segment", () => {
    const path = lessonVideoStoragePath({
      lessonId: "lesson-abc",
      teacherId: "teacher-1",
      filename: "video.mp4",
    });
    expect(typeof path).toBe("string");
    expect(path).toContain("lesson-abc");
  });

  it("sanitizes special characters in filename", () => {
    const path = lessonVideoStoragePath({
      lessonId: "lesson-1",
      teacherId: "teacher-1",
      filename: "my video file!@#.mp4",
    });
    // Special chars should be replaced; no spaces or ! @ # in path
    expect(path).not.toMatch(/[ !@#]/);
  });
});
