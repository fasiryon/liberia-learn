import { describe, it, expect } from "vitest";
import { computeDropoutRisk } from "@/lib/metrics/risk/dropoutRiskEngine";

describe("dropout risk engine", () => {
  it("computes a deterministic score for a known fixture", () => {
    const result = computeDropoutRisk({
      attendance: { recentAttendanceRate: 0.6, recentSessions: 6 },
      evidenceVelocity: { recentEvidenceCount: 4, priorEvidenceCount: 10 },
      masteryDecline: {
        currentAvgMastery: 0.55,
        baselineAvgMastery: 0.7,
        decayingFraction: 0.3,
      },
      aiRelianceIncrease: { recentAiRelianceRate: 0.4, priorAiRelianceRate: 0.2 },
      assignmentCompletion: { recentCompletionRate: 0.5 },
    });

    expect(result.totalRiskScore).toBe(59);
    expect(result.riskBand).toBe("MEDIUM");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same inputs", () => {
    const input = {
      attendance: { recentAttendanceRate: 0.8, recentSessions: 10 },
      evidenceVelocity: { recentEvidenceCount: 5, priorEvidenceCount: 6 },
      masteryDecline: { currentAvgMastery: 0.7, baselineAvgMastery: 0.72 },
      aiRelianceIncrease: { recentAiRelianceRate: 0.2, priorAiRelianceRate: 0.1 },
      assignmentCompletion: { recentCompletionRate: 0.75 },
    };

    const first = computeDropoutRisk(input);
    const second = computeDropoutRisk(input);

    expect(first).toEqual(second);
  });
});
