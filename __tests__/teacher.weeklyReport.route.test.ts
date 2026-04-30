import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockBuildTeacherWeeklyReport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/reporting/teacherWeeklyReport", () => ({
  buildTeacherWeeklyReport: mockBuildTeacherWeeklyReport,
}));

import { GET } from "@/app/api/teacher/weekly-report/route";

// Mirrors the pattern used throughout the test suite
function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

const MOCK_REPORT = {
  teacherId: "teacher-1",
  weekStart: "2026-04-07T00:00:00.000Z",
  weekEnd: "2026-04-13T23:59:59.999Z",
  generatedAt: new Date().toISOString(),
  classes: [
    {
      classId: "class-1",
      className: "JSS 1A",
      lessonCount: 3,
      lessonCompletionRate: 80,
      assignmentSubmissionRate: 60,
      absencesThisWeek: 2,
      atRiskStudentCount: 1,
      enrolledStudentCount: 25,
    },
  ],
  totalLessons: 3,
  totalAbsences: 2,
  overallCompletionRate: 80,
  savedLessonPlans: [],
};

describe("GET /api/teacher/weekly-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
    });
    mockBuildTeacherWeeklyReport.mockResolvedValue(MOCK_REPORT);
    mockLogLearningEvent.mockResolvedValue(null);
  });

  it("returns 200 with weekly report data", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/teacher/weekly-report"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.teacherId).toBe("teacher-1");
    expect(body.classes).toHaveLength(1);
    expect(body.overallCompletionRate).toBe(80);
  });

  it("calls buildTeacherWeeklyReport with correct teacher and school", async () => {
    await GET(makeNextRequest("http://localhost/api/teacher/weekly-report"));
    expect(mockBuildTeacherWeeklyReport).toHaveBeenCalledWith(
      "teacher-1",
      "school-1",
      expect.any(Date)
    );
  });

  it("fires logLearningEvent with teacher.weekly_report.viewed", async () => {
    await GET(makeNextRequest("http://localhost/api/teacher/weekly-report"));
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "teacher.weekly_report.viewed",
        userId: "teacher-1",
        schoolId: "school-1",
      })
    );
  });

  it("accepts optional ?date query param", async () => {
    await GET(makeNextRequest("http://localhost/api/teacher/weekly-report?date=2026-04-01"));
    expect(mockBuildTeacherWeeklyReport).toHaveBeenCalledWith(
      "teacher-1",
      "school-1",
      new Date("2026-04-01")
    );
  });

  it("returns 400 for invalid date param", async () => {
    const res = await GET(
      makeNextRequest("http://localhost/api/teacher/weekly-report?date=not-a-date")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 if user has no schoolId", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "teacher-1", role: "TEACHER", schoolId: null });
    const res = await GET(makeNextRequest("http://localhost/api/teacher/weekly-report"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when requireRole throws auth error", async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await GET(makeNextRequest("http://localhost/api/teacher/weekly-report"));
    expect(res.status).toBe(403);
  });

  it("returns 500 when report service throws", async () => {
    mockBuildTeacherWeeklyReport.mockRejectedValueOnce(new Error("DB error"));
    const res = await GET(makeNextRequest("http://localhost/api/teacher/weekly-report"));
    expect(res.status).toBe(500);
  });
});
