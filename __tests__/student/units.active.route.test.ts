import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledFindMany = vi.hoisted(() => vi.fn());
const mockContentFindMany = vi.hoisted(() => vi.fn());
const mockUnitFindFirst = vi.hoisted(() => vi.fn());
const mockProgressFindMany = vi.hoisted(() => vi.fn());
const mockPrereqFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    scheduledWork: { findMany: mockScheduledFindMany },
    curriculumContent: { findMany: mockContentFindMany },
    curriculumUnit: { findFirst: mockUnitFindFirst },
    studentProgress: { findMany: mockProgressFindMany },
    lessonPrerequisite: { findMany: mockPrereqFindMany },
  },
}));

describe("GET /api/student/units/active", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mockUnitFindFirst.mockResolvedValue(null);
    mockPrereqFindMany.mockResolvedValue([]);
  });

  it("returns active unit summaries, least complete first", async () => {
    mockStudentFindUnique.mockResolvedValue({ enrollments: [{ Class: { id: "class-1" } }] });
    mockScheduledFindMany.mockResolvedValue([{ contentId: "c1" }, { contentId: "c2" }]);
    // curriculumContent.findMany is used twice: unitId resolution + lesson load
    mockContentFindMany.mockImplementation(async (args: any) => {
      if (args?.where?.unitId && typeof args.where.unitId === "string") {
        return [
          { id: "p1", contentId: "c1", title: "Topic: A", orderInUnit: 1, lessonType: "core", grade: 8, subject: "MATH" },
          { id: "p2", contentId: "c2", title: "Topic: B", orderInUnit: 2, lessonType: "core", grade: 8, subject: "MATH" },
        ];
      }
      return [{ unitId: "u1" }, { unitId: "u1" }];
    });
    mockProgressFindMany.mockResolvedValue([
      { completedAt: new Date(), scheduledWork: { id: "sw1", contentId: "c1" } },
    ]);

    const { GET } = await import("@/app/api/student/units/active/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      unitId: "u1",
      unitName: "Topic",
      totalCount: 2,
      completedCount: 1,
      completionPct: 50,
    });
  }, 15_000);

  it("returns an empty list when the student has no enrollments", async () => {
    mockStudentFindUnique.mockResolvedValue({ enrollments: [] });

    const { GET } = await import("@/app/api/student/units/active/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  }, 15_000);
});
