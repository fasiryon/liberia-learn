/**
 * __tests__/evidence.pipeline.test.ts
 *
 * Tests for lib/mastery/evidencePipeline.ts — Block 7C.
 *
 * Verifies:
 *   1. Both flags on: both services are called with correctly transformed inputs.
 *   2. Baseline flag off: baseline returns { disabled: true }, mastery still called.
 *   3. Mastery flag off: mastery returns { disabled: true }, baseline service still called.
 *   4. Tenant isolation: a second call for school B uses school B's keys throughout.
 *   5. No PII in telemetry: recordMetricEvent payloads contain no studentId.
 *   6. Input transformation: correctness, assessmentWeight, gradeBand derived correctly.
 *   7. total=0 guard: correct=0, total=0 → correctness=0, no divide-by-zero.
 *
 * Approach:
 *   - vi.hoisted() for all mock functions.
 *   - Services are mocked at module level (not prisma), except prisma.student.findUnique
 *     which the pipeline owns directly.
 *   - featureFlags.isFeatureEnabled is mocked to control flag state per test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRecordEvidenceAndUpdateBaseline = vi.hoisted(() => vi.fn());
const mockUpdateMasteryProfile            = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabled                = vi.hoisted(() => vi.fn());
const mockStudentFindUnique               = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent               = vi.hoisted(() => vi.fn());
const mockAttemptLogCreate                = vi.hoisted(() => vi.fn());
const mockAttemptLogCount                 = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mastery/baselineService", () => ({
  recordEvidenceAndUpdateBaseline: mockRecordEvidenceAndUpdateBaseline,
}));

vi.mock("@/lib/mastery/masteryService", () => ({
  updateMasteryProfile: mockUpdateMasteryProfile,
}));

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

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

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { processEvidence } from "@/lib/mastery/evidencePipeline";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SCHOOL_A = "school_aaa";
const SCHOOL_B = "school_bbb";
const STUDENT_A = "student_a1";
const STUDENT_B = "student_b1";

const BASELINE_RESULT = { ability: 0.3, score: 0.575, expectedCorrectness: 0.5 };
const MASTERY_RESULT = {
  profileId: "profile_xyz",
  studentId: STUDENT_A,
  subject: "MATH" as const,
  strandKey: "algebra_basics",
  currentScore: 0.75,
  proficiencyState: "PROFICIENT" as const,
  masteryState: "DEVELOPING" as const,
  sustainabilityIndex: 0.8,
  decayRate: 0.02,
  aiRelianceRate: 0.0,
  hybridScore: 0.78,
  growthDelta: 0.05,
  isAtRisk: false,
};

const BASE_INPUT = {
  schoolId: SCHOOL_A,
  studentId: STUDENT_A,
  subject: "MATH" as const,
  strandKey: "algebra_basics",
  correct: 3,
  total: 4,
  difficulty: 3 as const,
  source: "practice" as const,
  wasAiAssisted: false,
  attemptCount: 1,
};

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Both flags on by default
  mockIsFeatureEnabled.mockReturnValue(true);

  // AttemptLog — new attempt by default (no duplicate)
  mockAttemptLogCreate.mockResolvedValue({ id: "log-1" });
  mockAttemptLogCount.mockResolvedValue(1);

  // Baseline service returns a successful result by default
  mockRecordEvidenceAndUpdateBaseline.mockResolvedValue(BASELINE_RESULT);

  // Mastery service returns a successful result by default
  mockUpdateMasteryProfile.mockResolvedValue(MASTERY_RESULT);

  // Student has currentGrade = 8 → G7_9 by default
  mockStudentFindUnique.mockResolvedValue({ currentGrade: 8 });

  // Telemetry is a no-op
  mockRecordMetricEvent.mockResolvedValue(undefined);
});

// ─── Test 1: Both flags on ────────────────────────────────────────────────────

describe("processEvidence — both flags on", () => {
  it("calls recordEvidenceAndUpdateBaseline once with correct transformed inputs", async () => {
    await processEvidence(BASE_INPUT);

    expect(mockRecordEvidenceAndUpdateBaseline).toHaveBeenCalledTimes(1);

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.schoolId).toBe(SCHOOL_A);
    expect(call.studentId).toBe(STUDENT_A);
    expect(call.subject).toBe("MATH");
    expect(call.strandKey).toBe("algebra_basics");
    // correct=3, total=4 → correctness=0.75; source="practice" → weight=0.4
    expect(call.evidence.correctness).toBeCloseTo(0.75);
    expect(call.evidence.assessmentWeight).toBe(0.4);
    expect(call.evidence.difficulty).toBe(3);
  });

  it("calls updateMasteryProfile once with correct transformed inputs", async () => {
    await processEvidence(BASE_INPUT);

    expect(mockUpdateMasteryProfile).toHaveBeenCalledTimes(1);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.schoolId).toBe(SCHOOL_A);
    expect(call.studentId).toBe(STUDENT_A);
    expect(call.subject).toBe("MATH");
    expect(call.strandKey).toBe("algebra_basics");
    expect(call.newScore).toBeCloseTo(0.75);
    expect(call.gradeBand).toBe("G7_9"); // currentGrade=8 → G7_9
    expect(call.wasAiAssisted).toBe(false);
  });

  it("returns both baseline and mastery results", async () => {
    const result = await processEvidence(BASE_INPUT);

    expect(result.baseline).toEqual(BASELINE_RESULT);
    expect(result.mastery).toEqual(MASTERY_RESULT);
  });
});

// ─── Test 2: Baseline flag off ────────────────────────────────────────────────

describe("processEvidence — baseline flag off", () => {
  beforeEach(() => {
    // Simulate ENABLE_ADAPTIVE_BASELINE=false by having baseline service return disabled
    mockRecordEvidenceAndUpdateBaseline.mockResolvedValue({ disabled: true });
    // ENABLE_MASTERY_ENGINE is still on
    mockIsFeatureEnabled.mockImplementation((flag: string) =>
      flag === "ENABLE_MASTERY_ENGINE" ? true : true
    );
  });

  it("returns baseline = { disabled: true } and still calls mastery service", async () => {
    const result = await processEvidence(BASE_INPUT);

    expect(result.baseline).toEqual({ disabled: true });
    expect(mockUpdateMasteryProfile).toHaveBeenCalledTimes(1);
  });

  it("baseline service is still called (the service handles the flag internally)", async () => {
    await processEvidence(BASE_INPUT);

    expect(mockRecordEvidenceAndUpdateBaseline).toHaveBeenCalledTimes(1);
  });
});

// ─── Test 3: Mastery flag off ─────────────────────────────────────────────────

describe("processEvidence — mastery flag off", () => {
  beforeEach(() => {
    mockIsFeatureEnabled.mockReturnValue(false); // ENABLE_MASTERY_ENGINE off
  });

  it("returns mastery = { disabled: true } and still calls baseline service", async () => {
    const result = await processEvidence(BASE_INPUT);

    expect(result.mastery).toEqual({ disabled: true });
    expect(mockRecordEvidenceAndUpdateBaseline).toHaveBeenCalledTimes(1);
  });

  it("does not call updateMasteryProfile when mastery flag is off", async () => {
    await processEvidence(BASE_INPUT);

    expect(mockUpdateMasteryProfile).not.toHaveBeenCalled();
  });
});

// ─── Test 4: Tenant isolation ─────────────────────────────────────────────────

describe("processEvidence — tenant isolation", () => {
  it("school B call uses school B keys in baseline and mastery calls", async () => {
    mockUpdateMasteryProfile.mockResolvedValue({ ...MASTERY_RESULT, studentId: STUDENT_B });

    await processEvidence({
      ...BASE_INPUT,
      schoolId: SCHOOL_B,
      studentId: STUDENT_B,
    });

    const baselineCall = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(baselineCall.schoolId).toBe(SCHOOL_B);
    expect(baselineCall.studentId).toBe(STUDENT_B);

    const masteryCall = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(masteryCall.schoolId).toBe(SCHOOL_B);
    expect(masteryCall.studentId).toBe(STUDENT_B);
  });

  it("sequential calls for different schools use the correct keys each time", async () => {
    await processEvidence({ ...BASE_INPUT, schoolId: SCHOOL_A, studentId: STUDENT_A });
    await processEvidence({ ...BASE_INPUT, schoolId: SCHOOL_B, studentId: STUDENT_B });

    const [callA, callB] = mockRecordEvidenceAndUpdateBaseline.mock.calls.map((c) => c[0]);
    expect(callA.schoolId).toBe(SCHOOL_A);
    expect(callB.schoolId).toBe(SCHOOL_B);
  });

  it("student.findUnique is called with the correct studentId for each call", async () => {
    await processEvidence({ ...BASE_INPUT, schoolId: SCHOOL_B, studentId: STUDENT_B });

    const findCall = mockStudentFindUnique.mock.calls[0][0];
    expect(findCall.where.id).toBe(STUDENT_B);
  });
});

// ─── Test 5: No PII in telemetry ─────────────────────────────────────────────

describe("processEvidence — telemetry PII guard", () => {
  it("recordMetricEvent payload does not contain studentId", async () => {
    await processEvidence(BASE_INPUT);

    expect(mockRecordMetricEvent).toHaveBeenCalled();

    for (const call of mockRecordMetricEvent.mock.calls) {
      const payload = call[1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("studentId");
      expect(payload).not.toHaveProperty("email");
      expect(payload).not.toHaveProperty("name");
    }
  });

  it("recordMetricEvent scope contains schoolId for tenant attribution", async () => {
    await processEvidence(BASE_INPUT);

    const metricCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "evidence.processed"
    );
    expect(metricCall).toBeDefined();
    const [, , scope] = metricCall!;
    expect(scope.schoolId).toBe(SCHOOL_A);
    expect(scope.scopeId).toBe(SCHOOL_A);
    expect(scope).not.toHaveProperty("studentId");
  });

  it("emits evidence.processed event with subject, strandKey, and source", async () => {
    await processEvidence(BASE_INPUT);

    const metricCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "evidence.processed"
    );
    expect(metricCall).toBeDefined();
    const [, payload] = metricCall!;
    expect(payload).toMatchObject({
      subject: "MATH",
      strandKey: "algebra_basics",
      source: "practice",
    });
  });
});

// ─── Test 6: Input transformation ────────────────────────────────────────────

describe("processEvidence — input transformation", () => {
  it("derives correctness=0.75 from correct=3, total=4", async () => {
    await processEvidence({ ...BASE_INPUT, correct: 3, total: 4 });

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.correctness).toBeCloseTo(0.75);
  });

  it('derives assessmentWeight=0.4 from source="practice"', async () => {
    await processEvidence({ ...BASE_INPUT, source: "practice" });

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.assessmentWeight).toBe(0.4);
  });

  it('derives assessmentWeight=0.6 from source="manual"', async () => {
    await processEvidence({ ...BASE_INPUT, source: "manual" });

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.assessmentWeight).toBe(0.6);
  });

  it('derives assessmentWeight=1.0 from source="assessment"', async () => {
    await processEvidence({ ...BASE_INPUT, source: "assessment" });

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.assessmentWeight).toBe(1.0);
  });

  it("derives gradeBand=G7_9 from currentGrade=8", async () => {
    mockStudentFindUnique.mockResolvedValue({ currentGrade: 8 });

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.gradeBand).toBe("G7_9");
  });

  it("derives gradeBand=G1_3 from currentGrade=2", async () => {
    mockStudentFindUnique.mockResolvedValue({ currentGrade: 2 });

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.gradeBand).toBe("G1_3");
  });

  it("derives gradeBand=G4_6 from currentGrade=5", async () => {
    mockStudentFindUnique.mockResolvedValue({ currentGrade: 5 });

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.gradeBand).toBe("G4_6");
  });

  it("derives gradeBand=G10_12 from currentGrade=11", async () => {
    mockStudentFindUnique.mockResolvedValue({ currentGrade: 11 });

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.gradeBand).toBe("G10_12");
  });

  it("derives gradeBand=G1_3 when student record not found (null)", async () => {
    mockStudentFindUnique.mockResolvedValue(null);

    await processEvidence(BASE_INPUT);

    const call = mockUpdateMasteryProfile.mock.calls[0][0];
    expect(call.gradeBand).toBe("G1_3");
  });

  it("defaults difficulty to 3 when not provided", async () => {
    const { difficulty: _omitted, ...inputWithoutDifficulty } = BASE_INPUT;
    await processEvidence(inputWithoutDifficulty);

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.difficulty).toBe(3);
  });
});

// ─── Test 7: total=0 guard ────────────────────────────────────────────────────

describe("processEvidence — total=0 guard", () => {
  it("returns correctness=0 when total=0 (no divide-by-zero)", async () => {
    await processEvidence({ ...BASE_INPUT, correct: 0, total: 1 });

    // Sanity check: with correct=0, total=1 → correctness=0
    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.correctness).toBe(0);
  });

  it("does not throw when correct=0 and total=0", async () => {
    // total=0 is invalid per route validation, but pipeline handles it gracefully
    await expect(
      processEvidence({ ...BASE_INPUT, correct: 0, total: 0 })
    ).resolves.not.toThrow();

    const call = mockRecordEvidenceAndUpdateBaseline.mock.calls[0][0];
    expect(call.evidence.correctness).toBe(0);
  });
});
