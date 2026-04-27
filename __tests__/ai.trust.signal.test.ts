import { describe, expect, it } from "vitest";
import {
  buildTrustSignal,
  deriveConfidence,
  computeGroundingScore,
  SAFE_GROUNDING_THRESHOLD,
} from "@/lib/ai/trust";

describe("deriveConfidence", () => {
  it("returns high when groundingScore >= 0.85 and no fallback", () => {
    expect(deriveConfidence({ groundingScore: 0.9, hadFallback: false, retrievalWeak: false })).toBe("high");
    expect(deriveConfidence({ groundingScore: 0.85, hadFallback: false, retrievalWeak: false })).toBe("high");
  });

  it("returns medium when groundingScore >= threshold but < 0.85", () => {
    expect(deriveConfidence({ groundingScore: 0.7, hadFallback: false, retrievalWeak: false })).toBe("medium");
    expect(deriveConfidence({ groundingScore: SAFE_GROUNDING_THRESHOLD, hadFallback: false, retrievalWeak: false })).toBe("medium");
  });

  it("returns low when groundingScore < threshold", () => {
    expect(deriveConfidence({ groundingScore: 0.5, hadFallback: false, retrievalWeak: false })).toBe("low");
    expect(deriveConfidence({ groundingScore: 0, hadFallback: false, retrievalWeak: false })).toBe("low");
  });

  it("returns low when hadFallback is true regardless of score", () => {
    expect(deriveConfidence({ groundingScore: 0.95, hadFallback: true, retrievalWeak: false })).toBe("low");
  });

  it("returns low when retrievalWeak is true", () => {
    expect(deriveConfidence({ groundingScore: 0.7, hadFallback: false, retrievalWeak: true })).toBe("low");
  });
});

describe("computeGroundingScore", () => {
  it("returns 0 for empty similarities", () => {
    expect(computeGroundingScore([])).toBe(0);
  });

  it("averages similarity scores", () => {
    expect(computeGroundingScore([0.8, 0.9])).toBe(0.85);
  });

  it("clamps values above 1 to 1", () => {
    expect(computeGroundingScore([1.5, 1.0])).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    expect(computeGroundingScore([-0.5, 0.8])).toBe(0.4);
  });
});

describe("buildTrustSignal", () => {
  it("high confidence signal has no warning", () => {
    const signal = buildTrustSignal({
      groundingScore: 0.9,
      hadFallback: false,
      retrievalUsed: false,
      role: "STUDENT",
    });
    expect(signal.confidence).toBe("high");
    expect(signal.fallbackUsed).toBe(false);
    expect(signal.warning).toBeUndefined();
    expect(signal.groundingScore).toBe(0.9);
    expect(signal.generatedAt).toBeTruthy();
  });

  it("low confidence signal includes curriculum grounding warning", () => {
    const signal = buildTrustSignal({
      groundingScore: 0.4,
      hadFallback: false,
      retrievalUsed: false,
      role: "STUDENT",
    });
    expect(signal.confidence).toBe("low");
    expect(signal.warning).toMatch(/limited curriculum grounding/i);
  });

  it("fallback signal includes limited context warning", () => {
    const signal = buildTrustSignal({
      groundingScore: 0.9,
      hadFallback: true,
      retrievalUsed: false,
      role: "STUDENT",
    });
    expect(signal.confidence).toBe("low");
    expect(signal.fallbackUsed).toBe(true);
    expect(signal.warning).toMatch(/limited context/i);
  });

  it("teacher role receives explainability detail", () => {
    const signal = buildTrustSignal({
      groundingScore: 0.8,
      hadFallback: false,
      retrievalUsed: true,
      role: "TEACHER",
      sources: ["Fractions Lesson"],
    });
    expect(signal.explainability).toBeDefined();
    expect(typeof signal.explainability?.reasoningSummary).toBe("string");
  });

  it("student role does not receive explainability detail", () => {
    const signal = buildTrustSignal({
      groundingScore: 0.8,
      hadFallback: false,
      retrievalUsed: false,
      role: "STUDENT",
    });
    expect(signal.explainability).toBeUndefined();
  });

  it("passes model and provider through to signal", () => {
    const signal = buildTrustSignal({
      groundingScore: 0.75,
      hadFallback: false,
      retrievalUsed: false,
      role: "ADMIN",
      model: "gpt-4o-mini",
      provider: "openai",
    });
    expect(signal.model).toBe("gpt-4o-mini");
    expect(signal.provider).toBe("openai");
  });

  it("missing trust metadata does not throw", () => {
    expect(() =>
      buildTrustSignal({
        groundingScore: 0,
        hadFallback: false,
        retrievalUsed: false,
        role: "STUDENT",
      })
    ).not.toThrow();
  });
});
