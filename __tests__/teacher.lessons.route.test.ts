import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsTeacherGenerationEnabled = vi.hoisted(() => vi.fn());
const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockStandardFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumCreate = vi.hoisted(() => vi.fn());
const mockCurriculumUpdate = vi.hoisted(() => vi.fn());
const mockScheduledWorkCreate = vi.hoisted(() => vi.fn());
const mockEmbedLesson = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockIsQueueConfigured = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/ai/rag/embeddingService", () => ({
  embedLesson: mockEmbedLesson,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/queue", () => ({
  JobType: {
    GENERATE_EMBEDDINGS: "GENERATE_EMBEDDINGS",
  },
  enqueueJob: mockEnqueueJob,
  isQueueConfigured: mockIsQueueConfigured,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findUnique: mockClassFindUnique },
    standard: { findUnique: mockStandardFindUnique },
    curriculumContent: {
      findUnique: mockCurriculumFindUnique,
      create: mockCurriculumCreate,
      update: mockCurriculumUpdate,
    },
    scheduledWork: { create: mockScheduledWorkCreate },
  },
}));

import { POST } from "@/app/api/teacher/lessons/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/teacher/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const teacherUser = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const validBody = {
  classId: "class-1",
  title: "Equivalent Fractions",
  content: "Equivalent fractions name the same amount in different ways.",
  assessmentQuestions: ["What makes two fractions equivalent?"],
  estimatedMinutes: 40,
  status: "draft",
  standardCode: "LR-MATH-G4_6-01",
};

beforeEach(() => {
  process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(teacherUser);
  mockIsTeacherGenerationEnabled.mockReturnValue(true);
  mockClassFindUnique.mockResolvedValue({
    id: "class-1",
    name: "Grade 5 Math",
    subject: "MATH",
    schoolId: "school-1",
    teacherId: "teacher-1",
    enrollments: [{ Student: { currentGrade: 5 } }],
  });
  mockStandardFindUnique.mockResolvedValue({
    code: "LR-MATH-G4_6-01",
    description: "Equivalent fractions",
  });
  mockCurriculumFindUnique.mockResolvedValue(null);
  mockCurriculumCreate.mockResolvedValue({
    id: "content-1",
    contentId: "teacher-class-1-equivalent-fractions-123",
    status: "draft",
  });
  mockScheduledWorkCreate.mockResolvedValue({
    id: "sched-1",
  });
  mockEmbedLesson.mockResolvedValue(undefined);
  mockEnqueueJob.mockResolvedValue(undefined);
  mockIsQueueConfigured.mockReturnValue(false);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/teacher/lessons", () => {
  it("save draft stores with status draft", async () => {
    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    expect(mockCurriculumCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "draft",
          teacherCreated: true,
        }),
      })
    );
    expect(mockScheduledWorkCreate).not.toHaveBeenCalled();
  });

  it("compatibility mode cannot publish without canonical provenance authority", async () => {
    const res = await POST(makeReq({ ...validBody, status: "published" }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "P2A_PROVENANCE_AUTHORITY_REQUIRED" });
    expect(mockCurriculumCreate).not.toHaveBeenCalled();
    expect(mockScheduledWorkCreate).not.toHaveBeenCalled();
  });

  it("queues embeddings when SQS is configured", async () => {
    mockIsQueueConfigured.mockReturnValue(true);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "GENERATE_EMBEDDINGS",
      expect.objectContaining({ lessonId: "content-1" })
    );
    expect(mockEmbedLesson).not.toHaveBeenCalled();
  });
});
