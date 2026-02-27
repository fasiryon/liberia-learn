import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockIsCurriculumOptimizationAiEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isCurriculumOptimizationAiEnabled: mockIsCurriculumOptimizationAiEnabled,
  };
});

import { optimizeCurriculumSignals } from "@/lib/ai/curriculum/curriculumOptimizer";

const BASE_SIGNAL = {
  rows: [],
  weakByGradeBand: {
    G4_6: [
      {
        gradeBand: "G4_6",
        subject: "MATH",
        strandKey: "fractions",
        strandName: "Fractions",
        sampleSize: 30,
        avgMastery: 0.48,
        avgMasteryDelta: -0.05,
        trendDirection: "declining",
        rank: 1,
        reasons: ["bottom_ranked_within_grade_band", "declining_mastery_delta"],
      },
    ],
  },
  summary: {
    totalProfilesConsidered: 30,
    eligibleStrandCount: 1,
    filteredOutBySample: 0,
    minSampleSize: 20,
    weakBottomN: 3,
    weakMasteryThreshold: 0.6,
  },
} as any;

describe("optimizeCurriculumSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deterministic advice when AI flag is off", async () => {
    mockIsCurriculumOptimizationAiEnabled.mockReturnValue(false);

    const result = await optimizeCurriculumSignals(BASE_SIGNAL);

    expect(result.weakStrands).toHaveLength(1);
    expect(result.aiSummary).toBeUndefined();
    expect(result.recommendedEmphasisChanges.length).toBeGreaterThan(0);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("falls back safely when AI throws", async () => {
    mockIsCurriculumOptimizationAiEnabled.mockReturnValue(true);
    mockRoutedCompletion.mockRejectedValue(new Error("AI down"));

    const result = await optimizeCurriculumSignals(BASE_SIGNAL);

    expect(result.aiSummary?.hadFallback).toBe(true);
    expect(result.recommendedEmphasisChanges.length).toBeGreaterThan(0);
  });

  it("falls back when AI returns invalid JSON", async () => {
    mockIsCurriculumOptimizationAiEnabled.mockReturnValue(true);
    mockRoutedCompletion.mockResolvedValue({
      content: "not-json",
      estimatedCostUSD: 0.01,
    });

    const result = await optimizeCurriculumSignals(BASE_SIGNAL);

    expect(result.aiSummary?.hadFallback).toBe(true);
    expect(result.recommendedEmphasisChanges.length).toBeGreaterThan(0);
  });
});

