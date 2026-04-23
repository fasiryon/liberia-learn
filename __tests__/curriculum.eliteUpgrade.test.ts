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
        "Apply ratio reasoning to a new market or farm-pricing situation and check the result.",
      ],
      sections: [
        { type: "introduction", content: "Students compare two market bundles, name the quantities, and predict which bundle gives better value." },
        { type: "explanation", content: "The teacher models ratio notation, equivalent ratios, and value comparison step by step. Students explain why the order of quantities matters and how to check a comparison." },
        { type: "worked_examples", examples: ["Compare 2 cups for 40 LD with 3 cups for 75 LD, showing unit prices step by step.", "Scale 1:20 to find 7:140 and justify why the ratio stayed equivalent.", "Compare two farm-mixture ratios and explain which mixture is stronger."] },
        { type: "guided_practice", questions: ["Which bundle has the better price? Explain.", "Write an equivalent ratio and justify each step.", "Compare a new pair of prices with a partner and check the answer."] },
        { type: "independent_practice", questions: ["Solve three price-ratio comparisons.", "Create one market-ratio example and explain why it works.", "Transfer the method to a farm seed-mixture problem."] },
        { type: "assessment", questions: ["Explain why 2:3 and 4:6 are equivalent.", "Justify the better-value bundle with calculations.", "Apply the same method to a new Liberia market price and check the result.", "Complete an exit ticket comparing two offers and explain your evidence."] },
        { type: "misconceptions", items: ["Students may reverse the quantity order in a ratio; correct this by labeling each quantity before calculating.", "Students may compare totals instead of unit value; correct this by converting both ratios to one unit."] },
        { type: "real_world_application", content: "Ratios help students compare market prices, farm mixtures, and community purchasing decisions in Liberia. The real-world transfer is deciding which offer gives better value when quantities differ." },
        { type: "summary", content: "Students summarize how to compare equivalent ratios, justify the better value, and check whether the reasoning transfers to a new problem." },
      ],
      teacher_notes: "Model one example on the board and label quantities before calculating; Pair students for guided practice and listen for explanation gaps; Check exit tickets before independent work and reteach if needed; No special equipment is required.",
      student_notes: "Remember that a ratio compares two quantities in a fixed order. Use equivalent ratios or unit value to compare, then check by explaining why your answer still fits the original quantities.",
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

function weakEliteResponseWithInflatedScore() {
  return {
    lesson: {
      title: "Ratios",
      objectives: ["Understand ratios."],
      sections: [
        { type: "introduction", content: "Students see that ratios compare two quantities in a simple everyday situation." },
        { type: "explanation", content: "A ratio compares two numbers, and the teacher says the order matters." },
        { type: "worked_examples", examples: ["2:4 is a ratio.", "3:6 is another ratio."] },
        { type: "guided_practice", questions: ["Write one ratio.", "Name the two quantities."] },
        { type: "independent_practice", questions: ["Try one more ratio.", "Write a ratio from home."] },
        { type: "assessment", questions: ["What is a ratio?", "Write one ratio.", "Name the order of the numbers."] },
        { type: "misconceptions", items: ["Students may reverse the order of the quantities."] },
        { type: "real_world_application", content: "Students may notice ratios when comparing simple market bundles in Liberia." },
        { type: "summary", content: "Ratios compare quantities, and students should remember the order." },
      ],
      teacher_notes: "Explain the idea again if students are confused during practice.",
      student_notes: "Remember that ratios compare two quantities and keep the order correct.",
    },
    quality_score: {
      clarity: 10,
      structure: 10,
      objectives: 10,
      examples: 10,
      practice: 10,
      assessment: 10,
      misconception: 10,
      application: 10,
      transfer: 10,
      teacher: 10,
      student: 10,
      total: 100,
    },
    improvement_summary: {
      strengths: ["Claimed strong."],
      weaknesses: [],
      what_was_improved: ["Minimal edits."],
    },
  };
}

