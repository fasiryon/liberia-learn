// __tests__/wave4a.schema.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── CurriculumContent new fields ───────────────────────────────────────────────

describe("CurriculumContent wave4 fields", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("learningObjectives defaults to empty array", async () => {
    const mockCreate = vi.fn(async () => ({
      id: "cc-1", learningObjectives: [], visibility: "class_only", lessonVersion: 1,
    }));
    vi.doMock("@/lib/db", () => ({ prisma: { curriculumContent: { create: mockCreate } } }));
    const { prisma } = await import("@/lib/db");
    const result = await prisma.curriculumContent.create({ data: {} as any });
    expect(result.learningObjectives).toEqual([]);
  });

  it("visibility defaults to class_only", async () => {
    const mockCreate = vi.fn(async () => ({ visibility: "class_only" }));
    vi.doMock("@/lib/db", () => ({ prisma: { curriculumContent: { create: mockCreate } } }));
    const { prisma } = await import("@/lib/db");
    const result = await prisma.curriculumContent.create({ data: {} as any });
    expect(result.visibility).toBe("class_only");
  });

  it("lessonVersion defaults to 1", async () => {
    const mockCreate = vi.fn(async () => ({ lessonVersion: 1 }));
    vi.doMock("@/lib/db", () => ({ prisma: { curriculumContent: { create: mockCreate } } }));
    const { prisma } = await import("@/lib/db");
    const result = await prisma.curriculumContent.create({ data: {} as any });
    expect(result.lessonVersion).toBe(1);
  });

  it("publishedAt is null until set", async () => {
    const mockCreate = vi.fn(async () => ({ publishedAt: null }));
    vi.doMock("@/lib/db", () => ({ prisma: { curriculumContent: { create: mockCreate } } }));
    const { prisma } = await import("@/lib/db");
    const result = await prisma.curriculumContent.create({ data: {} as any });
    expect(result.publishedAt).toBeNull();
  });

  it("rejectionReason stored and readable", async () => {
    const mockUpdate = vi.fn(async () => ({ rejectionReason: "Contains errors" }));
    vi.doMock("@/lib/db", () => ({ prisma: { curriculumContent: { update: mockUpdate } } }));
    const { prisma } = await import("@/lib/db");
    const result = await prisma.curriculumContent.update({
      where: { id: "cc-1" }, data: { rejectionReason: "Contains errors" } as any,
    });
    expect(result.rejectionReason).toBe("Contains errors");
  });

  it("parentLessonId chains version history", async () => {
    const mockUpdate = vi.fn(async () => ({ parentLessonId: "cc-parent", lessonVersion: 2 }));
    vi.doMock("@/lib/db", () => ({ prisma: { curriculumContent: { update: mockUpdate } } }));
    const { prisma } = await import("@/lib/db");
    const result = await prisma.curriculumContent.update({
      where: { id: "cc-2" }, data: { parentLessonId: "cc-parent", lessonVersion: 2 } as any,
    });
    expect(result.parentLessonId).toBe("cc-parent");
    expect(result.lessonVersion).toBe(2);
  });
});

// ── TeacherLessonAssignment ────────────────────────────────────────────────────

describe("TeacherLessonAssignment", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("creates assignment with required fields", async () => {
    const mockCreate = vi.fn(async () => ({
      id: "tla-1", contentId: "cc-1", classId: "cls-1", assignedById: "u-1", scheduledFor: null,
    }));
    vi.doMock("@/lib/db", () => ({ prisma: { teacherLessonAssignment: { create: mockCreate } } }));
    const { prisma } = await import("@/lib/db");
    const result = await prisma.teacherLessonAssignment.create({ data: {} as any });
    expect(result.contentId).toBe("cc-1");
    expect(result.scheduledFor).toBeNull();
  });

  it("unique constraint enforced: duplicate returns DB error", async () => {
    const mockCreate = vi.fn(async () => {
      const err = new Error("Unique constraint failed") as any;
      err.code = "P2002";
      throw err;
    });
    vi.doMock("@/lib/db", () => ({ prisma: { teacherLessonAssignment: { create: mockCreate } } }));
    const { prisma } = await import("@/lib/db");
    await expect(
      prisma.teacherLessonAssignment.create({ data: {} as any })
    ).rejects.toThrow("Unique constraint");
  });
});

// ── State machine transitions ──────────────────────────────────────────────────

