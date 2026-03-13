import { describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

import { analyzeLabSession } from "@/lib/ai/lab/labAnalyzer";

describe("analyzeLabSession", () => {
  it("returns parsed AI lab analysis", async () => {
    mockRoutedCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        suggestedScore: 84,
        observationFeedback: "The student recorded relevant observations and used evidence well.",
        conclusionFeedback: "The conclusion is mostly clear and could use one more supporting detail.",
        whatWentWell: ["Used clear evidence", "Recorded measurements carefully"],
        areasToImprove: ["Explain the conclusion in more depth"],
        connectionToStandard: "The work shows developing skill with evidence-based explanation.",
        teacherNote: "Review how to connect measurements to scientific claims.",
      }),
      model: "gpt-4o",
      estimatedCostUSD: 0.01,
    });

    const analysis = await analyzeLabSession({
      lab: {
        title: "Plant Growth Lab",
        subject: "SCIENCE",
        gradeLevel: 7,
      },
      observations: { measurement: 12 },
      conclusions: "The plant with more water grew more.",
      gradeLevel: 7,
    });

    expect(analysis.suggestedScore).toBe(84);
    expect(analysis.whatWentWell.length).toBeGreaterThan(0);
  });
});