function structurallyIncompleteEliteResponse() {
  return {
    lesson: {
      title: "Problem Solving Review",
      objectives: ["Solve multistep problems.", "Explain a strategy.", "Check the result."],
      sections: [
        { type: "introduction", content: "Students review a prior problem and identify what makes a solution complete." },
        { type: "explanation", content: "The teacher models a solution path and names the checking strategy." },
        { type: "worked_examples", examples: ["Example one with steps.", "Example two with steps."] },
        { type: "guided_practice", questions: ["Question one.", "Question two."] },
      ],
      teacher_notes: "Model first, then monitor pairs and reteach if needed.",
      student_notes: "Show steps, explain the strategy, and check the answer.",
    },
    quality_score: {
      clarity: 9,
      structure: 9,
      objectives: 9,
      examples: 9,
      practice: 9,
      assessment: 9,
      misconception: 9,
      application: 9,
      transfer: 9,
      teacher: 9,
      student: 9,
      total: 90,
    },
    improvement_summary: {
      strengths: ["Clear structure."],
      weaknesses: [],
      what_was_improved: ["Expanded lesson."],
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
      assessmentQuestions: ["Explain why the ratio is equivalent.", "Justify with evidence.", "Apply the method to a market example.", "Complete an exit ticket and explain the answer."],
      commonMisconceptions: ["Reverse order.", "Compare totals instead of unit value."],
      teacherNotes: ["Use the board to model one example; pair students to compare methods; check exit tickets and reteach if needed."],
      realWorldApplication: "Use this when comparing market prices in Liberia.",
    });

    expect(score.total).toBeGreaterThan(80);
    expect(score.criteria.assessment).toBeGreaterThan(5);
    expect(score.tier).toMatch(/ELITE|STRONG|ADEQUATE|WEAK|REJECT/);
  });

  it("does not award elite teacher and assessment scores to thin support content", async () => {
    const { scoreLessonQuality } = await import("@/lib/curriculum/eliteUpgrade");

    const score = scoreLessonQuality({
      title: "How Plants Make Food",
      objectives: ["Explain how plants make food using sunlight."],
      body: "Introduction. Explanation. Guided practice. Independent practice. Summary.",
      workedExamples: ["Example 1", "Example 2"],
      guidedPractice: ["Question 1", "Question 2", "Question 3"],
      independentPractice: ["Task 1", "Task 2", "Task 3"],
      assessmentQuestions: [
        "Explain what photosynthesis is.",
        "Why is sunlight important?",
        "Apply the idea to a plant in the community.",
      ],
      commonMisconceptions: ["Plants eat food from the soil.", "Leaves are not important."],
      teacherNotes: ["Model one example on the board and check understanding before students continue."],
      studentNotes: "Students explain the process and check their reasoning.",
      realWorldApplication: "Connect the lesson to crops and gardens in Liberia.",
    });

    expect(score.criteria.assessment).toBeLessThan(9);
    expect(score.criteria.teacher).toBeLessThan(9);
    expect(score.tier).not.toBe("ELITE");
    expect(score.weakCategories).toEqual(expect.arrayContaining(["assessment", "teacher"]));
  });

  it("does not treat one generic teacher paragraph as elite teacher support", async () => {
    const { scoreLessonQuality } = await import("@/lib/curriculum/eliteUpgrade");

    const score = scoreLessonQuality({
      title: "Problem Solving and Review",
      objectives: ["Solve multistep problems and explain each step."],
      body: "Introduction. Explanation. Guided practice. Independent practice. Summary.",
      workedExamples: ["Example 1", "Example 2", "Example 3"],
      guidedPractice: ["Question 1", "Question 2", "Question 3"],
      independentPractice: ["Task 1", "Task 2", "Task 3"],
      assessmentQuestions: [
        "Explain the strategy you chose.",
        "Justify each step with evidence.",
        "Apply the method to a new problem.",
        "Complete the exit ticket and explain your check.",
      ],
      commonMisconceptions: ["Students skip a step.", "Students do not check the answer."],
      teacherNotes: [
        "Monitor student understanding by checking for clarity in explanations during practice. Remind students to verbalize their thought processes. Use partner discussions to reinforce learning. If students struggle, revisit the worked examples as a group and analyze each step together.",
      ],
      studentNotes: "Show all steps, explain your reasoning, and check your final answer.",
      realWorldApplication: "Connect the strategy to market budgeting and community planning in Liberia.",
    });

    expect(score.criteria.teacher).toBeLessThan(9);
    expect(score.tier).not.toBe("ELITE");
    expect(score.weakCategories).toContain("teacher");
  });

  it("rejects invalid JSON safely before creating a draft", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    mockRoutedCompletion.mockResolvedValue({ content: "not-json" });

    await expect(
      createEliteUpgradeDraft({ contentId: "math-g7-ratios", userId: "admin-1", schoolId: "school-1" })
    ).rejects.toThrow(/invalid elite upgrade JSON/i);
    expect(mockCurriculumContentCreate).not.toHaveBeenCalled();
  });

  it("retries once when the first upgrade response is invalid JSON", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    mockRoutedCompletion
      .mockResolvedValueOnce({ content: "not-json" })
      .mockResolvedValueOnce({ content: JSON.stringify(validEliteResponse(94)) });

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(result.qualityScores.after.total).toBeGreaterThanOrEqual(90);
    expect(mockRoutedCompletion).toHaveBeenCalledTimes(2);
    expect(mockRoutedCompletion.mock.calls[1][0].maxTokens).toBe(14000);
    expect(mockRoutedCompletion.mock.calls[1][0].aiUsage.metadata.retryAttempt).toBe(1);
  });

  it("repairs malformed JSON after two invalid upgrade responses", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    mockRoutedCompletion
      .mockResolvedValueOnce({ content: "not-json" })
      .mockResolvedValueOnce({ content: "still-not-json" })
      .mockResolvedValueOnce({ content: JSON.stringify(validEliteResponse(94)) });

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(result.qualityScores.after.total).toBeGreaterThanOrEqual(90);
    expect(mockRoutedCompletion).toHaveBeenCalledTimes(3);
    expect(mockRoutedCompletion.mock.calls[2][0].aiUsage.requestType).toBe("elite_curriculum_upgrade_json_repair");
  });

  it("repairs truncated long-lesson JSON after bounded retries", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    const truncated = JSON.stringify(validEliteResponse(94)).slice(0, 220);
    mockRoutedCompletion
      .mockResolvedValueOnce({ content: truncated })
      .mockResolvedValueOnce({ content: truncated })
      .mockResolvedValueOnce({ content: JSON.stringify(validEliteResponse(94)) });

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(result.qualityScores.after.total).toBeGreaterThanOrEqual(90);
    expect(mockRoutedCompletion).toHaveBeenCalledTimes(3);
    expect(mockRoutedCompletion.mock.calls[0][0].maxTokens).toBe(10000);
    expect(mockRoutedCompletion.mock.calls[1][0].maxTokens).toBe(14000);
    expect(mockRoutedCompletion.mock.calls[2][0].aiUsage.requestType).toBe("elite_curriculum_upgrade_json_repair");
    expect(String(mockRoutedCompletion.mock.calls[2][0].messages[1].content)).toContain("Parse failure context:");
  });

  it("repairs missing score fields safely before creating a draft", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    const invalid = validEliteResponse(94) as any;
    delete invalid.quality_score.transfer;
    mockRoutedCompletion.mockResolvedValueOnce({ content: JSON.stringify(invalid) });

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(result.qualityScores.after.total).toBeGreaterThanOrEqual(90);
    expect(mockCurriculumContentCreate).toHaveBeenCalled();
  });

  it("derives missing top-level score and improvement objects from returned lesson content", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    const missingTopLevelObjects = validEliteResponse(94) as any;
    delete missingTopLevelObjects.quality_score;
    delete missingTopLevelObjects.improvement_summary;
    mockRoutedCompletion.mockResolvedValueOnce({
      content: JSON.stringify(missingTopLevelObjects),
    });

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(result.qualityScores.after.total).toBeGreaterThanOrEqual(90);
    expect(result.improvementSummary).toEqual(
      expect.objectContaining({
        strengths: expect.any(Array),
        weaknesses: expect.any(Array),
        what_was_improved: expect.any(Array),
      })
    );
    expect(mockCurriculumContentCreate).toHaveBeenCalled();
  });

  it("parses JSON when the model wraps the object in fences or trailing prose", async () => {
    const { parseEliteUpgradeResponse } = await import("@/lib/curriculum/eliteUpgrade");
    const wrapped = ["```json", JSON.stringify(validEliteResponse(94), null, 2), "```", "", "ignored trailing text"].join("\n");

    const parsed = parseEliteUpgradeResponse(wrapped);

    expect(parsed.response.lesson.title).toBe("Ratios in Market Prices");
    expect(parsed.qualityScore.total).toBeGreaterThanOrEqual(90);
  });

  it("rejects structurally incomplete lesson JSON so partial outputs cannot count as success", async () => {
    const { parseEliteUpgradeResponse } = await import("@/lib/curriculum/eliteUpgrade");

    expect(() =>
      parseEliteUpgradeResponse(JSON.stringify(structurallyIncompleteEliteResponse()))
    ).toThrow(/Missing required elite lesson section|must contain/);
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
                firstPass: expect.objectContaining({ tier: "ELITE" }),
              }),
              modelSelfScores: expect.objectContaining({
                firstPass: expect.objectContaining({ total: expect.any(Number) }),
              }),
              scoreSource: "platform_content_rubric",
              goldStandardLesson: true,
              sectionImprovements: expect.any(Array),
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
      .mockResolvedValueOnce({ content: JSON.stringify(weakEliteResponseWithInflatedScore()) })
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

  it("uses platform content scoring instead of trusting inflated model scores", async () => {
    const { createEliteUpgradeDraft } = await import("@/lib/curriculum/eliteUpgrade");
    mockRoutedCompletion
      .mockResolvedValueOnce({ content: JSON.stringify(weakEliteResponseWithInflatedScore()) })
      .mockResolvedValueOnce({ content: JSON.stringify(weakEliteResponseWithInflatedScore()) });

    const result = await createEliteUpgradeDraft({
      contentId: "math-g7-ratios",
      userId: "admin-1",
      schoolId: "school-1",
    });

    expect(result.qualityScores.firstPass.total).toBeLessThan(90);
    expect(result.qualityScores.after.total).toBeLessThan(90);
    expect(result.weakCategories.length).toBeGreaterThan(0);
    expect(mockCurriculumContentCreate.mock.calls[0][0].data.payload.upgradeMetadata.modelSelfScores.firstPass.total).toBe(100);
    expect(mockCurriculumContentCreate.mock.calls[0][0].data.payload.upgradeMetadata.goldStandardLesson).toBe(false);
  });
});
