import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── completeTeacherLesson ─────────────────────────────────────────────────────

describe("completeTeacherLesson", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  const APPROVED_CONTENT = {
    contentId: "c-1",
    teacherCreated: true,
    editReviewStatus: "APPROVED",
    visibility: "class_only",
    schoolId: "sch-1",
    editedById: "t-1",
  };

  function mockDb(overrides: Record<string, any> = {}) {
    const base = {
      curriculumContent: { findUnique: vi.fn(async () => APPROVED_CONTENT) },
      student: {
        findUnique: vi.fn(async () => ({ id: "stu-1", enrollments: [{ classId: "cls-1" }] })),
      },
      teacherLessonAssignment: {
        findFirst: vi.fn(async () => ({ classId: "cls-1" })),
      },
      scheduledWork: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "sw-virtual" })),
      },
    };
    return { prisma: { ...base, ...overrides } };
  }

  const mockComplete = vi.fn(async () => ({ completedAt: new Date(), exitTicketScore: null }));

  function mockPipeline() {
    vi.doMock("@/lib/student/completeScheduledLesson", () => ({
      completeScheduledLesson: mockComplete,
    }));
  }

  it("throws 404 when content is not teacher-created", async () => {
    vi.doMock("@/lib/db", () =>
      mockDb({
        curriculumContent: {
          findUnique: vi.fn(async () => ({ ...APPROVED_CONTENT, teacherCreated: false })),
        },
      })
    );
    mockPipeline();
    const { completeTeacherLesson } = await import("@/lib/student/completeTeacherLesson");
    await expect(completeTeacherLesson({ id: "u-1", schoolId: "sch-1" }, "c-1")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws 403 when lesson is not APPROVED (e.g. emergency-unpublished)", async () => {
    vi.doMock("@/lib/db", () =>
      mockDb({
        curriculumContent: {
          findUnique: vi.fn(async () => ({ ...APPROVED_CONTENT, editReviewStatus: "PENDING" })),
        },
      })
    );
    mockPipeline();
    const { completeTeacherLesson } = await import("@/lib/student/completeTeacherLesson");
    await expect(completeTeacherLesson({ id: "u-1", schoolId: "sch-1" }, "c-1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("throws 403 when lesson is neither assigned to student's class nor school_wide at their school", async () => {
    vi.doMock("@/lib/db", () =>
      mockDb({
        teacherLessonAssignment: { findFirst: vi.fn(async () => null) },
      })
    );
    mockPipeline();
    const { completeTeacherLesson } = await import("@/lib/student/completeTeacherLesson");
    await expect(completeTeacherLesson({ id: "u-1", schoolId: "sch-1" }, "c-1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("allows school_wide lesson at student's school without an assignment", async () => {
    const db = mockDb({
      curriculumContent: {
        findUnique: vi.fn(async () => ({ ...APPROVED_CONTENT, visibility: "school_wide" })),
      },
      teacherLessonAssignment: { findFirst: vi.fn(async () => null) },
    });
    vi.doMock("@/lib/db", () => db);
    mockPipeline();
    const { completeTeacherLesson } = await import("@/lib/student/completeTeacherLesson");
    await completeTeacherLesson({ id: "u-1", schoolId: "sch-1" }, "c-1");
    expect(mockComplete).toHaveBeenCalledWith({ user: { id: "u-1", schoolId: "sch-1" }, scheduledWorkId: "sw-virtual" });
  });

  it("creates a virtual ScheduledWork with sentinel date and teacher_lesson_virtual status", async () => {
    const db = mockDb();
    vi.doMock("@/lib/db", () => db);
    mockPipeline();
    const { completeTeacherLesson } = await import("@/lib/student/completeTeacherLesson");
    await completeTeacherLesson({ id: "u-1", schoolId: "sch-1" }, "c-1");

    const createArgs = (db.prisma.scheduledWork.create as any).mock.calls[0][0];
    expect(createArgs.data.status).toBe("teacher_lesson_virtual");
    expect(createArgs.data.contentId).toBe("c-1");
    expect(createArgs.data.classId).toBe("cls-1");
    expect(createArgs.data.createdById).toBe("t-1"); // lesson author, not the student
    // Sentinel date is far in the past — outside Today's same-day and
    // catch-up's trailing-14-day windows.
    expect(createArgs.data.scheduledDate.getUTCFullYear()).toBe(2001);
  });

  it("reuses an existing ScheduledWork instead of creating a duplicate", async () => {
    const db = mockDb({
      scheduledWork: {
        findFirst: vi.fn(async () => ({ id: "sw-existing" })),
        create: vi.fn(),
      },
    });
    vi.doMock("@/lib/db", () => db);
    mockPipeline();
    const { completeTeacherLesson } = await import("@/lib/student/completeTeacherLesson");
    await completeTeacherLesson({ id: "u-1", schoolId: "sch-1" }, "c-1");

    expect(db.prisma.scheduledWork.create).not.toHaveBeenCalled();
    expect(mockComplete).toHaveBeenCalledWith({ user: { id: "u-1", schoolId: "sch-1" }, scheduledWorkId: "sw-existing" });
  });

  it("delegates to completeScheduledLesson so the full pipeline runs (progress/cert/digest/league)", async () => {
    vi.doMock("@/lib/db", () => mockDb());
    mockPipeline();
    const { completeTeacherLesson } = await import("@/lib/student/completeTeacherLesson");
    const result = await completeTeacherLesson({ id: "u-1", schoolId: "sch-1" }, "c-1");
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty("completedAt");
  });
});

// ── POST /api/student/teacher-lessons/[contentId]/complete ───────────────────

describe("POST /api/student/teacher-lessons/[contentId]/complete", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with completedAt on success", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "u-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/student/completeTeacherLesson", () => ({
      completeTeacherLesson: vi.fn(async () => ({
        completedAt: new Date("2026-06-09T12:00:00Z"),
        exitTicketScore: null,
      })),
    }));
    const { POST } = await import("@/app/api/student/teacher-lessons/[contentId]/complete/route");
    const res = await POST(new Request("http://localhost/", { method: "POST" }), {
      params: { contentId: "c-1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.completedAt).toBeTruthy();
  });

  it("propagates status from completeTeacherLesson errors (403)", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "u-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/student/completeTeacherLesson", () => ({
      completeTeacherLesson: vi.fn(async () => {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }),
    }));
    const { POST } = await import("@/app/api/student/teacher-lessons/[contentId]/complete/route");
    const res = await POST(new Request("http://localhost/", { method: "POST" }), {
      params: { contentId: "c-1" },
    });
    expect(res.status).toBe(403);
  });
});

