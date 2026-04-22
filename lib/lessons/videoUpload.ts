import { uploadBinaryToSupabase } from "@/lib/supabaseStorage";

export const LESSON_VIDEO_BUCKET = "lesson-video";
export const MAX_LESSON_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_LESSON_VIDEO_SECONDS = 15 * 60;

const ACCEPTED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const ACCEPTED_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

export function validateLessonVideoFile(input: {
  fileName: string;
  contentType: string;
  size: number;
  durationSeconds: number;
}) {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_VIDEO_TYPES.has(input.contentType) && !ACCEPTED_EXTENSIONS.has(extension)) {
    throw new Error("Only MP4, WebM, or MOV videos are supported.");
  }
  if (input.size > MAX_LESSON_VIDEO_BYTES) {
    throw new Error("Video must be 500MB or smaller.");
  }
  if (input.durationSeconds > MAX_LESSON_VIDEO_SECONDS) {
    throw new Error("Video must be 15 minutes or shorter.");
  }
}

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "video";
}

export function lessonVideoStoragePath(input: {
  lessonId: string;
  teacherId: string;
  filename: string;
}) {
  return `lessons/video/${sanitizeSegment(input.lessonId)}/${sanitizeSegment(input.teacherId)}/${Date.now()}-${sanitizeSegment(input.filename)}`;
}

export function canManageLessonVideo(input: {
  user: { id: string; role: string };
  video: { uploadedBy: string };
}) {
  return input.user.role === "ADMIN" || input.video.uploadedBy === input.user.id;
}

export function selectActiveLessonVideo<T extends { isActive: boolean; uploadedAt: Date | string }>(
  videos: T[]
): T | null {
  return videos
    .filter((video) => video.isActive)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] ?? null;
}

export async function uploadLessonVideoToSupabase(input: {
  lessonId: string;
  teacherId: string;
  file: File;
}) {
  const path = lessonVideoStoragePath({
    lessonId: input.lessonId,
    teacherId: input.teacherId,
    filename: input.file.name,
  });
  return uploadBinaryToSupabase({
    bucket: LESSON_VIDEO_BUCKET,
    path,
    contentType: input.file.type || "application/octet-stream",
    body: Buffer.from(await input.file.arrayBuffer()),
  });
}
