/**
 * __tests__/mastery.tenant.test.ts
 *
 * Tenant isolation tests for lib/mastery/masteryService.ts — Block 7A.
 *
 * Verifies:
 *   1. DB writes are scoped to the correct student (no cross-tenant leakage).
 *   2. Telemetry events carry schoolId but never studentId (no PII).
 *   3. A call for school A never reads or writes school B's profiles.
 *   4. The service correctly upserts (not duplicates) on repeat calls.
 *
 * Approach:
 *   - Mock prisma and recordMetricEvent via vi.hoisted().
 *   - Each test configures the mock to simulate different DB states.
 *   - Assertions check the exact Prisma call arguments for isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (must run before any imports that use them) ────────────────

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpsert     = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    studentMasteryProfile: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { updateMasteryProfile } from "@/lib/mastery/masteryService";

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const SCHOOL_A = "school_aaa";
const SCHOOL_B = "school_bbb";
const STUDENT_A1 = "student_a1";
const STUDENT_B1 = "student_b1";

const BASE_INPUT = {
  subject: "MATH" as const,
  strandKey: "algebra_basics",
  gradeBand: "G7_9" as const,
  newScore: 0.80,
  wasAiAssisted: false,
  totalAttempts: 10,
  aiAssistedAttempts: 1,
  recentScores: [0.70, 0.75, 0.80],
  daysBetweenScores: [7, 7],
};

const MOCK_UPSERT_RESULT = { id: "profile_xyz" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("updateMasteryProfile — tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue(MOCK_UPSERT_RESULT);
    mockRecordMetricEvent.mockResolvedValue(undefined);
  });

  // ── 1. Upsert is scoped by studentId (not schoolId) ───────────────────────

  it("scopes the upsert where clause to the correct studentId", async () => {
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertCall = mockUpsert.mock.calls[0][0];

    expect(upsertCall.where).toMatchObject({
      StudentMasteryProfile_studentId_subject_strandKey_key: {
        studentId: STUDENT_A1,
        subject: "MATH",
        strandKey: "algebra_basics",
      },
    });
  });

  it("does NOT include schoolId in the upsert where clause (schoolId is not a DB filter for profiles)", async () => {
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.where).not.toHaveProperty("schoolId");
  });

  // ── 2. School A and School B produce independent profile queries ──────────

  it("uses distinct studentIds for school A and school B — no cross-tenant mixing", async () => {
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_B1, schoolId: SCHOOL_B });

    expect(mockUpsert).toHaveBeenCalledTimes(2);

    const [callA, callB] = mockUpsert.mock.calls.map((c) => c[0]);
    expect(callA.where.StudentMasteryProfile_studentId_subject_strandKey_key.studentId).toBe(STUDENT_A1);
    expect(callB.where.StudentMasteryProfile_studentId_subject_strandKey_key.studentId).toBe(STUDENT_B1);
  });

  it("findUnique is called with the correct studentId for each school", async () => {
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    const findCall = mockFindUnique.mock.calls[0][0];
    expect(findCall.where.StudentMasteryProfile_studentId_subject_strandKey_key.studentId)
      .toBe(STUDENT_A1);
  });

  // ── 3. Telemetry carries schoolId but NEVER studentId ─────────────────────

  it("emits mastery.updated with schoolId in scope but without studentId in payload", async () => {
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });

    const masteryUpdatedCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "mastery.updated"
    );
    expect(masteryUpdatedCall).toBeDefined();

    const [, payload, scope] = masteryUpdatedCall!;
    // Scope must carry schoolId for tenant attribution
    expect(scope.schoolId).toBe(SCHOOL_A);
    expect(scope.scopeId).toBe(SCHOOL_A);

    // Payload must NOT contain studentId (PII guard)
    expect(payload).not.toHaveProperty("studentId");
    expect(payload).not.toHaveProperty("studentName");
    expect(payload).not.toHaveProperty("email");
  });

  it("emits mastery.at_risk with schoolId but without studentId when student is at risk", async () => {
    await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
      newScore: 0.40, // BELOW_PROFICIENT → triggers at_risk
      recentScores: [0.4],
      daysBetweenScores: [],
    });

    const atRiskCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "mastery.at_risk"
    );
    expect(atRiskCall).toBeDefined();

    const [, payload, scope] = atRiskCall!;
    expect(scope.schoolId).toBe(SCHOOL_A);
    expect(payload).not.toHaveProperty("studentId");
  });

  it("does not emit at_risk when student is proficient", async () => {
    await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
      newScore: 0.80,
    });

    const atRiskCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "mastery.at_risk"
    );
    expect(atRiskCall).toBeUndefined();
  });

  // ── 4. Return value contains studentId but no other PII ───────────────────

  it("returns studentId in result (for caller use) but no PII fields", async () => {
    const result = await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
    });

    // studentId is needed by the caller to match the result to the student
    expect(result.studentId).toBe(STUDENT_A1);

    // No other PII should appear
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("name");
    expect(result).not.toHaveProperty("phone");
  });

  // ── 5. No duplicate upserts for the same student × strand ─────────────────

  it("calls upsert exactly once per updateMasteryProfile invocation", async () => {
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  // ── 6. Baseline is preserved from existing profile ───────────────────────

  it("uses existing baselineScore when profile already exists (not overwritten)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "existing_profile",
      baselineScore: 0.55,
      currentScore: 0.72,
      proficiencyState: "APPROACHING",
      masteryState: "DEVELOPING",
      aiRelianceRate: 0.10,
      baselineConfidence: 0.80,
      baselineCompletedAt: new Date("2026-01-01"),
    });

    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });

    const upsertCall = mockUpsert.mock.calls[0][0];
    // Create path should use existing baseline (not the new score as baseline)
    // Update path should NOT update baselineScore
    expect(upsertCall.update).not.toHaveProperty("baselineScore");
    // And block 7B baseline fields must be preserved
    expect(upsertCall.update.baselineConfidence).toBe(0.80);
  });

  it("sets baselineScore to newScore on first write (no existing profile)", async () => {
    mockFindUnique.mockResolvedValue(null);

    await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
      newScore: 0.65,
      recentScores: [0.65],
      daysBetweenScores: [],
    });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.create.baselineScore).toBe(0.65);
  });

  // ── 7. Scope passed to telemetry matches the input schoolId ───────────────

  it("all telemetry events use the scope 'school' and scopeId = schoolId", async () => {
    await updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A });

    for (const call of mockRecordMetricEvent.mock.calls) {
      const [, , scope] = call;
      expect(scope.scope).toBe("school");
      expect(scope.scopeId).toBe(SCHOOL_A);
    }
  });

  // ── 8. Decay-detected telemetry emitted when decay > threshold ────────────

  it("emits decay.detected when decayRate exceeds the alert threshold", async () => {
    // Sharp drop over a short interval produces high per-day decay
    await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
      newScore: 0.50,
      recentScores: [0.90, 0.50], // 0.40 drop in 1 day
      daysBetweenScores: [1],
    });

    const decayCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "decay.detected"
    );
    expect(decayCall).toBeDefined();
    expect(decayCall![1]).not.toHaveProperty("studentId");
  });

  // ── 9. ai.reliance.changed is only emitted on significant shifts ──────────

  it("emits ai.reliance.changed when reliance rate shifts significantly", async () => {
    // Existing rate was 0.0 (from null / new profile), new rate is 0.30 (3 out of 10)
    mockFindUnique.mockResolvedValue({
      id: "profile_001",
      baselineScore: 0.6,
      currentScore: 0.70,
      proficiencyState: "APPROACHING",
      masteryState: "DEVELOPING",
      aiRelianceRate: 0.0, // was 0
      baselineConfidence: null,
      baselineCompletedAt: null,
    });

    await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
      totalAttempts: 10,
      aiAssistedAttempts: 3, // 30% → delta 0.30 from 0.0
    });

    const relianceCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "ai.reliance.changed"
    );
    expect(relianceCall).toBeDefined();
    expect(relianceCall![1]).not.toHaveProperty("studentId");
  });

  it("does NOT emit ai.reliance.changed for tiny shifts (noise suppression)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "profile_001",
      baselineScore: 0.6,
      currentScore: 0.75,
      proficiencyState: "PROFICIENT",
      masteryState: "DEVELOPING",
      aiRelianceRate: 0.10,
      baselineConfidence: null,
      baselineCompletedAt: null,
    });

    await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
      totalAttempts: 100,
      aiAssistedAttempts: 11, // 11% → delta 0.01 from 10%
    });

    const relianceCall = mockRecordMetricEvent.mock.calls.find(
      ([name]) => name === "ai.reliance.changed"
    );
    expect(relianceCall).toBeUndefined();
  });
});

// ─── Migration safety check ───────────────────────────────────────────────────

describe("StudentMasteryProfile — backward compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue(MOCK_UPSERT_RESULT);
    mockRecordMetricEvent.mockResolvedValue(undefined);
  });

  it("handles a missing profile (null findUnique) without throwing", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      updateMasteryProfile({ ...BASE_INPUT, studentId: STUDENT_A1, schoolId: SCHOOL_A })
    ).resolves.not.toThrow();
  });

  it("produces a valid result object with all expected fields", async () => {
    const result = await updateMasteryProfile({
      ...BASE_INPUT,
      studentId: STUDENT_A1,
      schoolId: SCHOOL_A,
    });

    expect(result).toMatchObject({
      profileId: expect.any(String),
      studentId: STUDENT_A1,
      subject: "MATH",
      strandKey: "algebra_basics",
      currentScore: expect.any(Number),
      proficiencyState: expect.any(String),
      masteryState: expect.any(String),
      sustainabilityIndex: expect.any(Number),
      decayRate: expect.any(Number),
      aiRelianceRate: expect.any(Number),
      hybridScore: expect.any(Number),
      growthDelta: expect.any(Number),
      isAtRisk: expect.any(Boolean),
    });
  });
});
