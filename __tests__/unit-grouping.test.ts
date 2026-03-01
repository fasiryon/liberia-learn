import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsUnitGroupingEnabled = vi.hoisted(() => vi.fn());

const mockCurriculumUnitCreate = vi.hoisted(() => vi.fn());
const mockCurriculumUnitFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumContentGroupBy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isUnitGroupingEnabled: mockIsUnitGroupingEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumUnit: {
      create: mockCurriculumUnitCreate,
      findMany: mockCurriculumUnitFindMany,
    },
    curriculumContent: {
      groupBy: mockCurriculumContentGroupBy,
    },
  },
}));

import { POST } from "@/app/api/admin/curriculum/units/route";
import { GET } from "@/app/api/teacher/curriculum/units/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_USER = { id: "admin-1", schoolId: "school-1", role: "ADMIN" };
const TEACHER_USER = { id: "teacher-1", schoolId: "school-1", role: "TEACHER" };

const UNIT_RECORD = {
  unitId: "unit-uuid-1",
  name: "Fractions Unit",
  description: "A two-week unit on fractions",
  subject: "MATH",
  grade: 4,
  schoolId: "school-1",
  targetStandardCodes: ["MATH-G4-NUM-01", "MATH-G4-NUM-02"],
  weekStart: 1,
  weekEnd: 2,
  createdById: "admin-1",
  createdAt: new Date("2026-03-01"),
};

