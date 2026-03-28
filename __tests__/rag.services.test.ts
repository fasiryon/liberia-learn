import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCurriculumFindUnique = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockExecuteRaw = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockRoutedEmbedding = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  curriculumContent: {
    findUnique: mockCurriculumFindUnique,
  },
  student: {
    findUnique: mockStudentFindUnique,
  },
  $executeRaw: mockExecuteRaw,
  $queryRaw: mockQueryRaw,
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedEmbedding: mockRoutedEmbedding,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { embedLesson, embedText } from "@/lib/ai/rag/embeddingService";
import {
  retrieveRelevantChunks,
  retrieveRelevantLessons,
} from "@/lib/ai/rag/retrievalService";

describe("embeddingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$executeRaw = mockExecuteRaw;
  });

  it("embedText returns array of 1536 numbers", async () => {
    const vector = Array.from({ length: 1536 }, (_, index) => index / 1000);
    mockRoutedEmbedding.mockResolvedValue({
      model: "text-embedding-3-small",
      embedding: vector,
    });

    const result = await embedText("fractions lesson content");

    expect(result).toHaveLength(1536);
    expect(result[0]).toBe(0);
    expect(result[1535]).toBe(1.535);
  });

  it("embedLesson stores embedding on content record", async () => {
    mockCurriculumFindUnique.mockResolvedValue({
      id: "content-1",
      subject: "MATH",
      payload: { title: "Fractions", body: "Lesson body" },
    });
    mockRoutedEmbedding.mockResolvedValue({
      model: "text-embedding-3-small",
      embedding: Array.from({ length: 1536 }, () => 0.1),
    });
    mockExecuteRaw.mockResolvedValue(1);

    await embedLesson("content-1");

    expect(mockExecuteRaw).toHaveBeenCalledOnce();
  });

  it("embedLesson skips persistence safely when $executeRaw is unavailable", async () => {
    mockCurriculumFindUnique.mockResolvedValue({
      id: "content-1",
      subject: "MATH",
      payload: { title: "Fractions", body: "Lesson body" },
    });
    mockRoutedEmbedding.mockResolvedValue({
      model: "text-embedding-3-small",
      embedding: Array.from({ length: 1536 }, () => 0.1),
    });
    const originalExecuteRaw = mockPrisma.$executeRaw;
    delete (mockPrisma as any).$executeRaw;

    await expect(embedLesson("content-1")).resolves.toBeUndefined();
    expect(mockExecuteRaw).not.toHaveBeenCalled();

    mockPrisma.$executeRaw = originalExecuteRaw;
  });
});

