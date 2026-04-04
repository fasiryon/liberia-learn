import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindMany = vi.hoisted(() => vi.fn());
const mockStandardFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: { findMany: mockCurriculumContentFindMany },
    standard: { findMany: mockStandardFindMany },
  },
}));

import { GET } from "@/app/api/admin/curriculum/waec-alignment/route";

const adminUser = {
  id: "admin-1",
  role: "ADMIN" as const,
  schoolId: "school-1",
  isPlatformAdmin: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue(adminUser);
  mockLogAudit.mockResolvedValue(undefined);
  mockCurriculumContentFindMany.mockResolvedValue([
    {
      moeAlignments: {
        standards: [{ code: "MATH-G1-1" }, { code: "MATH-G1-2" }],
      },
    },
    {
      moeAlignments: null,
    },
  ]);
  mockStandardFindMany.mockResolvedValue([
    { code: "MATH-G1-1", subject: "MATH", band: "G1_3" },
    { code: "MATH-G1-2", subject: "MATH", band: "G1_3" },
    { code: "SCI-G4-1", subject: "SCIENCE", band: "G4_6" },
  ]);
});

describe("GET /api/admin/curriculum/waec-alignment", () => {
  it("returns aggregated curriculum alignment for admins", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      overview: {
        totalStandards: 3,
        coveredStandards: 2,
        coveragePct: 67,
        totalLessons: 2,
        alignedLessons: 1,
      },
      bySubject: [
        { subject: "MATH", total: 2, covered: 2, coveragePct: 100 },
        { subject: "SCIENCE", total: 1, covered: 0, coveragePct: 0 },
      ],
      bySubjectBand: [
        { subject: "MATH", band: "G1_3", total: 2, covered: 2, coveragePct: 100 },
        { subject: "SCIENCE", band: "G4_6", total: 1, covered: 0, coveragePct: 0 },
      ],
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_CURRICULUM_WAEC_ALIGNMENT_VIEW",
        userId: adminUser.id,
      })
    );
  });

  it("allows platform admins", async () => {
    mockRequireUser.mockResolvedValue({
      id: "platform-1",
      role: "TEACHER",
      schoolId: null,
      isPlatformAdmin: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("rejects unauthorized roles", async () => {
    mockRequireUser.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
