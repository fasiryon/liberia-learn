export const LESSON_VIDEO_BUCKET = "lesson-video";
export const MAX_LESSON_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB
export const MAX_LESSON_VIDEO_SECONDS = 15 * 60;

const ACCEPTED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
]);

const ACCEPTED_EXTENSIONS = new Set(["mp4", "webm"]);

export function validateLessonVideoFile(input: {
  fileName: string;
  contentType: string;
  size: number;
  durationSeconds: number;
}) {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_VIDEO_TYPES.has(input.contentType) && !ACCEPTED_EXTENSIONS.has(extension)) {
    throw Object.assign(new Error("Only MP4 or WebM videos are supported."), { status: 400 });
  }
  if (input.size > MAX_LESSON_VIDEO_BYTES) {
    throw Object.assign(new Error("Video must be 200MB or smaller."), { status: 413 });
  }
  if (input.durationSeconds > MAX_LESSON_VIDEO_SECONDS) {
    throw Object.assign(new Error("Video must be 15 minutes or shorter."), { status: 400 });
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
  return `lessons/${sanitizeSegment(input.lessonId)}/${Date.now()}-${sanitizeSegment(input.filename)}`;
}

export function canManageLessonVideo(input: {
  user: { id: string; role: string; schoolId?: string | null; isPlatformAdmin?: boolean };
  video: { uploadedBy: string; schoolId?: string | null };
}) {
  if (input.video.uploadedBy === input.user.id) return true;
  if (input.user.isPlatformAdmin) return true;
  if (input.user.role !== "ADMIN") return false;
  // ADMIN may only manage videos uploaded within their own school's tenant.
  return Boolean(input.user.schoolId) && input.user.schoolId === input.video.schoolId;
}

export function selectActiveLessonVideo<T extends { isActive: boolean; uploadedAt: Date | string }>(
  videos: T[]
): T | null {
  return videos
    .filter((video) => video.isActive)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] ?? null;
}

export async function uploadLessonVideoToVercelBlob(input: {
  lessonId: string;
  teacherId: string;
  file: File;
}): Promise<string> {
  const { put } = await import("@vercel/blob");
  const path = lessonVideoStoragePath({
    lessonId: input.lessonId,
    teacherId: input.teacherId,
    filename: input.file.name,
  });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const blob = await put(path, buffer, {
    access: "private",
    contentType: input.file.type || "video/mp4",
  });
  return blob.url;
}
