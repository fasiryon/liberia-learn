import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionCount = vi.hoisted(() => vi.fn());
const mockTeacherMorningBriefUpsert = vi.hoisted(() => vi.fn());
const mockBuildClassDifferentiationRollup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    class: { findMany: mockClassFindMany },
    assignmentSubmission: { count: mockAssignmentSubmissionCount },
    teacherMorningBrief: { upsert: mockTeacherMorningBriefUpsert },
  },
}));
vi.mock("@/lib/teacher/classDifferentiation", () => ({
  buildClassDifferentiationRollup: mockBuildClassDifferentiationRollup,
}));

import {
  morningbriefGetTeacherSignalsTool,
  morningbriefSaveBriefTool,
} from "@/lib/agents/tools/morningbrief.tools";

const CTX = { agentName: "morning-brief", userId: null, userRole: "system" as const, traceId: "trace-1" };

describe("morningbrief.getTeacherSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ name: "Mulbah Sirleaf", schoolId: "school-cha" });
    mockClassFindMany.mockResolvedValue([
      { id: "class-1", name: "Mathematics", _count: { enrollments: 44 } },
    ]);
    mockAssignmentSubmissionCount.mockResolvedValue(0);
  });

  it("loads real classes, teacher name, and school", async () => {
    mockBuildClassDifferentiationRollup.mockResolvedValue({
      classId: "class-1",
      className: "Mathematics",
      studentCount: 44,
      generatedAt: "now",
      groups: [{ type: "ON_TRACK", label: "On track", students: [] }],
    });

    const result = await morningbriefGetTeacherSignalsTool.handler({ teacherUserId: "teacher-1" }, CTX);
    expect(result.teacherName).toBe("Mulbah Sirleaf");
    expect(result.schoolId).toBe("school-cha");
    expect(result.classes).toEqual([{ classId: "class-1", className: "Mathematics", studentCount: 44 }]);
  });

  it("surfaces the top interventions from the Sprint 7.2 rollup, excluding ON_TRACK students", async () => {
    mockBuildClassDifferentiationRollup.mockResolvedValue({
      classId: "class-1",
      className: "Mathematics",
      studentCount: 2,
      generatedAt: "now",
      groups: [
        {
          type: "OVERDUE",
          label: "Overdue work",
          students: [
            {
              studentId: "s1",
              userId: "u1",
              name: "Finda Pewu",
              currentGrade: 6,
              hero: { type: "OVERDUE", priority: 80, label: "5 overdue", reason: "34 days overdue", href: "/teacher/students/s1" },
              interventionCount: 1,
              certificateProximity: null,
            },
          ],
        },
        { type: "ON_TRACK", label: "On track", students: [{ studentId: "s2", userId: "u2", name: "Other Student", currentGrade: 6, hero: null, interventionCount: 0, certificateProximity: null }] },
      ],
    });

    const result = await morningbriefGetTeacherSignalsTool.handler({ teacherUserId: "teacher-1" }, CTX);
    expect(result.interventionsTotalCount).toBe(1);
    expect(result.interventionsNeeded).toEqual([
      { studentName: "Finda Pewu", className: "Mathematics", type: "OVERDUE", label: "5 overdue", reason: "34 days overdue" },
    ]);
  });

  it("surfaces students close to a certificate unlock", async () => {
    mockBuildClassDifferentiationRollup.mockResolvedValue({
      classId: "class-1",
      className: "Mathematics",
      studentCount: 1,
      generatedAt: "now",
      groups: [
        {
          type: "WAEC_PRACTICE",
          label: "Behind on WAEC readiness",
          students: [
            {
              studentId: "s1",
              userId: "u1",
              name: "Blessing Toe",
              currentGrade: 10,
              hero: { type: "WAEC_PRACTICE", priority: 60, label: "Physics readiness: 60%", reason: "reason", href: "/teacher/students/s1" },
              interventionCount: 1,
              certificateProximity: { subject: "MATH", completionPct: 90, remainingLessons: 1 },
            },
          ],
        },
      ],
    });

    const result = await morningbriefGetTeacherSignalsTool.handler({ teacherUserId: "teacher-1" }, CTX);
    expect(result.certificateUnlocksClose).toEqual([
      { studentName: "Blessing Toe", className: "Mathematics", subject: "MATH", completionPct: 90, remainingLessons: 1 },
    ]);
  });

  it("counts real ungraded submissions scoped to the teacher's own classes", async () => {
    mockBuildClassDifferentiationRollup.mockResolvedValue({
      classId: "class-1",
      className: "Mathematics",
      studentCount: 0,
      generatedAt: "now",
      groups: [],
    });
    mockAssignmentSubmissionCount.mockResolvedValue(7);

    const result = await morningbriefGetTeacherSignalsTool.handler({ teacherUserId: "teacher-1" }, CTX);
    expect(result.ungradedSubmissionsCount).toBe(7);
    expect(mockAssignmentSubmissionCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          turnedInAt: { not: null },
          gradedAt: null,
          Assignment: { classId: { in: ["class-1"] } },
        }),
      })
    );
  });

  it("throws when the teacher does not exist", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await expect(morningbriefGetTeacherSignalsTool.handler({ teacherUserId: "missing" }, CTX)).rejects.toThrow();
  });
});

describe("morningbrief.saveBrief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ schoolId: "school-cha" });
    mockTeacherMorningBriefUpsert.mockResolvedValue({ id: "brief-1" });
  });

  const snapshot = {
    teacherUserId: "teacher-1",
    teacherName: "Mulbah Sirleaf",
    schoolId: "school-cha",
    briefDate: "2026-07-22",
    classes: [],
    interventionsNeeded: [],
    interventionsTotalCount: 0,
    certificateUnlocksClose: [],
    ungradedSubmissionsCount: 0,
  };

  it("upserts on (teacherUserId, briefDate), safe to call twice for the same day", async () => {
    const result = await morningbriefSaveBriefTool.handler(
      { teacherUserId: "teacher-1", briefDate: "2026-07-22", briefText: "All clear today.", dataSnapshot: snapshot },
      CTX
    );
    expect(result.briefId).toBe("brief-1");
    expect(mockTeacherMorningBriefUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherUserId_briefDate: { teacherUserId: "teacher-1", briefDate: new Date("2026-07-22T00:00:00.000Z") } },
      })
    );
  });

  it("throws when the teacher has no school context", async () => {
    mockUserFindUnique.mockResolvedValue({ schoolId: null });
    await expect(
      morningbriefSaveBriefTool.handler(
        { teacherUserId: "teacher-1", briefDate: "2026-07-22", briefText: "text", dataSnapshot: snapshot },
        CTX
      )
    ).rejects.toThrow();
  });
});
