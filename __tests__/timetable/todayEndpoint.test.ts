import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockBuildStudentLearningIntelligence = vi.hoisted(() => vi.fn());
const mockGetAdaptiveRecommendations = vi.hoisted(() => vi.fn());
const mockGenerateStudentActions = vi.hoisted(() => vi.fn());
const mockGetActiveStudentAction = vi.hoisted(() => vi.fn());
const mockGetTimetableForStudent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/student/learningIntelligence", () => ({
  buildStudentLearningIntelligence: mockBuildStudentLearningIntelligence,
}));
vi.mock("@/lib/student/adaptiveRecommendations", () => ({
  getAdaptiveRecommendations: mockGetAdaptiveRecommendations,
}));
vi.mock("@/lib/intelligence/actionEngine", () => ({
  generateStudentActions: mockGenerateStudentActions,
  getActiveStudentAction: mockGetActiveStudentAction,
}));
vi.mock("@/lib/timetable/timetableService", () => ({
  getTimetableForStudent: mockGetTimetableForStudent,
}));
vi.mock("@/lib/lessons/labLinks", () => ({ getLessonLabLinks: () => [] }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    scheduledWork: { findMany: vi.fn() },
    assignment: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/student/today/route";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

const STUDENT_USER = { id: "user-1", schoolId: "school-1", role: "STUDENT" };

const SAMPLE_TIMETABLE = {
  configured: true,
  date: "2026-04-27",
  dayName: "Monday",
  periods: [
    {
      id: "slot-1",
      periodLabel: "Period 1",
      subject: "MATH",
      startTime: "08:30",
      endTime: "09:15",
      teacherName: "Mulbah Sirleaf",
      assignment: {
        id: "ta-1",
        title: "Algebra: Quadratic Equations",
        contentId: "content-123",
        lessonUrl: "/student/lessons/content-123",
        instructions: null,
      },
    },
    {
      id: "slot-2",
      periodLabel: "Period 2",
      subject: "SCIENCE",
      startTime: "09:30",
      endTime: "10:15",
      teacherName: "Mary Pewee",
      assignment: null,
    },
  ],
};

function defaultIntelligence() {
  return {
    generatedAt: new Date().toISOString(),
    masteryBySubject: [],
    weaknesses: [],
    recommendedNextActions: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(STUDENT_USER);
  mockBuildStudentLearningIntelligence.mockResolvedValue(defaultIntelligence());
  mockGetAdaptiveRecommendations.mockResolvedValue({
    recommendation: null,
    masteryAlerts: [],
    contentGap: false,
  });
  mockGenerateStudentActions.mockResolvedValue([]);
  mockGetActiveStudentAction.mockResolvedValue(null);
  mockGetTimetableForStudent.mockResolvedValue(null);
  mockPrisma.student.findUnique.mockResolvedValue({
    id: "student-1",
    enrollments: [{ classId: "class-1" }],
  });
  mockPrisma.scheduledWork.findMany.mockResolvedValue([]);
  mockPrisma.assignment.findMany.mockResolvedValue([]);
});

describe("/api/student/today — timetable field", () => {
  it("includes timetable field in response (null when not configured)", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect("timetable" in data).toBe(true);
    expect(data.timetable).toBeNull();
  });

  it("returns timetable with correct period count when configured", async () => {
    mockGetTimetableForStudent.mockResolvedValueOnce(SAMPLE_TIMETABLE);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.timetable).not.toBeNull();
    expect(data.timetable.periods).toHaveLength(2);
    expect(data.timetable.dayName).toBe("Monday");
    expect(data.timetable.configured).toBe(true);
  });

  it("timetable period with assignment shows lessonUrl and title", async () => {
    mockGetTimetableForStudent.mockResolvedValueOnce(SAMPLE_TIMETABLE);

    const res = await GET();
    const data = await res.json();

    const period = data.timetable.periods[0];
    expect(period.assignment.lessonUrl).toBe("/student/lessons/content-123");
    expect(period.assignment.title).toBe("Algebra: Quadratic Equations");
  });

  it("timetable period with no assignment has assignment: null", async () => {
    mockGetTimetableForStudent.mockResolvedValueOnce(SAMPLE_TIMETABLE);

    const res = await GET();
    const data = await res.json();

    const period = data.timetable.periods[1];
    expect(period.assignment).toBeNull();
  });

  it("ALL existing today response fields are still present (backward compatibility)", async () => {
    const res = await GET();
    const data = await res.json();

    // Core scheduled work fields
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("subjects");
    expect(data).toHaveProperty("completedCount");
    expect(data).toHaveProperty("remainingCount");
    expect(data).toHaveProperty("currentItemId");
    expect(data).toHaveProperty("nextItemId");
    // Adaptive fields
    expect(data).toHaveProperty("priority");
    expect(data).toHaveProperty("recommendation");
    expect(data).toHaveProperty("masteryAlerts");
    expect(data).toHaveProperty("contentGap");
    expect(data).toHaveProperty("activeAction");
    expect(data).toHaveProperty("adaptivePlan");
    // New timetable field
    expect(data).toHaveProperty("timetable");
    expect(data).toHaveProperty("schoolDay");
    expect(data).toHaveProperty("todayFocus");
    expect(data).toHaveProperty("catchUpItems");
    expect(data).toHaveProperty("progressSnapshot");
  });

  it("timetable is null when student record not found", async () => {
    mockPrisma.student.findUnique.mockResolvedValueOnce(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    // Student not found → returns early with items:[] — no timetable
    expect(data.timetable).toBeUndefined();
  });

  it("timetable service errors do not break the today endpoint", async () => {
    mockGetTimetableForStudent.mockRejectedValueOnce(
      new Error("DB connection error")
    );

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.timetable).toBeNull();
  });
});

