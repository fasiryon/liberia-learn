import { describe, expect, it } from "vitest";
import {
  classifyGrade5EnglishTopic,
  isMalformedJsonError,
  phase6BatchPassRate,
  phase6ValidationFailures,
  selectBalancedGrade5EnglishTopic,
  shouldRetryTitleCollision,
  shouldStopPhase6Batch,
  topicDistribution,
} from "@/lib/curriculum/phase6GenerationSafety";

describe("Phase 6 generation safety", () => {
  it("detects malformed JSON errors for repair retry", () => {
    expect(isMalformedJsonError(new SyntaxError("Expected ',' or '}' after property value"))).toBe(true);
  });

  it("allows repaired JSON batches to pass when validation succeeds", () => {
    expect(phase6BatchPassRate({ attempted: 5, passed: 5 })).toBe(1);
  });

  it("stops when failed repairs exceed the malformed JSON threshold", () => {
    expect(
      shouldStopPhase6Batch({
        attempted: 10,
        passed: 9,
        cumulativeAttempted: 20,
        cumulativePassed: 18,
        malformedJsonAfterRepair: 4,
        titleCollisionAfterRetry: 0,
      })
    ).toBe(true);
  });

  it("detects title collisions for title retry", () => {
    expect(shouldRetryTitleCollision('Title similarity guard blocked "Understanding Adjectives"')).toBe(true);
  });

  it("stops when title collisions remain after retry", () => {
    expect(
      shouldStopPhase6Batch({
        attempted: 10,
        passed: 9,
        cumulativeAttempted: 20,
        cumulativePassed: 18,
        malformedJsonAfterRepair: 0,
        titleCollisionAfterRetry: 4,
      })
    ).toBe(true);
  });

  it("enforces topic distribution by selecting underrepresented buckets", () => {
    const distribution = topicDistribution([
      ...Array.from({ length: 30 }, () => ({ title: "Using Adjectives to Describe Markets" })),
      ...Array.from({ length: 2 }, () => ({ title: "Finding Main Idea in a Passage" })),
      ...Array.from({ length: 2 }, () => ({ title: "Writing a Clear Paragraph" })),
      ...Array.from({ length: 2 }, () => ({ title: "Using Context Clues" })),
      ...Array.from({ length: 2 }, () => ({ title: "Listening for Key Details" })),
    ]);

    expect(selectBalancedGrade5EnglishTopic({ distribution, weekNumber: 10, dayNumber: 1 }).bucket).not.toBe("grammar");
  });

  it("rejects repetitive adjective title patterns", () => {
    const failures = phase6ValidationFailures({
      title: "Using Adjectives to Describe Our Market",
      content: "A valid lesson about markets in Liberia.",
      topicBucket: "writing",
      distribution: { reading_comprehension: 10, writing: 10, grammar: 10, vocabulary: 10, speaking_listening: 10 },
    });

    expect(failures).toContain("repetitive_title_pattern");
  });

  it("rotates away from a bucket repeated three times consecutively", () => {
    const selected = selectBalancedGrade5EnglishTopic({
      distribution: { reading_comprehension: 3, writing: 3, grammar: 3, vocabulary: 3, speaking_listening: 3 },
      recentBuckets: ["vocabulary", "vocabulary", "vocabulary"],
      weekNumber: 11,
      dayNumber: 2,
    });

    expect(selected.bucket).not.toBe("vocabulary");
  });

  it("flags invalid Liberia context references", () => {
    const failures = phase6ValidationFailures({
      title: "Exploring Rivers in Liberia",
      content: "The River Congo is an important Liberian river for this lesson.",
      topicBucket: classifyGrade5EnglishTopic("reading passage about rivers"),
      distribution: { reading_comprehension: 10, writing: 10, grammar: 10, vocabulary: 10, speaking_listening: 10 },
    });

    expect(failures).toContain("invalid_context_reference");
  });
});
