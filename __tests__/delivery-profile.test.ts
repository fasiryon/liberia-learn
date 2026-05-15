import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_PAYLOAD = {
  title: "Introduction to Fractions",
  grade: 4,
  subject: "MATH",
  lessonFormat: "standard",
  objectives: ["Students will identify fractions as parts of a whole"],
  body: "Fractions represent parts of a whole. In Liberia, market sellers at Waterside use fractions daily when dividing palm oil and cassava portions for sale.",
  body_standard: "Fractions represent parts of a whole. In Liberia, market sellers at Waterside use fractions daily when dividing palm oil and cassava portions for sale.",
  activities: ["Group work with fraction strips", "Market role-play exercise"],
  moeAlignments: ["MATH-G4-NUM-01"],
  metadata: { topic: "Fractions", locale: "LR", generatedAt: new Date().toISOString() },
};

const VALID_DELIVERY_PROFILE = {
  estimatedMinutes: 45,
  recommendedFormat: "standard",
  phases: [
    { name: "Introduction", durationMinutes: 10, description: "Hook activity" },
    { name: "Instruction", durationMinutes: 20, description: "Direct teaching" },
    { name: "Practice", durationMinutes: 15, description: "Guided practice" },
  ],
  standardVersion: {
    phases: [
      { name: "Introduction", durationMinutes: 10, description: "Hook activity" },
      { name: "Practice", durationMinutes: 35, description: "Combined practice" },
    ],
    omittedActivities: ["Extended group activity"],
  },
  blockVersion: {
    phases: [
      { name: "Introduction", durationMinutes: 15, description: "Extended hook" },
      { name: "Instruction", durationMinutes: 30, description: "Deep instruction" },
      { name: "Lab Work", durationMinutes: 30, description: "Hands-on lab" },
      { name: "Closure", durationMinutes: 15, description: "Review and exit" },
    ],
    extensions: ["Real-world fraction market activity", "Peer teaching segment"],
  },
  exitTicket: {
    questions: [
      {
        question: "What fraction of a cassava is shaded?",
        type: "mcq",
        standardCode: "MATH-G4-NUM-01",
        choices: ["1/2", "1/3", "1/4", "2/3"],
      },
      {
        question: "Write a fraction that represents 3 out of 5 equal parts.",
        type: "short_answer",
        standardCode: "MATH-G4-NUM-01",
        choices: [],
      },
    ],
  },
  toolsRequired: [
    { toolKey: "fraction-visualizer", reason: "Visual fraction support", phase: "Practice", required: true },
  ],
};

function makeCompletion(payload: object) {
  return {
    content: JSON.stringify(payload),
    model: "gpt-4o-mini",
    estimatedCostUSD: 0.001,
  };
}

