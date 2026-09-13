import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockStudentUpdate = vi.hoisted(() => vi.fn());
const mockPlacementCreate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: mockStudentFindFirst, update: mockStudentUpdate },
    placementTest: { create: mockPlacementCreate },
  },
}));

import { POST } from "@/app/api/student/placement/route";

const payload = {
  band: "advanced",
  levelLabel: "Advanced",
  estimatedGrade: 12,
  rawScore: 10,
  totalQuestions: 10,
};

describe("placement administrative-grade containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-a", role: "STUDENT", schoolId: "school-a" });
    mockStudentFindFirst.mockResolvedValue({ id: "student-a", currentGrade: 4 });
    mockPlacementCreate.mockResolvedValue({ id: "placement-a", ...payload, studentId: "student-a" });
  });

  it("records a diagnostic without changing official grade", async () => {
    const response = await POST(new Request("http://localhost/api/student/placement", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      currentGrade: 4,
      recommendedGrade: 12,
      administrativeGradeChanged: false,
    });
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });

  it("scopes Student identity to the authenticated user and tenant", async () => {
    await POST(new Request("http://localhost/api/student/placement", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
    expect(mockStudentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-a", user: { schoolId: "school-a" } },
    }));
  });

  it("fails closed when no tenant-bound Student record exists", async () => {
    mockStudentFindFirst.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/student/placement", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
    expect(response.status).toBe(404);
    expect(mockPlacementCreate).not.toHaveBeenCalled();
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });
});
