import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumContentCount = vi.hoisted(() => vi.fn());
const mockStudentProgressCount = vi.hoisted(() => vi.fn());
const mockCertificateFindUnique = vi.hoisted(() => vi.fn());
const mockBuildLearningIntelligence = vi.hoisted(() => vi.fn());
const mockGetAdaptiveRecommendations = vi.hoisted(() => vi.fn());
const mockGenerateStudentActions = vi.hoisted(() => vi.fn());
const mockGetActiveStudentAction = vi.hoisted(() => vi.fn());
const mockGetTimetableForStudent = vi.hoisted(() => vi.fn());
const mockGetStudentWaecReadinessAll = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    scheduledWork: { findMany: mockScheduledWorkFindMany },
    assignment: { findMany: mockAssignmentFindMany },
    curriculumContent: { count: mockCurriculumContentCount },
    studentProgress: { count: mockStudentProgressCount },
    certificate: { findUnique: mockCertificateFindUnique },
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

vi.mock("@/lib/waec/readiness", () => ({
  getStudentWaecReadinessAll: mockGetStudentWaecReadinessAll,
}));

function defaultAdaptive() {
  return {
    recommendation: null,
    candidates: [],
    masteryAlerts: [],
    contentGap: false,
    pacingSignal: "on_track" as const,
    weakTopicSequence: [],
  };
}

function defaultIntelligence() {
  return {
    generatedAt: "2026-07-18T00:00:00.000Z",
    masteryBySubject: [],
    weaknesses: [],
    recommendedNextActions: [],
  };
}

