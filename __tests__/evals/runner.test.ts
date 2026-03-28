import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieveRelevantChunks = vi.hoisted(() => vi.fn());
const mockAnswerGroundedQuestion = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockEvalRunCreate = vi.hoisted(() => vi.fn());
const mockIsEvalDbLoggingEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/rag/retrievalService", () => ({
  retrieveRelevantChunks: mockRetrieveRelevantChunks,
}));

vi.mock("@/lib/ai/rag/groundedAnswerService", () => ({
  answerGroundedQuestion: mockAnswerGroundedQuestion,
}));

vi.mock("fs/promises", () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    evalRun: {
      create: mockEvalRunCreate,
    },
  },
}));

vi.mock("@/lib/serverFlags", () => ({
  isEvalDbLoggingEnabled: mockIsEvalDbLoggingEnabled,
}));

import { runEvalCases } from "@/lib/evals/runner";

describe("eval runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockEvalRunCreate.mockResolvedValue(undefined);
    mockIsEvalDbLoggingEnabled.mockReturnValue(false);
    mockRetrieveRelevantChunks.mockResolvedValue([
      {
        id: "chunk-1",
        sourceId: "math-fractions",
        sourceLabel: "wk_mca7a_mon_p1",
        sourceType: "curriculum_content",
        subject: "MATH",
        grade: 7,
        schoolId: "school-1",
        scope: "SCHOOL",
        title: "Fractions",
        content: "A fraction represents a part of a whole.",
        chunkIndex: 0,
        similarity: 0.91,
        rankingScore: 1.05,
      },
    ]);
    mockAnswerGroundedQuestion.mockResolvedValue({
      answer: "A fraction represents a part of a whole.",
      sources: [],
      retrievalWeak: false,
      hadFallback: false,
      isWeakGrounding: false,
      actions: [],
    });
  });

  it("runs a filtered 3-case subset and persists a timestamped result file", async () => {
    const result = await runEvalCases(
      [
        {
          id: "case-1",
          question: "Explain fractions",
          role: "STUDENT",
          mode: "classroom",
          subject: "MATH",
          grade: 7,
          schoolId: "school-1",
          expectedChunkIds: ["wk_mca7a_mon_p1"],
          expectedKeywords: ["fraction"],
          shouldFallback: false,
        },
        {
          id: "case-2",
          question: "Explain fractions again",
          role: "TEACHER",
          mode: "classroom",
          subject: "MATH",
          grade: 7,
          schoolId: "school-1",
          expectedChunkIds: ["wk_mca7a_mon_p1"],
          expectedKeywords: ["fraction"],
          shouldFallback: false,
        },
        {
          id: "case-3",
          question: "What governance controls apply?",
          role: "ADMIN",
          mode: "policy",
          schoolId: "school-1",
          expectedChunkIds: ["governance-data-governance"],
          expectedKeywords: ["governance"],
          shouldFallback: false,
        },
      ],
      { subject: "MATH" }
    );

    expect(result.datasetSize).toBe(2);
    expect(result.cases).toHaveLength(2);
    expect(mockRetrieveRelevantChunks).toHaveBeenCalled();
    expect(mockAnswerGroundedQuestion).toHaveBeenCalled();
    expect(result.cases.some((item) => item.result.hadFallback === false)).toBe(true);
    expect(mockAnswerGroundedQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedSubjects: ["MATH"],
        allowedGrades: [7],
        chunks: expect.arrayContaining([
          expect.objectContaining({
            id: "chunk-1",
          }),
        ]),
        isEvalRun: true,
      })
    );
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });
});
