import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockModerateText = vi.hoisted(() =>
  vi.fn(async (): Promise<{ verdict: "SAFE" | "UNSAFE" | "UNCERTAIN"; reason?: string }> => ({
    verdict: "SAFE",
  }))
);
const mockEnqueueEscalation = vi.hoisted(() => vi.fn(async () => ({ id: "escalation-1" })));

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));
// NR-9.5: mock moderation separately from routedCompletion (see
// groundedAnswerService.test.ts for why) so existing call-count assertions
// on mockRoutedCompletion stay accurate.
vi.mock("@/lib/agents/moderation", () => ({
  moderateText: mockModerateText,
}));
vi.mock("@/lib/agents/escalation", () => ({
  enqueueEscalation: mockEnqueueEscalation,
}));

import { analyzeLabSession } from "@/lib/ai/lab/labAnalyzer";

describe("analyzeLabSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
  });

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

  it("blocks unsafe input before calling the LLM and escalates (NR-9.5)", async () => {
    mockModerateText.mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_input" });

    const analysis = await analyzeLabSession({
      lab: { title: "Plant Growth Lab", subject: "SCIENCE", gradeLevel: 7 },
      observations: { measurement: 12 },
      conclusions: "something unsafe",
      gradeLevel: 7,
    });

    expect(mockRoutedCompletion).not.toHaveBeenCalled();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH" })
    );
    expect(analysis.teacherNote).toContain("safety moderation");
  });

  it("regenerates once on unsafe output, then escalates and returns a safe fallback if still unsafe (NR-9.5)", async () => {
    const unsafePayload = JSON.stringify({
      suggestedScore: 50,
      observationFeedback: "flagged unsafe observation feedback text",
      conclusionFeedback: "flagged unsafe conclusion feedback text",
      whatWentWell: ["flagged item"],
      areasToImprove: ["flagged item"],
      connectionToStandard: "flagged unsafe standard connection text",
      teacherNote: "flagged unsafe teacher note text",
    });
    mockRoutedCompletion
      .mockResolvedValueOnce({ content: unsafePayload })
      .mockResolvedValueOnce({ content: unsafePayload });
    mockModerateText
      .mockResolvedValueOnce({ verdict: "SAFE" }) // input
      .mockResolvedValueOnce({ verdict: "UNSAFE" }) // first output check
      .mockResolvedValueOnce({ verdict: "UNSAFE" }); // retry output check

    const analysis = await analyzeLabSession({
      lab: { title: "Plant Growth Lab", subject: "SCIENCE", gradeLevel: 7 },
      observations: { measurement: 12 },
      conclusions: "The plant with more water grew more.",
      gradeLevel: 7,
    });

    expect(mockRoutedCompletion).toHaveBeenCalledTimes(2);
    expect(analysis.teacherNote).toContain("safety moderation");
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH" })
    );
  });
});
