import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsRagTutorEnabled = vi.hoisted(() => vi.fn());
const mockAnswerGroundedQuestion = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isRagTutorEnabled: mockIsRagTutorEnabled,
  };
});

vi.mock("@/lib/ai/rag/groundedAnswerService", () => ({
  answerGroundedQuestion: mockAnswerGroundedQuestion,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findUnique: mockStudentFindUnique,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    aiInteractionLog: {
      create: mockAiInteractionLogCreate,
    },
  },
}));

import { POST } from "@/app/api/rag/query/route";

describe("POST /api/rag/query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRagTutorEnabled.mockReturnValue(true);
    mockRequireUser.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
    });
    mockAnswerGroundedQuestion.mockResolvedValue({
      answer: "Grounded answer",
      sources: [],
      retrievalWeak: false,
      hadFallback: false,
      cacheHit: false,
      isWeakGrounding: false,
      actions: [],
      confidence: "medium",
      groundingScore: 0.8,
      sourcesUsed: 0,
      citations: [],
      tokensUsed: 12,
      estimatedCost: 0.001,
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
    mockStudentFindUnique.mockResolvedValue({
      currentGrade: 7,
      enrollments: [{ Class: { subject: "MATH" } }],
    });
    mockUserFindUnique.mockResolvedValue({
      guardianOf: [
        {
          student: {
            currentGrade: 7,
            enrollments: [{ Class: { subject: "MATH" } }],
          },
        },
      ],
    });
  });

  it("rejects unsupported roles", async () => {
    mockRequireUser.mockResolvedValue({
      id: "moe-1",
      role: "MOE_OFFICIAL",
      schoolId: "school-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({ question: "What is a fraction?" }),
      }) as any
    );

    expect(response.status).toBe(403);
  });

  it("uses the authenticated user's schoolId for tenant-safe retrieval", async () => {
    await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "What is a fraction?",
          subject: "MATH",
          grade: 5,
          mode: "classroom",
        }),
      }) as any
    );

    expect(mockAnswerGroundedQuestion).toHaveBeenCalledWith({
      question: "What is a fraction?",
      schoolId: "school-1",
      subject: "MATH",
      grade: 5,
      mode: "classroom",
      role: "TEACHER",
      context: {
        role: "TEACHER",
        mode: "mixed",
        subject: "MATH",
        gradeLevel: "5",
      },
    });
  });

  it("infers homework context mode from /teacher/homework", async () => {
    await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "How should I assign fraction practice?",
          pathname: "/teacher/homework",
          subject: "MATH",
          grade: 7,
          retrievalMode: "classroom",
        }),
      }) as any
    );

    expect(mockAnswerGroundedQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          mode: "homework",
        }),
      })
    );
  });

  it("infers governance context mode from /admin", async () => {
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
    });

    await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "What governance controls apply here?",
          pathname: "/admin/dashboard",
        }),
      }) as any
    );

    expect(mockAnswerGroundedQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          mode: "governance",
          role: "ADMIN",
        }),
      })
    );
  });

  it("downgrades disallowed student policy mode to classroom and clamps subject-grade", async () => {
    mockRequireUser.mockResolvedValue({
      id: "student-1",
      role: "STUDENT",
      schoolId: "school-1",
    });

    await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "Explain fractions",
          subject: "SCIENCE",
          grade: 9,
          pathname: "/student",
          mode: "policy",
        }),
      }) as any
    );

    expect(mockAnswerGroundedQuestion).toHaveBeenCalledWith({
      question: "Explain fractions",
      schoolId: "school-1",
      subject: "MATH",
      grade: 7,
      allowedSubjects: ["MATH"],
      allowedGrades: [7],
      mode: "classroom",
      role: "STUDENT",
      context: {
        role: "STUDENT",
        mode: "learning",
        subject: "MATH",
        gradeLevel: "7",
      },
    });
  });

  it("accepts cached subject and gradeLevel values as normal request fields", async () => {
    await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "Explain fractions for class prep",
          pathname: "/teacher",
          subject: "MATH",
          gradeLevel: "7",
          retrievalMode: "classroom",
        }),
      }) as any
    );

    expect(mockAnswerGroundedQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "MATH",
        grade: 7,
        mode: "classroom",
        context: expect.objectContaining({
          subject: "MATH",
          gradeLevel: "7",
          mode: "mixed",
        }),
      })
    );
  });

  it("downgrades guardian mixed mode to classroom for linked student context", async () => {
    mockRequireUser.mockResolvedValue({
      id: "guardian-1",
      role: "GUARDIAN",
      schoolId: "school-1",
    });

    await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "How can I help with fractions at home?",
          subject: "MATH",
          grade: 7,
          pathname: "/guardian",
          mode: "mixed",
        }),
      }) as any
    );

    expect(mockAnswerGroundedQuestion).toHaveBeenCalledWith({
      question: "How can I help with fractions at home?",
      schoolId: "school-1",
      subject: "MATH",
      grade: 7,
      allowedSubjects: ["MATH"],
      allowedGrades: [7],
      mode: "classroom",
      role: "GUARDIAN",
      context: {
        role: "GUARDIAN",
        mode: "support",
        subject: "MATH",
        gradeLevel: "7",
      },
    });
  });

  it("rejects guardian requests outside linked student grades or subjects", async () => {
    mockRequireUser.mockResolvedValue({
      id: "guardian-1",
      role: "GUARDIAN",
      schoolId: "school-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "Explain photosynthesis",
          subject: "SCIENCE",
          grade: 9,
          mode: "classroom",
        }),
      }) as any
    );

    expect(response.status).toBe(403);
    expect(mockAnswerGroundedQuestion).not.toHaveBeenCalled();
  });

  it("rejects guardian requests that combine grade and subject from different linked students", async () => {
    mockRequireUser.mockResolvedValue({
      id: "guardian-1",
      role: "GUARDIAN",
      schoolId: "school-1",
    });
    mockUserFindUnique.mockResolvedValue({
      guardianOf: [
        {
          student: {
            currentGrade: 7,
            enrollments: [{ Class: { subject: "MATH" } }],
          },
        },
        {
          student: {
            currentGrade: 5,
            enrollments: [{ Class: { subject: "LITERACY" } }],
          },
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "Help my child with reading at home",
          subject: "LITERACY",
          grade: 7,
          pathname: "/guardian",
          mode: "classroom",
        }),
      }) as any
    );

    expect(response.status).toBe(403);
    expect(mockAnswerGroundedQuestion).not.toHaveBeenCalled();
  });

  it("logs zero spend when the grounded answer result was served from cache", async () => {
    mockAnswerGroundedQuestion.mockResolvedValue({
      answer: "Cached grounded answer",
      sources: [],
      retrievalWeak: false,
      hadFallback: false,
      cacheHit: true,
      isWeakGrounding: false,
      actions: [],
      confidence: "high",
      groundingScore: 0.92,
      sourcesUsed: 1,
      citations: [],
      tokensUsed: 0,
      estimatedCost: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          question: "What is a fraction?",
          subject: "MATH",
          grade: 5,
          mode: "classroom",
        }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(mockAiInteractionLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endpoint: "/api/rag/query",
        tokensUsed: 0,
        estimatedCostUSD: 0,
      }),
    });
    expect((await response.json()).cacheHit).toBe(true);
  });
});
