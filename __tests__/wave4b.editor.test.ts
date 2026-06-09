import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// ── POST /api/teacher/lessons/[contentId]/fork ────────────────────────────────

describe("POST /api/teacher/lessons/[contentId]/fork", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  function makeReq() {
    return new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }) as unknown as NextRequest;
  }

  function setupMocks(source: object, createFn = vi.fn(async () => ({ id: "new-id", contentId: "new-cc" }))) {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: { curriculumContent: { findUnique: vi.fn(async () => source), create: createFn } },
    }));
  }

  it("returns 403 if source is not APPROVED", async () => {
    setupMocks({ id: "src", contentId: "c-src", teacherCreated: false, editReviewStatus: "PENDING", editedById: null, lessonVersion: 1 });
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/fork/route");
    const res = await POST(makeReq(), { params: { contentId: "c-src" } });
    expect(res.status).toBe(403);
  });

  it("fork AI lesson: lessonVersion=1, parentLessonId=null, derivedFromContentId set", async () => {
    const mockCreate = vi.fn(async () => ({ id: "n-1", contentId: "n-cc" }));
    setupMocks({
      id: "src", contentId: "c-src", teacherCreated: false, editReviewStatus: "APPROVED",
      editedById: null, lessonVersion: 1, title: "AI Lesson", grade: 5, subject: "MATH", payload: {},
    }, mockCreate);
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/fork/route");
    const res = await POST(makeReq(), { params: { contentId: "c-src" } });
    expect(res.status).toBe(200);
    const createCall = (mockCreate.mock.calls as any)[0][0].data;
    expect(createCall.lessonVersion).toBe(1);
    expect(createCall.parentLessonId).toBeNull();
    expect(createCall.derivedFromContentId).toBe("c-src");
  });

  it("fork own teacher lesson: lessonVersion=parent+1, parentLessonId=parent.id", async () => {
    const mockCreate = vi.fn(async () => ({ id: "n-1", contentId: "n-cc" }));
    setupMocks({
      id: "src-id", contentId: "c-src", teacherCreated: true, editReviewStatus: "APPROVED",
      editedById: "t-1", lessonVersion: 2, title: "My Lesson", grade: 7, subject: "SCIENCE", payload: {},
    }, mockCreate);
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/fork/route");
    const res = await POST(makeReq(), { params: { contentId: "c-src" } });
    expect(res.status).toBe(200);
    const createCall = (mockCreate.mock.calls as any)[0][0].data;
    expect(createCall.lessonVersion).toBe(3);
    expect(createCall.parentLessonId).toBe("src-id");
    expect(createCall.derivedFromContentId).toBeNull();
  });

  it("fork other teacher lesson: lessonVersion=1, parentLessonId=null, derivedFromContentId set", async () => {
    const mockCreate = vi.fn(async () => ({ id: "n-1", contentId: "n-cc" }));
    setupMocks({
      id: "src-id", contentId: "c-src", teacherCreated: true, editReviewStatus: "APPROVED",
      editedById: "other-teacher", lessonVersion: 1, title: "Their Lesson", grade: 6, subject: "ENGLISH", payload: {},
    }, mockCreate);
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/fork/route");
    const res = await POST(makeReq(), { params: { contentId: "c-src" } });
    expect(res.status).toBe(200);
    const createCall = (mockCreate.mock.calls as any)[0][0].data;
    expect(createCall.lessonVersion).toBe(1);
    expect(createCall.parentLessonId).toBeNull();
    expect(createCall.derivedFromContentId).toBe("c-src");
  });
});

// ── GET /api/teacher/lessons/forkable ────────────────────────────────────────

describe("GET /api/teacher/lessons/forkable", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("returns approved non-teacher-created lessons filtered by query", async () => {
    const mockFindMany = vi.fn(async () => [
      { id: "cc-1", contentId: "c-1", title: "Fractions", grade: 4, subject: "MATH" },
    ]);
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({ prisma: { curriculumContent: { findMany: mockFindMany } } }));
    const { GET } = await import("@/app/api/teacher/lessons/forkable/route");
    const res = await GET(new Request("http://localhost/api/teacher/lessons/forkable?q=frac") as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.lessons)).toBe(true);
    expect(body.lessons).toHaveLength(1);
  });

  it("returns empty array when no match", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: { curriculumContent: { findMany: vi.fn(async () => []) } },
    }));
    const { GET } = await import("@/app/api/teacher/lessons/forkable/route");
    const res = await GET(new Request("http://localhost/api/teacher/lessons/forkable") as unknown as NextRequest);
    const body = await res.json();
    expect(body.lessons).toHaveLength(0);
  });
});
