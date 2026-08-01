import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// @sentry/nextjs's real module does OpenTelemetry/instrumentation setup on
// first import, which occasionally pushes the first cold-imported test in
// this file (via app/api/student/flag-content/route -> handleApiError) past
// vitest's default 5000ms timeout - a pure test-infra flake unrelated to the
// route's own logic. Mocking it removes the real SDK from the import graph
// entirely rather than papering over the symptom with a longer timeout.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// ── POST /api/student/flag-content ───────────────────────────────────────────

describe("POST /api/student/flag-content", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  function makeReq(body: object) {
    return new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest;
  }

  it("creates LessonHelpFlag and returns 200", async () => {
    const mockCreate = vi.fn(async () => ({ id: "flag-1" }));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonHelpFlag: {
          findUnique: vi.fn(async () => null),
          create: mockCreate,
          count: vi.fn(async () => 1),
        },
        curriculumContent: { findUnique: vi.fn(async () => null) },
        user: { findFirst: vi.fn(async () => null) },
      },
    }));
    const { POST } = await import("@/app/api/student/flag-content/route");
    const res = await POST(makeReq({ contentId: "c-1", reason: "inappropriate_content" }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("dedup: second flag from same student returns 200 no-op without creating", async () => {
    const mockCreate = vi.fn();
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonHelpFlag: {
          findUnique: vi.fn(async () => ({ id: "existing-flag" })),
          create: mockCreate,
          count: vi.fn(async () => 1),
        },
      },
    }));
    const { POST } = await import("@/app/api/student/flag-content/route");
    const res = await POST(makeReq({ contentId: "c-1", reason: "factually_wrong" }));
    expect(res.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("3+ flags triggers principal notification", async () => {
    const mockNotif = vi.fn(async () => ({}));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-3", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonHelpFlag: {
          findUnique: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: "f-new" })),
          count: vi.fn(async () => 3),
        },
        curriculumContent: {
          findUnique: vi.fn(async () => ({ schoolId: "sch-1", title: "Bad Lesson" })),
        },
        user: { findFirst: vi.fn(async () => ({ id: "principal-1" })) },
        notificationInboxItem: { create: mockNotif },
      },
    }));
    const { POST } = await import("@/app/api/student/flag-content/route");
    await POST(makeReq({ contentId: "c-1", reason: "inappropriate_content" }));
    expect(mockNotif).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "principal-1" }) })
    );
  });
});

// ── GET /api/moe/teacher-lessons ─────────────────────────────────────────────

describe("GET /api/moe/teacher-lessons", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("returns totalPublished count and bySchool breakdown", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn(async () => ({ id: "m-1", role: "MOE_OFFICIAL", isPlatformAdmin: false })),
    }));
    vi.doMock("@/lib/cache/redisCache", () => ({
      withRedisCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          count: vi.fn(async () => 12),
          groupBy: vi.fn(async () => [{ schoolId: "sch-1", _count: { id: 5 } }]),
          findMany: vi.fn(async () => []),
        },
        school: { findMany: vi.fn(async () => [{ id: "sch-1", name: "CHA School" }]) },
        teacherLessonAssignment: { groupBy: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/moe/teacher-lessons/route");
    const res = await GET(new Request("http://localhost/api/moe/teacher-lessons"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.totalPublished).toBe("number");
    expect(body.totalPublished).toBe(12);
    expect(Array.isArray(body.bySchool)).toBe(true);
    expect(body.bySchool[0].lessonCount).toBe(5);
  });
});

// ── wave4-audit script logic ──────────────────────────────────────────────────

describe("wave4-audit: scripts/wave4-audit.ts exists", () => {
  it("audit script file exists", async () => {
    const { existsSync } = await import("fs");
    expect(existsSync("scripts/wave4-audit.ts")).toBe(true);
  });

  it("audit script contains all 5 integrity checks", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("scripts/wave4-audit.ts", "utf-8");
    expect(src).toContain("publishedAt");
    expect(src).toContain("editedById");
    expect(src).toContain("lessonVersion");
    expect(src).toContain("parentLessonId");
    expect(src).toContain("TeacherLessonAssignment");
  });
});

// ── school-wide excludes own lessons ─────────────────────────────────────────

describe("GET /api/teacher/lessons/school-wide excludes own lessons", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("passes editedById: { not: user.id } to the query", async () => {
    const mockFindMany = vi.fn(async () => []);
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: { curriculumContent: { findMany: mockFindMany } },
    }));
    const { GET } = await import("@/app/api/teacher/lessons/school-wide/route");
    await GET();
    const query = (mockFindMany.mock.calls as any)[0]?.[0];
    expect(JSON.stringify(query?.where)).toContain("not");
    // editedById: { not: "t-1" } — own lessons excluded
    expect(JSON.stringify(query?.where?.editedById)).toContain("t-1");
  });

  it("only returns APPROVED school_wide lessons", async () => {
    const mockFindMany = vi.fn(async () => []);
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: { curriculumContent: { findMany: mockFindMany } },
    }));
    const { GET } = await import("@/app/api/teacher/lessons/school-wide/route");
    await GET();
    const query = (mockFindMany.mock.calls as any)[0]?.[0];
    expect(query?.where?.visibility).toBe("school_wide");
    expect(query?.where?.editReviewStatus).toBe("APPROVED");
  });
});

// ── v1 still visible when v2 is draft ────────────────────────────────────────

describe("teacher lesson versioning — v1 visible while v2 is draft", () => {
  it("fork creates new draft with editReviewStatus=null, existing v1 unchanged", async () => {
    // When teacher forks their own APPROVED lesson:
    // - New lesson is created with editReviewStatus=null (draft)
    // - Existing v1 lesson editReviewStatus stays APPROVED
    // This test verifies the fork route does NOT update the parent lesson status
    vi.resetModules();
    const mockCreate = vi.fn(async () => ({ id: "v2-id", contentId: "v2-cc" }));
    const mockUpdate = vi.fn();
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "v1-id", contentId: "v1-cc", teacherCreated: true, editReviewStatus: "APPROVED",
            editedById: "t-1", lessonVersion: 1, title: "Photosynthesis", grade: 7, subject: "SCIENCE", payload: {},
          })),
          create: mockCreate,
          update: mockUpdate,
        },
      },
    }));
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/fork/route");
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: "{}" }) as any,
      { params: { contentId: "v1-cc" } }
    );
    expect(res.status).toBe(200);
    // v2 created with editReviewStatus: null (draft)
    const createData = (mockCreate.mock.calls[0] as any)[0].data;
    expect(createData.editReviewStatus).toBeNull();
    expect(createData.lessonVersion).toBe(2);
    expect(createData.parentLessonId).toBe("v1-id");
    // v1's status was NOT updated (no update call on the parent)
    expect(mockUpdate).not.toHaveBeenCalled();
    vi.resetAllMocks();
  });
});
