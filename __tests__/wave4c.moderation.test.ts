// __tests__/wave4c.moderation.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── PATCH /api/admin/content-review/[lessonId] — state machine ────────────────

describe("PATCH /api/admin/content-review/[lessonId] state machine", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  function makeReq(body: object): any {
    return new Request("http://localhost/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function setupMocks(
    currentStatus: string | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateFn: any = vi.fn(async () => ({
      id: "cc-1", editReviewStatus: "APPROVED", status: "published",
    }))
  ) {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", title: "Test Lesson",
            editedById: "teacher-1", editReviewStatus: currentStatus,
          })),
          update: updateFn,
        },
        notificationInboxItem: { create: vi.fn(async () => ({})) },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
    vi.doMock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
  }

  it("PENDING → APPROVED: returns 200", async () => {
    setupMocks("PENDING");
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeReq({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(200);
  });

  it("PENDING → REJECTED: returns 200", async () => {
    setupMocks("PENDING", vi.fn(async () => ({ id: "cc-1", editReviewStatus: "REJECTED", status: "draft" })));
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeReq({ editReviewStatus: "REJECTED", rejectionReason: "Off-topic" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(200);
  });

  it("APPROVED → REJECTED: blocked with 409 and error=invalid_transition", async () => {
    setupMocks("APPROVED");
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeReq({ editReviewStatus: "REJECTED", rejectionReason: "Bad" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_transition");
  });

  it("null → APPROVED: blocked with 409", async () => {
    setupMocks(null);
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeReq({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(409);
  });

  it("REJECTED → APPROVED: blocked with 409", async () => {
    setupMocks("REJECTED");
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeReq({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(409);
  });

  it("approve: sets status=published and publishedAt in update call", async () => {
    const mockUpdate = vi.fn(async () => ({ id: "cc-1", editReviewStatus: "APPROVED", status: "published" }));
    setupMocks("PENDING", mockUpdate);
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    await PATCH(makeReq({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "published", editReviewStatus: "APPROVED" }),
    }));
    // publishedAt must be set (a Date, not null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callData = (mockUpdate.mock.calls[0] as any)[0].data;
    expect(callData.publishedAt).toBeInstanceOf(Date);
  });

  it("reject: stores rejectionReason in update call", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUpdate: any = vi.fn(async () => ({ id: "cc-1", editReviewStatus: "REJECTED", status: "draft" }));
    setupMocks("PENDING", mockUpdate);
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    await PATCH(makeReq({ editReviewStatus: "REJECTED", rejectionReason: "Factually wrong" }), { params: { lessonId: "cc-1" } });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ rejectionReason: "Factually wrong" }),
    }));
  });

  it("approve: creates NotificationInboxItem for teacher", async () => {
    const mockNotif = vi.fn(async () => ({}));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", title: "Photosynthesis",
            editedById: "teacher-1", editReviewStatus: "PENDING",
          })),
          update: vi.fn(async () => ({ id: "cc-1", editReviewStatus: "APPROVED", status: "published" })),
        },
        notificationInboxItem: { create: mockNotif },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
    vi.doMock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    await PATCH(makeReq({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(mockNotif).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "teacher-1" }),
    }));
  });
});

// ── POST /api/admin/content-review/[lessonId]/unpublish ───────────────────────

describe("POST /api/admin/content-review/[lessonId]/unpublish", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  function makeReq(body: object = {}): any {
    return new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 409 if lesson is not APPROVED", async () => {
    vi.doMock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "a-1", role: "ADMIN", schoolId: "s-1" })) }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", editedById: "t-1", editReviewStatus: "PENDING", title: "L",
          })),
        },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
    const { POST } = await import("@/app/api/admin/content-review/[lessonId]/unpublish/route");
    const res = await POST(makeReq({ reason: "Bad" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(409);
  });

  it("sets editReviewStatus=PENDING, publishedAt=null, writes audit, notifies teacher", async () => {
    const mockUpdate = vi.fn(async () => ({ id: "cc-1", editReviewStatus: "PENDING", publishedAt: null }));
    const mockNotif = vi.fn(async () => ({}));
    vi.doMock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "a-1", role: "ADMIN", schoolId: "s-1" })) }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", editedById: "t-1", editReviewStatus: "APPROVED", title: "Photosynthesis",
          })),
          update: mockUpdate,
        },
        notificationInboxItem: { create: mockNotif },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
    vi.doMock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
    const { POST } = await import("@/app/api/admin/content-review/[lessonId]/unpublish/route");
    const res = await POST(makeReq({ reason: "Factual error" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ editReviewStatus: "PENDING", publishedAt: null }),
    }));
    expect(mockNotif).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "t-1" }),
    }));
  });

  it("emergency unpublish audit log action is teacher.lesson.emergency_unpublish", async () => {
    const mockAudit = vi.fn(async () => {});
    vi.doMock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "a-1", role: "ADMIN", schoolId: "s-1" })) }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", editedById: "t-1", editReviewStatus: "APPROVED", title: "L",
          })),
          update: vi.fn(async () => ({ id: "cc-1" })),
        },
        notificationInboxItem: { create: vi.fn(async () => ({})) },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAudit: mockAudit }));
    vi.doMock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
    const { POST } = await import("@/app/api/admin/content-review/[lessonId]/unpublish/route");
    await POST(makeReq({}), { params: { lessonId: "cc-1" } });
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "teacher.lesson.emergency_unpublish",
    }));
  });
});
