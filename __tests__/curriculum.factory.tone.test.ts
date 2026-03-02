import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import { toneGuidance } from "@/lib/localization/tone-standardizer";

const VALID_PAYLOAD = {
  title: "Introduction to Fractions",
  grade: 4,
  subject: "MATH",
  objectives: ["Students will understand fractions"],
  body: "Fractions represent parts of a whole. In Liberia, market sellers use fractions daily when dividing palm oil.",
  activities: ["Group work with fraction strips"],
  moeAlignments: [],
  metadata: { topic: "Fractions", locale: "LR", generatedAt: new Date().toISOString() },
};

function makeCompletion(payload: object) {
  return {
    content: JSON.stringify(payload),
    model: "gpt-4o-mini",
    estimatedCostUSD: 0.001,
  };
}

describe("generateCurriculumPayload — toneGuidance injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects grade 1 tone guidance into system prompt", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(
      makeCompletion({ ...VALID_PAYLOAD, grade: 1 })
    );

    await generateCurriculumPayload({ grade: 1, subject: "LITERACY", topic: "Alphabet", liberiaContext: true });

    const call = mockRoutedCompletion.mock.calls[0][0];
    const systemPrompt: string = call.messages[0].content;
    expect(systemPrompt).toContain(toneGuidance(1));
    expect(systemPrompt).toContain("early elementary");
  });

  it("injects grade 6 tone guidance into system prompt", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(
      makeCompletion({ ...VALID_PAYLOAD, grade: 6 })
    );

    await generateCurriculumPayload({ grade: 6, subject: "MATH", topic: "Fractions", liberiaContext: true });

    const call = mockRoutedCompletion.mock.calls[0][0];
    const systemPrompt: string = call.messages[0].content;
    expect(systemPrompt).toContain(toneGuidance(6));
    expect(systemPrompt).toContain("upper elementary");
  });

  it("injects grade 9 tone guidance into system prompt", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(
      makeCompletion({ ...VALID_PAYLOAD, grade: 9 })
    );

    await generateCurriculumPayload({ grade: 9, subject: "SCIENCE", topic: "Ecosystems", liberiaContext: true });

    const call = mockRoutedCompletion.mock.calls[0][0];
    const systemPrompt: string = call.messages[0].content;
    expect(systemPrompt).toContain(toneGuidance(9));
    expect(systemPrompt).toContain("middle school");
  });

  it("injects grade 12 tone guidance into system prompt", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(
      makeCompletion({ ...VALID_PAYLOAD, grade: 12 })
    );

    await generateCurriculumPayload({ grade: 12, subject: "CIVICS", topic: "Government", liberiaContext: true });

    const call = mockRoutedCompletion.mock.calls[0][0];
    const systemPrompt: string = call.messages[0].content;
    expect(systemPrompt).toContain(toneGuidance(12));
    expect(systemPrompt).toContain("high school");
  });
});
