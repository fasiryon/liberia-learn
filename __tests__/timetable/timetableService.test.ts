import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockTimetableFindMany = vi.hoisted(() => vi.fn());
const mockTimetableAssignmentUpsert = vi.hoisted(() => vi.fn());
const mockTimetableAssignmentDeleteMany = vi.hoisted(() => vi.fn());
const mockTimetableFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    enrollment: { findMany: mockEnrollmentFindMany },
    timetable: {
      findMany: mockTimetableFindMany,
      findFirst: mockTimetableFindFirst,
    },
    timetableAssignment: {
      upsert: mockTimetableAssignmentUpsert,
      deleteMany: mockTimetableAssignmentDeleteMany,
    },
  },
}));

import {
  getTimetableForStudent,
  getTimetableForTeacher,
  assignLessonToSlot,
  removeLessonFromSlot,
} from "@/lib/timetable/timetableService";

// Monday 2026-04-27
const MONDAY = new Date("2026-04-27T08:00:00.000Z");

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: "slot-1",
    classId: "class-1",
    subject: "MATH",
    dayOfWeek: "MONDAY",
    periodLabel: "Period 1",
    startTime: "08:30",
    endTime: "09:15",
    room: null,
    teacher: { id: "teacher-1", name: "Mulbah Sirleaf" },
    class: { id: "class-1", name: "7A" },
    assignments: [],
    ...overrides,
  };
}

describe("getTimetableForStudent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrollmentFindMany.mockResolvedValue([{ classId: "class-1" }]);
    mockTimetableFindMany.mockResolvedValue([]);
  });

  it("returns null when student has no enrollments", async () => {
    mockEnrollmentFindMany.mockResolvedValueOnce([]);
    const result = await getTimetableForStudent("student-1", MONDAY);
    expect(result).toBeNull();
  });

  it("returns null when no timetable slots on that day", async () => {
    const result = await getTimetableForStudent("student-1", MONDAY);
    expect(result).toBeNull();
  });

  it("returns periods sorted by startTime ascending", async () => {
    mockTimetableFindMany.mockResolvedValueOnce([
      makeSlot({ id: "slot-2", periodLabel: "Period 2", startTime: "09:30" }),
      makeSlot({ id: "slot-1", periodLabel: "Period 1", startTime: "08:30" }),
    ]);

    const result = await getTimetableForStudent("student-1", MONDAY);

    expect(result).not.toBeNull();
    expect(result!.periods[0].startTime).toBe("08:30");
    expect(result!.periods[1].startTime).toBe("09:30");
  });

  it("queries with the correct dayOfWeek for a Monday", async () => {
    mockTimetableFindMany.mockResolvedValueOnce([makeSlot()]);
    await getTimetableForStudent("student-1", MONDAY);

    const callArgs = mockTimetableFindMany.mock.calls[0][0];
    expect(callArgs.where.dayOfWeek).toBe("MONDAY");
  });

  it("period with no assignment has assignment: null", async () => {
    mockTimetableFindMany.mockResolvedValueOnce([makeSlot({ assignments: [] })]);

    const result = await getTimetableForStudent("student-1", MONDAY);

    expect(result!.periods[0].assignment).toBeNull();
  });

  it("period with assignment returns assignment details", async () => {
    mockTimetableFindMany.mockResolvedValueOnce([
      makeSlot({
        assignments: [
          {
            id: "ta-1",
            title: "Algebra: Quadratic Equations",
            curriculumContentId: "content-123",
            instructions: "Focus on factoring.",
          },
        ],
      }),
    ]);

    const result = await getTimetableForStudent("student-1", MONDAY);
    const assignment = result!.periods[0].assignment!;

    expect(assignment.title).toBe("Algebra: Quadratic Equations");
    expect(assignment.contentId).toBe("content-123");
    expect(assignment.lessonUrl).toBe("/student/lessons/content-123");
    expect(assignment.instructions).toBe("Focus on factoring.");
  });

  it("tenant scoping: queries only class IDs from student's enrollments", async () => {
    mockEnrollmentFindMany.mockResolvedValueOnce([
      { classId: "class-A" },
      { classId: "class-B" },
    ]);
    mockTimetableFindMany.mockResolvedValueOnce([]);

    await getTimetableForStudent("student-1", MONDAY);

    const callArgs = mockTimetableFindMany.mock.calls[0][0];
    expect(callArgs.where.classId).toEqual({ in: ["class-A", "class-B"] });
  });

  it("returns correct date and dayName in response", async () => {
    mockTimetableFindMany.mockResolvedValueOnce([makeSlot()]);

    const result = await getTimetableForStudent("student-1", MONDAY);

    expect(result!.dayName).toBe("Monday");
    expect(result!.date).toBe("2026-04-27");
    expect(result!.configured).toBe(true);
  });
});