describe("student today nextBestAction wiring (Sprint 6.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "student-user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      currentGrade: 7,
      enrollments: [{ classId: "class-1" }],
    });
    mockScheduledWorkFindMany.mockResolvedValue([]);
    mockAssignmentFindMany.mockResolvedValue([]);
    mockBuildLearningIntelligence.mockResolvedValue(defaultIntelligence());
    mockGetAdaptiveRecommendations.mockResolvedValue(defaultAdaptive());
    mockGenerateStudentActions.mockResolvedValue(null);
    mockGetActiveStudentAction.mockResolvedValue(null);
    mockGetTimetableForStudent.mockResolvedValue(null);
    mockGetStudentWaecReadinessAll.mockResolvedValue([]);
    mockCurriculumContentCount.mockResolvedValue(0);
    mockStudentProgressCount.mockResolvedValue(0);
    mockCertificateFindUnique.mockResolvedValue(null);
  });

  it("a past-due assignment becomes the hero recommendation with a real day count", async () => {
    mockScheduledWorkFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const dueAt = new Date(Date.now() - 3 * 86_400_000);
    mockAssignmentFindMany
      .mockResolvedValueOnce([]) // due-today query
      .mockResolvedValueOnce([{ id: "a1", title: "Fractions worksheet", dueAt, scheduledWorkId: null }]); // overdue query

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.heroRecommendation?.type).toBe("OVERDUE");
    expect(body.heroRecommendation?.reason).toContain("3 days ago");
  });

  it("Grade 11 WAEC-eligible student with a severe gap and nothing else scheduled gets WAEC_PRACTICE as the hero", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      currentGrade: 11,
      enrollments: [{ classId: "class-1" }],
    });
    mockScheduledWorkFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockAssignmentFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockGetStudentWaecReadinessAll.mockResolvedValue([
      {
        subjectId: "waec_literature",
        name: "Literature-in-English",
        available: true,
        readiness: 10,
        coverage: 0.5,
        trend: "declining",
        nextFocusTopicId: "topic-1",
        nextFocusName: "Prose",
        topics: [],
      },
    ]);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.heroRecommendation?.type).toBe("WAEC_PRACTICE");
    expect(body.heroRecommendation?.href).toBe("/student/waec/literature/practice");
    expect(body.waecSecondaryCard).toBeNull();
  });

  it("Grade 11 student with a mild WAEC gap plus a routine scheduled item: WAEC loses the hero slot but still gets a guaranteed secondary card", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      currentGrade: 11,
      enrollments: [{ classId: "class-1" }],
    });
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([
        {
          id: "sw-1",
          classId: "class-1",
          scheduledDate: new Date(),
          periodNumber: 1,
          startTime: "09:00",
          endTime: "09:45",
          content: {
            contentId: "content-1",
            grade: 11,
            subject: "MATH",
            contentType: "lesson",
            payload: { title: "Coordinate Geometry", durationMins: 45 },
          },
          progress: [{ startedAt: null, completedAt: null }],
        },
      ])
      .mockResolvedValueOnce([]);
    mockAssignmentFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockGetStudentWaecReadinessAll.mockResolvedValue([
      {
        subjectId: "waec_literature",
        name: "Literature-in-English",
        available: true,
        readiness: 70,
        coverage: 0.6,
        trend: "improving",
        nextFocusTopicId: "topic-1",
        nextFocusName: "Prose",
        topics: [],
      },
    ]);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.heroRecommendation?.type).toBe("SCHEDULED_TODAY");
    expect(body.waecSecondaryCard).not.toBeNull();
    expect(body.waecSecondaryCard?.reason).toContain("70%");
  });

  it("not WAEC-eligible (grade 7): readiness is never fetched and no WAEC candidate appears", async () => {
    mockScheduledWorkFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockAssignmentFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/student/today/route");
    await GET();

    expect(mockGetStudentWaecReadinessAll).not.toHaveBeenCalled();
  });

  // Sprint 6.7 Deliverable 1's real walkthrough found this exact case empty:
  // a Grade 11 WAEC-track student with real readiness data but zero class
  // enrollment got a bare "no lessons available" page. WAEC readiness is
  // computed straight from mastery data and never depended on enrollment, so
  // this case must still surface it.
  it("Grade 11 WAEC-eligible student with NO class enrollment still gets the WAEC gap as the hero", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      currentGrade: 11,
      enrollments: [],
    });
    mockGetStudentWaecReadinessAll.mockResolvedValue([
      {
        subjectId: "waec_literature",
        name: "Literature-in-English",
        available: true,
        readiness: 10,
        coverage: 0.5,
        trend: "declining",
        nextFocusTopicId: "topic-1",
        nextFocusName: "Prose",
        topics: [],
      },
    ]);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.items).toEqual([]);
    expect(body.heroRecommendation?.type).toBe("WAEC_PRACTICE");
    expect(body.heroRecommendation?.href).toBe("/student/waec/literature/practice");
    expect(body.waecSecondaryCard).toBeNull();
  });

  it("Grade 7 (not WAEC-eligible) student with NO class enrollment gets the plain empty state, unchanged", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      currentGrade: 7,
      enrollments: [],
    });

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body).toEqual({ items: [], adaptivePlan: expect.any(Object) });
    expect(mockGetStudentWaecReadinessAll).not.toHaveBeenCalled();
  });

  it("attaches certificate-proximity 'unlocks' data for the hero's subject when a real gap exists", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([
        {
          id: "sw-1",
          classId: "class-1",
          scheduledDate: new Date(),
          periodNumber: 1,
          startTime: "09:00",
          endTime: "09:45",
          content: {
            contentId: "content-1",
            grade: 7,
            subject: "MATH",
            contentType: "lesson",
            payload: { title: "Ratios", durationMins: 45 },
          },
          progress: [{ startedAt: null, completedAt: null }],
        },
      ])
      .mockResolvedValueOnce([]);
    mockAssignmentFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockCurriculumContentCount.mockResolvedValue(10);
    mockStudentProgressCount.mockResolvedValue(6);
    mockCertificateFindUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.unlocks).toMatchObject({
      subject: "MATH",
      completedLessons: 6,
      totalLessons: 10,
      completionPct: 60,
    });
  });

  it("does not surface unlocks when the certificate was already awarded", async () => {
    mockScheduledWorkFindMany
      .mockResolvedValueOnce([
        {
          id: "sw-1",
          classId: "class-1",
          scheduledDate: new Date(),
          periodNumber: 1,
          startTime: "09:00",
          endTime: "09:45",
          content: {
            contentId: "content-1",
            grade: 7,
            subject: "MATH",
            contentType: "lesson",
            payload: { title: "Ratios", durationMins: 45 },
          },
          progress: [{ startedAt: null, completedAt: null }],
        },
      ])
      .mockResolvedValueOnce([]);
    mockAssignmentFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockCurriculumContentCount.mockResolvedValue(10);
    mockStudentProgressCount.mockResolvedValue(9);
    mockCertificateFindUnique.mockResolvedValue({ id: "cert-1" });

    const { GET } = await import("@/app/api/student/today/route");
    const body = await (await GET()).json();

    expect(body.unlocks).toBeNull();
  });
});
