/**
 * __tests__/teacherVideos/adminAndWatch.test.ts
 * Tests for admin video moderation and student watch event routes.
 *
 * NOTE: Any mock for sendPushToUser / sendPushToMany / logAudit MUST return a
 * Promise (use `vi.fn(async () => {})`) because routes call
 * `void fn(...).catch(() => {})`.  A plain `vi.fn()` returning undefined
 * would crash with "Cannot read properties of undefined (reading 'catch')".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── GET /api/admin/videos ─────────────────────────────────────────────────────

describe("GET /api/admin/videos", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 for non-admin", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }),
    }));
    vi.doMock("@/lib/db", () => ({ prisma: {} }));
    const { GET } = await import("@/app/api/admin/videos/route");
    const res = await GET(new Request("http://localhost/api/admin/videos"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with videos array and pendingCount for admin", async () => {
    const mockFindMany = vi.fn(async () => [
      { id: "v1", title: "Video 1", status: "PENDING", storageUrl: "https://blob.test/v1.mp4", thumbnailUrl: null },
    ]);
    const mockCount = vi.fn(async () => 1);
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "admin-1",
        role: "ADMIN",
        schoolId: "school-1",
        isPlatformAdmin: false,
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findMany: mockFindMany,
          count: mockCount,
        },
      },
    }));
    vi.doMock("@vercel/blob", () => ({
      head: vi.fn(async () => ({ downloadUrl: "https://signed.test/v1.mp4" })),
    }));
    const { GET } = await import("@/app/api/admin/videos/route");
    const res = await GET(
      new Request("http://localhost/api/admin/videos?status=PENDING")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.videos)).toBe(true);
    expect(typeof body.pendingCount).toBe("number");
    expect(body.pendingCount).toBe(1);
  });
});

// ── PATCH /api/admin/videos/[id]/approve ─────────────────────────────────────

describe("PATCH /api/admin/videos/[id]/approve", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  /** Shared factory for the approve route mocks. */
  function setupApproveMocks({
    videoExists = true,
    update = vi.fn(async () => ({ id: "vid-1", status: "APPROVED", isActive: true })),
    sendPushToUser = vi.fn(async () => {}),
  }: {
    videoExists?: boolean;
    update?: ReturnType<typeof vi.fn>;
    sendPushToUser?: ReturnType<typeof vi.fn>;
  } = {}) {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "admin-1",
        role: "ADMIN",
        schoolId: "school-1",
        isPlatformAdmin: false,
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findUnique: vi.fn(async () =>
            videoExists
              ? {
                  id: "vid-1",
                  title: "My Video",
                  uploadedBy: "teacher-1",
                  schoolId: "school-1",
                  status: "PENDING",
                  lesson: { contentId: "cc-1" },
                }
              : null
          ),
          update,
        },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
    vi.doMock("@/lib/push/sendPush", () => ({
      sendPushToUser,
      sendPushToMany: vi.fn(async () => {}),
    }));
    return { update, sendPushToUser };
  }

  it("returns 404 when video not found", async () => {
    setupApproveMocks({ videoExists: false });
    const { PATCH } = await import(
      "@/app/api/admin/videos/[id]/approve/route"
    );
    const res = await PATCH(
      new Request("http://localhost/", { method: "PATCH" }),
      { params: { id: "missing-vid" } }
    );
    expect(res.status).toBe(404);
  });

  it("sets status=APPROVED and isActive=true", async () => {
    const { update } = setupApproveMocks();
    const { PATCH } = await import(
      "@/app/api/admin/videos/[id]/approve/route"
    );
    const res = await PATCH(
      new Request("http://localhost/", { method: "PATCH" }),
      { params: { id: "vid-1" } }
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED", isActive: true }),
      })
    );
  });

  it("sends push notification to teacher (uploadedBy)", async () => {
    const mockSendPushToUser = vi.fn(async () => {});
    setupApproveMocks({ sendPushToUser: mockSendPushToUser });
    const { PATCH } = await import(
      "@/app/api/admin/videos/[id]/approve/route"
    );
    await PATCH(
      new Request("http://localhost/", { method: "PATCH" }),
      { params: { id: "vid-1" } }
    );
    await vi.waitFor(() =>
      expect(mockSendPushToUser).toHaveBeenCalledWith(
        "teacher-1",
        expect.objectContaining({ title: "Video approved" })
      )
    );
  });
});

// ── PATCH /api/admin/videos/[id]/reject ──────────────────────────────────────