describe("getTimetableForTeacher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimetableFindMany.mockResolvedValue([]);
  });

  it("returns empty array when no slots on that day", async () => {
    const result = await getTimetableForTeacher("teacher-1", "school-1", MONDAY);
    expect(result).toEqual([]);
  });

  it("returns slots sorted by startTime", async () => {
    mockTimetableFindMany.mockResolvedValueOnce([
      makeSlot({ id: "slot-2", startTime: "10:00" }),
      makeSlot({ id: "slot-1", startTime: "08:30" }),
    ]);

    const result = await getTimetableForTeacher("teacher-1", "school-1", MONDAY);
    expect(result[0].startTime).toBe("08:30");
    expect(result[1].startTime).toBe("10:00");
  });

  it("scopes query to teacherId and schoolId", async () => {
    await getTimetableForTeacher("teacher-1", "school-1", MONDAY);

    const callArgs = mockTimetableFindMany.mock.calls[0][0];
    expect(callArgs.where.teacherId).toBe("teacher-1");
    expect(callArgs.where.schoolId).toBe("school-1");
  });
});

describe("assignLessonToSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimetableFindFirst.mockResolvedValue({ id: "slot-1" });
    mockTimetableAssignmentUpsert.mockResolvedValue({ id: "ta-1" });
  });

  it("upserts an assignment when slot belongs to the teacher", async () => {
    const result = await assignLessonToSlot(
      "slot-1",
      "teacher-1",
      "school-1",
      {
        assignedDate: MONDAY,
        title: "Algebra: Quadratic Equations",
        curriculumContentId: "content-123",
        instructions: null,
      }
    );
    expect(result.id).toBe("ta-1");
    expect(mockTimetableAssignmentUpsert).toHaveBeenCalledOnce();
  });

  it("throws 404 when slot not found or teacher does not own it", async () => {
    mockTimetableFindFirst.mockResolvedValueOnce(null);

    await expect(
      assignLessonToSlot("slot-999", "teacher-1", "school-1", {
        assignedDate: MONDAY,
        title: "Test",
        curriculumContentId: null,
        instructions: null,
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("uses upsert semantics (same slot+date replaces existing)", async () => {
    await assignLessonToSlot("slot-1", "teacher-1", "school-1", {
      assignedDate: MONDAY,
      title: "Updated title",
      curriculumContentId: null,
      instructions: null,
    });

    const upsertCall = mockTimetableAssignmentUpsert.mock.calls[0][0];
    expect(upsertCall.where.timetableId_assignedDate).toMatchObject({
      timetableId: "slot-1",
    });
    expect(upsertCall.update).toMatchObject({ title: "Updated title" });
  });
});

describe("removeLessonFromSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimetableFindFirst.mockResolvedValue({ id: "slot-1" });
    mockTimetableAssignmentDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes the assignment when teacher owns the slot", async () => {
    await removeLessonFromSlot("slot-1", "teacher-1", "school-1", MONDAY);
    expect(mockTimetableAssignmentDeleteMany).toHaveBeenCalledOnce();
  });

  it("throws 404 when teacher does not own the slot", async () => {
    mockTimetableFindFirst.mockResolvedValueOnce(null);

    await expect(
      removeLessonFromSlot("slot-999", "teacher-1", "school-1", MONDAY)
    ).rejects.toMatchObject({ status: 404 });
  });
});
