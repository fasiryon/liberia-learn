import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindFirst = vi.hoisted(() => vi.fn());
const mockScheduledWorkCreate = vi.hoisted(() => vi.fn());
const mockTimetableAssignmentFindFirst = vi.hoisted(() => vi.fn());
const mockEnrollmentFindUnique = vi.hoisted(() => vi.fn());
const mockStudentProgressCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    scheduledWork: {
      findUnique: mockScheduledWorkFindUnique,
      findFirst: mockScheduledWorkFindFirst,
      create: mockScheduledWorkCreate,
    },
    timetableAssignment: { findFirst: mockTimetableAssignmentFindFirst },
    enrollment: { findUnique: mockEnrollmentFindUnique },
    studentProgress: { create: mockStudentProgressCreate },
  },
}));

function scheduledWork(id = "sw-created") {
  return {
    id,
    classId: "class-1",
    classFormat: "standard",
    class: {
      id: "class-1",
      schoolId: "school-1",
      name: "Class 1",
      Teacher: { name: "Teacher" },
      School: { name: "School" },
    },
    content: {
      contentId: "content-123",
      payload: {
        title: "Timetable Lesson",
        body: "## Teacher Guidance\nNever expose this planning note.",
        activities: ["Teacher-only planning note"],
        labs: [{
          title: "Evidence lab",
          type: "guided_walkthrough",
          secretAnswer: "hidden",
          procedure: [{ instruction: "Record one observation.", teacherNote: "teacher secret" }],
          analysisQuestions: [{ question: "What did you observe?", expectedAnswer: "hidden answer", scoringRubric: "teacher rubric" }],
        }],
        objectives: ["Use evidence from the passage."],
        studentMaterials: {
          learnerMaterial: "Read the passage and underline two details that support its central idea.",
          guidedItems: ["Which detail supports the central idea?"],
          independentItems: ["Write the central idea in your own words."],
          masteryTask: "State the central idea and cite two details.",
          classwork: ["Sort the details into supports and does not support."],
          groupWork: "In groups, compare the passage evidence and report one supported claim.",
          homework: ["Find one short paragraph at home and identify its central idea."],
          project: "Create a one-page evidence chart.",
        },
      },
      subject: "MATH",
      grade: 4,
      contentType: "lesson",
      status: "published",
      version: "v1",
      deliveryProfile: { exitTicket: { questions: [] } },
      moeAlignments: [],
      audioAssets: [],
      videoSupplements: [],
    },
    progress: [],
  };
}

describe("student timetable contentId lesson routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindUnique.mockResolvedValue({ id: "student-1" });
    mockScheduledWorkFindUnique.mockResolvedValue(null);
    mockScheduledWorkFindFirst.mockResolvedValue(null);
    mockScheduledWorkCreate.mockResolvedValue(scheduledWork());
    mockTimetableAssignmentFindFirst.mockResolvedValue({
      curriculumContentId: "content-123",
      timetable: {
        classId: "class-1",
        periodLabel: "Period 1",
        startTime: "08:30",
        endTime: "09:15",
        teacherId: "teacher-1",
      },
    });
    mockEnrollmentFindUnique.mockResolvedValue({ id: "enrollment-1" });
    mockStudentProgressCreate.mockResolvedValue({ id: "progress-1" });
  });

  it("loads a timetable lesson using raw contentId and returns scheduled work id for progress saves", async () => {
    const { GET } = await import("@/app/api/student/work/[scheduledWorkId]/route");
    const res = await GET(new Request("http://localhost/api/student/work/content-123") as any, {
      params: Promise.resolve({ scheduledWorkId: "content-123" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("sw-created");
    expect(data.contentId).toBe("content-123");
    expect(data.body).toContain("Read the passage");
    expect(data.body).not.toContain("Teacher Guidance");
    expect(data.body).not.toContain("Teacher-only planning note");
    expect(data.body).not.toContain("hidden");
    expect(data.bodyStandard).toBe(data.body);
    expect(data.activities).toContain("Sort the details into supports and does not support.");
    expect(data.activities).not.toContain("Teacher-only planning note");
    expect(data.body).toContain("In groups, compare the passage evidence");
    expect(data.body).not.toContain("Discuss the material with your group. Take turns explaining");
    expect(data.labs).toHaveLength(1);
    expect(data.labs[0]).not.toHaveProperty("secretAnswer");
    expect(data.labs[0].procedure[0]).not.toHaveProperty("teacherNote");
    expect(data.labs[0].analysisQuestions[0]).not.toHaveProperty("expectedAnswer");
    expect(data.labs[0].analysisQuestions[0]).not.toHaveProperty("scoringRubric");
    expect(mockScheduledWorkCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contentId: "content-123", classId: "class-1" }),
    }));
  });
});