describe("PATCH /api/admin/videos/[id]/reject", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  /** Shared factory for the reject route mocks. */
  function setupRejectMocks({
    update = vi.fn(async () => ({ id: "vid-1", status: "REJECTED" })),
    sendPushToUser = vi.fn(async () => {}),
  }: {
    update?: ReturnType<typeof vi.fn>;
    sendPushToUser?: ReturnType<typeof vi.fn>;
  } = {}) {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "admin-1",
        role: "ADMIN",
        schoolId: "school-1",
        isPlatformAdmin: false,
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findUnique: vi.fn(async () => ({
            id: "vid-1",
            title: "My Video",
            uploadedBy: "teacher-1",
            schoolId: "school-1",
            status: "PENDING",
            lesson: { contentId: "cc-1" },
          })),
          update,
        },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
    vi.doMock("@/lib/push/sendPush", () => ({
      sendPushToUser,
      sendPushToMany: vi.fn(async () => {}),
    }));
    return { update, sendPushToUser };
  }

  it("returns 400 when reason missing", async () => {
    setupRejectMocks();
    const { PATCH } = await import(
      "@/app/api/admin/videos/[id]/reject/route"
    );
    const res = await PATCH(
      new Request("http://localhost/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: { id: "vid-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("sets status=REJECTED with rejectedReason", async () => {
    const { update } = setupRejectMocks();
    const { PATCH } = await import(
      "@/app/api/admin/videos/[id]/reject/route"
    );
    const res = await PATCH(
      new Request("http://localhost/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Poor quality" }),
      }),
      { params: { id: "vid-1" } }
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectedReason: "Poor quality",
        }),
      })
    );
  });

  it("sends push to teacher on rejection", async () => {
    const mockSendPushToUser = vi.fn(async () => {});
    setupRejectMocks({ sendPushToUser: mockSendPushToUser });
    const { PATCH } = await import(
      "@/app/api/admin/videos/[id]/reject/route"
    );
    await PATCH(
      new Request("http://localhost/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Poor quality" }),
      }),
      { params: { id: "vid-1" } }
    );
    await vi.waitFor(() =>
      expect(mockSendPushToUser).toHaveBeenCalledWith(
        "teacher-1",
        expect.objectContaining({ title: "Video rejected" })
      )
    );
  });
});

// ── POST /api/student/video/[videoId]/watch ───────────────────────────────────

describe("POST /api/student/video/[videoId]/watch", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  function setupStudentMocks({
    videoStatus = "APPROVED",
    existingWatchEvent = null as { id: string; completedAt: Date | null } | null,
    videoUpdate = vi.fn(async () => ({ id: "vid-1", viewCount: 1 })),
    upsert = vi.fn(async () => ({})),
  } = {}) {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({
        id: "student-1",
        role: "STUDENT",
        schoolId: "school-1",
      })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: {
          findUnique: vi.fn(async () =>
            videoStatus === "APPROVED"
              ? { id: "vid-1", status: "APPROVED", viewCount: 0 }
              : null
          ),
          update: videoUpdate,
        },
        videoWatchEvent: {
          findUnique: vi.fn(async () => existingWatchEvent),
          upsert,
        },
      },
    }));
    return { videoUpdate, upsert };
  }

  it("returns 400 when totalSecs=0", async () => {
    setupStudentMocks();
    const { POST } = await import(
      "@/app/api/student/video/[videoId]/watch/route"
    );
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedSecs: 10, totalSecs: 0 }),
      }),
      { params: { videoId: "vid-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when watchedSecs negative", async () => {
    setupStudentMocks();
    const { POST } = await import(
      "@/app/api/student/video/[videoId]/watch/route"
    );
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedSecs: -5, totalSecs: 100 }),
      }),
      { params: { videoId: "vid-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when video status != APPROVED", async () => {
    setupStudentMocks({ videoStatus: "PENDING" });
    const { POST } = await import(
      "@/app/api/student/video/[videoId]/watch/route"
    );
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedSecs: 50, totalSecs: 100 }),
      }),
      { params: { videoId: "vid-1" } }
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 and upserts watch event", async () => {
    const { upsert } = setupStudentMocks();
    const { POST } = await import(
      "@/app/api/student/video/[videoId]/watch/route"
    );
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedSecs: 50, totalSecs: 100 }),
      }),
      { params: { videoId: "vid-1" } }
    );
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("increments viewCount on first 90% completion", async () => {
    const { videoUpdate } = setupStudentMocks({ existingWatchEvent: null });
    const { POST } = await import(
      "@/app/api/student/video/[videoId]/watch/route"
    );
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedSecs: 91, totalSecs: 100 }),
      }),
      { params: { videoId: "vid-1" } }
    );
    expect(res.status).toBe(200);
    expect(videoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { viewCount: { increment: 1 } },
      })
    );
  });

  it("does NOT increment viewCount on second completion (wasAlreadyCompleted=true)", async () => {
    const { videoUpdate } = setupStudentMocks({
      existingWatchEvent: { id: "wev-1", completedAt: new Date("2026-01-01") },
    });
    const { POST } = await import(
      "@/app/api/student/video/[videoId]/watch/route"
    );
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedSecs: 91, totalSecs: 100 }),
      }),
      { params: { videoId: "vid-1" } }
    );
    expect(res.status).toBe(200);
    // update should NOT be called because wasAlreadyCompleted = true
    expect(videoUpdate).not.toHaveBeenCalled();
  });
});
