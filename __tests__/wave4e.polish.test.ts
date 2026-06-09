import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

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
      requireRole: vi.fn(async () => ({ id: "m-1", role: "MOE_OFFICIAL" })),
    }));
    vi.doMock("@/lib/cache/redisCache", () => ({
      withRedisCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          count: vi.fn(async () => 12),
          groupBy: vi.fn(async () => [{ schoolId: "sch-1", _count: { id: 5 } }]),
        },
        school: { findMany: vi.fn(async () => [{ id: "sch-1", name: "CHA School" }]) },
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
});
