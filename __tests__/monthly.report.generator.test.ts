/**
 * __tests__/monthly.report.generator.test.ts
 *
 * Tests for lib/reporting/monthly/reportGenerator.ts — Block 8.
 *
 * Covers:
 *   1. Feature flag off → returns { disabled: true }, no DB calls.
 *   2. Invalid month format → throws 400.
 *   3. Successful generation → upserts pending, then updates to completed.
 *   4. Idempotency → second call upserts the same record (same unique key).
 *   5. Aggregation failure → sets report to failed status, emits report.failed.
 *   6. Telemetry: report.generated emitted on success with no PII.
 *   7. National scope uses NATIONAL_SCOPE_ID_SENTINEL in DB.
 *   8. School scope correctly passes schoolId for tenant isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockIsFeatureEnabled         = vi.hoisted(() => vi.fn());
const mockAggregateProfilesForScope = vi.hoisted(() => vi.fn());
const mockMonthlyReportUpsert      = vi.hoisted(() => vi.fn());
const mockMonthlyReportUpdate      = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent        = vi.hoisted(() => vi.fn());

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("@/lib/reporting/monthly/aggregationService", () => ({
  aggregateProfilesForScope: mockAggregateProfilesForScope,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    monthlyReport: {
      upsert: mockMonthlyReportUpsert,
      update: mockMonthlyReportUpdate,
    },
  } as any,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import {
  generateMonthlyReport,
  NATIONAL_SCOPE_ID_SENTINEL,
  ALL_SUBJECTS_SENTINEL,
} from "@/lib/reporting/monthly/reportGenerator";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SCHOOL_A = "school_aaa";

const BASE_INPUT = {
  scope: "school" as const,
  scopeId: SCHOOL_A,
  schoolId: SCHOOL_A,
  month: "2026-01",
};

const MOCK_ROW = {
  subject: "MATH",
  strandKey: "algebra_basics",
  currentScore: 0.80,
  baselineScore: 0.60,
  growthDelta: 0.20,
  sustainabilityIndex: 0.75,
  aiRelianceRate: 0.10,
  proficiencyState: "PROFICIENT",
  masteryState: "DEVELOPING",
};

const MOCK_AGGREGATION_RESULT = {
  rows: [MOCK_ROW],
  distinctStudentCount: 10,
};

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockIsFeatureEnabled.mockReturnValue(true);
  mockAggregateProfilesForScope.mockResolvedValue(MOCK_AGGREGATION_RESULT);
  mockMonthlyReportUpsert.mockResolvedValue({ id: "report_xyz" });
  mockMonthlyReportUpdate.mockResolvedValue({ id: "report_xyz" });
  mockRecordMetricEvent.mockResolvedValue(undefined);
});

// ─── 1. Feature flag off ──────────────────────────────────────────────────────

describe("generateMonthlyReport — feature flag off", () => {
  it("returns { disabled: true } when ENABLE_MONTHLY_REPORTS is off", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const result = await generateMonthlyReport(BASE_INPUT);

    expect(result).toEqual({ disabled: true });
  });

  it("makes no DB calls when feature flag is off", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    await generateMonthlyReport(BASE_INPUT);

    expect(mockMonthlyReportUpsert).not.toHaveBeenCalled();
    expect(mockAggregateProfilesForScope).not.toHaveBeenCalled();
  });

  it("emits no telemetry when feature flag is off", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    await generateMonthlyReport(BASE_INPUT);

    expect(mockRecordMetricEvent).not.toHaveBeenCalled();
  });
});

// ─── 2. Invalid month format ──────────────────────────────────────────────────

describe("generateMonthlyReport — month validation", () => {
  it("throws 400 for invalid month format", async () => {
    await expect(
      generateMonthlyReport({ ...BASE_INPUT, month: "January 2026" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 for month with 2-digit year", async () => {
    await expect(
      generateMonthlyReport({ ...BASE_INPUT, month: "26-01" })
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ─── 3. Successful generation ─────────────────────────────────────────────────

describe("generateMonthlyReport — successful generation", () => {
  it("calls aggregateProfilesForScope with correct scope and month", async () => {
    await generateMonthlyReport(BASE_INPUT);

    expect(mockAggregateProfilesForScope).toHaveBeenCalledTimes(1);
    const call = mockAggregateProfilesForScope.mock.calls[0][0];
    expect(call.scope).toBe("school");
    expect(call.scopeId).toBe(SCHOOL_A);
    expect(call.month).toBe("2026-01");
  });

  it("creates a pending record first (upsert)", async () => {
    await generateMonthlyReport(BASE_INPUT);

    expect(mockMonthlyReportUpsert).toHaveBeenCalledTimes(1);
    const upsertCall = mockMonthlyReportUpsert.mock.calls[0][0];
    expect(upsertCall.create.status).toBe("pending");
  });

  it("updates the record to completed after aggregation", async () => {
    await generateMonthlyReport(BASE_INPUT);

    expect(mockMonthlyReportUpdate).toHaveBeenCalled();
    const updateCall = mockMonthlyReportUpdate.mock.calls.find(
      (c: any[]) => c[0].data?.status === "completed"
    );
    expect(updateCall).toBeDefined();
  });

  it("stores headline metrics in the completed update", async () => {
    await generateMonthlyReport(BASE_INPUT);

    const updateCall = mockMonthlyReportUpdate.mock.calls.find(
      (c: any[]) => c[0].data?.status === "completed"
    );
    const data = updateCall![0].data;
    expect(data.proficiencyRate).toBeDefined();
    expect(data.totalStudents).toBe(10);
    expect(data.totalStrands).toBe(1);
  });

  it("returns completed result with reportId and headline metrics", async () => {
    const result = await generateMonthlyReport(BASE_INPUT);

    expect(result).toMatchObject({
      reportId: "report_xyz",
      status: "completed",
      month: "2026-01",
      scope: "school",
      totalStudents: 10,
      totalStrands: 1,
    });
    expect("disabled" in result).toBe(false);
  });

  it("result contains tierCounts with valid keys", async () => {
    const result = await generateMonthlyReport(BASE_INPUT);

    if ("disabled" in result) throw new Error("Expected non-disabled result");
    expect(result.tierCounts).toMatchObject({
      A: expect.any(Number),
      B: expect.any(Number),
      C: expect.any(Number),
      D: expect.any(Number),
      unclassified: expect.any(Number),
    });
  });
});

// ─── 4. Idempotency ───────────────────────────────────────────────────────────

describe("generateMonthlyReport — idempotency", () => {
  it("uses upsert (not create) ensuring the same unique key on both calls", async () => {
    await generateMonthlyReport(BASE_INPUT);
    await generateMonthlyReport(BASE_INPUT);

    // Both calls should use the same unique constraint key
    expect(mockMonthlyReportUpsert).toHaveBeenCalledTimes(2);

    const [call1, call2] = mockMonthlyReportUpsert.mock.calls.map((c: any[]) => c[0]);
    expect(call1.where).toEqual(call2.where); // same unique key
  });

  it("upsert where clause includes scope, scopeId, month, subject", async () => {
    await generateMonthlyReport(BASE_INPUT);

    const upsertCall = mockMonthlyReportUpsert.mock.calls[0][0];
    const key = upsertCall.where.MonthlyReport_scope_scopeId_month_subject_key;
    expect(key.scope).toBe("school");
    expect(key.scopeId).toBe(SCHOOL_A);
    expect(key.month).toBe("2026-01");
    expect(key.subject).toBe(ALL_SUBJECTS_SENTINEL);
  });
});

// ─── 5. Aggregation failure ───────────────────────────────────────────────────

describe("generateMonthlyReport — aggregation failure", () => {
  it("marks report as failed when aggregation throws", async () => {
    mockAggregateProfilesForScope.mockRejectedValue(new Error("DB timeout"));

    await expect(generateMonthlyReport(BASE_INPUT)).rejects.toThrow("DB timeout");

    const failedUpdate = mockMonthlyReportUpdate.mock.calls.find(
      (c: any[]) => c[0].data?.status === "failed"
    );
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate![0].data.errorMessage).toBe("DB timeout");
  });

  it("emits report.failed telemetry with phase=aggregation (no PII)", async () => {
    mockAggregateProfilesForScope.mockRejectedValue(new Error("timeout"));

    await expect(generateMonthlyReport(BASE_INPUT)).rejects.toThrow();

    const failedMetric = mockRecordMetricEvent.mock.calls.find(
      ([name]: string[]) => name === "report.failed"
    );
    expect(failedMetric).toBeDefined();
    const [, payload] = failedMetric!;
    expect(payload).not.toHaveProperty("studentId");
    expect(payload).not.toHaveProperty("email");
    expect(payload.phase).toBe("aggregation");
  });
});

// ─── 6. Telemetry: no PII ─────────────────────────────────────────────────────

describe("generateMonthlyReport — telemetry PII guard", () => {
  it("emits report.generated after successful generation", async () => {
    await generateMonthlyReport(BASE_INPUT);

    const generatedEvent = mockRecordMetricEvent.mock.calls.find(
      ([name]: string[]) => name === "report.generated"
    );
    expect(generatedEvent).toBeDefined();
  });

  it("report.generated payload contains no studentId or PII", async () => {
    await generateMonthlyReport(BASE_INPUT);

    for (const call of mockRecordMetricEvent.mock.calls) {
      const payload = call[1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("studentId");
      expect(payload).not.toHaveProperty("email");
      expect(payload).not.toHaveProperty("name");
    }
  });

  it("telemetry scope contains schoolId but no studentId", async () => {
    await generateMonthlyReport(BASE_INPUT);

    for (const call of mockRecordMetricEvent.mock.calls) {
      const scope = call[2] as Record<string, unknown>;
      expect(scope.schoolId).toBe(SCHOOL_A);
      expect(scope).not.toHaveProperty("studentId");
    }
  });
});

// ─── 7. National scope sentinel ───────────────────────────────────────────────

describe("generateMonthlyReport — national scope", () => {
  it("stores NATIONAL_SCOPE_ID_SENTINEL as scopeId in DB for national reports", async () => {
    await generateMonthlyReport({
      scope: "national",
      scopeId: null,
      schoolId: null,
      month: "2026-01",
    });

    const upsertCall = mockMonthlyReportUpsert.mock.calls[0][0];
    const key = upsertCall.where.MonthlyReport_scope_scopeId_month_subject_key;
    expect(key.scopeId).toBe(NATIONAL_SCOPE_ID_SENTINEL);
  });

  it("passes null scopeId to aggregateProfilesForScope for national", async () => {
    await generateMonthlyReport({
      scope: "national",
      scopeId: null,
      schoolId: null,
      month: "2026-01",
    });

    const aggCall = mockAggregateProfilesForScope.mock.calls[0][0];
    expect(aggCall.scopeId).toBeNull();
  });

  it("returns null scopeId in the result for national scope", async () => {
    const result = await generateMonthlyReport({
      scope: "national",
      scopeId: null,
      schoolId: null,
      month: "2026-01",
    });

    if ("disabled" in result) throw new Error("Expected non-disabled result");
    expect(result.scopeId).toBeNull();
  });
});

// ─── 8. Tenant isolation ──────────────────────────────────────────────────────

describe("generateMonthlyReport — tenant isolation", () => {
  it("school B report uses school B scopeId in upsert", async () => {
    const SCHOOL_B = "school_bbb";
    await generateMonthlyReport({
      ...BASE_INPUT,
      scopeId: SCHOOL_B,
      schoolId: SCHOOL_B,
    });

    const upsertCall = mockMonthlyReportUpsert.mock.calls[0][0];
    const key = upsertCall.where.MonthlyReport_scope_scopeId_month_subject_key;
    expect(key.scopeId).toBe(SCHOOL_B);
    expect(upsertCall.create.schoolId).toBe(SCHOOL_B);
  });
});
