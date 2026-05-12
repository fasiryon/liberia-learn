import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Hoist mock objects before vi.mock calls ----------------------------

const mockPrismaInstance = vi.hoisted(() => {
  const STUDENT_ID = "student-1";
  const TERM_ID = "term-1";
  const CLASS_ID = "class-1";
  const SCHOOL_ID = "school-1";
  const CREATED_BY = "admin-1";

  const mockTerm = {
    id: TERM_ID,
    name: "Term 1",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-04-30"),
  };
  const mockStudent = { id: STUDENT_ID, user: { schoolId: SCHOOL_ID } };
  const mockClass = { id: CLASS_ID, subject: "MATH" };

  return {
    term: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(mockTerm),
    },
    student: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(mockStudent),
      findUnique: vi.fn().mockResolvedValue({ id: STUDENT_ID }),
    },
    reportCard: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(({ create }: any) =>
        Promise.resolve({ id: "rc-1", ...create })
      ),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: "rc-1", ...data })
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    class: {
      findUnique: vi.fn().mockResolvedValue(mockClass),
      findFirst: vi.fn().mockResolvedValue({ id: CLASS_ID, schoolId: SCHOOL_ID }),
      findMany: vi.fn().mockResolvedValue([{ id: CLASS_ID }]),
    },
    assignmentSubmission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    grade: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    attendance: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    enrollment: {
      findMany: vi.fn().mockResolvedValue([{ Student: { id: STUDENT_ID } }]),
    },
    studentGuardian: {
      findFirst: vi.fn().mockResolvedValue({ guardianId: "g-1", studentId: STUDENT_ID }),
      findMany: vi.fn().mockResolvedValue([
        { student: { id: STUDENT_ID, user: { name: "Fatu" } } },
      ]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrismaInstance }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));

// ---- Constants ----------------------------------------------------------

const STUDENT_ID = "student-1";
const TERM_ID = "term-1";
const CLASS_ID = "class-1";
const SCHOOL_ID = "school-1";
const CREATED_BY = "admin-1";

const mockTerm = {
  id: TERM_ID,
  name: "Term 1",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-04-30"),
};
const mockStudent = { id: STUDENT_ID, user: { schoolId: SCHOOL_ID } };
const mockClass = { id: CLASS_ID, subject: "MATH" };

// ---- Imports after mocks ------------------------------------------------

import { generateReportCard } from "@/lib/reportCards/generateReportCard";
import { requireRole } from "@/lib/auth";

const mockRequireRole = requireRole as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrismaInstance.term.findUniqueOrThrow.mockResolvedValue(mockTerm);
  mockPrismaInstance.student.findUniqueOrThrow.mockResolvedValue(mockStudent);
  mockPrismaInstance.student.findUnique.mockResolvedValue({ id: STUDENT_ID });
  mockPrismaInstance.class.findUnique.mockResolvedValue(mockClass);
  mockPrismaInstance.class.findFirst.mockResolvedValue({ id: CLASS_ID, schoolId: SCHOOL_ID });
  mockPrismaInstance.reportCard.findUnique.mockResolvedValue(null);
  mockPrismaInstance.reportCard.upsert.mockImplementation(({ create }: any) =>
    Promise.resolve({ id: "rc-1", ...create })
  );
  mockPrismaInstance.reportCard.update.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "rc-1", ...data })
  );
  mockPrismaInstance.reportCard.updateMany.mockResolvedValue({ count: 2 });
  mockPrismaInstance.reportCard.findMany.mockResolvedValue([]);
  mockPrismaInstance.assignmentSubmission.findMany.mockResolvedValue([]);
  mockPrismaInstance.grade.findMany.mockResolvedValue([]);
  mockPrismaInstance.attendance.findMany.mockResolvedValue([]);
  mockPrismaInstance.enrollment.findMany.mockResolvedValue([{ Student: { id: STUDENT_ID } }]);
  mockPrismaInstance.studentGuardian.findMany.mockResolvedValue([
    { student: { id: STUDENT_ID, user: { name: "Fatu" } } },
  ]);
});

// =========================================================================
// 1. generateReportCard — subject grade aggregation
// =========================================================================

