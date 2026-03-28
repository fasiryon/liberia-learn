import { describe, expect, it } from "vitest";
import {
  computeFallbackRate,
  computeGroundingScore,
  computeLengthScore,
  computeRefusalRate,
  evaluateAnswerMetrics,
} from "@/lib/evals/answer";

describe("eval answer metrics", () => {
  it("scores grounded sentences using chunk overlap", () => {
    const score = computeGroundingScore(
      "A fraction is a part of a whole. The numerator tells how many parts you have.",
      [
        {
          title: "Fractions Unit",
          content:
            "A fraction represents a part of a whole. The numerator tells how many parts you have and the denominator tells the total equal parts.",
        },
      ]
    );

    expect(score).toBe(1);
  });

  it("computes fallback and refusal rates without external scoring", () => {
    expect(computeFallbackRate([{ hadFallback: true }, { hadFallback: false }])).toBe(0.5);
    expect(
      computeRefusalRate([
        { hadFallback: false, answer: "I could not find enough approved LiberiaLearn content to answer that confidently." },
        { hadFallback: false, answer: "Fractions describe equal parts of a whole." },
      ])
    ).toBe(0.5);
  });

  it("returns length and weak-grounding friendly metrics for a single answer", () => {
    const metrics = evaluateAnswerMetrics({
      answer:
        "Weak grounding: I could not find enough approved LiberiaLearn content to answer that confidently.",
      chunks: [],
      hadFallback: true,
    });

    expect(metrics.fallbackRate).toBe(1);
    expect(metrics.refusalRate).toBe(1);
    expect(metrics.lengthScore).toBeLessThan(1);
    expect(computeLengthScore("short")).toBeLessThan(1);
  });
});