// Two-pass Pass 1 returns plain Markdown prose. This response is under 1200 words,
// so the factory discards it and falls back to single-pass OpenAI — which is what
// these tests exercise.
const PASS1_FALLBACK = {
  content: "Short body.",
  model: "llama-3.3-70b-versatile",
  estimatedCostUSD: 0,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generateCurriculumPayload — deliveryProfile flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Part 1: Flag OFF ────────────────────────────────────────────────────────

  describe("ENABLE_DELIVERY_PROFILE=false", () => {
    it("does not include deliveryProfile in the returned payload", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(false);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: VALID_DELIVERY_PROFILE })
        );

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      expect(result).not.toHaveProperty("deliveryProfile");
    });

    it("does not inject deliveryProfile prompt into system message", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(false);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(makeCompletion(BASE_PAYLOAD));

      await generateCurriculumPayload({ grade: 4, subject: "MATH", topic: "Fractions", liberiaContext: true });

      // calls[0] is the two-pass Pass 1 call; calls[1] is the single-pass fallback whose
      // system prompt reflects the flag state.
      const systemPrompt: string =
        mockRoutedCompletion.mock.calls[1][0].messages[0].content;
      expect(systemPrompt).not.toContain("deliveryProfile");
      expect(systemPrompt).not.toContain("estimatedMinutes");
      expect(systemPrompt).not.toContain("exitTicket");
    });

    it("succeeds even when AI returns no deliveryProfile field", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(false);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(makeCompletion(BASE_PAYLOAD));

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      expect(result.title).toBe("Introduction to Fractions");
    });

    it("strips deliveryProfile even when AI unexpectedly returns one", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(false);
      const withProfile = { ...BASE_PAYLOAD, deliveryProfile: VALID_DELIVERY_PROFILE };
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(makeCompletion(withProfile));

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      expect(result.deliveryProfile).toBeUndefined();
    });
  });

  // ── Part 2: Flag ON ─────────────────────────────────────────────────────────

  describe("ENABLE_DELIVERY_PROFILE=true", () => {
    it("injects deliveryProfile prompt into the system message", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: VALID_DELIVERY_PROFILE })
        );

      await generateCurriculumPayload({ grade: 4, subject: "MATH", topic: "Fractions", liberiaContext: true });

      // calls[0] is the two-pass Pass 1 call; calls[1] is the single-pass fallback whose
      // system prompt reflects the flag state.
      const systemPrompt: string =
        mockRoutedCompletion.mock.calls[1][0].messages[0].content;
      expect(systemPrompt).toContain("deliveryProfile");
      expect(systemPrompt).toContain("estimatedMinutes");
      expect(systemPrompt).toContain("exitTicket");
      expect(systemPrompt).toContain("toolsRequired");
    });

    it("returns payload with valid deliveryProfile when AI output is well-formed", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: VALID_DELIVERY_PROFILE })
        );

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      expect(result.deliveryProfile).toBeDefined();
      expect(result.deliveryProfile!.estimatedMinutes).toBe(45);
      expect(result.deliveryProfile!.recommendedFormat).toBe("standard");
      expect(result.deliveryProfile!.exitTicket.questions).toHaveLength(2);
    });

    it("includes valid toolsRequired with known toolKey", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: VALID_DELIVERY_PROFILE })
        );

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      expect(result.deliveryProfile!.toolsRequired[0].toolKey).toBe("fraction-visualizer");
      expect(result.deliveryProfile!.toolsRequired[0].required).toBe(true);
    });

    // ── Validation failures ────────────────────────────────────────────────────

    it("does not throw on unknown toolKey (Zod schema allows any string — prompt enforces the list)", async () => {
      // The ToolRequiredSchema uses z.string() not z.enum(), so an unrecognised
      // toolKey passes Zod validation. The AI prompt restricts the allowed values,
      // but that is a generation-time concern, not a parse-time one.
      // Callers such as getToolsForLesson() silently skip unknown toolKeys.
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      const profileWithUnknownTool = {
        ...VALID_DELIVERY_PROFILE,
        toolsRequired: [
          {
            toolKey: "INVALID_TOOL_XYZ",
            reason: "unknown tool",
            phase: "Practice",
            required: true,
          },
        ],
      };
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: profileWithUnknownTool })
        );

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      // Succeeds — Zod does not enumerate allowed toolKey values
      expect(result.deliveryProfile!.toolsRequired[0].toolKey).toBe("INVALID_TOOL_XYZ");
    });

    it("throws when exitTicket has fewer than 2 questions", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      const badProfile = {
        ...VALID_DELIVERY_PROFILE,
        exitTicket: {
          questions: [
            {
              question: "Single question only",
              type: "mcq",
              standardCode: "MATH-G4-NUM-01",
              choices: ["A", "B"],
            },
          ],
        },
      };
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: badProfile })
        );

      await expect(
        generateCurriculumPayload({ grade: 4, subject: "MATH", topic: "Fractions", liberiaContext: true })
      ).rejects.toThrow(/validation/i);
    });

    it("throws when exitTicket has more than 3 questions", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      const badProfile = {
        ...VALID_DELIVERY_PROFILE,
        exitTicket: {
          questions: [
            { question: "Q1", type: "mcq", standardCode: "MATH-G4-NUM-01", choices: ["A"] },
            { question: "Q2", type: "short_answer", standardCode: "MATH-G4-NUM-01", choices: [] },
            { question: "Q3", type: "mcq", standardCode: "MATH-G4-NUM-01", choices: ["A"] },
            { question: "Q4", type: "mcq", standardCode: "MATH-G4-NUM-01", choices: ["B"] },
          ],
        },
      };
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: badProfile })
        );

      await expect(
        generateCurriculumPayload({ grade: 4, subject: "MATH", topic: "Fractions", liberiaContext: true })
      ).rejects.toThrow(/validation/i);
    });

    it("accepts exitTicket with exactly 2 questions (lower bound)", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: VALID_DELIVERY_PROFILE })
        );

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      expect(result.deliveryProfile!.exitTicket.questions).toHaveLength(2);
    });

    it("accepts exitTicket with exactly 3 questions (upper bound)", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      const threeQProfile = {
        ...VALID_DELIVERY_PROFILE,
        exitTicket: {
          questions: [
            { question: "Q1", type: "mcq", standardCode: "MATH-G4-NUM-01", choices: ["A", "B"] },
            { question: "Q2", type: "short_answer", standardCode: "MATH-G4-NUM-01", choices: [] },
            { question: "Q3", type: "mcq", standardCode: "MATH-G4-NUM-01", choices: ["A", "B"] },
          ],
        },
      };
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce(
          makeCompletion({ ...BASE_PAYLOAD, deliveryProfile: threeQProfile })
        );

      const result = await generateCurriculumPayload({
        grade: 4,
        subject: "MATH",
        topic: "Fractions",
        liberiaContext: true,
      });

      expect(result.deliveryProfile!.exitTicket.questions).toHaveLength(3);
    });

    it("throws when AI returns invalid JSON entirely", async () => {
      mockIsDeliveryProfileEnabled.mockReturnValue(true);
      mockRoutedCompletion
        .mockResolvedValueOnce(PASS1_FALLBACK)
        .mockResolvedValueOnce({
          content: "Sorry, I cannot generate that content.",
          model: "gpt-4o-mini",
          estimatedCostUSD: 0,
        });

      await expect(
        generateCurriculumPayload({ grade: 4, subject: "MATH", topic: "Fractions", liberiaContext: true })
      ).rejects.toThrow(/invalid JSON/i);
    });
  });
});