describe("generateReportCard — subject grade aggregation", () => {
  it("computes average from graded submissions", async () => {
    mockPrismaInstance.assignmentSubmission.findMany.mockResolvedValue([
      {
        score: 80,
        gradedAt: new Date("2026-02-01"),
        turnedInAt: null,
        Assignment: { Class: { subject: "MATH" } },
      },
      {
        score: 90,
        gradedAt: new Date("2026-02-15"),
        turnedInAt: null,
        Assignment: { Class: { subject: "MATH" } },
      },
    ]);

    await generateReportCard(STUDENT_ID, TERM_ID, CLASS_ID, CREATED_BY);
    const upsertCall = mockPrismaInstance.reportCard.upsert.mock.calls[0][0];
    const grades = upsertCall.create.subjectGrades as any[];
    const math = grades.find((g: any) => g.subject === "MATH");

    expect(math).toBeDefined();
    expect(math.average).toBe(85); // (80+90)/2
    expect(math.assignmentCount).toBe(2);
  });

  it("handles zero submissions — creates placeholder row for primary class subject", async () => {
    mockPrismaInstance.assignmentSubmission.findMany.mockResolvedValue([]);

    await generateReportCard(STUDENT_ID, TERM_ID, CLASS_ID, CREATED_BY);
    const upsertCall = mockPrismaInstance.reportCard.upsert.mock.calls[0][0];
    const grades = upsertCall.create.subjectGrades as any[];

    expect(grades).toHaveLength(1);
    expect(grades[0].subject).toBe("MATH");
    expect(grades[0].average).toBe(0);
    expect(grades[0].assignmentCount).toBe(0);
  });

  it("attaches exam score from Grade model to primary subject", async () => {
    mockPrismaInstance.grade.findMany.mockResolvedValue([{ percent: 75 }, { percent: 85 }]);
    mockPrismaInstance.assignmentSubmission.findMany.mockResolvedValue([
      {
        score: 70,
        gradedAt: new Date("2026-02-01"),
        turnedInAt: null,
        Assignment: { Class: { subject: "MATH" } },
      },
    ]);

    await generateReportCard(STUDENT_ID, TERM_ID, CLASS_ID, CREATED_BY);
    const upsertCall = mockPrismaInstance.reportCard.upsert.mock.calls[0][0];
    const grades = upsertCall.create.subjectGrades as any[];
    const math = grades.find((g: any) => g.subject === "MATH");

    expect(math.examScore).toBe(80); // (75+85)/2
  });
});

// =========================================================================
// 2. generateReportCard — attendance summary
// =========================================================================

describe("generateReportCard — attendance summary", () => {
  it("counts present, absent, late and computes rate", async () => {
    mockPrismaInstance.attendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
      { status: "LATE" },
    ]);

    await generateReportCard(STUDENT_ID, TERM_ID, CLASS_ID, CREATED_BY);
    const upsertCall = mockPrismaInstance.reportCard.upsert.mock.calls[0][0];
    const att = upsertCall.create.attendanceSummary;

    expect(att.totalDays).toBe(4);
    expect(att.present).toBe(2);
    expect(att.absent).toBe(1);
    expect(att.late).toBe(1);
    expect(att.rate).toBe(50); // 2/4 = 50%
  });

  it("returns zero rate when no attendance records", async () => {
    mockPrismaInstance.attendance.findMany.mockResolvedValue([]);

    await generateReportCard(STUDENT_ID, TERM_ID, CLASS_ID, CREATED_BY);
    const upsertCall = mockPrismaInstance.reportCard.upsert.mock.calls[0][0];
    const att = upsertCall.create.attendanceSummary;

    expect(att.totalDays).toBe(0);
    expect(att.rate).toBe(0);
  });
});

// =========================================================================
// 3. Regenerating a DRAFT overwrites it; PUBLISHED is never overwritten
// =========================================================================

describe("generateReportCard — regeneration guards", () => {
  it("upserts (overwrites) an existing DRAFT card", async () => {
    mockPrismaInstance.reportCard.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "DRAFT",
      studentId: STUDENT_ID,
      termId: TERM_ID,
    });

    await generateReportCard(STUDENT_ID, TERM_ID, CLASS_ID, CREATED_BY);
    expect(mockPrismaInstance.reportCard.upsert).toHaveBeenCalledTimes(1);
  });

  it("does NOT overwrite a PUBLISHED card — returns existing card immediately", async () => {
    const published = {
      id: "rc-published",
      status: "PUBLISHED",
      studentId: STUDENT_ID,
      termId: TERM_ID,
    };
    mockPrismaInstance.reportCard.findUnique.mockResolvedValue(published);

    const result = await generateReportCard(STUDENT_ID, TERM_ID, CLASS_ID, CREATED_BY);
    expect(mockPrismaInstance.reportCard.upsert).not.toHaveBeenCalled();
    expect(result.id).toBe("rc-published");
  });
});

// =========================================================================
// 4. API routes — auth + access control
// =========================================================================

import { NextRequest } from "next/server";

