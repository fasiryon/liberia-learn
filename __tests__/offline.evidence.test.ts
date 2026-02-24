/**
 * __tests__/offline.evidence.test.ts
 *
 * Tests for lib/mastery/evidencePipeline.ts — Block 8A AttemptLog integration.
 *
 * Verifies:
 *   1. AttemptLog.create called with correct fields.
 *   2. Idempotency key handling (provided vs generated).
 *   3. Duplicate key (P2002) → idempotent: true, downstream skipped.
 *   4. Cumulative totalAttempts / aiAssistedAttempts from AttemptLog.count.
 *   5. Flag behaviour: AttemptLog.create is unconditional.
 *   6. Tenant isolation: studentId from input.
 *   7. PII guard: no studentId in telemetry.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockAttemptLogCreate = vi.hoisted(() => vi.fn());
const mockAttemptLogCount  = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockRecordEvidenceAndUpdateBaseline = vi.hoisted(() => vi.fn());
const mockUpdateMasteryProfile            = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabled                = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent               = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    attemptLog: {
      create: mockAttemptLogCreate,
      count:  mockAttemptLogCount,
    },
    student: {
      findUnique: mockStudentFindUnique,
    },
  },
}));

vi.mock("@/lib/mastery/baselineService", () => ({
  recordEvidenceAndUpdateBaseline: mockRecordEvidenceAndUpdateBaseline,
}));

vi.mock("@/lib/mastery/masteryService", () => ({
  updateMasteryProfile: mockUpdateMasteryProfile,
}));

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { processEvidence } from "@/lib/mastery/evidencePipeline";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  schoolId: "school-aaa",
  studentId: "student-a1",
  subject: "MATH" as const,
  strandKey: "algebra_basics",
  correct: 3,
  total: 4,
  difficulty: 3 as const,
  source: "practice" as const,
  wasAiAssisted: false,
};

const BASELINE_RESULT = { ability: 0.3 };
const MASTERY_RESULT = { profileId: "profile_xyz", currentScore: 0.75 };

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockIsFeatureEnabled.mockReturnValue(true);
  mockAttemptLogCreate.mockResolvedValue({ id: "log-1" });
  mockAttemptLogCount.mockResolvedValue(1);
  mockStudentFindUnique.mockResolvedValue({ currentGrade: 8 });
  mockRecordEvidenceAndUpdateBaseline.mockResolvedValue(BASELINE_RESULT);
  mockUpdateMasteryProfile.mockResolvedValue(MASTERY_RESULT);
  mockRecordMetricEvent.mockResolvedValue(undefined);
});

// ─── AttemptLog creation ──────────────────────────────────────────────────────

describe("processEvidence — AttemptLog creation", () => {
  it("creates AttemptLog with correct fields", async () => {
    const ts = new Date("2026-02-24T10:00:00.000Z");
    await processEvidence({ ...BASE_INPUT, timestamp: ts });

    expect(mockAttemptLogCreate).toHaveBeenCalledTimes(1);
    const data = mockAttemptLogCreate.mock.calls[0][0].data;
    expect(data.studentId).toBe("student-a1");
    expect(data.subject).toBe("MATH");
    expect(data.strandKey).toBe("algebra_basics");
    expect(data.correct).toBe(3);
    expect(data.total).toBe(4);
    expect(data.source).toBe("practice");
    expect(data.difficulty).toBe(3);
    expect(data.wasAiAssisted).toBe(false);
    expect(data.timestamp).toEqual(ts);
  });

  it("uses provided idempotencyKey when given", async () => {
    await processEvidence({ ...BASE_INPUT, idempotencyKey: "client-uuid-123" });

    const data = mockAttemptLogCreate.mock.calls[0][0].data;
    expect(data.idempotencyKey).toBe("client-uuid-123");
  });

  it("generates server-side UUID when idempotencyKey omitted", async () => {
    await processEvidence(BASE_INPUT);

    const data = mockAttemptLogCreate.mock.calls[0][0].data;
    expect(typeof data.idempotencyKey).toBe("string");
    expect(data.idempotencyKey.length).toBeGreaterThan(0);
  });

  it("returns { idempotent: true } when P2002 caught on duplicate key", async () => {
    mockAttemptLogCreate.mockRejectedValue({ code: "P2002" });

    const result = await processEvidence(BASE_INPUT);

    expect(result.idempotent).toBe(true);
  });

  it("does NOT call downstream services when idempotent", async () => {
    mockAttemptLogCreate.mockRejectedValue({ code: "P2002" });

    await processEvidence(BASE_INPUT);

    expect(mockRecordEvidenceAndUpdateBaseline).not.toHaveBeenCalled();
    expect(mockUpdateMasteryProfile).not.toHaveBeenCalled();
  });
});

// ─── Cumulative attemptCount ──────────────────────────────────────────────────

describe("processEvidence — cumulative attemptCount", () => {
  it("mastery service receives totalAttempts=1 when count returns 1", async () => {
    mockAttemptLogCount.mockResolvedValue(1);

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.totalAttempts).toBe(1);
  });

  it("mastery service receives totalAttempts=3 when count returns 3", async () => {
    mockAttemptLogCount.mockResolvedValue(3);

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.totalAttempts).toBe(3);
  });

  it("mastery service receives aiAssistedAttempts=1 when aiAssisted count returns 1", async () => {
    // First call (total count) = 2, second call (aiAssisted count) = 1
    mockAttemptLogCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.aiAssistedAttempts).toBe(1);
  });

  it("mastery service receives aiAssistedAttempts=0 when aiAssisted count returns 0", async () => {
    mockAttemptLogCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.aiAssistedAttempts).toBe(0);
  });

  it("cumulative count passed to baseline service as attemptCount", async () => {
    mockAttemptLogCount.mockResolvedValue(5);

    await processEvidence(BASE_INPUT);

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.attemptCount).toBe(5);
  });
});

// ─── Flag behaviour ───────────────────────────────────────────────────────────

describe("processEvidence — flag behaviour unchanged", () => {
  it("AttemptLog.create called even when ENABLE_MASTERY_ENGINE=false", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    await processEvidence(BASE_INPUT);

    expect(mockAttemptLogCreate).toHaveBeenCalledTimes(1);
  });

  it("AttemptLog.create called when baseline returns { disabled: true }", async () => {
    mockRecordEvidenceAndUpdateBaseline.mockResolvedValue({ disabled: true });

    await processEvidence(BASE_INPUT);

    expect(mockAttemptLogCreate).toHaveBeenCalledTimes(1);
  });

  it("count queries run even when mastery flag off", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    await processEvidence(BASE_INPUT);

    expect(mockAttemptLogCount).toHaveBeenCalled();
  });
});

// ─── Tenant isolation ─────────────────────────────────────────────────────────

describe("processEvidence — tenant isolation", () => {
  it("AttemptLog.create called with studentId from input", async () => {
    await processEvidence({ ...BASE_INPUT, studentId: "student-xyz" });

    const data = mockAttemptLogCreate.mock.calls[0][0].data;
    expect(data.studentId).toBe("student-xyz");
  });

  it("count query where clause uses input.studentId", async () => {
    await processEvidence({ ...BASE_INPUT, studentId: "student-xyz" });

    const countCalls = mockAttemptLogCount.mock.calls;
    expect(countCalls.length).toBeGreaterThan(0);
    for (const call of countCalls) {
      expect(call[0].where.studentId).toBe("student-xyz");
    }
  });
});

// ─── PII guard ────────────────────────────────────────────────────────────────

describe("processEvidence — PII guard", () => {
  it("evidence.processed telemetry has no studentId", async () => {
    await processEvidence(BASE_INPUT);

    const metricCall = mockRecordMetricEvent.mock.calls.find(
      ([name]: [string]) => name === "evidence.processed"
    );
    expect(metricCall).toBeDefined();
    const payload = metricCall![1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("studentId");
  });
});
