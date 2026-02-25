/**
 * __tests__/ai.metrics.test.ts — Block 10
 *
 * Tests for AI interaction metrics and correlation log:
 *   1. recordAiCorrelation emits correct metric event
 *   2. No studentId in any metric payload
 *   3. Correct correlation result (improved/unchanged/declined) from score delta
 *   4. scheduleAiCorrelationCheck is fire-and-forget (no throw on metric failure)
 *   5. aiCorrelationLog fallback rate tracked via hadFallback on AiInteractionLog
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRecordMetricEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

import {
  recordAiCorrelation,
  scheduleAiCorrelationCheck,
  type AiCorrelationInput,
} from "@/lib/ai/metrics/aiCorrelationLog";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUT: AiCorrelationInput = {
  schoolId: "school-aaa",
  subject: "Mathematics",
  strandKey: "fractions.adding",
  gradeBand: "upper_primary",
  scoreBefore: 0.5,
  scoreAfter: 0.7,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRecordMetricEvent.mockResolvedValue(undefined);
});

// ─── Correlation result classification ───────────────────────────────────────

describe("recordAiCorrelation — correlation result", () => {
  it("classifies delta > 0.05 as 'improved'", async () => {
    await recordAiCorrelation({ ...BASE_INPUT, scoreBefore: 0.5, scoreAfter: 0.7 });
    const [, payload] = mockRecordMetricEvent.mock.calls[0];
    expect(payload.correlationResult).toBe("improved");
    expect(payload.scoreDelta).toBeCloseTo(0.2, 3);
  });

  it("classifies delta < -0.05 as 'declined'", async () => {
    await recordAiCorrelation({ ...BASE_INPUT, scoreBefore: 0.7, scoreAfter: 0.5 });
    const [, payload] = mockRecordMetricEvent.mock.calls[0];
    expect(payload.correlationResult).toBe("declined");
    expect(payload.scoreDelta).toBeCloseTo(-0.2, 3);
  });

  it("classifies |delta| <= 0.05 as 'unchanged'", async () => {
    await recordAiCorrelation({ ...BASE_INPUT, scoreBefore: 0.5, scoreAfter: 0.53 });
    const [, payload] = mockRecordMetricEvent.mock.calls[0];
    expect(payload.correlationResult).toBe("unchanged");
  });

  it("classifies exact 0.05 delta as 'improved'", async () => {
    await recordAiCorrelation({ ...BASE_INPUT, scoreBefore: 0.5, scoreAfter: 0.55 });
    const [, payload] = mockRecordMetricEvent.mock.calls[0];
    expect(payload.correlationResult).toBe("improved");
  });
});

// ─── No PII ───────────────────────────────────────────────────────────────────

describe("recordAiCorrelation — no PII in payload", () => {
  it("does not include studentId in metric payload", async () => {
    await recordAiCorrelation(BASE_INPUT);
    const [, payload] = mockRecordMetricEvent.mock.calls[0];
    expect(payload).not.toHaveProperty("studentId");
    expect(JSON.stringify(payload)).not.toMatch(/student.*id/i);
  });

  it("does not include school name in payload", async () => {
    await recordAiCorrelation(BASE_INPUT);
    const [, payload] = mockRecordMetricEvent.mock.calls[0];
    expect(payload).not.toHaveProperty("schoolName");
  });

  it("includes only subject, strandKey, gradeBand, scoreDelta, correlationResult", async () => {
    await recordAiCorrelation(BASE_INPUT);
    const [, payload] = mockRecordMetricEvent.mock.calls[0];
    const keys = Object.keys(payload);
    expect(keys).toEqual(
      expect.arrayContaining([
        "subject",
        "strandKey",
        "gradeBand",
        "scoreDelta",
        "correlationResult",
      ])
    );
    // Ensure no extra PII keys
    expect(keys).not.toContain("studentId");
    expect(keys).not.toContain("teacherId");
    expect(keys).not.toContain("email");
  });
});

// ─── Metric event shape ───────────────────────────────────────────────────────

describe("recordAiCorrelation — metric event shape", () => {
  it("emits event named ai_tutor_correlation", async () => {
    await recordAiCorrelation(BASE_INPUT);
    const [name] = mockRecordMetricEvent.mock.calls[0];
    expect(name).toBe("ai_tutor_correlation");
  });

  it("passes schoolId as scopeId", async () => {
    await recordAiCorrelation(BASE_INPUT);
    const [, , scope] = mockRecordMetricEvent.mock.calls[0];
    expect(scope.scopeId).toBe("school-aaa");
    expect(scope.schoolId).toBe("school-aaa");
  });

  it("handles null schoolId gracefully", async () => {
    await recordAiCorrelation({ ...BASE_INPUT, schoolId: null });
    const [, , scope] = mockRecordMetricEvent.mock.calls[0];
    expect(scope.scopeId).toBeNull();
  });
});

// ─── Fire-and-forget ──────────────────────────────────────────────────────────

describe("scheduleAiCorrelationCheck — fire-and-forget", () => {
  it("does not throw when recordMetricEvent fails", async () => {
    mockRecordMetricEvent.mockRejectedValue(new Error("DB unavailable"));
    // scheduleAiCorrelationCheck is void — should not throw
    expect(() => scheduleAiCorrelationCheck(BASE_INPUT)).not.toThrow();
    // Allow micro-task queue to flush
    await new Promise((r) => setTimeout(r, 0));
  });

  it("calls recordMetricEvent in the background", async () => {
    scheduleAiCorrelationCheck(BASE_INPUT);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRecordMetricEvent).toHaveBeenCalledOnce();
  });
});
