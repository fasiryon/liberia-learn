import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsUnitAssemblyEnabled = vi.hoisted(() => vi.fn());
const mockAssembleUnit = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockAuditLogCount = vi.hoisted(() => vi.fn());
const mockUnitFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isUnitAssemblyEnabled: mockIsUnitAssemblyEnabled,
  };
});

vi.mock("@/lib/ai/units/unitAssembler", () => ({
  assembleUnit: mockAssembleUnit,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { count: mockAuditLogCount },
    curriculumUnit: { findMany: mockUnitFindMany },
    curriculumContent: { findMany: mockCurriculumFindMany },
  },
}));

import { GET, POST } from "@/app/api/admin/curriculum/units/route";

const adminUser = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

function makePostReq(body: unknown) {
  return new Request("http://localhost/api/admin/curriculum/units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeGetReq(query = "") {
  return new Request(`http://localhost/api/admin/curriculum/units${query}`) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue(adminUser);
  mockIsUnitAssemblyEnabled.mockReturnValue(true);
  mockAuditLogCount.mockResolvedValue(0);
  mockAssembleUnit.mockResolvedValue({
    unit: { unitId: "unit-1" },
    lessons: Array.from({ length: 7 }, (_, index) => ({ id: `lesson-${index + 1}` })),
  });
  mockUnitFindMany.mockResolvedValue([
    {
      id: "db-1",
      unitId: "unit-1",
      name: "Number Sense",
      description: "Understand place value and operations.",
      subject: "MATH",
      grade: 5,
      weekStart: 1,
      weekEnd: 2,
      createdAt: new Date("2026-03-12T10:00:00.000Z"),
    },
  ]);
  mockCurriculumFindMany.mockResolvedValue([
    {
      id: "lesson-1",
      contentId: "lesson-1",
      contentType: "lesson",
      lessonType: "intro",
      orderInUnit: 1,
      status: "published",
      unitId: "unit-1",
      payload: { title: "Intro to Number Sense" },
    },
  ]);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("admin curriculum units route", () => {
  it("validates subject and gradeLevel on POST", async () => {
    const res = await POST(
      makePostReq({
        subject: "INVALID",
        gradeLevel: 14,
        unitTitle: "Number Sense",
      })
    );

    expect(res.status).toBe(422);
    expect(mockAssembleUnit).not.toHaveBeenCalled();
  });

  it("rejects non-admin roles", async () => {
    mockRequireUser.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await POST(
      makePostReq({
        subject: "MATH",
        gradeLevel: 5,
        unitTitle: "Number Sense",
      })
    );

    expect(res.status).toBe(403);
  });

  it("returns scoped unit list results for the current school", async () => {
    const res = await GET(makeGetReq("?subject=MATH&gradeLevel=5"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.units).toHaveLength(1);
    expect(body.units[0].lessonCount).toBe(1);
    expect(mockUnitFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          subject: "MATH",
          grade: 5,
        }),
      })
    );
  });

  it("gates the route when ENABLE_UNIT_ASSEMBLY is disabled", async () => {
    mockIsUnitAssemblyEnabled.mockReturnValue(false);

    const res = await POST(
      makePostReq({
        subject: "MATH",
        gradeLevel: 5,
        unitTitle: "Number Sense",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("unit_assembly_disabled");
  });
});
