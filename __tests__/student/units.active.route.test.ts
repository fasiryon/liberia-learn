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
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-a" });
    mockUnitFindFirst.mockResolvedValue(null);
    mockPrereqFindMany.mockResolvedValue([]);
  });

  it("returns active unit summaries, in catalog order", async () => {
    mockStudentFindUnique.mockResolvedValue({ enrollments: [{ classId: "class-1", Class: { id: "class-1", schoolId: "school-a" } }] });
    mockScheduledFindMany.mockResolvedValue([{ contentId: "c1" }, { contentId: "c2" }]);
    // curriculumContent.findMany is used twice: unitId resolution + lesson load
    mockContentFindMany.mockImplementation(async (args: any) => {
      if (args?.where?.AND?.[2]?.unitId && typeof args.where.AND[2].unitId === "string") {
        return [
          { id: "p1", contentId: "c1", title: "Topic: A", orderInUnit: 1, lessonType: "core", grade: 8, subject: "MATH", status: "published", visibility: "public", payload: {}, schoolId: null, teacherCreated: false },
          { id: "p2", contentId: "c2", title: "Topic: B", orderInUnit: 2, lessonType: "core", grade: 8, subject: "MATH", status: "published", visibility: "public", payload: {}, schoolId: null, teacherCreated: false },
        ];
      }
      return [{ unitId: "u1", contentId: "c1", status: "published", visibility: "public", payload: {}, schoolId: null, teacherCreated: false }];
    });
    mockProgressFindMany.mockResolvedValue([
      { completedAt: new Date(), scheduledWork: { id: "sw1", contentId: "c1" } },
    ]);

    const { GET } = await import("@/app/api/student/units/active/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
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
    expect(body).toMatchObject({ availability: "empty", eligibility: "not_enrolled", items: [] });
  }, 15_000);
});