describe("retrievalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoutedEmbedding.mockResolvedValue({
      model: "text-embedding-3-small",
      embedding: Array.from({ length: 1536 }, () => 0.2),
    });
  });

  it("retrieveRelevantLessons returns empty array gracefully when no embeddings exist", async () => {
    mockStudentFindUnique.mockResolvedValue({
      currentGrade: 5,
      enrollments: [{ Class: { subject: "MATH" } }],
    });
    mockQueryRaw.mockResolvedValue([]);

    const result = await retrieveRelevantLessons("What are fractions?", "student-1");

    expect(result).toEqual([]);
  });

  it("retrieval scopes lessons to student grade level", async () => {
    mockStudentFindUnique.mockResolvedValue({
      currentGrade: 6,
      enrollments: [{ Class: { subject: "SCIENCE" } }],
    });
    mockQueryRaw.mockResolvedValue([
      {
        id: "lesson-1",
        title: "Matter",
        content: "Matter has mass and occupies space.",
        subject: "SCIENCE",
        gradeLevel: 6,
        similarity: 0.93,
      },
    ]);

    const result = await retrieveRelevantLessons("What is matter?", "student-1");

    expect(result[0].gradeLevel).toBe(6);
    const sqlArg = mockQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain(6);
  });

  it("retrieves school and global RAG chunks for grounded queries", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: "chunk-1",
        sourceType: "curriculum_content",
        sourceId: "curr-1",
        title: "Fractions",
        content: "Fractions are parts of a whole.",
        chunkIndex: 0,
        subject: "MATH",
        grade: 5,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "teacher-fractions",
        similarity: 0.91,
        metadata: { kind: "curriculum" },
      },
    ]);

    const result = await retrieveRelevantChunks({
      question: "What is a fraction?",
      schoolId: "school-1",
      subject: "MATH",
      grade: 5,
    });

    expect(result[0].schoolId).toBe("school-1");
    const sqlArg = mockQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain("school-1");
  });

  it("classroom retrieval filters to curriculum chunks and exact subject-grade matches", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await retrieveRelevantChunks({
      question: "Explain fractions",
      schoolId: "school-1",
      subject: "MATH",
      grade: 7,
      mode: "classroom",
    });

    const sqlArg = mockQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain("curriculum_content");
    expect(sqlArg.values).toContain("MATH");
    expect(sqlArg.values).toContain(7);
  });

  it("classroom retrieval normalizes subject casing and grade strings while allowing null metadata rows", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: "metadata-match",
        sourceType: "curriculum_content",
        sourceId: "lesson-4",
        title: "Grade 7 Fractions",
        content: "Equivalent fractions and simplification.",
        chunkIndex: 0,
        subject: null,
        grade: null,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "wk_mca7a_mon_p5",
        similarity: 0.61,
        metadata: { kind: "curriculum", subject: " math ", gradeLevel: "7" },
      },
    ]);

    const result = await retrieveRelevantChunks({
      question: "What are equivalent fractions?",
      schoolId: "school-1",
      subject: " math ",
      grade: 7,
      mode: "classroom",
      context: {
        role: "TEACHER",
        mode: "lesson",
        subject: " math ",
        gradeLevel: "7",
      },
    });

    expect(result[0].id).toBe("metadata-match");
    const sqlArg = mockQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain("MATH");
    expect(sqlArg.values).toContain(7);
  });

  it("enforces allowed grade and subject scopes in chunk retrieval SQL", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await retrieveRelevantChunks({
      question: "Explain fractions",
      schoolId: "school-1",
      subject: "MATH",
      grade: 7,
      allowedSubjects: ["MATH", "SCIENCE"],
      allowedGrades: [6, 7],
      mode: "classroom",
    });

    const sqlArg = mockQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain("MATH");
    expect(sqlArg.values).toContain("SCIENCE");
    expect(sqlArg.values).toContain(6);
    expect(sqlArg.values).toContain(7);
  });

  it("prefers curriculum chunks over governance docs for lesson-style queries", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: "policy-1",
        sourceType: "policy_document",
        sourceId: "gov-1",
        title: "Governance ADR",
        content: "Governance guidance for platform operations.",
        chunkIndex: 0,
        subject: null,
        grade: null,
        schoolId: null,
        scope: "GLOBAL",
        sourceLabel: "adr-001",
        similarity: 0.92,
        metadata: { kind: "governance" },
      },
      {
        id: "curr-1",
        sourceType: "curriculum_content",
        sourceId: "lesson-1",
        title: "Fractions Lesson",
        content: "Fractions are equal parts of a whole.",
        chunkIndex: 0,
        subject: "MATH",
        grade: 7,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "teacher-fractions",
        similarity: 0.84,
        metadata: { kind: "curriculum", subject: "MATH", gradeLevel: "7" },
      },
    ]);

    const result = await retrieveRelevantChunks({
      question: "Explain fractions with a lesson example",
      schoolId: "school-1",
      topK: 2,
      context: {
        role: "TEACHER",
        mode: "lesson",
        subject: "MATH",
        gradeLevel: "7",
      },
    });

    expect(result[0].id).toBe("curr-1");
    expect(result[0].rankingScore).toBeGreaterThan(result[1].rankingScore);
  });

  it("boosts exact subject and grade metadata matches", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: "near-match",
        sourceType: "curriculum_content",
        sourceId: "lesson-2",
        title: "General Fractions",
        content: "Fractions basics.",
        chunkIndex: 0,
        subject: "SCIENCE",
        grade: 6,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "lesson-2",
        similarity: 0.88,
        metadata: { kind: "curriculum", subject: "SCIENCE", gradeLevel: "6" },
      },
      {
        id: "exact-match",
        sourceType: "curriculum_content",
        sourceId: "lesson-3",
        title: "Grade 7 Fractions",
        content: "Grade 7 fractions lesson.",
        chunkIndex: 0,
        subject: "MATH",
        grade: 7,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "lesson-3",
        similarity: 0.84,
        metadata: { kind: "curriculum", subject: "MATH", gradeLevel: "7" },
      },
    ]);

    const result = await retrieveRelevantChunks({
      question: "Explain fractions",
      schoolId: "school-1",
      topK: 2,
      context: {
        role: "STUDENT",
        mode: "learning",
        subject: "MATH",
        gradeLevel: "7",
      },
    });

    expect(result[0].id).toBe("exact-match");
    expect(result[0].rankingScore).toBeGreaterThan(result[1].rankingScore);
  });

  it("retries classroom retrieval with a broader grade window when strict filters return no rows", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "nearby-grade",
          sourceType: "curriculum_content",
          sourceId: "lesson-5",
          title: "Fractions Review",
          content: "Practice equal fractions with visual models.",
          chunkIndex: 0,
          subject: "MATH",
          grade: 5,
          schoolId: "school-1",
          scope: "SCHOOL",
          sourceLabel: "math-g5-fractions",
          similarity: 0.55,
          metadata: { kind: "curriculum", subject: "MATH", gradeLevel: "5" },
        },
      ]);

    const result = await retrieveRelevantChunks({
      question: "Explain fractions for Grade 7 math.",
      schoolId: "school-1",
      subject: "MATH",
      grade: 7,
      mode: "classroom",
      context: {
        role: "STUDENT",
        mode: "learning",
        subject: "MATH",
        gradeLevel: "7",
      },
    });

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(result[0].id).toBe("nearby-grade");
    const fallbackSqlArg = mockQueryRaw.mock.calls[1][0] as any;
    expect(fallbackSqlArg.values).toContain(5);
    expect(fallbackSqlArg.values).not.toContain(7);
    expect(fallbackSqlArg.values).toContain(6);
    expect(fallbackSqlArg.values).toContain(8);
    expect(fallbackSqlArg.values).toContain(9);
    expect(result[0].retrievalTier).toBe("nearby_grade");
  });

  it("keeps classroom retrieval on the same-grade tier when exact-grade chunks exist", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: "same-grade",
        sourceType: "curriculum_content",
        sourceId: "lesson-7",
        title: "Grade 7 Ratios",
        content: "Ratios compare quantities.",
        chunkIndex: 0,
        subject: "MATH",
        grade: 7,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "math-g7-ratios",
        similarity: 0.87,
        metadata: { kind: "curriculum", subject: "MATH", gradeLevel: "7" },
      },
    ]);

    const result = await retrieveRelevantChunks({
      question: "Explain grade 7 ratios.",
      schoolId: "school-1",
      subject: "MATH",
      grade: 7,
      mode: "classroom",
      context: {
        role: "STUDENT",
        mode: "learning",
        subject: "MATH",
        gradeLevel: "7",
      },
    });

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(result[0].id).toBe("same-grade");
    expect(result[0].retrievalTier).toBe("same_grade");
  });
});