describe("POST /api/admin/report-cards/generate — auth", () => {
  it("returns 403 when not ADMIN", async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const { POST } = await import("@/app/api/admin/report-cards/generate/route");
    const req = new NextRequest("http://localhost/api/admin/report-cards/generate", {
      method: "POST",
      body: JSON.stringify({ classId: CLASS_ID, termId: TERM_ID }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("generates cards for enrolled students when ADMIN", async () => {
    mockRequireRole.mockResolvedValue({ id: CREATED_BY, role: "ADMIN", schoolId: SCHOOL_ID });
    const { POST } = await import("@/app/api/admin/report-cards/generate/route");
    const req = new NextRequest("http://localhost/api/admin/report-cards/generate", {
      method: "POST",
      body: JSON.stringify({ classId: CLASS_ID, termId: TERM_ID }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.generated).toBe("number");
  });
});

describe("PATCH /api/report-cards/[id]/comment — teacher access", () => {
  it("allows teacher to set teacherComment", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: SCHOOL_ID });
    mockPrismaInstance.reportCard.findUnique.mockResolvedValue({
      id: "rc-1",
      schoolId: SCHOOL_ID,
      status: "DRAFT",
    });
    mockPrismaInstance.reportCard.update.mockResolvedValue({
      id: "rc-1",
      teacherComment: "Great work!",
    });

    const { PATCH } = await import("@/app/api/report-cards/[id]/comment/route");
    const req = new NextRequest("http://localhost/api/report-cards/rc-1/comment", {
      method: "PATCH",
      body: JSON.stringify({ teacherComment: "Great work!" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: { id: "rc-1" } });
    expect(res.status).toBe(200);
  });

  it("rejects teacher trying to set principalComment", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: SCHOOL_ID });
    mockPrismaInstance.reportCard.findUnique.mockResolvedValue({
      id: "rc-1",
      schoolId: SCHOOL_ID,
      status: "DRAFT",
    });

    const { PATCH } = await import("@/app/api/report-cards/[id]/comment/route");
    const req = new NextRequest("http://localhost/api/report-cards/rc-1/comment", {
      method: "PATCH",
      body: JSON.stringify({ principalComment: "Good class" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: { id: "rc-1" } });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/report-cards/[id]/publish — admin only", () => {
  it("allows admin to publish a DRAFT card", async () => {
    mockRequireRole.mockResolvedValue({ id: CREATED_BY, role: "ADMIN", schoolId: SCHOOL_ID });
    mockPrismaInstance.reportCard.findUnique.mockResolvedValue({
      id: "rc-1",
      schoolId: SCHOOL_ID,
      status: "DRAFT",
    });

    const { PATCH } = await import("@/app/api/report-cards/[id]/publish/route");
    const req = new NextRequest("http://localhost/api/report-cards/rc-1/publish", {
      method: "PATCH",
    });
    const res = await PATCH(req, { params: { id: "rc-1" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reportCard.status).toBe("PUBLISHED");
  });

  it("returns 403 for teacher trying to publish", async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const { PATCH } = await import("@/app/api/report-cards/[id]/publish/route");
    const req = new NextRequest("http://localhost/api/report-cards/rc-1/publish", {
      method: "PATCH",
    });
    const res = await PATCH(req, { params: { id: "rc-1" } });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/student/report-cards — student visibility", () => {
  it("returns only PUBLISHED cards for the student", async () => {
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: SCHOOL_ID });
    mockPrismaInstance.student.findUnique.mockResolvedValue({ id: STUDENT_ID });
    mockPrismaInstance.reportCard.findMany.mockResolvedValue([
      {
        id: "rc-pub",
        status: "PUBLISHED",
        subjectGrades: [],
        attendanceSummary: {},
        term: { name: "Term 1", academicYear: { yearLabel: "2026" } },
      },
    ]);

    const { GET } = await import("@/app/api/student/report-cards/route");
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reportCards).toHaveLength(1);
    // Confirm DB query filters by PUBLISHED
    const findManyCall = mockPrismaInstance.reportCard.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe("PUBLISHED");
  });
});

describe("GET /api/guardian/report-cards — guardian sees published only", () => {
  it("returns published cards for a linked child", async () => {
    mockRequireRole.mockResolvedValue({ id: "g-1", role: "GUARDIAN", schoolId: null });
    mockPrismaInstance.reportCard.findMany.mockResolvedValue([
      {
        id: "rc-pub",
        status: "PUBLISHED",
        term: { name: "Term 1", academicYear: { yearLabel: "2026" } },
      },
    ]);

    const { GET } = await import("@/app/api/guardian/report-cards/route");
    const req = new NextRequest("http://localhost/api/guardian/report-cards");
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reportCards).toHaveLength(1);
    const findManyCall = mockPrismaInstance.reportCard.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe("PUBLISHED");
  });
});

describe("POST /api/admin/report-cards/publish-all", () => {
  it("publishes only DRAFT cards for the specified class+term", async () => {
    mockRequireRole.mockResolvedValue({ id: CREATED_BY, role: "ADMIN", schoolId: SCHOOL_ID });
    mockPrismaInstance.reportCard.updateMany.mockResolvedValue({ count: 3 });

    const { POST } = await import("@/app/api/admin/report-cards/publish-all/route");
    const req = new NextRequest("http://localhost/api/admin/report-cards/publish-all", {
      method: "POST",
      body: JSON.stringify({ classId: CLASS_ID, termId: TERM_ID }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.published).toBe(3);

    const updateCall = mockPrismaInstance.reportCard.updateMany.mock.calls[0][0];
    expect(updateCall.where.classId).toBe(CLASS_ID);
    expect(updateCall.where.termId).toBe(TERM_ID);
    expect(updateCall.where.schoolId).toBe(SCHOOL_ID);
    expect(updateCall.where.status).toBe("DRAFT");
  });
});
