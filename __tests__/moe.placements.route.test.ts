import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockPlacementFindMany = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockMoeEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/serverFlags", () => ({
  isMoePortalEnabled: mockMoeEnabled,
}));

vi.mock("@/lib/logging/requestLogger", () => ({
  withRequestLogging: (_route: string, handler: any) => handler,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    placementTest: {
      findMany: mockPlacementFindMany,
    },
    school: {
      findMany: mockSchoolFindMany,
    },
  },
}));

describe("moe placements route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockMoeEnabled.mockReturnValue(true);
    mockRequireUser.mockResolvedValue({
      id: "moe-1",
      role: "MOE_OFFICIAL",
      isPlatformAdmin: false,
    });
  });

  it("requires an MOE official or platform admin", async () => {
    mockRequireUser.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      isPlatformAdmin: false,
    });

    const { GET } = await import("@/app/api/moe/placements/route");
    const response = await GET();

    expect(response.status).toBe(403);
  }, 15_000);

  it("NR-8: returns 200 for MOE_SUPER_ADMIN (previously excluded by a literal MOE_OFFICIAL-only check)", async () => {
    mockRequireUser.mockResolvedValue({
      id: "moe-super-1",
      role: "MOE_SUPER_ADMIN",
      isPlatformAdmin: false,
    });
    mockPlacementFindMany.mockResolvedValue([]);
    mockSchoolFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/moe/placements/route");
    const response = await GET();

    expect(response.status).toBe(200);
  }, 15_000);

  it("returns district override patterns without PII", async () => {
    mockPlacementFindMany.mockResolvedValue([
      {
        band: "developing",
        teacherDecision: "confirmed",
        teacherReason: null,
        details: { confidence: "high" },
        student: { user: { schoolId: "school-cha" } },
      },
      {
        band: "developing",
        teacherDecision: "overridden",
        teacherReason: "Teacher had stronger class evidence.",
        details: { confidence: "medium" },
        student: { user: { schoolId: "school-cha" } },
      },
    ]);
    mockSchoolFindMany.mockResolvedValue([
      {
        id: "school-cha",
        districtId: "district-1",
        district: "District 1",
        District: { id: "district-1", name: "District 1" },
      },
    ]);

    const { GET } = await import("@/app/api/moe/placements/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.totalStudentsPlaced).toBe(2);
    expect(payload.mostCommonPlacementBand).toBe("developing");
    expect(payload.byDistrict[0]).toEqual(
      expect.objectContaining({
        districtName: "District 1",
        studentsPlaced: 2,
        overrideRate: 50,
        avgAiConfidence: 80,
      })
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MOE_PLACEMENT_ANALYTICS_VIEW",
      })
    );
  }, 15_000);
});