describe("/api/student/today — fail-closed curriculum routing (NR-10)", () => {
  it("both today and catch-up scheduledWork queries scope content to approved statuses only", async () => {
    await GET();

    expect(mockPrisma.scheduledWork.findMany).toHaveBeenCalledTimes(2);
    for (const call of mockPrisma.scheduledWork.findMany.mock.calls) {
      const where = call[0]?.where;
      expect(where?.content?.status?.in).toEqual(
        expect.arrayContaining(["published", "APPROVED"])
      );
      // Only the two approved-equivalent statuses may ever be reachable —
      // draft/pending/needs-review content must never be requested for a student.
      expect(where.content.status.in).toHaveLength(2);
    }
  });

  it("never surfaces a scheduled-work item whose content is not approved", async () => {
    mockPrisma.scheduledWork.findMany.mockImplementation(async ({ where }: any) => {
      const allowed: string[] = where?.content?.status?.in ?? [];
      const rows = [
        {
          id: "sw-approved",
          classId: "class-1",
          contentId: "content-approved",
          content: { contentId: "content-approved", grade: 9, subject: "MATH", contentType: "LESSON", payload: {}, status: "APPROVED" },
          progress: [],
          order: 1,
          periodNumber: 1,
          startTime: null,
          endTime: null,
        },
        {
          id: "sw-draft",
          classId: "class-1",
          contentId: "content-draft",
          content: { contentId: "content-draft", grade: 9, subject: "MATH", contentType: "LESSON", payload: {}, status: "DRAFT" },
          progress: [],
          order: 2,
          periodNumber: 2,
          startTime: null,
          endTime: null,
        },
      ];
      // Mimic real Prisma relation filtering: a WHERE clause on the content
      // relation excludes rows whose content status is not in the allow-list.
      return rows.filter((r) => allowed.includes(r.content.status));
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    const returnedContentIds = (data.items ?? []).map((item: any) => item.contentId);
    expect(returnedContentIds).not.toContain("content-draft");
  });
});
