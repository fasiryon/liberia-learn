import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockBuildLearningIntelligence = vi.hoisted(() => vi.fn());
const mockGetAdaptiveRecommendations = vi.hoisted(() => vi.fn());
const mockGenerateStudentActions = vi.hoisted(() => vi.fn());
const mockGetActiveStudentAction = vi.hoisted(() => vi.fn());
const mockGetTimetableForStudent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    scheduledWork: { findMany: mockScheduledWorkFindMany },
    assignment: { findMany: mockAssignmentFindMany },
  },
}));

vi.mock("@/lib/student/learningIntelligence", () => ({
  buildStudentLearningIntelligence: mockBuildLearningIntelligence,
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

function scheduledWork(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "sw-1",
    classId: "class-1",
    scheduledDate: now,
    periodNumber: 1,
    startTime: "09:00",
    endTime: "09:45",
    content: {
      contentId: "content-1",
      grade: 7,
      subject: "MATH",
      contentType: "lesson",
      payload: { title: "Ratios in Market Prices", durationMins: 45 },
    },
    progress: [{ startedAt: null, completedAt: null }],
    ...overrides,
  };
}

function defaultAdaptive() {
  return {
    recommendation: null,
    masteryAlerts: [],
    contentGap: false,
    pacingSignal: "on_track" as const,
    weakTopicSequence: [],
  };
}

describe("student today layered school day", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "student-user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockBuildLearningIntelligence.mockResolvedValue({
      generatedAt: "2026-04-23T00:00:00.000Z",
      masteryBySubject: [],
      weaknesses: [{ label: "Ratios", severity: "high" }],
      recommendedNextActions: [
        {
          type: "review_weak_lesson",
          label: "Review Ratios",
          reason: "Recent quiz signals show ratio weakness.",
          href: "/student/lesson/math-g7-ratios",
          priority: 80,
        },
      ],
    });
    mockGetAdaptiveRecommendations.mockResolvedValue(defaultAdaptive());
    mockGenerateStudentActions.mockResolvedValue(null);
    mockGetActiveStudentAction.mockResolvedValue(null);
    mockAssignmentFindMany.mockResolvedValue([]);
    mockGetTimetableForStudent.mockResolvedValue(null);
  });

  it("renders timetable as the primary school day with time ranges", async () => {
    mockScheduledWorkFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockGetTimetableForStudent.mockResolvedValue({
      configured: true,
      date: "2026-05-04",
      dayName: "Monday",
      periods: [
        {
          id: "tt-1",
          classId: "class-1",
          periodLabel: "Period 1",
          subject: "MATH",
          startTime: "09:00",
          endTime: "09:45",
          teacherName: "Mary Pewee",
          assignment: null,
        },
      ],
    });

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.schoolDay.mode).toBe("timetable");
    expect(body.schoolDay.items[0]).toMatchObject({
      timeRange: "09:00-09:45",
      periodLabel: "Period 1",
      subject: "MATH",
      teacherName: "Mary Pewee",
    });
  });

  it("attaches scheduledWork to the matching timetable period", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([scheduledWork()])
      .mockResolvedValueOnce([]);
    mockGetTimetableForStudent.mockResolvedValue({
      configured: true,
      date: "2026-05-04",
      dayName: "Monday",
      periods: [
        {
          id: "tt-1",
          classId: "class-1",
          periodLabel: "Period 1",
          subject: "MATH",
          startTime: "09:00",
          endTime: "09:45",
          teacherName: "Mary Pewee",
          assignment: null,
        },
      ],
    });

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.schoolDay.items[0]).toMatchObject({
      scheduledWorkId: "sw-1",
      title: "Ratios in Market Prices",
    });
    expect(body.todayFocus.primaryHref).toBe("/student/lessons/content-1");
  });

  it("does not crash when a timetable period is missing teacher details", async () => {
    mockScheduledWorkFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockGetTimetableForStudent.mockResolvedValue({
      configured: true,
      date: "2026-05-04",
      dayName: "Monday",
      periods: [
        {
          id: "tt-1",
          classId: "class-1",
          periodLabel: "Period 1",
          subject: "math",
          startTime: "09:00",
          endTime: "09:45",
          teacherName: undefined,
          assignment: null,
        },
      ],
    });

    const { GET } = await import("@/app/api/student/today/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schoolDay.items[0]).toMatchObject({
      subject: "MATH",
      teacherName: null,
      title: null,
    });
  });

  it("does not crash when scheduledWork has no attached lesson content", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([scheduledWork({ content: null })])
      .mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/student/today/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schoolDay.mode).toBe("learning_plan");
    expect(body.schoolDay.items[0]).toMatchObject({
      title: "GENERAL Lesson",
      subject: "GENERAL",
      primaryAction: { href: "/student/lessons/sw-1" },
    });
  });

  it("puts old incomplete work under Catch Up instead of the main school day", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([scheduledWork({ id: "old-sw", progress: [{ startedAt: null, completedAt: null }] })]);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.schoolDay.items).toHaveLength(0);
    expect(body.catchUpItems).toHaveLength(1);
    expect(body.catchUpItems[0].id).toBe("old-sw");
  });

  it("uses learning plan fallback when no timetable exists but scheduledWork does", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([scheduledWork()])
      .mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.schoolDay.mode).toBe("learning_plan");
    expect(body.schoolDay.note).toContain("not configured a full timetable");
    expect(body.schoolDay.items[0].source).toBe("scheduled_work");
  });

  it("renders scheduledWork fallback when timetable exists but has no periods", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([scheduledWork()])
      .mockResolvedValueOnce([]);
    mockGetTimetableForStudent.mockResolvedValue({
      configured: false,
      date: "2026-05-04",
      dayName: "Monday",
      periods: [],
    });

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.schoolDay.mode).toBe("learning_plan");
    expect(body.schoolDay.items).toHaveLength(1);
    expect(body.schoolDay.items[0].title).toBe("Ratios in Market Prices");
  });

  it("returns setup-needed state when there is no timetable or scheduled work", async () => {
    mockScheduledWorkFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.schoolDay.mode).toBe("setup_needed");
    expect(body.schoolDay.note).toBe("No school day schedule has been configured yet.");
  });

  it("keeps adaptive recommendation separate from school-day primary CTA", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([scheduledWork()])
      .mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.todayFocus.primaryHref).toBe("/student/lessons/content-1");
    expect(body.adaptivePlan.orderedActions.some((action: any) => action.source === "learning_intelligence")).toBe(true);
  });
});