describe("editReviewStatus state machine — PATCH /api/admin/content-review/[lessonId]", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  function makeRequest(body: object): any {
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
      id: "cc-1", editReviewStatus: "APPROVED", status: "published", publishedAt: new Date(),
    }))
  ) {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1",
            contentId: "lesson-content-1",
            title: "Test Lesson",
            editedById: "teacher-1",
            editReviewStatus: currentStatus,
          })),
          update: updateFn,
        },
        notificationInboxItem: { create: vi.fn(async () => ({})) },
        $transaction: vi.fn(async (callback: any) => callback({
          curriculumContent: { update: updateFn },
        })),
      },
    }));
    const audit = vi.fn(async () => {});
    vi.doMock("@/lib/audit", () => ({
      logAudit: audit,
      logAuditRequired: audit,
      logAuditRequiredWithId: audit,
    }));
    vi.doMock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
  }

  it("PENDING → APPROVED: allowed, returns 200", async () => {
    setupMocks("PENDING");
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeRequest({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(200);
  });

  it("PENDING → REJECTED: allowed, returns 200", async () => {
    setupMocks("PENDING", vi.fn(async () => ({ id: "cc-1", editReviewStatus: "REJECTED", status: "draft" })));
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(
      makeRequest({ editReviewStatus: "REJECTED", rejectionReason: "Off-topic" }),
      { params: { lessonId: "cc-1" } }
    );
    expect(res.status).toBe(200);
  });

  it("APPROVED → REJECTED: blocked with 409", async () => {
    setupMocks("APPROVED");
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(
      makeRequest({ editReviewStatus: "REJECTED", rejectionReason: "Bad" }),
      { params: { lessonId: "cc-1" } }
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_transition");
  });

  it("null → APPROVED: blocked with 409", async () => {
    setupMocks(null);
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeRequest({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(409);
  });

  it("REJECTED → APPROVED: blocked with 409", async () => {
    setupMocks("REJECTED");
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    const res = await PATCH(makeRequest({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(res.status).toBe(409);
  });

  it("approve sets publishedAt + status=published in the update call", async () => {
    const mockUpdate = vi.fn(async () => ({
      id: "cc-1", editReviewStatus: "APPROVED", status: "published", publishedAt: new Date(),
    }));
    setupMocks("PENDING", mockUpdate);
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    await PATCH(makeRequest({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "published", editReviewStatus: "APPROVED" }),
      })
    );
  });

  it("reject stores rejectionReason in the update call", async () => {
    const mockUpdate = vi.fn(async () => ({
      id: "cc-1", editReviewStatus: "REJECTED", rejectionReason: "Factually wrong",
    }));
    setupMocks("PENDING", mockUpdate);
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    await PATCH(
      makeRequest({ editReviewStatus: "REJECTED", rejectionReason: "Factually wrong" }),
      { params: { lessonId: "cc-1" } }
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectionReason: "Factually wrong" }),
      })
    );
  });

  it("approve creates NotificationInboxItem for teacher", async () => {
    const mockNotif = vi.fn(async () => ({}));
    const mockUpdate = vi.fn(async () => ({ id: "cc-1", editReviewStatus: "APPROVED", status: "published" }));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", title: "Photosynthesis", editedById: "teacher-1", editReviewStatus: "PENDING",
          })),
          update: mockUpdate,
        },
        notificationInboxItem: { create: mockNotif },
        $transaction: vi.fn(async (callback: any) => callback({
          curriculumContent: { update: mockUpdate },
        })),
      },
    }));
    const audit = vi.fn(async () => {});
    vi.doMock("@/lib/audit", () => ({ logAudit: audit, logAuditRequired: audit, logAuditRequiredWithId: audit }));
    vi.doMock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    await PATCH(makeRequest({ editReviewStatus: "APPROVED" }), { params: { lessonId: "cc-1" } });
    expect(mockNotif).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "teacher-1" }) })
    );
  });

  it("reject creates NotificationInboxItem for teacher with reason", async () => {
    const mockNotif = vi.fn(async () => ({}));
    const mockUpdate = vi.fn(async () => ({ id: "cc-1", editReviewStatus: "REJECTED" }));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", title: "Bad Lesson", editedById: "teacher-1", editReviewStatus: "PENDING",
          })),
          update: mockUpdate,
        },
        notificationInboxItem: { create: mockNotif },
        $transaction: vi.fn(async (callback: any) => callback({
          curriculumContent: { update: mockUpdate },
        })),
      },
    }));
    const audit = vi.fn(async () => {});
    vi.doMock("@/lib/audit", () => ({ logAudit: audit, logAuditRequired: audit, logAuditRequiredWithId: audit }));
    vi.doMock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
    const { PATCH } = await import("@/app/api/admin/content-review/[lessonId]/route");
    await PATCH(
      makeRequest({ editReviewStatus: "REJECTED", rejectionReason: "Inaccurate" }),
      { params: { lessonId: "cc-1" } }
    );
    expect(mockNotif).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "teacher-1" }) })
    );
  });

  it("migration SQL file exists", async () => {
    const { existsSync } = await import("fs");
    expect(
      existsSync(
        "prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql"
      )
    ).toBe(true);
  });
});