function makePostRequest(body: object) {
  return new Request("http://localhost/api/admin/curriculum/units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeGetRequest(params = "") {
  return new Request(`http://localhost/api/teacher/curriculum/units${params}`) as any;
}

// ─── Tests: POST /api/admin/curriculum/units ──────────────────────────────────

describe("POST /api/admin/curriculum/units", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_USER);
    mockIsUnitGroupingEnabled.mockReturnValue(true);
    mockCurriculumUnitCreate.mockResolvedValue(UNIT_RECORD);
  });

  it("returns 404 when ENABLE_UNIT_GROUPING flag is OFF", async () => {
    mockIsUnitGroupingEnabled.mockReturnValue(false);

    const res = await POST(makePostRequest({ name: "Unit", subject: "MATH", grade: 4, weekStart: 1, weekEnd: 2 }));

    expect(res.status).toBe(404);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makePostRequest({ subject: "MATH", grade: 4, weekStart: 1, weekEnd: 2 })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/name/i);
    expect(mockCurriculumUnitCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when subject is missing", async () => {
    const res = await POST(
      makePostRequest({ name: "Fractions Unit", grade: 4, weekStart: 1, weekEnd: 2 })
    );

    expect(res.status).toBe(400);
    expect(mockCurriculumUnitCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when grade is missing", async () => {
    const res = await POST(
      makePostRequest({ name: "Fractions Unit", subject: "MATH", weekStart: 1, weekEnd: 2 })
    );

    expect(res.status).toBe(400);
    expect(mockCurriculumUnitCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when weekStart is missing", async () => {
    const res = await POST(
      makePostRequest({ name: "Fractions Unit", subject: "MATH", grade: 4, weekEnd: 2 })
    );

    expect(res.status).toBe(400);
    expect(mockCurriculumUnitCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when weekEnd is missing", async () => {
    const res = await POST(
      makePostRequest({ name: "Fractions Unit", subject: "MATH", grade: 4, weekStart: 1 })
    );

    expect(res.status).toBe(400);
    expect(mockCurriculumUnitCreate).not.toHaveBeenCalled();
  });

  it("returns 200 with created unit on valid body", async () => {
    const res = await POST(
      makePostRequest({
        name: "Fractions Unit",
        subject: "MATH",
        grade: 4,
        weekStart: 1,
        weekEnd: 2,
        targetStandardCodes: ["MATH-G4-NUM-01"],
        description: "A two-week unit on fractions",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.unit).toBeDefined();
    expect(json.unit.name).toBe("Fractions Unit");
    expect(json.unit.unitId).toBe("unit-uuid-1");
  });

  it("creates unit with correct schoolId from user context", async () => {
    await POST(
      makePostRequest({ name: "Unit", subject: "MATH", grade: 4, weekStart: 1, weekEnd: 2 })
    );

    const createArgs = mockCurriculumUnitCreate.mock.calls[0][0];
    expect(createArgs.data.schoolId).toBe("school-1");
    expect(createArgs.data.createdById).toBe("admin-1");
  });

  it("defaults targetStandardCodes to empty array when not provided", async () => {
    await POST(
      makePostRequest({ name: "Unit", subject: "MATH", grade: 4, weekStart: 1, weekEnd: 2 })
    );

    const createArgs = mockCurriculumUnitCreate.mock.calls[0][0];
    expect(createArgs.data.targetStandardCodes).toEqual([]);
  });
});

// ─── Tests: GET /api/teacher/curriculum/units ─────────────────────────────────

describe("GET /api/teacher/curriculum/units", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockIsUnitGroupingEnabled.mockReturnValue(true);
    mockCurriculumUnitFindMany.mockResolvedValue([UNIT_RECORD]);
    mockCurriculumContentGroupBy.mockResolvedValue([
      { unitId: "unit-uuid-1", _count: { id: 5 } },
    ]);
  });

  it("returns 404 when ENABLE_UNIT_GROUPING flag is OFF", async () => {
    mockIsUnitGroupingEnabled.mockReturnValue(false);

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(404);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("returns units with lessonCount for teacher's school", async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.units).toHaveLength(1);
    expect(json.units[0].unitId).toBe("unit-uuid-1");
    expect(json.units[0].lessonCount).toBe(5);
  });

  it("filters by schoolId in DB query (tenant isolation)", async () => {
    await GET(makeGetRequest());

    const findManyArgs = mockCurriculumUnitFindMany.mock.calls[0][0];
    expect(findManyArgs.where.schoolId).toBe("school-1");
  });

  it("does not include units from a different school (tenant isolation)", async () => {
    // Simulate DB returning results already filtered by schoolId
    mockCurriculumUnitFindMany.mockResolvedValue([]);
    mockCurriculumContentGroupBy.mockResolvedValue([]);

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.units).toHaveLength(0);
  });

  it("lessonCount defaults to 0 when no lessons are linked to a unit", async () => {
    mockCurriculumContentGroupBy.mockResolvedValue([]); // no lesson counts returned

    const res = await GET(makeGetRequest());

    const json = await res.json();
    expect(json.units[0].lessonCount).toBe(0);
  });

  it("passes grade filter to DB query when provided", async () => {
    await GET(makeGetRequest("?grade=4"));

    const findManyArgs = mockCurriculumUnitFindMany.mock.calls[0][0];
    expect(findManyArgs.where.grade).toBe(4);
  });

  it("passes subject filter to DB query when provided", async () => {
    await GET(makeGetRequest("?subject=MATH"));

    const findManyArgs = mockCurriculumUnitFindMany.mock.calls[0][0];
    expect(findManyArgs.where.subject).toBe("MATH");
  });

  it("returns multiple units each with correct lessonCount", async () => {
    const secondUnit = { ...UNIT_RECORD, unitId: "unit-uuid-2", name: "Decimals Unit" };
    mockCurriculumUnitFindMany.mockResolvedValue([UNIT_RECORD, secondUnit]);
    mockCurriculumContentGroupBy.mockResolvedValue([
      { unitId: "unit-uuid-1", _count: { id: 5 } },
      { unitId: "unit-uuid-2", _count: { id: 3 } },
    ]);

    const res = await GET(makeGetRequest());

    const json = await res.json();
    expect(json.units).toHaveLength(2);
    expect(json.units.find((u: any) => u.unitId === "unit-uuid-1").lessonCount).toBe(5);
    expect(json.units.find((u: any) => u.unitId === "unit-uuid-2").lessonCount).toBe(3);
  });
});
