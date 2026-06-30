import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockContentFindFirst = vi.hoisted(() => vi.fn());
const mockContentFindMany = vi.hoisted(() => vi.fn());
const mockUnitFindFirst = vi.hoisted(() => vi.fn());
const mockProgressFindMany = vi.hoisted(() => vi.fn());
const mockPrereqFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: { findFirst: mockContentFindFirst, findMany: mockContentFindMany },
    curriculumUnit: { findFirst: mockUnitFindFirst },
    studentProgress: { findMany: mockProgressFindMany },
    lessonPrerequisite: { findMany: mockPrereqFindMany },
  },
}));

describe("GET /api/student/units/by-content/[contentId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mockUnitFindFirst.mockResolvedValue(null);
    mockProgressFindMany.mockResolvedValue([]);
    mockPrereqFindMany.mockResolvedValue([]);
  });

  function req(url = "http://localhost/api/student/units/by-content/c2") {
    return new Request(url);
  }

  it("returns the unit sequence with the requested lesson marked current", async () => {
    mockContentFindFirst.mockResolvedValue({ unitId: "u1" });
    mockContentFindMany.mockResolvedValue([
      { id: "p1", contentId: "c1", title: "Topic: One", orderInUnit: 1, lessonType: "core", grade: 8, subject: "MATH" },
      { id: "p2", contentId: "c2", title: "Topic: Two", orderInUnit: 2, lessonType: "core", grade: 8, subject: "MATH" },
    ]);
    mockProgressFindMany.mockResolvedValue([
      { completedAt: new Date(), scheduledWork: { id: "sw1", contentId: "c1" } },
    ]);

    const { GET } = await import("@/app/api/student/units/by-content/[contentId]/route");
    const res = await GET(req(), { params: { contentId: "c2" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unitId).toBe("u1");
    expect(body.unitName).toBe("Topic");
    expect(body.lessons).toHaveLength(2);
    expect(body.lessons.find((l: any) => l.contentId === "c1").status).toBe("completed");
    expect(body.lessons.find((l: any) => l.contentId === "c2").status).toBe("current");
    expect(body.completionPct).toBe(50);
  }, 15_000);

  it("returns 404 when the lesson has no unit", async () => {
    mockContentFindFirst.mockResolvedValue({ unitId: null });

    const { GET } = await import("@/app/api/student/units/by-content/[contentId]/route");
    const res = await GET(req(), { params: { contentId: "c2" } });
    expect(res.status).toBe(404);
  }, 15_000);
});
