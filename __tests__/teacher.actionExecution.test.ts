import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTeacherActionFindFirst = vi.hoisted(() => vi.fn());
const mockTeacherActionUpdate = vi.hoisted(() => vi.fn());
const mockTeacherActionCreate = vi.hoisted(() => vi.fn());
const mockAssignmentCreate = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionCreateMany = vi.hoisted(() => vi.fn());
const mockStudentFindMany = vi.hoisted(() => vi.fn());
const mockClassFindFirst = vi.hoisted(() => vi.fn());
const mockEnrollmentFindFirst = vi.hoisted(() => vi.fn());
const mockCurriculumFindUnique = vi.hoisted(() => vi.fn());
const mockInterventionUpdateMany = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindFirst = vi.hoisted(() => vi.fn());
const mockTimetableFindFirst = vi.hoisted(() => vi.fn());
const mockTimetableAssignmentUpsert = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockPlanner = vi.hoisted(() => vi.fn());
const mockOpenInterventionChain = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    teacherAction: {
      findFirst: mockTeacherActionFindFirst,
      update: mockTeacherActionUpdate,
      create: mockTeacherActionCreate,
    },
    assignment: { create: mockAssignmentCreate },
    assignmentSubmission: { createMany: mockAssignmentSubmissionCreateMany },
    student: { findMany: mockStudentFindMany },
    class: { findFirst: mockClassFindFirst },
    enrollment: { findFirst: mockEnrollmentFindFirst },
    curriculumContent: { findUnique: mockCurriculumFindUnique },
    interventionRecommendation: { updateMany: mockInterventionUpdateMany },
    scheduledWork: { findFirst: mockScheduledWorkFindFirst },
    timetable: { findFirst: mockTimetableFindFirst },
    timetableAssignment: { upsert: mockTimetableAssignmentUpsert },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/ai/teacher/lessonPlanner", () => ({
  getTeacherLessonPlannerResponse: mockPlanner,
}));
vi.mock("@/lib/interventions/interventionChains", () => ({
  openInterventionChain: mockOpenInterventionChain,
}));

import { executeTeacherAction } from "@/lib/intelligence/teacherActionExecution";
import { bindLessonPlanToSlot } from "@/lib/intelligence/lessonPlanBinding";

const TEACHER_ID = "teacher-1";
const SCHOOL_ID = "school-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockTeacherActionUpdate.mockResolvedValue({});
  mockTeacherActionCreate.mockResolvedValue({ id: "created-action-1" });
  mockAssignmentCreate.mockResolvedValue({ id: "assignment-1" });
  mockAssignmentSubmissionCreateMany.mockResolvedValue({ count: 1 });
  mockStudentFindMany.mockResolvedValue([{ id: "student-1" }]);
  mockClassFindFirst.mockResolvedValue({ id: "class-1", name: "Grade 7A" });
  mockEnrollmentFindFirst.mockResolvedValue({ classId: "class-1", Class: { id: "class-1", name: "Grade 7A" } });
  mockCurriculumFindUnique.mockResolvedValue({
    contentId: "content-1",
    payload: { title: "Fractions" },
    moeAlignments: [{ code: "MATH.7.1" }],
  });
  mockInterventionUpdateMany.mockResolvedValue({ count: 1 });
  mockLogAudit.mockResolvedValue(undefined);
  mockLogLearningEvent.mockResolvedValue(undefined);
  mockPlanner.mockResolvedValue({
    learningObjectives: ["Review the weak concept"],
    warmUpActivity: "Quick recap",
    teachingSequence: [],
    assessmentCheck: "Exit ticket",
    homeworkSuggestion: "Practice",
    hadFallback: false,
  });
  mockOpenInterventionChain.mockResolvedValue({ id: "chain-1" });
  mockScheduledWorkFindFirst.mockResolvedValue(null);
  mockTimetableFindFirst.mockResolvedValue(null);
  mockTimetableAssignmentUpsert.mockResolvedValue({ id: "tt-assignment-1" });
});

