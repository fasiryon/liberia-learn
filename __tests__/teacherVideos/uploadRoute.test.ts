/**
 * __tests__/teacherVideos/uploadRoute.test.ts
 * Tests for teacher video upload/manage API routes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── POST /api/teacher/lessons/[contentId]/video ────────────────────────────

describe("POST /api/teacher/lessons/[contentId]/video", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  function setupMocks({
    role = "TEACHER",
    contentExists = true,
  }: { role?: string; contentExists?: boolean } = {}) {
    const mockStorageQuotaUpsert = vi.fn(async () => ({ usedBytes: 0, limitBytes: 5368709120 }));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async (...roles: string[]) => {
        if (!roles.includes(role)) {
          throw Object.assign(new Error("Forbidden"), { status: 403 });
        }
        return {
          id: "teacher-1",
          role,
          schoolId: "school-1",
          isPlatformAdmin: false,
          name: "Test Teacher",
        };
      }),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () =>
            contentExists ? { contentId: "cc-1", subject: "MATH", grade: 7 } : null
          ),
        },
        lessonVideo: {
          create: vi.fn(async (args: any) => ({
            id: "vid-1",
            status: "PENDING",
            isActive: false,
            ...args.data,
          })),
        },
        schoolStorageQuota: {
          upsert: mockStorageQuotaUpsert,
          findUnique: vi.fn(async () => null),
        },
        user: { findMany: vi.fn(async () => []) },
      },
    }));
    vi.doMock("@vercel/blob", () => ({
      put: vi.fn(async () => ({ url: "https://blob.example.com/video.mp4" })),
    }));
    vi.doMock("@/lib/push/sendPush", () => ({
      sendPushToMany: vi.fn(),
      sendPushToUser: vi.fn(),
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
    vi.doMock("@/lib/events/logLearningEvent", () => ({
      logLearningEvent: vi.fn(async () => {}),
    }));
    return { mockStorageQuotaUpsert };
  }

  it("returns 403 when not authenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }),
    }));
    vi.doMock("@/lib/db", () => ({ prisma: {} }));
    vi.doMock("@vercel/blob", () => ({ put: vi.fn() }));
    vi.doMock("@/lib/push/sendPush", () => ({
      sendPushToMany: vi.fn(),
      sendPushToUser: vi.fn(),
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn() }));
    vi.doMock("@/lib/events/logLearningEvent", () => ({
      logLearningEvent: vi.fn(),
    }));
    const { POST } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/route"
    );
    const form = new FormData();
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: form }),
      { params: { contentId: "cc-1" } }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when no file provided", async () => {
    setupMocks();
    const { POST } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/route"
    );
    const form = new FormData();
    form.append("title", "Test");
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: form }),
      { params: { contentId: "cc-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when content not found", async () => {
    setupMocks({ contentExists: false });
    const { POST } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/route"
    );
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(100)], "test.mp4", { type: "video/mp4" })
    );
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: form }),
      { params: { contentId: "cc-1" } }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when MIME type invalid", async () => {
    setupMocks();
    const { POST } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/route"
    );
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(100)], "test.avi", { type: "video/avi" })
    );
    form.append("durationSeconds", "30");
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: form }),
      { params: { contentId: "cc-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("creates LessonVideo with PENDING status on success", async () => {
    const { mockStorageQuotaUpsert } = setupMocks();
    const { POST } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/route"
    );
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(1024)], "lesson.mp4", { type: "video/mp4" })
    );
    form.append("durationSeconds", "60");
    form.append("title", "My Video");
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: form }),
      { params: { contentId: "cc-1" } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.video.status).toBe("PENDING");
    // Quota upsert must be called (check + increment = at least once)
    expect(mockStorageQuotaUpsert).toHaveBeenCalled();
  });
});

// ── PATCH /api/teacher/lessons/[contentId]/video/[videoId] ────────────────

describe("PATCH /api/teacher/lessons/[contentId]/video/[videoId]", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 if canManageLessonVideo fails (wrong teacher)", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "teacher-other",
        role: "TEACHER",
        schoolId: "school-1",
        isPlatformAdmin: false,
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findUnique: vi.fn(async () => ({
            id: "vid-1",
            lessonId: "cc-1",
            uploadedBy: "teacher-1",
          })),
          updateMany: vi.fn(async () => {}),
          update: vi.fn(async () => ({})),
        },
      },
    }));
    vi.doMock("@vercel/blob", () => ({ del: vi.fn() }));
    const { PATCH } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/[videoId]/route"
    );
    const res = await PATCH(
      new Request("http://localhost/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      }),
      { params: { contentId: "cc-1", videoId: "vid-1" } }
    );
    expect(res.status).toBe(403);
  });

  it("sets isActive=true and deactivates others on success", async () => {
    const mockUpdateMany = vi.fn(async () => {});
    const mockUpdate = vi.fn(async (args: any) => ({
      id: "vid-1",
      isActive: args.data.isActive,
    }));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "teacher-1",
        role: "TEACHER",
        schoolId: "school-1",
        isPlatformAdmin: false,
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findUnique: vi.fn(async () => ({
            id: "vid-1",
            lessonId: "cc-1",
            uploadedBy: "teacher-1",
          })),
          updateMany: mockUpdateMany,
          update: mockUpdate,
        },
      },
    }));
    vi.doMock("@vercel/blob", () => ({ del: vi.fn() }));
    const { PATCH } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/[videoId]/route"
    );
    const res = await PATCH(
      new Request("http://localhost/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      }),
      { params: { contentId: "cc-1", videoId: "vid-1" } }
    );
    expect(res.status).toBe(200);
    // updateMany called to deactivate others — verify WHERE clause scopes correctly
    expect(mockUpdateMany).toHaveBeenCalledOnce();
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lessonId: "cc-1",
          id: { not: "vid-1" },
        }),
      })
    );
    // update called to set isActive true
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } })
    );
  });
});

// ── DELETE /api/teacher/lessons/[contentId]/video/[videoId] ───────────────

describe("DELETE /api/teacher/lessons/[contentId]/video/[videoId]", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 404 if video not found", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "teacher-1",
        role: "TEACHER",
        schoolId: "school-1",
        isPlatformAdmin: false,
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findUnique: vi.fn(async () => null),
          delete: vi.fn(),
        },
      },
    }));
    vi.doMock("@vercel/blob", () => ({ del: vi.fn() }));
    const { DELETE } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/[videoId]/route"
    );
    const res = await DELETE(
      new Request("http://localhost/", { method: "DELETE" }),
      { params: { contentId: "cc-1", videoId: "vid-missing" } }
    );
    expect(res.status).toBe(404);
  });

  it("deletes video and calls del() on storageUrl", async () => {
    const mockDel = vi.fn(async () => {});
    const mockDelete = vi.fn(async () => {});
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "teacher-1",
        role: "TEACHER",
        schoolId: "school-1",
        isPlatformAdmin: false,
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findUnique: vi.fn(async () => ({
            id: "vid-1",
            lessonId: "cc-1",
            uploadedBy: "teacher-1",
            storageUrl: "https://blob.vercel-storage.com/video.mp4",
          })),
          delete: mockDelete,
        },
      },
    }));
    vi.doMock("@vercel/blob", () => ({ del: mockDel }));
    const { DELETE } = await import(
      "@/app/api/teacher/lessons/[contentId]/video/[videoId]/route"
    );
    const res = await DELETE(
      new Request("http://localhost/", { method: "DELETE" }),
      { params: { contentId: "cc-1", videoId: "vid-1" } }
    );
    expect(res.status).toBe(200);
    expect(mockDel).toHaveBeenCalledWith(
      "https://blob.vercel-storage.com/video.mp4"
    );
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "vid-1" } });
  });
});
