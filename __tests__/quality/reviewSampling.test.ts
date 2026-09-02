import { describe, expect, it } from "vitest";
import { selectSample, type SamplingPolicy } from "@/lib/quality/reviewSampling";

const policy: SamplingPolicy = { policyId: "helpfulness-default", version: 1, domain: "TUTOR_HELPFULNESS", ratePer1000: 100, minimumSample: 2, priorityTags: ["escalated"], riskEscalationRatePer1000: 1000, window: { fromHours: 24 }, owner: "quality-team" };

describe("review sampling policy", () => {
  it("is deterministic across repeated calls with the same population", () => {
    const population = Array.from({ length: 50 }, (_, i) => ({ artifactRef: `artifact-${i}`, occurredAt: "2026-09-01T00:00:00.000Z", riskTags: [] }));
    const first = selectSample(population, policy, "2026-09-01T01:00:00.000Z");
    const second = selectSample(population, policy, "2026-09-01T01:00:00.000Z");
    expect(first).toEqual(second);
  });

  it("always samples 100% of priority-risk-tagged artifacts", () => {
    const population = [{ artifactRef: "a-1", occurredAt: "2026-09-01T00:00:00.000Z", riskTags: ["escalated"] }];
    expect(selectSample(population, policy, "2026-09-01T01:00:00.000Z")).toContain("a-1");
  });

  it("respects the minimum sample floor even at a low rate", () => {
    const population = Array.from({ length: 3 }, (_, i) => ({ artifactRef: `artifact-${i}`, occurredAt: "2026-09-01T00:00:00.000Z", riskTags: [] }));
    const lowRate: SamplingPolicy = { ...policy, ratePer1000: 1 };
    expect(selectSample(population, lowRate, "2026-09-01T01:00:00.000Z").length).toBeGreaterThanOrEqual(policy.minimumSample);
  });

  it("excludes artifacts outside the policy window", () => {
    const population = [{ artifactRef: "old", occurredAt: "2026-08-01T00:00:00.000Z", riskTags: ["escalated"] }];
    expect(selectSample(population, policy, "2026-09-01T01:00:00.000Z")).toEqual([]);
  });
});
