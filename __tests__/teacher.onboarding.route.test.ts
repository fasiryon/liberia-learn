import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockTeacherProfileFindUnique = vi.hoisted(() => vi.fn());
const mockTeacherProfileUpsert = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    teacherProfile: {
      findUnique: mockTeacherProfileFindUnique,
      upsert: mockTeacherProfileUpsert,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

describe("PATCH /api/teacher/onboarding/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      name: "Teacher One",
      schoolId: "school-1",
    });
    mockTeacherProfileFindUnique.mockResolvedValue({
      id: "profile-1",
      schoolId: "school-1",
      fullName: "Teacher One",
    });
    mockTeacherProfileUpsert.mockResolvedValue({
      id: "profile-1",
      isOnboarded: true,
    });
  });

  it("marks teacher onboarding complete and logs audit", async () => {
    const { PATCH } = await import("@/app/api/teacher/onboarding/complete/route");
    const response = await PATCH();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockTeacherProfileUpsert).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "teacher-1",
        action: "teacher.onboarding.completed",
      })
    );
  });
});
