import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsTeacherGenerationEnabled = vi.hoisted(() => vi.fn());
const mockAuditLogCount = vi.hoisted(() => vi.fn());
const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockStandardFindFirst = vi.hoisted(() => vi.fn());
const mockGenerateCurriculumPayload = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isTeacherGenerationEnabled: mockIsTeacherGenerationEnabled,
  };
});

vi.mock("@/lib/ai/curriculum-factory", () => ({
  generateCurriculumPayload: mockGenerateCurriculumPayload,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { count: mockAuditLogCount },
    class: { findUnique: mockClassFindUnique },
    standard: { findFirst: mockStandardFindFirst, findMany: vi.fn() },
  },
}));

import { POST } from "@/app/api/teacher/generate-lesson/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/teacher/generate-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const teacherUser = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const validBody = {
  classId: "class-1",
  objective: "Students will understand equivalent fractions",
  gradeLevel: 5,
  subject: "MATH",
  standardCode: "LR-MATH-G4_6-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(teacherUser);
  mockIsTeacherGenerationEnabled.mockReturnValue(true);
  mockAuditLogCount.mockResolvedValue(0);
  mockClassFindUnique.mockResolvedValue({
    id: "class-1",
    name: "Grade 5 Math",
    subject: "MATH",
    schoolId: "school-1",
    teacherId: "teacher-1",
    enrollments: [{ Student: { currentGrade: 5 } }],
  });
  mockStandardFindFirst.mockResolvedValue({ description: "Equivalent fractions" });
  mockGenerateCurriculumPayload.mockResolvedValue({
    title: "Equivalent Fractions",
    grade: 5,
    subject: "MATH",
    objectives: ["Understand equivalent fractions"],
    body: "Equivalent fractions name the same amount.",
    activities: ["Use bottle caps to compare fractions."],
    moeAlignments: ["LR-MATH-G4_6-01"],
    deliveryProfile: {
      estimatedMinutes: 40,
      exitTicket: {
        questions: [{ question: "What makes fractions equivalent?" }],
      },
    },
    metadata: {
      topic: "Equivalent fractions",
      locale: "LR",
      generatedAt: new Date().toISOString(),
    },
  });
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/teacher/generate-lesson", () => {
  it("validates classId ownership", async () => {
    mockClassFindUnique.mockResolvedValue({
      id: "class-1",
      name: "Other class",
      subject: "MATH",
      schoolId: "school-1",
      teacherId: "teacher-OTHER",
      enrollments: [],
    });

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(403);
  });

  it("rejects non-TEACHER role", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(403);
  });

  it("returns 503 when ENABLE_TEACHER_GENERATION flag is disabled", async () => {
    mockIsTeacherGenerationEnabled.mockReturnValue(false);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(503);
  });

  it("rate limit blocks after 10 generations per day", async () => {
    mockAuditLogCount.mockResolvedValue(10);

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("daily_generation_limit_reached");
  });
});
