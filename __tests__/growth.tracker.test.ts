import { describe, it, expect } from "vitest";
import {
  classifyGrowthRate,
  computeGrowthRatePercent,
  deriveGrowthSnapshot,
} from "@/lib/metrics/longitudinal/growthTracker";

describe("growth tracker math", () => {
  it("classifies accelerating when growthRate > +5%", () => {
    expect(classifyGrowthRate(5.01)).toBe("accelerating");
  });

  it("classifies at_risk when growthRate < -5%", () => {
    expect(classifyGrowthRate(-5.01)).toBe("at_risk");
  });

  it("classifies on_track inside [-5, +5]", () => {
    expect(classifyGrowthRate(-5)).toBe("on_track");
    expect(classifyGrowthRate(0)).toBe("on_track");
    expect(classifyGrowthRate(5)).toBe("on_track");
  });

  it("computes growthRate as current minus previous in percent points", () => {
    expect(computeGrowthRatePercent(0.72, 0.65)).toBe(7);
    expect(computeGrowthRatePercent(0.61, 0.68)).toBe(-7);
  });

  it("handles empty history gracefully", () => {
    const snapshot = deriveGrowthSnapshot(0.7, null);
    expect(snapshot.growthRate).toBe(0);
    expect(snapshot.classification).toBe("on_track");
  });
});
