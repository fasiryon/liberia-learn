import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockPlacementFindMany = vi.hoisted(() => vi.fn());
const mockPlacementFindUnique = vi.hoisted(() => vi.fn());
const mockPlacementUpdate = vi.hoisted(() => vi.fn());
const mockStudentUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockReviewCreate = vi.hoisted(() => vi.fn());
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
    placementReview: {
      create: mockReviewCreate,
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

  function placement(schoolId: string) {
    return {
      id: "placement-2",
      studentId: "student-2",
      estimatedGrade: 5,
      source: "server_session",
      decision: null,
      student: {
        id: "student-2",
        currentGrade: 4,
        guardians: [],
        user: { id: "student-user-2", name: "Student", schoolId, guardianPhoneE164: null, school: { name: "School" } },
      },
    };
  }

  async function review(body: unknown) {
    const { POST } = await import("@/app/api/teacher/placements/[id]/review/route");
    return POST(
      new Request("http://localhost/api/teacher/placements/placement-2/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "placement-2" }) }
    );
  }

  it("hides a placement from another school (hostile)", async () => {
    mockPlacementFindUnique.mockResolvedValue(placement("school-other"));
    const response = await review({ recommendation: "endorse" });
    expect(response.status).toBe(404);
    expect(mockReviewCreate).not.toHaveBeenCalled();
  });

  it("records a recommendation and never writes the official grade", async () => {
    mockPlacementFindUnique.mockResolvedValue(placement("school-cha"));
    mockReviewCreate.mockImplementation(async ({ data }: any) => ({ id: "review-1", createdAt: new Date(), ...data }));
    const response = await review({ recommendation: "endorse" });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ officialGradeChanged: false, review: { recommendation: "endorse", recommendedGrade: 5 } });
    expect(mockStudentUpdate).not.toHaveBeenCalled();
    expect(mockPlacementUpdate).not.toHaveBeenCalled();
    expect(mockNotifyPlacementConfirmation).not.toHaveBeenCalled();
  });

  it("an adjusted recommendation needs a different grade and a 20-character note", async () => {
    mockPlacementFindUnique.mockResolvedValue(placement("school-cha"));
    expect((await review({ recommendation: "adjust", recommendedGrade: 6, note: "too short" })).status).toBe(400);
    expect((await review({ recommendation: "adjust", recommendedGrade: 5, note: "x".repeat(30) })).status).toBe(400);
    expect(mockReviewCreate).not.toHaveBeenCalled();
  });

  it("the retired confirm/override body no longer changes anything", async () => {
    mockPlacementFindUnique.mockResolvedValue(placement("school-cha"));
    const response = await review({ decision: "confirm" });
    expect(response.status).toBe(400);
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });
});
