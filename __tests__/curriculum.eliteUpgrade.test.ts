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

function validEliteResponse(score = 94) {
  const categoryScore = score >= 90 ? 9.4 : 7.2;
  return {
    lesson: {
      title: "Ratios in Market Prices",
      objectives: [
        "Explain ratio language using two quantities in market-price situations.",
        "Compare equivalent ratios and justify which price offer gives better value.",
      ],
      sections: [
        { type: "introduction", content: "Students compare two market bundles and name the quantities." },
        { type: "explanation", content: "The teacher models ratio notation, equivalent ratios, and value comparison step by step." },
        { type: "worked_examples", examples: ["Compare 2 cups for 40 LD with 3 cups for 75 LD.", "Scale 1:20 to find 7:140."] },
        { type: "guided_practice", questions: ["Which bundle has the better price? Explain.", "Write an equivalent ratio."] },
        { type: "independent_practice", questions: ["Solve three price-ratio comparisons.", "Create one market-ratio example."] },
        { type: "assessment", questions: ["Explain why 2:3 and 4:6 are equivalent.", "Justify the better-value bundle."] },
        { type: "misconceptions", items: ["Students may reverse the quantity order in a ratio."] },
        { type: "real_world_application", content: "Ratios help students compare market prices and farm mixtures in Liberia." },
        { type: "summary", content: "Students summarize how to compare equivalent ratios and check value." },
      ],
      teacher_notes: "Keep the order of quantities visible and ask students to explain each comparison.",
      student_notes: "A ratio compares two quantities in a fixed order. Use equivalent ratios to compare value.",
    },
    quality_score: {
      clarity: categoryScore,
      structure: categoryScore,
      objectives: categoryScore,
      examples: categoryScore,
      practice: categoryScore,
      assessment: categoryScore,
      misconception: categoryScore,
      application: categoryScore,
      transfer: categoryScore,
      teacher: categoryScore,
      student: categoryScore,
      total: score,
    },
    improvement_summary: {
      strengths: ["Clearer objective progression."],
      weaknesses: score >= 90 ? [] : ["Practice needs stronger transfer."],
      what_was_improved: ["Strengthened objectives, examples, practice, and assessment evidence."],
    },
  };
}

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
      content: JSON.stringify(validEliteResponse(94)),
      tier: "smart",
      model: "test-model",
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUSD: 0,
    });
  });

  it("scores lesson quality with the required weighted rubric", async () => {
    const { ELITE_QUALITY_WEIGHTS, scoreLessonQuality } = await import("@/lib/curriculum/eliteUpgrade");

    expect(ELITE_QUALITY_WEIGHTS).toEqual({
      clarity: 15,
      structure: 10,
      objectives: 10,
      examples: 10,
      practice: 10,
      assessment: 10,
      misconception: 10,
      application: 10,
      transfer: 10,
      teacher: 5,
      student: 5,
    });

    const score = scoreLessonQuality({
      title: "Ratios in Market Prices",
      grade: 7,
      objectives: ["Explain ratio language clearly.", "Compare ratios."],
      body: "Introduction. Explanation. Guided practice. Independent practice. Summary. Students explain why ratios transfer to market value comparisons.",
      workedExamples: ["Example 1", "Example 2"],
      guidedPractice: ["A", "B"],
      independentPractice: ["C", "D"],
      assessmentQuestions: ["Explain why the ratio is equivalent.", "Justify with evidence."],
      commonMisconceptions: ["Reverse order."],
      teacherNotes: ["Use the board."],
      realWorldApplication: "Use this when comparing market prices in Liberia.",
    });

    expect(score.total).toBeGreaterThan(70);
    expect(score.criteria.assessment).toBeGreaterThan(5);
    expect(score.tier).toMatch(/ELITE|STRONG|ADEQUATE|WEAK|REJECT/);
  });

  it("rejects invalid JSON safely before creating a draft", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    mockRoutedCompletion.mockResolvedValueOnce({ content: "not-json" });

    await expect(
      createEliteUpgradeDraft({ contentId: "math-g7-ratios", userId: "admin-1", schoolId: "school-1" })
    ).rejects.toThrow(/invalid elite upgrade JSON/i);
    expect(mockCurriculumContentCreate).not.toHaveBeenCalled();
  });

  it("rejects missing score fields safely before creating a draft", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    const invalid = validEliteResponse(94) as any;
    delete invalid.quality_score.transfer;
    mockRoutedCompletion.mockResolvedValueOnce({ content: JSON.stringify(invalid) });

    await expect(
      createEliteUpgradeDraft({ contentId: "math-g7-ratios", userId: "admin-1", schoolId: "school-1" })
    ).rejects.toThrow();
    expect(mockCurriculumContentCreate).not.toHaveBeenCalled();
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
    expect(result.qualityScores.after.total).toBeGreaterThanOrEqual(90);
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
              qualityRubric: expect.objectContaining({ highestMode: "ELITE" }),
              qualityScores: expect.objectContaining({
                after: expect.objectContaining({ tier: "ELITE" }),
              }),
              improvementSummary: expect.objectContaining({
                strengths: expect.any(Array),
                weaknesses: expect.any(Array),
                what_was_improved: expect.any(Array),
              }),
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
          promptKey: "curriculum.lesson_upgrade_elite_v1.system",
        }),
      })
    );
  });

  it("runs a refinement pass when the first score is below elite threshold", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    mockRoutedCompletion
      .mockResolvedValueOnce({ content: JSON.stringify(validEliteResponse(72)) })
      .mockResolvedValueOnce({ content: JSON.stringify(validEliteResponse(93)) });

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(mockRoutedCompletion).toHaveBeenCalledTimes(2);
    expect(result.refinement).toMatchObject({ attempted: true, applied: true });
    expect(result.qualityScores.firstPass.total).toBeLessThan(90);
    expect(result.qualityScores.after.total).toBeGreaterThanOrEqual(90);
    expect(mockRoutedCompletion.mock.calls[1][0].aiUsage).toMatchObject({
      requestType: "elite_curriculum_refinement",
      promptKey: "curriculum.lesson_upgrade_refinement_v1.user",
    });
  });
});
