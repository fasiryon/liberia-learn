import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  learningEvent: { findMany: vi.fn() },
  studentPerformanceEvent: { findMany: vi.fn() },
  student: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

import { buildXapiExport } from "@/lib/interoperability/xapiExport";

const INPUT = {
  schoolId: "school-1",
  since: new Date("2026-07-01T00:00:00.000Z"),
  until: new Date("2026-07-21T23:59:59.999Z"),
  source: "all" as const,
  limit: 100,
  pseudonymSecret: "test-xapi-export-secret-at-least-32",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.learningEvent.findMany.mockResolvedValue([
    {
      id: "learning-1",
      eventType: "lesson.completed",
      occurredAt: new Date("2026-07-10T10:00:00.000Z"),
      originalOccurredAt: null,
      userId: "student-user-1",
      studentId: null,
      actorId: null,
      targetType: "lesson",
      targetId: "lesson-1",
      contentId: "content-1",
      lessonId: "lesson-1",
      status: "completed",
      curriculumVersion: "2026.1",
      promptVersion: null,
      assessmentVersion: null,
      calculationVersion: null,
      replayOfEventId: null,
      replaySequence: null,
      isReplay: false,
    },
  ]);
  db.studentPerformanceEvent.findMany.mockResolvedValue([
    {
      id: "performance-1",
      studentId: "student-1",
      lessonId: "lesson-1",
      subject: "Mathematics",
      gradeLevel: 6,
      eventType: "practice_attempt",
      score: 0.8,
      durationSeconds: 90,
      attempts: 1,
      aiAssistUsed: false,
      createdAt: new Date("2026-07-10T11:00:00.000Z"),
    },
  ]);
  db.student.findMany.mockResolvedValue([{ id: "student-1", userId: "student-user-1" }]);
});

describe("xAPI export query service", () => {
  it("queries both event streams with explicit school scope and emits pseudonymous statements", async () => {
    const statements = await buildXapiExport(INPUT);

    expect(db.learningEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: "school-1" }),
    }));
    expect(db.studentPerformanceEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        schoolId: "school-1",
        student: { user: { schoolId: "school-1" } },
      }),
    }));
    expect(db.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ user: { schoolId: "school-1" } }),
    }));
    expect(statements).toHaveLength(2);
    expect(statements[0].actor).toEqual(statements[1].actor);
    expect(JSON.stringify(statements)).not.toContain("student-user-1");
    expect(JSON.stringify(statements)).not.toContain("student-1");
  });

  it("does not query the excluded stream", async () => {
    await buildXapiExport({ ...INPUT, source: "learning" });

    expect(db.learningEvent.findMany).toHaveBeenCalledTimes(1);
    expect(db.studentPerformanceEvent.findMany).not.toHaveBeenCalled();
  });
});
