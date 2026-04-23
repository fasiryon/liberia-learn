import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumContentCreate = vi.hoisted(() => vi.fn());
const mockCurriculumVersionCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockCurriculumContentFindUnique,
      create: mockCurriculumContentCreate,
    },
    curriculumVersion: {
      create: mockCurriculumVersionCreate,
    },
  },
}));

describe("elite curriculum upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "record-1",
      contentId: "math-g7-ratios",
      title: "Ratios",
      grade: 7,
      subject: "MATH",
      contentType: "lesson",
      status: "published",
      version: "2026-04-20",
      versionId: "source-version",
      moeAlignments: ["MATH-G7-RATIO-01"],
      payload: {
        title: "Ratios",
        grade: 7,
        subject: "MATH",
        objectives: ["Understand ratios"],
        body: "Students learn ratios with a short example.",
        activities: ["Compare prices."],
        approvalStatus: "APPROVED",
        originalImportedVersion: true,
      },
    });
    mockCurriculumVersionCreate.mockResolvedValue({
      id: "elite-version-1",
      versionName: "elite-upgrade-math-g7-ratios",
    });
    mockCurriculumContentCreate.mockImplementation(async (args) => ({
      id: "elite-record-1",
      contentId: args.data.contentId,
      payload: args.data.payload,
    }));
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        title: "Ratios in Market Prices",
        objectives: [
          "Explain ratio language using two quantities in market-price situations.",
          "Compare equivalent ratios and justify which price offer gives better value.",
        ],
        body: [
          "## Opening",
          "Students review multiplication facts and compare two market bundles.",
          "## Direct Instruction",
          "The teacher models ratio notation with rice prices and explains each step.",
          "## Guided Practice",
          "Learners solve examples with teacher questioning.",
          "## Independent Practice",
          "Students answer mixed problems and explain why.",
          "## Closing",
          "Students complete an exit ticket and summarize the strategy.",
        ].join("\n"),
        body_standard: null,
        body_block: null,
        activities: ["Pairs compare two market bundles and explain the better value."],
        assessmentQuestions: [
          "Explain why 2:3 and 4:6 are equivalent.",
          "Which bundle has the better value? Explain your reasoning.",
          "Write one ratio from a farm or market context.",
        ],
        workedExamples: [
          "A bag with 2 cups of rice for 40 LD has a ratio of 2:40.",
          "Compare 3 oranges for 30 LD and 5 oranges for 60 LD step by step.",
        ],
        guidedPractice: ["Solve two equivalent-ratio examples with the class."],
        independentPractice: ["Complete five ratio comparison problems."],
        formativeChecks: ["Ask learners to explain ratio order.", "Use one exit ticket."],
        commonMisconceptions: ["Learners may reverse the quantities in a ratio."],
        teacherNotes: ["Keep the order of quantities visible on the board."],
        realWorldApplication: "Ratios help students compare market prices and farm mixtures.",
        careerConnection: "This supports business, agriculture, logistics, and technical trade decisions.",
        localContextEnrichment: ["Use Liberian dollar market prices."],
        workforceReadinessEnrichment: ["Compare value before purchasing materials."],
        improvementsSummary: ["Strengthened objectives and assessment evidence."],
        qualityRationale: {
          clarity: "Sections and objectives are explicit.",
          rigor: "Students explain equivalence and comparison.",
          sequencing: "The lesson moves from model to guided and independent work.",
          assessmentQuality: "Questions reveal reasoning.",
          teacherUsability: "Teacher notes are practical.",
        },
      }),
      tier: "smart",
      model: "test-model",
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUSD: 0,
    });
  });

  it("scores lesson quality deterministically", async () => {
    const { scoreLessonQuality } = await import("@/lib/curriculum/eliteUpgrade");

    const score = scoreLessonQuality({
      title: "Ratios in Market Prices",
      grade: 7,
      objectives: ["Explain ratio language clearly."],
      body: "Opening. Direct Instruction. Guided Practice. Independent Practice. Closing. Students apply the skill in a market example.",
      workedExamples: ["Example 1", "Example 2"],
      independentPractice: ["A", "B", "C"],
      assessmentQuestions: ["Explain why the ratio is equivalent.", "Answer key included.", "Use evidence."],
      formativeChecks: ["Check 1", "Check 2"],
      teacherNotes: ["Use the board."],
      commonMisconceptions: ["Reverse order."],
      realWorldApplication: "Use this when comparing market prices in Liberia.",
      careerConnection: "Useful for work in business and agriculture.",
    });

    expect(score.overall).toBeGreaterThan(70);
    expect(score.criteria.assessmentQuality).toBeGreaterThan(70);
  });

  it("creates an AI-upgraded draft without mutating the original content", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(result.originalContentId).toBe("math-g7-ratios");
    expect(result.draftContentId).toContain("math-g7-ratios-elite-");
    expect(mockCurriculumContentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contentId: "math-g7-ratios" } })
    );
    expect(mockCurriculumContentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contentId: expect.stringContaining("math-g7-ratios-elite-"),
          status: "pending_approval",
          versionId: "elite-version-1",
          payload: expect.objectContaining({
            approvalStatus: "PENDING_APPROVAL",
            reviewStage: "AI_UPGRADED_DRAFT",
            originalImportedVersion: false,
            upgradeMetadata: expect.objectContaining({
              originalContentId: "math-g7-ratios",
              governance: expect.objectContaining({
                preservesOriginalContent: true,
              }),
            }),
          }),
        }),
      })
    );
    expect(mockRoutedCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        aiUsage: expect.objectContaining({
          feature: "curriculum",
          requestType: "elite_curriculum_upgrade",
          contentId: "math-g7-ratios",
        }),
      })
    );
  });
});