describe("executeTeacherAction", () => {
  it("teacher can execute own remediation action and create an assignment", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "action-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      classId: null,
      studentId: "student-1",
      contentId: "content-1",
      actionType: "teacher_alert.ASSIGN_REMEDIATION_REVIEW",
      metadata: { lifecycle: "draft", action: { status: "available" } },
    });

    const result = await executeTeacherAction("action-1", {
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });

    expect(result.status).toBe("executed");
    expect(result.resourceId).toBe("assignment-1");
    expect(mockAssignmentCreate).toHaveBeenCalledOnce();
    expect(mockAssignmentCreate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        classId: "class-1",
        contentId: "content-1",
        generationMethod: "suggested",
      })
    );
  });

  it("stores target students and creates placeholder submissions for targeted remediation", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "action-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      classId: "class-1",
      studentId: null,
      contentId: "content-1",
      actionType: "teacher_alert.ASSIGN_REMEDIATION_REVIEW",
      metadata: { lifecycle: "draft", action: { status: "available", targetStudents: ["student-1", "foreign-student"] } },
    });
    mockStudentFindMany.mockResolvedValue([{ id: "student-1" }]);

    const result = await executeTeacherAction("action-1", {
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });

    expect(result.status).toBe("executed");
    expect(mockAssignmentSubmissionCreateMany).toHaveBeenCalledWith({
      data: [{ assignmentId: "assignment-1", studentId: "student-1" }],
      skipDuplicates: true,
    });
    expect(mockTeacherActionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "assignment_targeting",
          targetType: "assignment",
          targetId: "assignment-1",
          metadata: expect.objectContaining({
            targetStudentIds: ["student-1"],
            invalidTargetStudentIds: ["foreign-student"],
          }),
        }),
      })
    );
  });

  it("keeps remediation class-level when the target list is empty", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "action-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      classId: "class-1",
      studentId: null,
      contentId: "content-1",
      actionType: "teacher_alert.ASSIGN_REMEDIATION_REVIEW",
      metadata: { lifecycle: "draft", action: { status: "available", targetStudents: [] } },
    });

    await executeTeacherAction("action-1", {
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });

    expect(mockAssignmentCreate).toHaveBeenCalledOnce();
    expect(mockAssignmentSubmissionCreateMany).not.toHaveBeenCalled();
    expect(mockTeacherActionCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actionType: "assignment_targeting" }) })
    );
  });

  it("does not create class-wide remediation when targeted students are outside the class or tenant", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "action-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      classId: "class-1",
      studentId: null,
      contentId: "content-1",
      actionType: "teacher_alert.ASSIGN_REMEDIATION_REVIEW",
      metadata: { lifecycle: "draft", action: { status: "available", targetStudents: ["foreign-student"] } },
    });
    mockStudentFindMany.mockResolvedValue([]);

    await expect(
      executeTeacherAction("action-1", { teacherUserId: TEACHER_ID, schoolId: SCHOOL_ID })
    ).rejects.toMatchObject({ status: 409 });

    expect(mockAssignmentCreate).not.toHaveBeenCalled();
    expect(mockAssignmentSubmissionCreateMany).not.toHaveBeenCalled();
  });

  it("cannot execute actions from another school or teacher", async () => {
    mockTeacherActionFindFirst.mockResolvedValue(null);
    await expect(
      executeTeacherAction("action-foreign", { teacherUserId: TEACHER_ID, schoolId: SCHOOL_ID })
    ).rejects.toMatchObject({ status: 404 });
    expect(mockAssignmentCreate).not.toHaveBeenCalled();
  });

  it("fails safely when required remediation data is missing", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "action-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      classId: null,
      studentId: "student-1",
      contentId: null,
      actionType: "teacher_alert.ASSIGN_REMEDIATION_REVIEW",
      metadata: { lifecycle: "draft", action: { status: "needs_review" } },
    });

    await expect(
      executeTeacherAction("action-1", { teacherUserId: TEACHER_ID, schoolId: SCHOOL_ID })
    ).rejects.toMatchObject({ status: 409 });
    expect(mockTeacherActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ lifecycle: "failed" }),
        }),
      })
    );
  });

  it("uses the existing planner for review plan actions", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "action-plan",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      classId: "class-1",
      studentId: null,
      contentId: null,
      subject: "SCIENCE",
      actionType: "teacher_alert.PLAN_CLASS_REVIEW",
      metadata: { lifecycle: "draft", action: { status: "needs_review", evidence: "Average dropped." } },
    });

    const result = await executeTeacherAction("action-plan", {
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });

    expect(result.resourceType).toBe("teacher_action");
    expect(mockPlanner).toHaveBeenCalledOnce();
    expect(mockTeacherActionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "lesson_plan_saved" }),
      })
    );
  });
});

describe("bindLessonPlanToSlot", () => {
  it("links a plan to a scheduled work slot", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "plan-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      actionType: "lesson_plan_saved",
      contentId: "content-1",
      metadata: { lessonTitle: "Fractions plan", plannedDate: "2026-05-04" },
    });
    mockScheduledWorkFindFirst.mockResolvedValue({
      id: "sw-1",
      classId: "class-1",
      contentId: "content-1",
      scheduledDate: new Date("2026-05-04T09:00:00.000Z"),
    });

    const result = await bindLessonPlanToSlot({
      planId: "plan-1",
      slotId: "sw-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });

    expect(result.bindingStatus).toBe("bound");
    expect(result.slotType).toBe("scheduled_work");
    expect(mockTeacherActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ scheduledWorkId: "sw-1", bindingStatus: "bound" }),
        }),
      })
    );
  });

  it("falls back to needs_review when slot is missing", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "plan-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      actionType: "lesson_plan_saved",
      contentId: "content-1",
      metadata: { lessonTitle: "Fractions plan" },
    });
    mockScheduledWorkFindFirst.mockResolvedValue(null);
    mockTimetableFindFirst.mockResolvedValue(null);

    const result = await bindLessonPlanToSlot({
      planId: "plan-1",
      slotId: "missing-slot",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });

    expect(result.bindingStatus).toBe("needs_review");
    expect(mockTimetableAssignmentUpsert).not.toHaveBeenCalled();
  });

  it("binds to timetable slots through the existing timetable assignment service", async () => {
    mockTeacherActionFindFirst.mockResolvedValue({
      id: "plan-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
      actionType: "lesson_plan_saved",
      contentId: "content-1",
      metadata: { lessonTitle: "Fractions plan", plannedDate: "2026-05-04" },
    });
    mockScheduledWorkFindFirst.mockResolvedValue(null);
    mockTimetableFindFirst.mockResolvedValue({ id: "tt-1", classId: "class-1", periodLabel: "P1" });

    const result = await bindLessonPlanToSlot({
      planId: "plan-1",
      slotId: "tt-1",
      teacherUserId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });

    expect(result.slotType).toBe("timetable");
    expect(mockTimetableAssignmentUpsert).toHaveBeenCalledOnce();
  });
});
