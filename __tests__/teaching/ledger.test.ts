import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    teachingSession: { findUnique: vi.fn() },
    teachingTurn: { findMany: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
    teachingLedger: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { buildAndSaveLedger } from "@/lib/teaching/ledger";

const SESSION = {
  id: "sess-1",
  contentId: "content-1",
  facilitatorId: "teacher-1",
  schoolId: "school-1",
  grade: "7",
  subject: "Mathematics",
  alignmentMode: "FULL_CONFIDENCE",
};

const TURNS = [
  {
    turnIndex: 0,
    role: "facilitator",
    inputText: "Start",
    responseText: "Welcome to fractions.",
    guardrailMode: "FULL_CONFIDENCE",
    deferred: false,
    lessonDirectorAction: "continue",
    whisperPrompt: null,
    createdAt: new Date("2026-07-28T12:00:00.000Z"),
  },
  {
    turnIndex: 1,
    role: "student",
    inputText: "What about calculus?",
    responseText: "I don't know that one for sure.",
    guardrailMode: "FULL_CONFIDENCE",
    deferred: true,
    lessonDirectorAction: "continue",
    whisperPrompt: null,
    createdAt: new Date("2026-07-28T12:01:00.000Z"),
  },
  {
    turnIndex: 2,
    role: "facilitator",
    inputText: "Continue",
    responseText: "Let's try an example.",
    guardrailMode: "FULL_CONFIDENCE",
    deferred: false,
    lessonDirectorAction: "comprehension_check",
    whisperPrompt: {
      title: "Teaching Coach",
      body: "Check the back row.",
    },
    createdAt: new Date("2026-07-28T12:02:00.000Z"),
  },
];

const CONTENT = {
  id: "internal-content-1",
  contentId: "content-1",
  payload: {
    objectives: ["Understand fractions"],
    slideDeckSpecs: [
      {
        slides: [
          {
            title: "Fractions",
            bullets: ["Parts of a whole"],
          },
        ],
      },
    ],
  },
  moeAlignments: {
    contentId: "internal-content-1",
    standards: [
      {
        code: "MOE-MATH-G7-01",
        description: "Understand fractions.",
        confidence: "high",
      },
    ],
    alignedAt: "2026-07-28T10:00:00.000Z",
    method: "exact",
  },
  audioAssets: [{ id: "audio-1" }],
};

beforeEach(() => {
  mockPrisma.teachingSession.findUnique.mockReset().mockResolvedValue(SESSION);
  mockPrisma.teachingTurn.findMany.mockReset().mockResolvedValue(TURNS);
  mockPrisma.curriculumContent.findUnique.mockReset().mockResolvedValue(CONTENT);
  mockPrisma.teachingLedger.create
    .mockReset()
    .mockImplementation(({ data }) =>
      Promise.resolve({ id: "ledger-1", ...data })
    );
});

describe("buildAndSaveLedger", () => {
  it("saves a ledger with real standards, resources, aggregates, and out-of-scope questions", async () => {
    const { ledgerId } = await buildAndSaveLedger("sess-1");
    expect(ledgerId).toBe("ledger-1");

    expect(mockPrisma.curriculumContent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contentId: "content-1" } })
    );
    const createArgs =
      mockPrisma.teachingLedger.create.mock.calls[0][0].data;
    expect(createArgs.sessionId).toBe("sess-1");
    expect(createArgs.objectives).toEqual(["Understand fractions"]);
    expect(createArgs.standardsCovered).toEqual(["MOE-MATH-G7-01"]);
    expect(createArgs.resourcesUsed).toEqual({
      slideCount: 1,
      audioAssetId: "audio-1",
    });
    expect(createArgs.transcript).toHaveLength(3);
    expect(createArgs.transcript[0].createdAt).toBe(
      "2026-07-28T12:00:00.000Z"
    );
    expect(createArgs.outOfScopeQuestions).toEqual([
      { turnIndex: 1, text: "What about calculus?" },
    ]);
    expect(createArgs.confidenceFlags).toEqual([
      { turnIndex: 0, mode: "FULL_CONFIDENCE", deferred: false },
      { turnIndex: 1, mode: "FULL_CONFIDENCE", deferred: true },
      { turnIndex: 2, mode: "FULL_CONFIDENCE", deferred: false },
    ]);
    expect(createArgs.aggregatedResponses).toEqual({
      totalTurns: 3,
      deferredTurns: 1,
      whisperPromptsIssued: 1,
    });
    expect(createArgs.status).toBe("DRAFT");
  });

  it("throws when the session does not exist", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue(null);
    await expect(buildAndSaveLedger("missing")).rejects.toThrow(/not found/i);
  });
});
