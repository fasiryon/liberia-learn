import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsAdaptiveEngineEnabled = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockStudentAdaptiveAttemptFindMany = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressCount = vi.hoisted(() => vi.fn());
const mockEnrollmentCount = vi.hoisted(() => vi.fn());
const mockStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionCount = vi.hoisted(() => vi.fn());
const mockLabSessionCount = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({ isAdaptiveEngineEnabled: mockIsAdaptiveEngineEnabled }));
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockClassFindMany },
    studentAdaptiveAttempt: { findMany: mockStudentAdaptiveAttemptFindMany },
    scheduledWork: { findMany: mockScheduledWorkFindMany },
    studentProgress: { count: mockStudentProgressCount, findMany: mockStudentProgressFindMany },
    enrollment: { count: mockEnrollmentCount },
    assignmentSubmission: { count: mockAssignmentSubmissionCount },
    labSession: { count: mockLabSessionCount },
    curriculumContent: { findMany: mockCurriculumContentFindMany },
  },
}));

import { GET } from "@/app/api/teacher/dashboard/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
  mockIsAdaptiveEngineEnabled.mockReturnValue(true);
  mockClassFindMany.mockResolvedValue([{ id: "class-1", name: "Grade 6" }]);
  mockStudentAdaptiveAttemptFindMany.mockResolvedValue([]);
  mockScheduledWorkFindMany.mockResolvedValue([]);
  mockStudentProgressCount.mockResolvedValue(0);
  mockEnrollmentCount.mockResolvedValue(0);
  mockStudentProgressFindMany.mockResolvedValue([]);
  mockAssignmentSubmissionCount.mockResolvedValue(0);
  mockLabSessionCount.mockResolvedValue(0);
  mockCurriculumContentFindMany.mockResolvedValue([]);
});

describe("GET /api/teacher/dashboard adaptiveStats", () => {
  it("adaptiveStats returns zeros when no attempts exist", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.adaptiveStats).toEqual({
      studentsWithGaps: 0,
      totalGapsDetected: 0,
      avgMasteryScore: 0,
      topWeakStrands: [],
    });
  });

  it("studentsWithGaps counts correctly", async () => {
    mockStudentAdaptiveAttemptFindMany.mockResolvedValue([
      { studentId: "student-1", strandCode: "fractions", score: 0.4 },
      { studentId: "student-2", strandCode: "fractions", score: 0.3 },
      { studentId: "student-2", strandCode: "grammar", score: 0.9 },
    ]);

    const response = await GET();
    const body = await response.json();
    expect(body.adaptiveStats.studentsWithGaps).toBe(2);
  });

  it("topWeakStrands returns top 3", async () => {
    mockStudentAdaptiveAttemptFindMany.mockResolvedValue([
      { studentId: "student-1", strandCode: "fractions", score: 0.4 },
      { studentId: "student-1", strandCode: "grammar", score: 0.3 },
      { studentId: "student-1", strandCode: "geometry", score: 0.2 },
      { studentId: "student-1", strandCode: "reading", score: 0.1 },
    ]);

    const response = await GET();
    const body = await response.json();
    expect(body.adaptiveStats.topWeakStrands).toEqual(["reading", "geometry", "grammar"]);
  });
});
