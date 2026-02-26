/**
 * __tests__/interventions.engine.test.ts -- Block 13
 *
 * Tests for recommendationEngine deterministic logic and AI fallback.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TrendSeries } from "@/lib/reporting/trends/types";
import { computeRecommendations, buildInterventionPrompt } from "@/lib/ai/interventions/recommendationEngine";

const baseTrends: TrendSeries = {
  period: "monthly",
  masteryTrend: [
    { period: "2026-01", value: 0.7 },
    { period: "2026-02", value: 0.7 },
    { period: "2026-03", value: 0.7 },
  ],
  evidenceVelocityTrend: [
    { period: "2026-01", value: 10 },
    { period: "2026-02", value: 10 },
    { period: "2026-03", value: 10 },
  ],
};

const baseMetrics = {
  avgMasteryScore: 0.5,
  trainingAdoptionRate: 0.5,
  evidenceSubmissionRate: 0.5,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-02-26T12:00:00Z"));
  process.env.AI_INTERVENTIONS_AI_ENHANCED = "false";
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  vi.useRealTimers();
});

it("priority score matches formula for known fixture", async () => {
  const result = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: baseMetrics,
    trends: baseTrends,
  });

  // avgMasteryScore < 0.6 -> low risk (0.25)
  // score = (1-0.5)*40 + 0.25*30 + (1-0.5)*20 + (1-0.5)*10
  expect(result.interventionPriorityScore).toBeCloseTo(42.5, 4);
});

it("growthRiskFlag is critical when avgMasteryScore < 0.4", async () => {
  const result = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: { ...baseMetrics, avgMasteryScore: 0.35 },
    trends: baseTrends,
  });

  expect(result.growthRiskFlag).toBe("critical");
});

it("growthRiskFlag is medium after 2 consecutive declines", async () => {
  const trends: TrendSeries = {
    ...baseTrends,
    masteryTrend: [
      { period: "2026-01", value: 0.8 },
      { period: "2026-02", value: 0.7 },
      { period: "2026-03", value: 0.6 },
    ],
  };

  const result = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: { ...baseMetrics, avgMasteryScore: 0.7 },
    trends,
  });

  expect(result.growthRiskFlag).toBe("medium");
});

it("growthRiskFlag is high after 3 consecutive declines", async () => {
  const trends: TrendSeries = {
    ...baseTrends,
    masteryTrend: [
      { period: "2026-01", value: 0.9 },
      { period: "2026-02", value: 0.8 },
      { period: "2026-03", value: 0.7 },
      { period: "2026-04", value: 0.6 },
    ],
  };

  const result = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: { ...baseMetrics, avgMasteryScore: 0.7 },
    trends,
  });

  expect(result.growthRiskFlag).toBe("high");
});

it("adds training recommendation when adoptionRate < 0.3", async () => {
  const result = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: { ...baseMetrics, trainingAdoptionRate: 0.2 },
    trends: baseTrends,
  });

  const hasTraining = result.recommendedActions.some((a) => a.type === "training");
  expect(hasTraining).toBe(true);
});

it("AI path falls back gracefully when OpenAI unavailable", async () => {
  process.env.AI_INTERVENTIONS_AI_ENHANCED = "true";
  delete process.env.OPENAI_API_KEY;

  const result = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: { ...baseMetrics, trainingAdoptionRate: 0.2 },
    trends: baseTrends,
  });

  expect(result.recommendedActions.length).toBeGreaterThan(0);
  expect(result.growthRiskFlag).toBeDefined();
});

it("AI prompt contains no PII identifiers", () => {
  const prompt = buildInterventionPrompt({
    currentMetrics: baseMetrics,
    trends: baseTrends,
    impactData: null,
    gradeBand: "G4_6",
  });

  expect(prompt).not.toContain("studentId");
  expect(prompt).not.toContain("teacherId");
  expect(prompt).not.toContain("schoolId");
  expect(prompt).not.toContain("school name");
});

it("idempotency: same inputs produce same output", async () => {
  const result1 = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: baseMetrics,
    trends: baseTrends,
  });

  const result2 = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: baseMetrics,
    trends: baseTrends,
  });

  expect(result1).toEqual(result2);
});

it("dataConfidence is low when impact is not meaningful and confidence is low", async () => {
  const result = await computeRecommendations({
    tenantId: "school-1",
    schoolId: "school-1",
    currentMetrics: baseMetrics,
    trends: baseTrends,
    impactData: {
      id: "snap-1",
      tenantId: "school-1",
      schoolId: "school-1",
      classId: null,
      period: "2026-01",
      proficiencyRate: 0.4,
      avgMasteryScore: 0.4,
      masteryDelta: 0.01,
      growthDelta: 0.01,
      effectSize: null,
      statisticallyMeaningful: false,
      confidenceLabel: "low",
      sampleSize: 5,
      generatedAt: new Date("2026-02-01T00:00:00Z"),
    },
  });

  expect(result.dataConfidence).toBe("low");
});


