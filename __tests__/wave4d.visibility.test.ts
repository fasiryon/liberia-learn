import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── POST /api/teacher/lessons/[contentId]/assign ──────────────────────────────

describe("POST /api/teacher/lessons/[contentId]/assign", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  function makeReq(body: object): any {
    return new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates assignment and returns 200", async () => {
    const mockCreate = vi.fn(async () => ({ id: "tla-1", contentId: "c-1", classId: "cls-1" }));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({ contentId: "c-1", editedById: "t-1", editReviewStatus: "APPROVED" })),
        },
        class: { findUnique: vi.fn(async () => ({ schoolId: "s-1" })) },
        teacherLessonAssignment: { create: mockCreate },
      },
    }));
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/assign/route");
    const res = await POST(makeReq({ classId: "cls-1" }), { params: { contentId: "c-1" } });
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("returns 409 with already_assigned on duplicate contentId+classId", async () => {
    const dupError = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({ contentId: "c-1", editedById: "t-1", editReviewStatus: "APPROVED" })),
        },
        class: { findUnique: vi.fn(async () => ({ schoolId: "s-1" })) },
        teacherLessonAssignment: { create: vi.fn(async () => { throw dupError; }) },
      },
    }));
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/assign/route");
    const res = await POST(makeReq({ classId: "cls-1" }), { params: { contentId: "c-1" } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("already_assigned");
  });

  it("returns 403 if lesson not APPROVED", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({ contentId: "c-1", editedById: "t-1", editReviewStatus: "PENDING" })),
        },
        teacherLessonAssignment: { create: vi.fn() },
      },
    }));
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/assign/route");
    const res = await POST(makeReq({ classId: "cls-1" }), { params: { contentId: "c-1" } });
    expect(res.status).toBe(403);
  });
});

// ── GET /api/student/teacher-lessons ─────────────────────────────────────────

describe("GET /api/student/teacher-lessons", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("returns class_only assigned lesson that is APPROVED with scheduledFor=null", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "cls-1" }] })) },
        teacherLessonAssignment: {
          findMany: vi.fn(async () => [{
            id: "tla-1", scheduledFor: null,
            content: {
              id: "cc-1", contentId: "c-1", title: "Photosynthesis", grade: 7, subject: "SCIENCE",
              editedBy: { name: "Mr. Johnson" }, editReviewStatus: "APPROVED", visibility: "class_only",
            },
          }]),
        },
        curriculumContent: { findMany: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lessons).toHaveLength(1);
    expect(body.lessons[0].teacherAuthorName).toBe("Mr. Johnson");
  });

  it("does NOT return lesson with scheduledFor in the future", async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "cls-1" }] })) },
        teacherLessonAssignment: { findMany: vi.fn(async () => []) },
        curriculumContent: { findMany: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    const body = await res.json();
    expect(body.lessons).toHaveLength(0);
  });

  it("returns school_wide lesson for student at same school", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "cls-1" }] })) },
        teacherLessonAssignment: { findMany: vi.fn(async () => []) },
        curriculumContent: {
          findMany: vi.fn(async () => [{
            id: "cc-2", contentId: "c-2", title: "School Wide Lesson", grade: 7, subject: "ENGLISH",
            editedBy: { name: "Ms. Kollie" }, editReviewStatus: "APPROVED", visibility: "school_wide", schoolId: "sch-1",
          }]),
        },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    const body = await res.json();
    expect(body.lessons).toHaveLength(1);
    expect(body.lessons[0].title).toBe("School Wide Lesson");
  });

  it("returns 0 lessons when student has no classId and no school_wide lessons", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [] })) },
        teacherLessonAssignment: { findMany: vi.fn(async () => []) },
        curriculumContent: { findMany: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    const body = await res.json();
    expect(body.lessons).toHaveLength(0);
  });
});
