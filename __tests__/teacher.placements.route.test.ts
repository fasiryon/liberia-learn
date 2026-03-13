import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockPlacementFindMany = vi.hoisted(() => vi.fn());
const mockPlacementFindUnique = vi.hoisted(() => vi.fn());
const mockPlacementUpdate = vi.hoisted(() => vi.fn());
const mockStudentUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockNotifyPlacementConfirmation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/placement-notifications", () => ({
  notifyPlacementConfirmation: mockNotifyPlacementConfirmation,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    placementTest: {
      findMany: mockPlacementFindMany,
      findUnique: mockPlacementFindUnique,
      update: mockPlacementUpdate,
    },
    student: {
      update: mockStudentUpdate,
    },
    $transaction: mockTransaction,
  },
}));

describe("teacher placements routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-cha",
    });
    mockTransaction.mockImplementation(async (callback: any) =>
      callback({
        placementTest: {
          update: mockPlacementUpdate,
        },
        student: {
          update: mockStudentUpdate,
        },
      })
    );
    mockNotifyPlacementConfirmation.mockResolvedValue(undefined);
  });

  it("lists placements scoped to the teacher school", async () => {
    mockPlacementFindMany.mockResolvedValue([
      {
        id: "placement-1",
        studentId: "student-1",
        estimatedGrade: 6,
        band: "developing",
        levelLabel: "Developing",
        teacherDecision: null,
        teacherGrade: null,
        teacherReason: null,
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        student: {
          currentGrade: 5,
          user: {
            name: "Korto Doe",
            email: "korto@example.com",
          },
        },
      },
    ]);

    const { GET } = await import("@/app/api/teacher/placements/route");
    const response = await GET();
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
    expect(payload.summary.pendingReview).toBe(1);
    expect(payload.placements[0].studentName).toBe("Korto Doe");
  });

  it("blocks placement review for a different school", async () => {
    mockPlacementFindUnique.mockResolvedValue({
      id: "placement-2",
      studentId: "student-2",
      estimatedGrade: 5,
      student: {
        user: {
          id: "student-user-2",
          name: "Other Student",
          schoolId: "school-other",
          guardianPhoneE164: null,
          school: { name: "Other School" },
        },
        guardians: [],
      },
    });

    const { POST } = await import("@/app/api/teacher/placements/[id]/review/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/placements/placement-2/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "confirm" }),
      }),
      { params: Promise.resolve({ id: "placement-2" }) }
    );

    expect(response.status).toBe(403);
    expect(mockPlacementUpdate).not.toHaveBeenCalled();
  });

  it("confirm decision sets teacherDecision and updates student grade", async () => {
    mockPlacementFindUnique.mockResolvedValue({
      id: "placement-3",
      studentId: "student-3",
      estimatedGrade: 7,
      student: {
        user: {
          id: "student-user-3",
          name: "Korto Doe",
          schoolId: "school-cha",
          guardianPhoneE164: "+231770000111",
          school: { name: "Camp Johnson School" },
        },
        guardians: [{ guardianId: "guardian-3", guardian: { name: "Ma Korto" } }],
      },
    });
    mockPlacementUpdate.mockResolvedValue({
      id: "placement-3",
      teacherDecision: "confirmed",
      teacherGrade: null,
      teacherReason: null,
      reviewedAt: new Date("2026-03-13T12:00:00.000Z"),
    });
    mockStudentUpdate.mockResolvedValue({ id: "student-3", currentGrade: 7 });

    const { POST } = await import("@/app/api/teacher/placements/[id]/review/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/placements/placement-3/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "confirm" }),
      }),
      { params: Promise.resolve({ id: "placement-3" }) }
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(mockPlacementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teacherDecision: "confirmed",
          teacherGrade: null,
          teacherReason: null,
          reviewedBy: "teacher-1",
        }),
      })
    );
    expect(mockStudentUpdate).toHaveBeenCalledWith({
      where: { id: "student-3" },
      data: { currentGrade: 7 },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "teacher.placement.reviewed",
        resourceId: "placement-3",
      })
    );
    expect(mockNotifyPlacementConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "school-cha",
        finalGrade: 7,
        student: expect.objectContaining({
          id: "student-3",
          userId: "student-user-3",
          phone: "+231770000111",
        }),
      })
    );
    expect(payload.finalGrade).toBe(7);
  });

  it("override requires a reason with at least 20 characters", async () => {
    const { POST } = await import("@/app/api/teacher/placements/[id]/review/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/placements/placement-4/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "override", overrideGrade: 8, overrideReason: "Too short" }),
      }),
      { params: Promise.resolve({ id: "placement-4" }) }
    );

    expect(response.status).toBe(400);
    expect(mockPlacementFindUnique).not.toHaveBeenCalled();
  });

  it("override stores teacher grade and reason, then updates student grade", async () => {
    mockPlacementFindUnique.mockResolvedValue({
      id: "placement-5",
      studentId: "student-5",
      estimatedGrade: 6,
      student: {
        user: {
          id: "student-user-5",
          name: "Musu Doe",
          schoolId: "school-cha",
          guardianPhoneE164: null,
          school: { name: "Camp Johnson School" },
        },
        guardians: [{ guardianId: "guardian-5", guardian: { name: "Pa Doe" } }],
      },
    });
    mockPlacementUpdate.mockResolvedValue({
      id: "placement-5",
      teacherDecision: "overridden",
      teacherGrade: 8,
      teacherReason: "Student demonstrated stronger mastery during live review.",
      reviewedAt: new Date("2026-03-13T12:00:00.000Z"),
    });
    mockStudentUpdate.mockResolvedValue({ id: "student-5", currentGrade: 8 });

    const { POST } = await import("@/app/api/teacher/placements/[id]/review/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/placements/placement-5/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "override",
          overrideGrade: 8,
          overrideReason: "Student demonstrated stronger mastery during live review.",
        }),
      }),
      { params: Promise.resolve({ id: "placement-5" }) }
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(mockPlacementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teacherDecision: "overridden",
          teacherGrade: 8,
          teacherReason: "Student demonstrated stronger mastery during live review.",
        }),
      })
    );
    expect(mockStudentUpdate).toHaveBeenCalledWith({
      where: { id: "student-5" },
      data: { currentGrade: 8 },
    });
    expect(payload.finalGrade).toBe(8);
  });

  it("returns success even if placement notifications fail", async () => {
    mockPlacementFindUnique.mockResolvedValue({
      id: "placement-6",
      studentId: "student-6",
      estimatedGrade: 6,
      student: {
        user: {
          id: "student-user-6",
          name: "Finda Doe",
          schoolId: "school-cha",
          guardianPhoneE164: "+231770000222",
          school: { name: "Camp Johnson School" },
        },
        guardians: [{ guardianId: "guardian-6", guardian: { name: "Ma Finda" } }],
      },
    });
    mockPlacementUpdate.mockResolvedValue({
      id: "placement-6",
      teacherDecision: "confirmed",
      teacherGrade: null,
      teacherReason: null,
      reviewedAt: new Date("2026-03-13T12:00:00.000Z"),
    });
    mockStudentUpdate.mockResolvedValue({ id: "student-6", currentGrade: 6 });
    mockNotifyPlacementConfirmation.mockRejectedValue(new Error("sms provider unavailable"));

    const { POST } = await import("@/app/api/teacher/placements/[id]/review/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/placements/placement-6/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "confirm" }),
      }),
      { params: Promise.resolve({ id: "placement-6" }) }
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.finalGrade).toBe(6);
  });
});
