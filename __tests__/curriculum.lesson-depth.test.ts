import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockIsDeliveryProfileEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isDeliveryProfileEnabled: mockIsDeliveryProfileEnabled,
  };
});

import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";

function repeatSentence(sentence: string, count: number) {
  return Array.from({ length: count }, () => sentence).join(" ");
}

function buildStandardBody() {
  return [
    "## Opening (5 minutes)",
    repeatSentence("Students discuss how rice sellers in Monrovia divide bags into equal parts for customers.", 35),
    "## Direct Instruction (15 minutes)",
    repeatSentence("The teacher explains the concept with worked examples using Liberian dollars, county names, and step by step solutions.", 95),
    "## Guided Practice (15 minutes)",
    repeatSentence("The class solves practice problems together while the teacher points out common mistakes and correct reasoning.", 85),
    "## Independent Practice (8 minutes)",
    repeatSentence("Students complete easy medium and challenge problems with an answer key at the end of the section.", 65),
    "## Closing (7 minutes)",
    repeatSentence("The lesson closes with a summary exit ticket and preview of the next day.", 40),
  ].join("\n\n");
}

function buildBlockBody() {
  return [
    "## Opening (5 minutes)",
    repeatSentence("Students connect the lesson to market prices river transport and daily life in Liberia.", 45),
    "## Direct Instruction (20 minutes)",
    repeatSentence("The teacher models several worked examples with careful vocabulary review and full reasoning.", 120),
    "## Guided Practice (20 minutes)",
    repeatSentence("Learners solve multiple guided problems while the teacher checks misconceptions and prompts discussion.", 110),
    "## Lab or Activity (25 minutes)",
    repeatSentence("Groups conduct an investigation using paper stones water string and notebook observations gathered from the school yard.", 120),
    "## Independent Work (15 minutes)",
    repeatSentence("Students complete a longer task sequence that ranges from straightforward items to a challenge problem.", 95),
    "## Group Discussion (8 minutes)",
    repeatSentence("The class discusses how the concept connects to Liberian communities and current local realities.", 55),
    "## Closing (7 minutes)",
    repeatSentence("The lesson ends with reflection review and a preview of the next session.", 45),
  ].join("\n\n");
}

function makeCompletion(payload: object) {
  return {
    content: JSON.stringify(payload),
    model: "gpt-4o",
    estimatedCostUSD: 0.01,
  };
}

