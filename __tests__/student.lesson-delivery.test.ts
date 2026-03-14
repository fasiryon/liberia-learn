import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockEnrollmentFindUnique = vi.hoisted(() => vi.fn());
const mockStudentProgressUpsert = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockNotifyLessonCompletion = vi.hoisted(() => vi.fn());
const mockUpdateMasteryProfile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    scheduledWork: { findUnique: mockScheduledWorkFindUnique },
    student: { findUnique: mockStudentFindUnique },
    enrollment: { findUnique: mockEnrollmentFindUnique },
    studentProgress: { upsert: mockStudentProgressUpsert },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/lesson-notifications", () => ({
  notifyLessonCompletion: mockNotifyLessonCompletion,
}));

vi.mock("@/lib/mastery/masteryService", () => ({
  updateMasteryProfile: mockUpdateMasteryProfile,
}));

describe("student lesson delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects the standard lesson body for standard formats", async () => {
    const { selectLessonBody } = await import("@/lib/lessons");
    expect(
      selectLessonBody(
        {
          body_standard: "## Opening\nStandard lesson body",
          body_block: "## Opening\nBlock lesson body",
        },
        "standard"
      )
    ).toContain("Standard lesson body");
  });

  it("selects the block lesson body for block formats", async () => {
    const { selectLessonBody } = await import("@/lib/lessons");
    expect(
      selectLessonBody(
        {
          body_standard: "## Opening\nStandard lesson body",
          body_block: "## Opening\nBlock lesson body",
        },
        "block_a"
      )
    ).toContain("Block lesson body");
  });

  it("marks the lesson complete and sends guardian notification", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      id: "sw-1",
      classId: "class-1",
      class: { schoolId: "school-1", School: { name: "Capitol Hill Academy" } },
      content: {
        grade: 6,
        subject: "MATH",
        payload: {},
        deliveryProfile: {
          exitTicket: {
            questions: [{ question: "2 + 2 = ?", standardCode: "math-basics", correctAnswer: "1" }],
          },
        },
        moeAlignments: [{ code: "MATH-G6-01" }],
      },
    });
    mockStudentFindUnique.mockResolvedValue({ id: "student-1", user: { name: "Student One" } });
    mockEnrollmentFindUnique.mockResolvedValue({ id: "enroll-1" });
    mockStudentProgressUpsert.mockResolvedValue({ completedAt: new Date("2026-03-13T12:00:00.000Z") });
    mockLogAudit.mockResolvedValue(undefined);
    mockNotifyLessonCompletion.mockResolvedValue(undefined);
    mockUpdateMasteryProfile.mockResolvedValue(undefined);
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });

    const { POST } = await import("@/app/api/student/lessons/[id]/complete/route");
    const response = await POST(
      new Request("http://localhost/api/student/lessons/sw-1/complete", {
        method: "POST",
        body: JSON.stringify({ exitTicketAnswers: [{ questionIndex: 0, answer: "1" }] }),
        headers: { "Content-Type": "application/json" },
      }) as any,
      { params: { id: "sw-1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, exitTicketScore: 100 });
    expect(mockNotifyLessonCompletion).toHaveBeenCalledOnce();
    expect(mockUpdateMasteryProfile).toHaveBeenCalledOnce();
  });

  it("does not fail the lesson completion flow when guardian SMS fails", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      id: "sw-1",
      classId: "class-1",
      class: { schoolId: "school-1", School: { name: "Capitol Hill Academy" } },
      content: {
        grade: 6,
        subject: "SCIENCE",
        payload: {},
        deliveryProfile: { exitTicket: { questions: [] } },
        moeAlignments: [],
      },
    });
    mockStudentFindUnique.mockResolvedValue({ id: "student-1", user: { name: "Student One" } });
    mockEnrollmentFindUnique.mockResolvedValue({ id: "enroll-1" });
    mockStudentProgressUpsert.mockResolvedValue({ completedAt: new Date("2026-03-13T12:00:00.000Z") });
    mockLogAudit.mockResolvedValue(undefined);
    mockNotifyLessonCompletion.mockRejectedValue(new Error("sms failed"));
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });

    const { POST } = await import("@/app/api/student/lessons/[id]/complete/route");
    const response = await POST(
      new Request("http://localhost/api/student/lessons/sw-1/complete", {
        method: "POST",
        body: JSON.stringify({ exitTicketAnswers: [] }),
        headers: { "Content-Type": "application/json" },
      }) as any,
      { params: { id: "sw-1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });
});
