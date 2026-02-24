/**
 * __tests__/baseline.tenant.test.ts
 *
 * Tenant isolation and feature flag tests for lib/mastery/baselineService.ts — Block 7B.
 *
 * Verifies:
 *   1. DB reads and writes are scoped to the correct (schoolId, studentId) pair.
 *   2. Telemetry payloads never include studentId (no PII).
 *   3. When ENABLE_ADAPTIVE_BASELINE is off, all three service functions
 *      return the disabled response and make no DB calls.
 *   4. Cross-tenant data is never mixed (school A's calls use school A's keys).
 *   5. setBaseline with source=initial emits the extra baseline.placed event.
 *
 * Approach:
 *   - Mock prisma, recordMetricEvent, and isFeatureEnabled via vi.hoisted().
 *   - Each test configures mocks for a specific scenario.
 *   - Assertions inspect the exact Prisma call arguments for isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (must run before any imports that use them) ────────────────

const mockIsFeatureEnabled     = vi.hoisted(() => vi.fn());
const mockFindUnique           = vi.hoisted(() => vi.fn());
const mockUpsert               = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent    = vi.hoisted(() => vi.fn());

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    studentBaselineAbility: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import {
  getBaseline,
  setBaseline,
  recordEvidenceAndUpdateBaseline,
} from "@/lib/mastery/baselineService";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SCHOOL_A = "school_aaa";
const SCHOOL_B = "school_bbb";
const STUDENT_A = "student_a1";
const STUDENT_B = "student_b1";

const BASE_ID: Parameters<typeof getBaseline>[0] = {
  schoolId: SCHOOL_A,
  studentId: STUDENT_A,
  subject: "MATH",
  strandKey: "number_sense",
};

const EVIDENCE = {
  correctness: 0.8,
  difficulty: 3 as const,
  attemptCount: 1,
  assessmentWeight: 1.0,
};

const UNIQUE_WHERE = {
  StudentBaselineAbility_schoolId_studentId_subject_strandKey_key: {
    schoolId: SCHOOL_A,
    studentId: STUDENT_A,
    subject: "MATH",
    strandKey: "number_sense",
  },
};

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockIsFeatureEnabled.mockReturnValue(true); // flag ON by default
  mockFindUnique.mockResolvedValue(null);     // no existing record
  mockUpsert.mockResolvedValue({});
  mockRecordMetricEvent.mockResolvedValue(undefined);
});

// ─── getBaseline ─────────────────────────────────────────────────────────────

describe("getBaseline — feature flag", () => {
  it("returns disabled response when flag is off (no DB call)", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const result = await getBaseline(BASE_ID);

    expect(result).toEqual({ ability: 0, score: 0.5, disabled: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("queries the DB when flag is on", async () => {
    mockFindUnique.mockResolvedValue({ ability: 0.5 });

    await getBaseline(BASE_ID);

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe("getBaseline — tenant isolation", () => {
  it("scopes the findUnique query to the correct schoolId + studentId", async () => {
    await getBaseline(BASE_ID);

    const call = mockFindUnique.mock.calls[0][0];
    expect(call.where).toEqual(UNIQUE_WHERE);
  });

  it("returns ability from the DB record when found", async () => {
    mockFindUnique.mockResolvedValue({ ability: 1.2 });

    const result = await getBaseline(BASE_ID);

    expect(result).toMatchObject({ ability: 1.2 });
    // score should be normalised: (1.2 - (-2)) / 4 = 3.2 / 4 = 0.8
    expect((result as { score: number }).score).toBeCloseTo(0.8, 5);
  });

  it("returns ability=0 when no record exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getBaseline(BASE_ID);

    expect(result).toMatchObject({ ability: 0, score: 0.5 });
  });

  it("does not mix school A data with school B request", async () => {
    await getBaseline({ ...BASE_ID, schoolId: SCHOOL_B, studentId: STUDENT_B });

    const call = mockFindUnique.mock.calls[0][0];
    const key = call.where.StudentBaselineAbility_schoolId_studentId_subject_strandKey_key;
    expect(key.schoolId).toBe(SCHOOL_B);
    expect(key.studentId).toBe(STUDENT_B);
  });
});

// ─── setBaseline ──────────────────────────────────────────────────────────────

describe("setBaseline — feature flag", () => {
  it("returns disabled and makes no DB call when flag is off", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const result = await setBaseline({ ...BASE_ID, ability: 0.5, source: "assessment" });

    expect(result).toEqual({ disabled: true });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockRecordMetricEvent).not.toHaveBeenCalled();
  });
});

describe("setBaseline — tenant isolation", () => {
  it("scopes the upsert where clause to the correct schoolId + studentId", async () => {
    await setBaseline({ ...BASE_ID, ability: 0.3, source: "assessment" });

    const call = mockUpsert.mock.calls[0][0];
    expect(call.where).toEqual(UNIQUE_WHERE);
  });

  it("writes the clamped ability value to the DB", async () => {
    await setBaseline({ ...BASE_ID, ability: 1.5, source: "assessment" });

    const call = mockUpsert.mock.calls[0][0];
    expect(call.update.ability).toBe(1.5);
    expect(call.create.ability).toBe(1.5);
  });

  it("clamps ability to ABILITY_MAX before writing", async () => {
    await setBaseline({ ...BASE_ID, ability: 99, source: "manual" });

    const call = mockUpsert.mock.calls[0][0];
    expect(call.update.ability).toBe(2);
  });

  it("clamps ability to ABILITY_MIN before writing", async () => {
    await setBaseline({ ...BASE_ID, ability: -99, source: "manual" });

    const call = mockUpsert.mock.calls[0][0];
    expect(call.update.ability).toBe(-2);
  });
});

describe("setBaseline — telemetry", () => {
  it("emits baseline.updated after a successful write", async () => {
    await setBaseline({ ...BASE_ID, ability: 0.4, source: "assessment" });

    const eventNames = mockRecordMetricEvent.mock.calls.map((c: unknown[]) => c[0]);
    expect(eventNames).toContain("baseline.updated");
  });

  it("emits baseline.placed (in addition to baseline.updated) when source is initial", async () => {
    await setBaseline({ ...BASE_ID, ability: 0, source: "initial" });

    const eventNames = mockRecordMetricEvent.mock.calls.map((c: unknown[]) => c[0]);
    expect(eventNames).toContain("baseline.updated");
    expect(eventNames).toContain("baseline.placed");
  });

  it("does not emit baseline.placed when source is practice", async () => {
    await setBaseline({ ...BASE_ID, ability: 0.2, source: "practice" });

    const eventNames = mockRecordMetricEvent.mock.calls.map((c: unknown[]) => c[0]);
    expect(eventNames).not.toContain("baseline.placed");
  });

  it("telemetry payload does not contain studentId (no PII)", async () => {
    await setBaseline({ ...BASE_ID, ability: 0.5, source: "assessment" });

    for (const call of mockRecordMetricEvent.mock.calls) {
      const payload = call[1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("studentId");
    }
  });

  it("telemetry scope contains schoolId but not studentId", async () => {
    await setBaseline({ ...BASE_ID, ability: 0.5, source: "assessment" });

    for (const call of mockRecordMetricEvent.mock.calls) {
      const scope = call[2] as Record<string, unknown>;
      expect(scope.schoolId).toBe(SCHOOL_A);
      expect(scope).not.toHaveProperty("studentId");
    }
  });
});

// ─── recordEvidenceAndUpdateBaseline ─────────────────────────────────────────

describe("recordEvidenceAndUpdateBaseline — feature flag", () => {
  it("returns disabled and makes no DB call when flag is off", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const result = await recordEvidenceAndUpdateBaseline({ ...BASE_ID, evidence: EVIDENCE });

    expect(result).toEqual({ disabled: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("recordEvidenceAndUpdateBaseline — EMA application", () => {
  it("reads the existing ability and updates it with the EMA rule", async () => {
    // Existing ability = 0; correct=0.8, D3, exam → should move ability upward
    mockFindUnique.mockResolvedValue({ ability: 0 });

    const result = await recordEvidenceAndUpdateBaseline({ ...BASE_ID, evidence: EVIDENCE });

    expect((result as { ability: number }).ability).toBeGreaterThan(0);
  });

  it("starts from ability=0 when no existing record", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await recordEvidenceAndUpdateBaseline({
      ...BASE_ID,
      evidence: { ...EVIDENCE, correctness: 0 }, // all wrong → ability drops from 0
    });

    expect((result as { ability: number }).ability).toBeLessThan(0);
  });

  it("returns expectedCorrectness from the pre-update ability (not post-update)", async () => {
    // prevAbility = 0; D3; expectedCorrectness = sigmoid(0 - 0) = 0.5
    mockFindUnique.mockResolvedValue({ ability: 0 });

    const result = await recordEvidenceAndUpdateBaseline({ ...BASE_ID, evidence: EVIDENCE });

    expect((result as { expectedCorrectness: number }).expectedCorrectness).toBeCloseTo(0.5, 5);
  });

  it("persists the new ability via upsert", async () => {
    mockFindUnique.mockResolvedValue({ ability: 0 });

    await recordEvidenceAndUpdateBaseline({ ...BASE_ID, evidence: EVIDENCE });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("recordEvidenceAndUpdateBaseline — tenant isolation", () => {
  it("uses the same schoolId for both findUnique and upsert", async () => {
    mockFindUnique.mockResolvedValue({ ability: 0 });

    await recordEvidenceAndUpdateBaseline({ ...BASE_ID, evidence: EVIDENCE });

    const findCall  = mockFindUnique.mock.calls[0][0];
    const upsertCall = mockUpsert.mock.calls[0][0];

    const findKey   = findCall.where.StudentBaselineAbility_schoolId_studentId_subject_strandKey_key;
    const upsertKey = upsertCall.where.StudentBaselineAbility_schoolId_studentId_subject_strandKey_key;

    expect(findKey.schoolId).toBe(SCHOOL_A);
    expect(upsertKey.schoolId).toBe(SCHOOL_A);
  });

  it("school B call uses school B keys throughout", async () => {
    mockFindUnique.mockResolvedValue({ ability: 0 });

    await recordEvidenceAndUpdateBaseline({
      schoolId: SCHOOL_B,
      studentId: STUDENT_B,
      subject: "SCIENCE",
      strandKey: "biology_cells",
      evidence: EVIDENCE,
    });

    const findCall  = mockFindUnique.mock.calls[0][0];
    const upsertCall = mockUpsert.mock.calls[0][0];

    const findKey   = findCall.where.StudentBaselineAbility_schoolId_studentId_subject_strandKey_key;
    const upsertKey = upsertCall.where.StudentBaselineAbility_schoolId_studentId_subject_strandKey_key;

    expect(findKey.schoolId).toBe(SCHOOL_B);
    expect(findKey.studentId).toBe(STUDENT_B);
    expect(upsertKey.schoolId).toBe(SCHOOL_B);
    expect(upsertKey.studentId).toBe(STUDENT_B);
  });
});
