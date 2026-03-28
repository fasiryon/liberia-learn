import { describe, expect, it } from "vitest";
import {
  computeMrr,
  computePrecisionAtK,
  computeRecallAtK,
  evaluateRetrievalMetrics,
  filterRetrievedChunksByMetadata,
  getChunkEvalIdentifier,
} from "@/lib/evals/retrieval";

describe("eval retrieval metrics", () => {
  it("computes recall@k correctly", () => {
    expect(computeRecallAtK(["chunk-a", "chunk-b"], ["chunk-c", "chunk-b", "chunk-a"], 2)).toBe(0.5);
    expect(computeRecallAtK(["chunk-a", "chunk-b"], ["chunk-c", "chunk-b", "chunk-a"], 3)).toBe(1);
  });

  it("never lets recall exceed 1.0 when duplicate hits repeat the same source", () => {
    expect(
      computeRecallAtK(
        ["chunk-a"],
        ["chunk-a", "chunk-a", "chunk-a"],
        5
      )
    ).toBe(1);
  });

  it("computes precision@k correctly", () => {
    expect(computePrecisionAtK(["chunk-a", "chunk-b"], ["chunk-b", "chunk-x", "chunk-a"], 2)).toBe(0.5);
    expect(computePrecisionAtK(["chunk-a", "chunk-b"], ["chunk-b", "chunk-a"], 5)).toBe(1);
  });

  it("never lets precision exceed 1.0 when duplicate hits repeat the same source", () => {
    expect(
      computePrecisionAtK(
        ["chunk-a"],
        ["chunk-a", "chunk-a", "chunk-a"],
        5
      )
    ).toBe(1);
  });

  it("computes mrr from first relevant position", () => {
    expect(computeMrr(["chunk-z"], ["chunk-a", "chunk-z", "chunk-b"])).toBe(0.5);
    expect(computeMrr(["chunk-z"], ["chunk-a", "chunk-b"])).toBe(0);
  });

  it("filters retrieved chunks by metadata and evaluates curriculum ids using sourceLabel before sourceId", () => {
    const filtered = filterRetrievedChunksByMetadata(
      [
        {
          id: "1",
          sourceId: "math-fractions",
          sourceLabel: "wk_mca7a_mon_p1",
          sourceType: "curriculum_content",
          subject: "MATH",
          grade: 7,
          schoolId: "school-1",
        },
        {
          id: "2",
          sourceId: "policy-doc",
          sourceLabel: "docs/policy",
          sourceType: "policy_document",
          subject: null,
          grade: null,
          schoolId: null,
        },
      ],
      {
        schoolId: "school-1",
        subject: "MATH",
        grade: 7,
        sourceType: "curriculum",
      }
    );

    expect(filtered).toHaveLength(1);
    expect(getChunkEvalIdentifier(filtered[0])).toBe("wk_mca7a_mon_p1");

    const metrics = evaluateRetrievalMetrics(["wk_mca7a_mon_p1"], filtered);
    expect(metrics.recallAt5).toBe(1);
    expect(metrics.precisionAt5).toBe(1);
    expect(metrics.mrr).toBe(1);
  });

  it("counts duplicate retrieved chunk hits only once and supports legacy expected ids", () => {
    const metrics = evaluateRetrievalMetrics(
      ["wk_mca7a_tue_p1"],
      [
        {
          id: "1",
          sourceId: "math-g7-adding-fractions-like-denominators",
          sourceLabel: "wk_mca7a_tue_p1",
          sourceType: "curriculum_content",
          subject: "MATH",
          grade: 7,
          schoolId: "school-1",
        },
        {
          id: "2",
          sourceId: "math-g7-adding-fractions-like-denominators",
          sourceLabel: "wk_mca7a_tue_p1",
          sourceType: "curriculum_content",
          subject: "MATH",
          grade: 7,
          schoolId: "school-1",
        },
      ],
      5
    );

    expect(metrics.recallAt5).toBe(1);
    expect(metrics.precisionAt5).toBe(1);
    expect(metrics.relevantRetrievedCount).toBe(1);
    expect(metrics.retrievedCount).toBe(1);
  });
});
