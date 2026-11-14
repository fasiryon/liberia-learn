/** Actual upload route, validator, quota, pending-video, learning-event and audit SQL.
 * Blob storage and push are synthetic transports; no paid upload is performed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ userId: "teacher-A", uploads: 0 }));
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => {
  const { prisma } = await import("@/lib/db"); const user = await prisma.user.findUniqueOrThrow({ where: { id: h.userId } });
  if (!roles.includes(user.role)) throw Object.assign(Error("Forbidden"), { status: 403 }); return user;
} }));
vi.mock("@vercel/blob", () => ({ put: async () => { h.uploads++; return { url: "https://storage.example.invalid/synthetic-video" }; } }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToMany: async () => undefined }));
let admitted = false;
try { const url = new URL(process.env.DATABASE_URL ?? ""); admitted = process.env.LL_SEC_25_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" && /^\/sec25_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1"; } catch { /* Local only. */ }
if (process.env.LL_SEC_25_DB_TEST === "1" && !admitted) throw Error("SEC-25 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-25 native video metadata admission", () => {
  let db: PrismaClient; let upload: typeof import("@/app/api/teacher/lessons/[contentId]/video/route").POST;
  beforeAll(async () => {
    vi.stubGlobal("fetch", () => { throw Error("No external calls"); });
    ({ prisma: db } = await import("@/lib/db")); ({ POST: upload } = await import("@/app/api/teacher/lessons/[contentId]/video/route"));
    for (const suffix of ["A", "B"]) {
      await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}` } });
      await db.user.create({ data: { id: `teacher-${suffix}`, email: `teacher-${suffix}@example.invalid`, role: "TEACHER", schoolId: `school-${suffix}` } });
    }
    await db.user.create({ data: { id: "student", email: "student@example.invalid", role: "STUDENT", schoolId: "school-A" } });
    for (const grade of [4, 9]) await db.curriculumContent.create({ data: { contentId: `synthetic-g${grade}`, subject: "MATH", grade, contentType: "lesson", status: "published", version: "synthetic-1", payload: {} } });
  });
  beforeEach(() => { h.userId = "teacher-A"; h.uploads = 0; });
  afterAll(async () => { vi.unstubAllGlobals(); await db?.$disconnect(); });
  const request = (fileName: string, type: string, duration = 30) => {
    const form = new FormData(); form.set("file", new File([new Uint8Array([0, 1, 2, 3])], fileName, { type }));
    form.set("durationSeconds", String(duration)); form.set("schoolId", "school-B"); form.set("uploadedBy", "teacher-B");
    return new Request("http://localhost/api/teacher/lessons/synthetic/video", { method: "POST", body: form });
  };
  const context = { params: { contentId: "synthetic-g4" } };
  const counts = async () => [await db.lessonVideo.count(), await db.schoolStorageQuota.count(), await db.auditLog.count(), await db.learningEvent.count()];
  it.each([
    ["unsupported extension", "payload.html", "video/mp4"], ["unsupported MIME", "lesson.mp4", "text/html"],
    ["missing extension", "lesson", "video/mp4"], ["generic MIME with accepted extension", "lesson.webm", "application/octet-stream"],
    ["both unsupported", "lesson.avi", "video/avi"],
  ])("rejects %s before storage, quota, video or audit writes", async (_label, fileName, type) => {
    const before = await counts(); const res = await upload(request(fileName, type), context);
    expect(res.status).toBe(400); expect(h.uploads).toBe(0); expect(await counts()).toEqual(before);
  });
  it.each([["lesson.mp4", "video/mp4"], ["lesson.webm", "video/webm"], ["lesson.MP4", "video/mp4"]])("retains supported %s upload as pending in the canonical school", async (fileName, type) => {
    const res = await upload(request(fileName, type), context); expect(res.status).toBe(200); const { video } = await res.json();
    expect(await db.lessonVideo.findUnique({ where: { id: video.id } })).toMatchObject({ uploadedBy: "teacher-A", schoolId: "school-A", status: "PENDING", isActive: false, fileSize: 4 });
    expect(await db.auditLog.findFirst({ where: { resourceId: video.id, action: "video.uploaded" } })).toMatchObject({ userId: "teacher-A" });
    expect(await db.learningEvent.findFirst({ where: { eventType: "LESSON_VIDEO_UPLOADED", userId: "teacher-A" } })).toMatchObject({ schoolId: "school-A" });
    expect(await db.schoolStorageQuota.count({ where: { schoolId: "school-B" } })).toBe(0); expect(h.uploads).toBe(1);
  });
  it("Grade9 teacher in a second school retains an isolated pending upload", async () => {
    h.userId = "teacher-B"; const res = await upload(request("lesson.webm", "video/webm"), { params: { contentId: "synthetic-g9" } }); expect(res.status).toBe(200);
    const { video } = await res.json(); expect(await db.lessonVideo.findUnique({ where: { id: video.id } })).toMatchObject({ schoolId: "school-B", uploadedBy: "teacher-B", lessonId: "synthetic-g9", status: "PENDING" });
  });
  it("student cannot upload despite valid file metadata", async () => {
    h.userId = "student"; const before = await counts(); expect((await upload(request("lesson.mp4", "video/mp4"), context)).status).toBe(403); expect(h.uploads).toBe(0); expect(await counts()).toEqual(before);
  });
  it("duration contract still refuses over fifteen minutes before persistence", async () => {
    const before = await counts(); expect((await upload(request("lesson.mp4", "video/mp4", 901), context)).status).toBe(400); expect(h.uploads).toBe(0); expect(await counts()).toEqual(before);
  });
});
