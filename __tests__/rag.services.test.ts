import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCurriculumFindUnique = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockExecuteRaw = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockCurriculumFindUnique,
    },
    student: {
      findUnique: mockStudentFindUnique,
    },
    $executeRaw: mockExecuteRaw,
    $queryRaw: mockQueryRaw,
  },
}));

import { embedLesson, embedText } from "@/lib/ai/rag/embeddingService";
import {
  retrieveRelevantChunks,
  retrieveRelevantLessons,
} from "@/lib/ai/rag/retrievalService";

describe("embeddingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("embedText returns array of 1536 numbers", async () => {
    const vector = Array.from({ length: 1536 }, (_, index) => index / 1000);
    mockRoutedCompletion.mockResolvedValue({
      mode: "embedding",
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
    mockRoutedCompletion.mockResolvedValue({
      mode: "embedding",
      model: "text-embedding-3-small",
      embedding: Array.from({ length: 1536 }, () => 0.1),
    });
    mockExecuteRaw.mockResolvedValue(1);

    await embedLesson("content-1");

    expect(mockExecuteRaw).toHaveBeenCalledOnce();
  });
});

describe("retrievalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoutedCompletion.mockResolvedValue({
      mode: "embedding",
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
});