// ── GET /api/moe/teacher-lessons — topAssigned ────────────────────────────────

describe("GET /api/moe/teacher-lessons — topAssigned", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns topAssigned with title, author, and assignmentCount", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn(async () => ({ id: "m-1", role: "MOE_OFFICIAL", isPlatformAdmin: false })),
    }));
    vi.doMock("@/lib/cache/redisCache", () => ({
      withRedisCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          count: vi.fn(async () => 3),
          groupBy: vi.fn(async () => [{ schoolId: "sch-1", _count: { id: 3 } }]),
          findMany: vi.fn(async () => [
            {
              contentId: "c-top",
              title: "Photosynthesis",
              subject: "SCIENCE",
              grade: 7,
              editedBy: { name: "Mr. Johnson" },
            },
          ]),
        },
        school: { findMany: vi.fn(async () => [{ id: "sch-1", name: "CHA School" }]) },
        teacherLessonAssignment: {
          groupBy: vi.fn(async () => [{ contentId: "c-top", _count: { id: 4 } }]),
        },
      },
    }));
    const { GET } = await import("@/app/api/moe/teacher-lessons/route");
    const res = await GET(new Request("http://localhost/api/moe/teacher-lessons"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.topAssigned)).toBe(true);
    expect(body.topAssigned[0]).toMatchObject({
      contentId: "c-top",
      title: "Photosynthesis",
      teacherAuthorName: "Mr. Johnson",
      assignmentCount: 4,
    });
  });

  it("returns empty topAssigned when no assignments exist", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn(async () => ({ id: "m-1", role: "MOE_OFFICIAL", isPlatformAdmin: false })),
    }));
    vi.doMock("@/lib/cache/redisCache", () => ({
      withRedisCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          count: vi.fn(async () => 0),
          groupBy: vi.fn(async () => []),
          findMany: vi.fn(async () => []),
        },
        school: { findMany: vi.fn(async () => []) },
        teacherLessonAssignment: { groupBy: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/moe/teacher-lessons/route");
    const res = await GET(new Request("http://localhost/api/moe/teacher-lessons"));
    const body = await res.json();
    expect(body.topAssigned).toEqual([]);
  });
});

// ── MOE dashboard panel wiring ────────────────────────────────────────────────

describe("MOE dashboard — TeacherContentPanel wired", () => {
  it("dashboard page imports and renders TeacherContentPanel", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/moe/dashboard/page.tsx", "utf-8");
    expect(src).toContain('import { TeacherContentPanel } from "@/components/moe/TeacherContentPanel"');
    expect(src).toContain("<TeacherContentPanel />");
  });

  it("panel component fetches /api/moe/teacher-lessons", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("components/moe/TeacherContentPanel.tsx", "utf-8");
    expect(src).toContain("/api/moe/teacher-lessons");
    expect(src).toContain("Teacher Content");
  });
});

// ── Lesson viewer fires completion for teacher lessons ───────────────────────

describe("student lesson viewer — teacher lesson completion wired", () => {
  it("handleComplete POSTs to the teacher-lessons complete endpoint when teacherCreated", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/student/lesson/[contentId]/page.tsx", "utf-8");
    expect(src).toContain("metadata?.teacherCreated");
    expect(src).toContain("/api/student/teacher-lessons/${contentId}/complete");
  });

  it("curriculum API exposes teacherCreated in metadata", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/api/curriculum/[contentId]/route.ts", "utf-8");
    expect(src).toContain("teacherCreated: row.teacherCreated ?? false");
  });
});

// ── Certificate status-mismatch fix ───────────────────────────────────────────

describe("checkAndAwardCertificate — approved status set", () => {
  it("counts APPROVED and published statuses, not just legacy lowercase approved", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("lib/certificates/autoAwardCertificate.ts", "utf-8");
    // Both the totalLessons count and the completed-progress join must use
    // the full approved-status set. Prior to WAVE-4-FIX this filtered
    // status: "approved" — a value held by exactly 1 row in production,
    // making subject certificates unawardable.
    expect(src).toContain('["APPROVED", "published", "approved"]');
    expect(src).not.toMatch(/status: "approved"/);
  });
});
