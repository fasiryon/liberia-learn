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
  const s = "Students discuss how rice sellers in Monrovia divide bags into equal parts for customers. ";
  return [
    "## 1. Welcome and Hook\n\n" + repeatSentence(s, 12),
    "## 2. Learning Objective\n\nObjective: Students will apply fraction concepts. " + repeatSentence(s, 10),
    "## 3. Prior Knowledge Check\n\nIntroduction: Recall what we learned yesterday. " + repeatSentence(s, 10),
    "## 4. Concept Introduction\n\n" + repeatSentence(s, 12),
    "## 5. Key Vocabulary\n\n" + repeatSentence(s, 10),
    "## 6. Worked Example 1\n\n" + repeatSentence(s, 12),
    "## 7. Worked Example 2\n\n" + repeatSentence(s, 12),
    "## 8. Common Mistakes\n\n" + repeatSentence(s, 10),
    "## 9. Guided Practice Problem 1\n\nGuided Practice: Solve together. " + repeatSentence(s, 10),
    "## 10. Guided Practice Problem 2\n\n" + repeatSentence(s, 10),
    "## 11. Guided Practice Problem 3\n\n" + repeatSentence(s, 10),
    "## 12. Independent Practice Easy\n\nIndependent Practice: complete the tasks. " + repeatSentence(s, 10),
    "## 13. Independent Practice Medium\n\n" + repeatSentence(s, 10),
    "## 14. Independent Practice Challenge\n\n" + repeatSentence(s, 10),
    "## 15. Assessment and Exit Ticket\n\nAssessment: Answer the exit ticket. " + repeatSentence(s, 10),
  ].join("\n\n");
}

function buildBlockBody() {
  const s = "The teacher models worked examples with vocabulary review and full step by step reasoning for Liberian learners. ";
  return [
    "## 1. Welcome and Hook\n\n" + repeatSentence(s, 12),
    "## 2. Learning Objective\n\nObjective: Students collect and interpret field data. " + repeatSentence(s, 10),
    "## 3. Prior Knowledge Check\n\nIntroduction: Connect to prior learning. " + repeatSentence(s, 10),
    "## 4. Concept Introduction Part 1\n\n" + repeatSentence(s, 12),
    "## 5. Concept Introduction Part 2\n\n" + repeatSentence(s, 12),
    "## 6. Key Vocabulary\n\n" + repeatSentence(s, 10),
    "## 7. Worked Example 1\n\n" + repeatSentence(s, 12),
    "## 8. Worked Example 2\n\n" + repeatSentence(s, 12),
    "## 9. Worked Example 3\n\n" + repeatSentence(s, 12),
    "## 10. Common Mistakes\n\n" + repeatSentence(s, 10),
    "## 11. Guided Practice Problem 1\n\nGuided Practice: work together. " + repeatSentence(s, 10),
    "## 12. Guided Practice Problem 2\n\n" + repeatSentence(s, 10),
    "## 13. Guided Practice Problem 3\n\n" + repeatSentence(s, 10),
    "## 14. Lab or Investigation Activity\n\n" + repeatSentence(s, 15),
    "## 15. Group Discussion\n\n" + repeatSentence(s, 10),
    "## 16. Independent Practice Easy and Medium\n\nIndependent Practice: complete tasks. " + repeatSentence(s, 12),
    "## 17. Independent Practice Challenge\n\n" + repeatSentence(s, 10),
    "## 18. Assessment Exit Ticket and Reflection\n\nAssessment: exit ticket below. " + repeatSentence(s, 10),
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
    expect(prompt).toContain("## 1. Hook — The Real-World Challenge");
    expect(prompt).toContain("## 2. Learning Objectives");
    expect(prompt).toContain("## 10. Guided Practice — Problem 1");
    expect(prompt).toContain("## 13. Independent Practice — Tier 1 Foundational");
    expect(prompt).toContain("## 17. Assessment, Exit Ticket, and Lesson Summary");
    expect(prompt).toContain("AT LEAST 17");
    expect(payload.body_standard).toContain("## 7. Worked Example 2");
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
    expect(prompt).toContain("## 15. Investigation Activity");
    expect(prompt).toContain("## 17. Independent Practice — Tiers 1 and 2");
    expect(prompt).toContain("## 16. Group Discussion and Cross-Curricular Connection");
    expect(prompt).toContain("## 20. Assessment, Exit Ticket, and Lesson Summary");
    expect(prompt).toContain("AT LEAST 20");
    expect(payload.body_block).toContain("## 14. Lab or Investigation Activity");
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