describe("generateCurriculumPayload lesson depth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDeliveryProfileEnabled.mockReturnValue(true);
  });

  it("injects all required standard lesson sections into the prompt", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(
      makeCompletion({
        title: "Fractions in Market Trading",
        grade: 5,
        subject: "MATH",
        lessonFormat: "standard",
        objectives: ["Understand fractions in context"],
        body: buildStandardBody(),
        body_standard: buildStandardBody(),
        activities: ["Fraction strip practice"],
        moeAlignments: ["MATH-G5-NS-01"],
        metadata: { topic: "Fractions", locale: "LR", generatedAt: new Date().toISOString() },
        deliveryProfile: {
          estimatedMinutes: 45,
          recommendedFormat: "standard",
          phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
          standardVersion: {
            phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
            omittedActivities: [],
          },
          blockVersion: {
            phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
            extensions: [],
          },
          exitTicket: {
            questions: [
              { question: "What is one half?", type: "short_answer", standardCode: "MATH-G5-NS-01", choices: [] },
              { question: "Choose the fraction.", type: "mcq", standardCode: "MATH-G5-NS-01", choices: ["1/2", "1/3"] },
            ],
          },
          toolsRequired: [],
        },
      })
    );

    const payload = await generateCurriculumPayload({
      grade: 5,
      subject: "MATH",
      topic: "Fractions",
      lessonFormat: "standard",
      liberiaContext: true,
    });

    const prompt = mockRoutedCompletion.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("## Opening (5 minutes)");
    expect(prompt).toContain("## Direct Instruction (15 minutes)");
    expect(prompt).toContain("## Guided Practice (15 minutes)");
    expect(prompt).toContain("## Independent Practice (8 minutes)");
    expect(prompt).toContain("## Closing (7 minutes)");
    expect(payload.body_standard).toContain("## Direct Instruction (15 minutes)");
    expect(payload.body_standard!.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(1000);
  });

  it("injects all required block lesson sections into the prompt", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(
      makeCompletion({
        title: "Data and Measurement in Farming",
        grade: 8,
        subject: "SCIENCE",
        lessonFormat: "block",
        objectives: ["Collect and interpret data"],
        body: buildBlockBody(),
        body_block: buildBlockBody(),
        activities: ["Field data collection"],
        labs: [
          {
            title: "Field Data Collection Lab",
            type: "guided_walkthrough",
            durationMinutes: 30,
            subject: "SCIENCE",
            gradeLevel: 8,
            labObjective: "Students collect and compare field observations using locally available materials.",
            materialsNeeded: ["paper", "pencil", "string", "stones", "water"],
            safetyNotes: "Handle water carefully to avoid slips.",
            procedure: [
              { stepNumber: 1, instruction: "Gather field materials.", teacherNote: "Use school-yard items only.", durationMinutes: 5 },
              { stepNumber: 2, instruction: "Measure and record one variable.", teacherNote: "Model the first entry.", durationMinutes: 10 },
              { stepNumber: 3, instruction: "Compare results with a partner.", teacherNote: "Prompt evidence-based discussion.", durationMinutes: 8 },
              { stepNumber: 4, instruction: "Prepare one class finding.", teacherNote: "Summarize patterns clearly.", durationMinutes: 7 },
            ],
            observationForm: [
              { field: "sample", prompt: "What did you measure?", inputType: "text", choices: null },
              { field: "value", prompt: "What value did you record?", inputType: "number", choices: null },
            ],
            analysisQuestions: [
              {
                question: "What did the data show?",
                expectedAnswer: "Students identify a pattern or comparison from their measurements.",
                scoringRubric: "Full credit for a specific evidence-based observation.",
              },
              {
                question: "How does the evidence connect to the lesson?",
                expectedAnswer: "Students explain the connection between the observed data and the lesson concept.",
                scoringRubric: "Full credit for a clear link to the lesson objective.",
              },
            ],
            connectionToLesson: "Students use evidence to deepen the lesson concept.",
            offlineCapable: true,
            virtualAlternative: "A cached 2D graphing activity can substitute if materials are unavailable.",
          },
        ],
        moeAlignments: ["SCI-G8-DATA-02"],
        metadata: { topic: "Data Collection", locale: "LR", generatedAt: new Date().toISOString() },
        deliveryProfile: {
          estimatedMinutes: 90,
          recommendedFormat: "block",
          phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
          standardVersion: {
            phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
            omittedActivities: [],
          },
          blockVersion: {
            phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
            extensions: [],
          },
          splitPoint: { afterPhase: "Guided Practice", day2Opening: "Review prior observations" },
          exitTicket: {
            questions: [
              { question: "What did your data show?", type: "short_answer", standardCode: "SCI-G8-DATA-02", choices: [] },
              { question: "Choose the best graph.", type: "mcq", standardCode: "SCI-G8-DATA-02", choices: ["A", "B"] },
            ],
          },
          toolsRequired: [],
        },
      })
    );

    const payload = await generateCurriculumPayload({
      grade: 8,
      subject: "SCIENCE",
      topic: "Data Collection",
      lessonFormat: "block",
      liberiaContext: true,
    });

    const prompt = mockRoutedCompletion.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("## Lab or Activity (25 minutes)");
    expect(prompt).toContain("## Independent Work (15 minutes)");
    expect(prompt).toContain("## Group Discussion (8 minutes)");
    expect(prompt).toContain("## Closing (7 minutes)");
    expect(payload.body_block).toContain("## Lab or Activity (25 minutes)");
    expect(payload.body_block!.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(1800);
  });

  it("returns both lesson bodies when lessonFormat is either", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(
      makeCompletion({
        title: "Fractions for Markets and Measurement",
        grade: 6,
        subject: "MATH",
        lessonFormat: "either",
        objectives: ["Compare fractions", "Apply fractions to measurement"],
        body: buildStandardBody(),
        body_standard: buildStandardBody(),
        body_block: buildBlockBody(),
        activities: ["Market fraction challenge"],
        moeAlignments: ["MATH-G6-NS-03"],
        metadata: { topic: "Fractions", locale: "LR", generatedAt: new Date().toISOString() },
        deliveryProfile: {
          estimatedMinutes: 90,
          recommendedFormat: "either",
          phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
          standardVersion: {
            phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
            omittedActivities: [],
          },
          blockVersion: {
            phases: [{ name: "Opening", durationMinutes: 5, description: "Hook" }],
            extensions: [],
          },
          splitPoint: { afterPhase: "Guided Practice", day2Opening: "Review prior work" },
          exitTicket: {
            questions: [
              { question: "Explain one fraction idea.", type: "short_answer", standardCode: "MATH-G6-NS-03", choices: [] },
              { question: "Pick the correct fraction.", type: "mcq", standardCode: "MATH-G6-NS-03", choices: ["A", "B"] },
            ],
          },
          toolsRequired: [],
        },
      })
    );

    const payload = await generateCurriculumPayload({
      grade: 6,
      subject: "MATH",
      topic: "Fractions",
      lessonFormat: "either",
      liberiaContext: true,
    });

    expect(payload.body_standard).toBeDefined();
    expect(payload.body_block).toBeDefined();
    expect(payload.body).toBe(payload.body_standard);
  });
});
