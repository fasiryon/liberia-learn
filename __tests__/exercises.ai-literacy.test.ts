/**
 * __tests__/exercises.ai-literacy.test.ts  — NR-14D Phase 4
 *
 * Tests for AI literacy grading:
 *   1. Each of the 4 exercise types has its own rubric criteria
 *   2. gradeAILiteracy returns a score + breakdown + feedback
 *   3. Too-short responses get a tooShort signal (< 30 words)
 *   4. ethics_scenario does NOT penalize a specific position — rewards reasoning quality
 *   5. bias_detection checks for specific identification, explanation, and alternative
 *   6. Malformed LLM JSON falls back to neutral scores
 *   7. POST /api/grading/ai-literacy — validates exerciseType, rate-limits, idempotency
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock routedCompletion ─────────────────────────────────────────────────────
vi.mock("@/lib/ai/router", () => ({
  routedCompletion: vi.fn(),
}));

// ── Mock prisma for route tests ───────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
    aILiteracyExercise: { findUnique: vi.fn() },
    gradedSubmission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "user-1", role: "STUDENT" }),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
  rateLimitExceededResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "rate_limit_exceeded" }), { status: 429 })
  ),
}));

vi.mock("@/lib/adaptive/updateMastery", () => ({
  recordAnswer: vi.fn().mockResolvedValue({ score: 0.8, mastered: false }),
  buildSkillKey: vi.fn().mockReturnValue("CS:G7:unit-ai"),
}));

import { gradeAILiteracy, isAILiteracyGradeResult } from "@/lib/grading/gradeAILiteracy";
import { routedCompletion } from "@/lib/ai/router";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

const mockRoute = routedCompletion as any;
const mockPrisma = prisma as any;
const mockCheckRateLimit = checkRateLimit as any;

// ── Shared rubrics per type ───────────────────────────────────────────────────

const PROMPT_RUBRIC = {
  criteria: [
    { key: "clarity", label: "Clarity", description: "Clear task statement", weight: 0.3 },
    { key: "specificity", label: "Specificity", description: "Enough context", weight: 0.3 },
    { key: "context", label: "Context", description: "Liberian context", weight: 0.2 },
    { key: "constraints", label: "Constraints", description: "Limits set", weight: 0.2 },
  ],
};

const ETHICS_RUBRIC = {
  criteria: [
    { key: "position", label: "Position", description: "Clear position", weight: 0.25 },
    { key: "perspectives", label: "Perspectives", description: "Multiple views", weight: 0.35 },
    { key: "safeguard", label: "Safeguard", description: "Practical rule", weight: 0.25 },
    { key: "reasoning", label: "Reasoning", description: "Logic quality", weight: 0.15 },
  ],
};

const BIAS_RUBRIC = {
  criteria: [
    { key: "identification", label: "Bias Identified", description: "Correctly spots bias", weight: 0.4 },
    { key: "explanation", label: "Explanation", description: "Who is excluded", weight: 0.35 },
    { key: "alternative", label: "Alternative", description: "Inclusive rewrite", weight: 0.25 },
  ],
};

function makeGradeJSON(criteria: string[], scores: number[]) {
  const criteriaObj: Record<string, { score: number; comment: string }> = {};
  criteria.forEach((key, i) => {
    criteriaObj[key] = { score: scores[i], comment: `Good work on ${key}` };
  });
  return JSON.stringify({ criteria: criteriaObj, feedback: "Well done! Keep thinking critically." });
}

// ── gradeAILiteracy unit tests ────────────────────────────────────────────────

describe("gradeAILiteracy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tooShort when response is under 30 words", async () => {
    const result = await gradeAILiteracy({
      studentResponse: "This is too short.",
      exerciseType: "ethics_scenario",
      scenario: "An AI system...",
      studentPromptInstruction: null,
      rubric: ETHICS_RUBRIC,
      grade: 7,
    });

    expect(result.tooShort).toBe(true);
    if (result.tooShort) {
      expect(result.minWords).toBe(30);
    }
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it("returns a full graded result for prompt_engineering", async () => {
    mockRoute.mockResolvedValue({
      content: makeGradeJSON(["clarity", "specificity", "context", "constraints"], [0.9, 0.8, 0.7, 0.6]),
    });

    const response =
      "Write a prompt asking the AI to create a budget plan for a small cassava vendor in Monrovia with 500 Liberian dollars. The prompt should ask for a 7-day meal plan, include local food options, and specify that prices should be realistic for the Waterside Market.";

    const result = await gradeAILiteracy({
      studentResponse: response,
      exerciseType: "prompt_engineering",
      scenario: "You need to create a budget meal plan.",
      studentPromptInstruction: "Write a prompt to accomplish the task.",
      rubric: PROMPT_RUBRIC,
      grade: 8,
    });

    expect(isAILiteracyGradeResult(result)).toBe(true);
    if (isAILiteracyGradeResult(result)) {
      expect(result.score).toBeGreaterThan(0);
      expect(result.breakdown).toHaveProperty("clarity");
      expect(result.breakdown).toHaveProperty("specificity");
      expect(result.feedback).toBeTruthy();
    }
  });

  it("rewards multi-perspective reasoning for ethics_scenario", async () => {
    // High scores across all criteria — rewards complex reasoning
    mockRoute.mockResolvedValue({
      content: makeGradeJSON(
        ["position", "perspectives", "safeguard", "reasoning"],
        [0.9, 0.95, 0.85, 0.9]
      ),
    });

    const response =
      "I think using AI to predict student dropout is unfair because it could label students before they even have a chance. From a teacher perspective this could help early intervention, but from a student perspective it could create bias. Schools should require that any AI prediction be reviewed by a human counselor before any action is taken.";

    const result = await gradeAILiteracy({
      studentResponse: response,
      exerciseType: "ethics_scenario",
      scenario: "A school uses AI to predict dropout...",
      studentPromptInstruction: null,
      rubric: ETHICS_RUBRIC,
      grade: 9,
    });

    expect(isAILiteracyGradeResult(result)).toBe(true);
    if (isAILiteracyGradeResult(result)) {
      // Weighted score should be high — reward good reasoning regardless of position
      expect(result.score).toBeGreaterThan(0.85);
    }
  });

  it("grades bias_detection on identification + explanation + alternative", async () => {
    mockRoute.mockResolvedValue({
      content: makeGradeJSON(
        ["identification", "explanation", "alternative"],
        [1.0, 0.9, 0.8]
      ),
    });

    const response =
      "The text assumes everyone has electricity and a smartphone which leaves out rural Liberians in Lofa county and Grand Gedeh who may not have reliable power. A more inclusive version would say 'whether you have a smartphone, a basic phone, or only radio access.'";

    const result = await gradeAILiteracy({
      studentResponse: response,
      exerciseType: "bias_detection",
      scenario: "AI-generated text assumes electricity access...",
      studentPromptInstruction: "Identify the bias.",
      rubric: BIAS_RUBRIC,
      grade: 7,
    });

    expect(isAILiteracyGradeResult(result)).toBe(true);
    if (isAILiteracyGradeResult(result)) {
      expect(result.breakdown).toHaveProperty("identification");
      expect(result.breakdown).toHaveProperty("explanation");
      expect(result.breakdown).toHaveProperty("alternative");
    }
  });

  it("falls back to neutral scores when LLM returns malformed JSON", async () => {
    mockRoute.mockResolvedValue({ content: "sorry I cannot grade this {malformed}" });

    const response =
      "This is a long enough response about AI bias and how it affects Liberian students who live in rural areas without electricity. I believe the text is biased because it assumes everyone owns a smartphone.";

    const result = await gradeAILiteracy({
      studentResponse: response,
      exerciseType: "bias_detection",
      scenario: "AI text with bias...",
      studentPromptInstruction: null,
      rubric: BIAS_RUBRIC,
      grade: 6,
    });

    expect(isAILiteracyGradeResult(result)).toBe(true);
    if (isAILiteracyGradeResult(result)) {
      // All criteria fall back to 0.5
      expect(result.breakdown.identification.score).toBe(0.5);
      expect(result.feedback).toBeTruthy();
    }
  });
});

// ── Route tests ───────────────────────────────────────────────────────────────

describe("POST /api/grading/ai-literacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 19 }); // not rate limited
  });

  async function callRoute(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/grading/ai-literacy/route");
    return POST(new Request("http://localhost/api/grading/ai-literacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }

  function setupMocks() {
    mockPrisma.student.findFirst.mockResolvedValue({ id: "student-1" });
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({
      grade: 7,
      subject: "COMPUTER_SCIENCE",
      unitId: "unit-1",
      contentId: "CS_G7_AI",
    });
    mockPrisma.aILiteracyExercise.findUnique.mockResolvedValue({
      scenario: "An AI is used to...",
      studentPromptInstruction: "Identify the issue.",
      rubric: ETHICS_RUBRIC,
    });
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue(null);
    mockPrisma.gradedSubmission.create.mockResolvedValue({ id: "sub-1" });
    mockPrisma.gradedSubmission.update.mockResolvedValue({ id: "sub-1" });
  }

  it("returns 400 for invalid exerciseType", async () => {
    setupMocks();
    const res = await callRoute({
      lessonId: "lesson-1",
      exerciseId: "ex-1",
      exerciseType: "invalid_type",
      studentResponse: "Some response about AI bias in Liberia that is long enough to grade.",
    });
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 }); // rate limited
    mockPrisma.student.findFirst.mockResolvedValue({ id: "student-1" });

    const res = await callRoute({
      lessonId: "lesson-1",
      exerciseId: "ex-1",
      exerciseType: "ethics_scenario",
      studentResponse: "Some long enough response about AI ethics in Liberia that discusses multiple perspectives.",
    });
    expect(res.status).toBe(429);
  });

  it("returns graded result for valid ethics_scenario submission", async () => {
    setupMocks();
    mockRoute.mockResolvedValue({
      content: makeGradeJSON(
        ["position", "perspectives", "safeguard", "reasoning"],
        [0.8, 0.9, 0.7, 0.8]
      ),
    });

    const res = await callRoute({
      lessonId: "lesson-1",
      exerciseId: "ex-1",
      exerciseType: "ethics_scenario",
      studentResponse:
        "I think the AI system is unfair because it might label students incorrectly. Teachers would benefit from early warnings but students could be harmed by false predictions. The school should require human review before taking any action based on AI predictions about students.",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.score).toBeGreaterThan(0);
    expect(data.feedback).toBeTruthy();
  });

  it("returns idempotent response for duplicate clientSubmissionId", async () => {
    mockPrisma.student.findFirst.mockResolvedValue({ id: "student-1" });
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue({
      id: "existing-sub",
      score: 0.75,
      status: "graded",
    });

    const res = await callRoute({
      lessonId: "lesson-1",
      exerciseId: "ex-1",
      exerciseType: "ethics_scenario",
      studentResponse: "Long enough response about AI ethics...",
      clientSubmissionId: "already-seen-uuid",
    });

    expect(res.status).toBe(200);
    // Grading should NOT be called again
    expect(mockRoute).not.toHaveBeenCalled();
  });
});
