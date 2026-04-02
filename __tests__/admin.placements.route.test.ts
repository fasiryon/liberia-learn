import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockPlacementFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    placementTest: {
      findMany: mockPlacementFindMany,
    },
  },
}));

describe("admin placements route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-cha",
      isPlatformAdmin: false,
    });
  });

  it("is school-scoped for admins", async () => {
    mockPlacementFindMany.mockResolvedValue([
      {
        id: "placement-1",
        estimatedGrade: 6,
        band: "proficient",
        levelLabel: "Proficient",
        teacherGrade: null,
        teacherDecision: null,
        teacherReason: null,
        aiAnalysis: { overallNarrative: "Strong work." },
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        student: {
          currentGrade: 5,
          user: {
            name: "Miatta Doe",
            email: "miatta@example.com",
          },
        },
      },
    ]);

    const { GET } = await import("@/app/api/admin/placements/route");
    const response = await GET(new Request("http://localhost/api/admin/placements") as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockPlacementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          student: {
            user: {
              schoolId: "school-cha",
            },
          },
        },
      })
    );
    expect(payload.placements).toHaveLength(1);
  }, 15_000);

  it("calculates override rate from reviewed placements only", async () => {
    mockPlacementFindMany.mockResolvedValue([
      {
        id: "placement-confirmed",
        estimatedGrade: 6,
        band: "proficient",
        levelLabel: "Proficient",
        teacherGrade: null,
        teacherDecision: "confirmed",
        teacherReason: null,
        aiAnalysis: null,
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        student: { currentGrade: 6, user: { name: "A", email: "a@example.com" } },
      },
      {
        id: "placement-overridden",
        estimatedGrade: 5,
        band: "developing",
        levelLabel: "Developing",
        teacherGrade: 6,
        teacherDecision: "overridden",
        teacherReason: "Teacher had stronger classroom evidence.",
        aiAnalysis: null,
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        student: { currentGrade: 6, user: { name: "B", email: "b@example.com" } },
      },
      {
        id: "placement-pending",
        estimatedGrade: 4,
        band: "foundational",
        levelLabel: "Foundational",
        teacherGrade: null,
        teacherDecision: null,
        teacherReason: null,
        aiAnalysis: null,
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        student: { currentGrade: 4, user: { name: "C", email: "c@example.com" } },
      },
    ]);

    const { GET } = await import("@/app/api/admin/placements/route");
    const response = await GET(new Request("http://localhost/api/admin/placements") as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary.aiConfirmed).toBe(1);
    expect(payload.summary.aiOverridden).toBe(1);
    expect(payload.summary.overrideRate).toBe(50);
    expect(payload.summary.calibrationSignal.label).toBe("AI needs recalibration");
  }, 15_000);
});
