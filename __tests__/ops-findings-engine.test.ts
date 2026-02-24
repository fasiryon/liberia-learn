/**
 * __tests__/ops-findings-engine.test.ts
 *
 * Tests for:
 *   - All 8 deterministic rules (trigger / non-trigger)
 *   - Severity escalation for rules with multiple thresholds
 *   - Tenant scoping in runFindingsEngine
 *   - Deduplication logic
 *   - buildSafePromptContext (PII-free output)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Prisma mock ────────────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    metricEvent: { findMany: vi.fn() },
    user:        { count: vi.fn() },
    trainingProgress: { findMany: vi.fn() },
    opsFinding:  { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

// ── Training modules mock ──────────────────────────────────────────────────────

vi.mock("@/lib/training/modules", () => ({
  MODULES_BY_LEVEL: {
    1: [{ id: "l1-login-nav" }, { id: "l1-class-work" }],
    2: [{ id: "l2-create-lesson" }, { id: "l2-create-assignment" }, { id: "l2-grade-feedback" }, { id: "l2-message-guardians" }],
    3: [{ id: "l3-view-reports" }, { id: "l3-guided-tools" }],
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import {
  smsHighFailureRate,
  smsThrottleSpike,
  onboardingLowCompletion,
  onboardingAbandonSpike,
  trainingL1LowAdoption,
  trainingAbandonSpike,
  offlineDeadLetterNonzero,
  offlineConflictSpike,
  ALL_RULES,
  type RuleContext,
} from "@/lib/ops/rules";

import { runFindingsEngine, buildSafePromptContext } from "@/lib/ops/findings-engine";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const BASE_CTX: RuleContext = {
  schoolId: "school-1",
  onboarding: {
    totalCompleted: 10,
    totalDismissed: 2,
    totalReopened: 1,
    completionRate: 0.83,
    abandonRate: 0.17,
    windowHours: 168,
  },
  training: {
    totalTeachers: 10,
    l1CompletionRate: 0.50,
    l2CompletionRate: 0.30,
    l3CompletionRate: 0.10,
    totalAbandoned: 3,
    windowHours: 168,
  },
  sms: {
    sendCount: 20,
    failedCount: 2,
    failureRate: 0.09,
    throttledCount: 1,
    windowHours: 168,
  },
  offline: {
    conflictCount: 5,
    deadLetterCount: 0,
    windowHours: 168,
  },
};

function ctx(overrides: Partial<RuleContext>): RuleContext {
  return { ...BASE_CTX, ...overrides };
}

// ── SMS rules ─────────────────────────────────────────────────────────────────

describe("smsHighFailureRate rule", () => {
  it("does not fire when failureRate < 0.3", () => {
    expect(smsHighFailureRate(ctx({ sms: { ...BASE_CTX.sms, failureRate: 0.29 } }))).toBeNull();
  });

  it("fires warn when failureRate is 0.31", () => {
    const result = smsHighFailureRate(ctx({ sms: { ...BASE_CTX.sms, failureRate: 0.31 } }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warn");
    expect(result!.signalKey).toBe("sms.high_failure_rate");
    expect(result!.category).toBe("sms");
  });

  it("escalates to critical when failureRate >= 0.6", () => {
    const result = smsHighFailureRate(ctx({ sms: { ...BASE_CTX.sms, failureRate: 0.65 } }));
    expect(result!.severity).toBe("critical");
  });

  it("includes baseline and deltaPct", () => {
    const result = smsHighFailureRate(ctx({ sms: { ...BASE_CTX.sms, failureRate: 0.4 } }));
    expect(result!.baseline).toBe(0.1);
    expect(result!.deltaPct).toBeDefined();
  });

  it("recommendedFlags is empty (no flag recommended for high failure)", () => {
    const result = smsHighFailureRate(ctx({ sms: { ...BASE_CTX.sms, failureRate: 0.4 } }));
    expect(result!.recommendedFlags).toEqual([]);
  });
});

describe("smsThrottleSpike rule", () => {
  it("does not fire when throttledCount < 5", () => {
    expect(smsThrottleSpike(ctx({ sms: { ...BASE_CTX.sms, throttledCount: 4 } }))).toBeNull();
  });

  it("fires warn when throttledCount >= 5", () => {
    const result = smsThrottleSpike(ctx({ sms: { ...BASE_CTX.sms, throttledCount: 5 } }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warn");
    expect(result!.signalKey).toBe("sms.throttle_spike");
  });

  it("recommends SMS_THROTTLE_MAX_PER_WINDOW flag", () => {
    const result = smsThrottleSpike(ctx({ sms: { ...BASE_CTX.sms, throttledCount: 10 } }));
    expect(result!.recommendedFlags).toContainEqual(
      expect.objectContaining({ flag: "SMS_THROTTLE_MAX_PER_WINDOW" })
    );
  });
});

// ── Onboarding rules ──────────────────────────────────────────────────────────

describe("onboardingLowCompletion rule", () => {
  it("does not fire when completionRate >= 0.5", () => {
    expect(onboardingLowCompletion(ctx({
      onboarding: { ...BASE_CTX.onboarding, completionRate: 0.5, totalDismissed: 5 },
    }))).toBeNull();
  });

  it("does not fire when totalDismissed < 3 (low volume)", () => {
    expect(onboardingLowCompletion(ctx({
      onboarding: { ...BASE_CTX.onboarding, completionRate: 0.3, totalDismissed: 2 },
    }))).toBeNull();
  });

  it("fires when completionRate < 0.5 AND dismissed >= 3", () => {
    const result = onboardingLowCompletion(ctx({
      onboarding: { ...BASE_CTX.onboarding, completionRate: 0.4, totalDismissed: 4 },
    }));
    expect(result).not.toBeNull();
    expect(result!.signalKey).toBe("onboarding.low_completion");
    expect(result!.severity).toBe("warn");
  });

  it("recommends enabling GUIDED_ONBOARDING flag", () => {
    const result = onboardingLowCompletion(ctx({
      onboarding: { ...BASE_CTX.onboarding, completionRate: 0.3, totalDismissed: 5 },
    }));
    expect(result!.recommendedFlags).toContainEqual(
      expect.objectContaining({ flag: "NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING", setValue: "true" })
    );
  });
});

describe("onboardingAbandonSpike rule", () => {
  it("does not fire when abandonRate < 0.6", () => {
    expect(onboardingAbandonSpike(ctx({
      onboarding: { ...BASE_CTX.onboarding, abandonRate: 0.59 },
    }))).toBeNull();
  });

  it("fires warn when abandonRate >= 0.6", () => {
    const result = onboardingAbandonSpike(ctx({
      onboarding: { ...BASE_CTX.onboarding, abandonRate: 0.7 },
    }));
    expect(result).not.toBeNull();
    expect(result!.signalKey).toBe("onboarding.abandon_spike");
  });
});

// ── Training rules ────────────────────────────────────────────────────────────

describe("trainingL1LowAdoption rule", () => {
  it("does not fire when l1CompletionRate >= 0.2", () => {
    expect(trainingL1LowAdoption(ctx({
      training: { ...BASE_CTX.training, l1CompletionRate: 0.2, totalTeachers: 5 },
    }))).toBeNull();
  });

  it("does not fire when totalTeachers < 3 (too small a sample)", () => {
    expect(trainingL1LowAdoption(ctx({
      training: { ...BASE_CTX.training, l1CompletionRate: 0.05, totalTeachers: 2 },
    }))).toBeNull();
  });

  it("fires info when l1CompletionRate < 0.2 and totalTeachers >= 3", () => {
    const result = trainingL1LowAdoption(ctx({
      training: { ...BASE_CTX.training, l1CompletionRate: 0.15, totalTeachers: 5 },
    }));
    expect(result).not.toBeNull();
    expect(result!.signalKey).toBe("training.l1_low_adoption");
    expect(result!.severity).toBe("info");
  });

  it("escalates to warn when l1CompletionRate < 0.1", () => {
    const result = trainingL1LowAdoption(ctx({
      training: { ...BASE_CTX.training, l1CompletionRate: 0.05, totalTeachers: 5 },
    }));
    expect(result!.severity).toBe("warn");
  });
});

describe("trainingAbandonSpike rule", () => {
  it("does not fire when totalAbandoned < 10", () => {
    expect(trainingAbandonSpike(ctx({
      training: { ...BASE_CTX.training, totalAbandoned: 9 },
    }))).toBeNull();
  });

  it("fires info when totalAbandoned is 10–19", () => {
    const result = trainingAbandonSpike(ctx({
      training: { ...BASE_CTX.training, totalAbandoned: 15 },
    }));
    expect(result!.severity).toBe("info");
  });

  it("fires warn when totalAbandoned >= 20", () => {
    const result = trainingAbandonSpike(ctx({
      training: { ...BASE_CTX.training, totalAbandoned: 20 },
    }));
    expect(result!.severity).toBe("warn");
  });
});

// ── Offline rules ─────────────────────────────────────────────────────────────

describe("offlineDeadLetterNonzero rule", () => {
  it("does not fire when deadLetterCount is 0", () => {
    expect(offlineDeadLetterNonzero(ctx({
      offline: { ...BASE_CTX.offline, deadLetterCount: 0 },
    }))).toBeNull();
  });

  it("fires warn when deadLetterCount >= 1", () => {
    const result = offlineDeadLetterNonzero(ctx({
      offline: { ...BASE_CTX.offline, deadLetterCount: 1 },
    }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warn");
    expect(result!.signalKey).toBe("offline.deadletter_nonzero");
  });
});

describe("offlineConflictSpike rule", () => {
  it("does not fire when conflictCount < 20", () => {
    expect(offlineConflictSpike(ctx({
      offline: { ...BASE_CTX.offline, conflictCount: 19 },
    }))).toBeNull();
  });

  it("fires warn when conflictCount is 20–49", () => {
    const result = offlineConflictSpike(ctx({
      offline: { ...BASE_CTX.offline, conflictCount: 25 },
    }));
    expect(result!.severity).toBe("warn");
  });

  it("fires critical when conflictCount >= 50", () => {
    const result = offlineConflictSpike(ctx({
      offline: { ...BASE_CTX.offline, conflictCount: 50 },
    }));
    expect(result!.severity).toBe("critical");
  });
});

// ── ALL_RULES registry ────────────────────────────────────────────────────────

describe("ALL_RULES registry", () => {
  it("contains exactly 8 rules", () => {
    expect(ALL_RULES).toHaveLength(8);
  });

  it("every rule is a function", () => {
    for (const rule of ALL_RULES) {
      expect(typeof rule).toBe("function");
    }
  });

  it("no rule fires on healthy baseline context", () => {
    // All metrics are within normal ranges — no findings expected
    const candidates = ALL_RULES.map((r) => r(BASE_CTX)).filter(Boolean);
    expect(candidates).toHaveLength(0);
  });

  it("all signalKeys are unique across rules when triggered", () => {
    // Force all rules to trigger
    const badCtx: RuleContext = {
      schoolId: "school-bad",
      onboarding: { ...BASE_CTX.onboarding, completionRate: 0.2, abandonRate: 0.8, totalDismissed: 10 },
      training:   { ...BASE_CTX.training,   l1CompletionRate: 0.05, totalTeachers: 5, totalAbandoned: 25 },
      sms:        { ...BASE_CTX.sms,        failureRate: 0.7, throttledCount: 10 },
      offline:    { ...BASE_CTX.offline,    deadLetterCount: 3, conflictCount: 60 },
    };
    const fired = ALL_RULES.map((r) => r(badCtx)).filter((c): c is NonNullable<typeof c> => c !== null);
    const keys = fired.map((c) => c.signalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ── runFindingsEngine (integration) ───────────────────────────────────────────

describe("runFindingsEngine — tenant isolation + deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Simulate: no existing MetricEvents → all aggregates are zero → no rules fire
    prismaMock.metricEvent.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.trainingProgress.findMany.mockResolvedValue([]);
    prismaMock.opsFinding.findFirst.mockResolvedValue(null);
    prismaMock.opsFinding.create.mockImplementation((args: any) => ({
      id: `finding-${Math.random()}`,
      ...args.data,
    }));
  });

  it("returns zero findings when all aggregates are safe", async () => {
    const result = await runFindingsEngine("school-1");
    expect(result.totalCandidates).toBe(0);
    expect(result.created).toBe(0);
  });

  it("scopes MetricEvent query to schoolId", async () => {
    await runFindingsEngine("school-99");
    const call = prismaMock.metricEvent.findMany.mock.calls[0][0];
    expect(call.where.schoolId).toBe("school-99");
  });

  it("does not filter by schoolId when null (global scan)", async () => {
    await runFindingsEngine(null);
    const call = prismaMock.metricEvent.findMany.mock.calls[0][0];
    expect(call.where.schoolId).toBeUndefined();
  });

  it("deduplicates findings when an open finding already exists", async () => {
    // Simulate: SMS failure rate is high
    prismaMock.metricEvent.findMany.mockResolvedValue([
      ...Array(8).fill({ name: "sms.sent",   payloadJson: {} }),
      ...Array(4).fill({ name: "sms.failed", payloadJson: {} }),
    ]);
    prismaMock.user.count.mockResolvedValue(5);

    // Simulate: existing open finding for this signalKey
    prismaMock.opsFinding.findFirst.mockResolvedValue({ id: "existing-1" });

    const result = await runFindingsEngine("school-1");
    expect(result.deduped).toBeGreaterThan(0);
    expect(prismaMock.opsFinding.create).not.toHaveBeenCalled();
  });

  it("creates a finding when none exists for the signalKey", async () => {
    // High SMS failure: 4 sent, 8 failed → rate ≈ 0.67 (critical)
    prismaMock.metricEvent.findMany.mockResolvedValue([
      ...Array(4).fill({ name: "sms.sent",   payloadJson: {} }),
      ...Array(8).fill({ name: "sms.failed", payloadJson: {} }),
    ]);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.opsFinding.findFirst.mockResolvedValue(null);
    prismaMock.opsFinding.create.mockResolvedValue({
      id: "new-finding-1",
      signalKey: "sms.high_failure_rate",
    });

    const result = await runFindingsEngine("school-1");
    expect(result.created).toBeGreaterThan(0);
    expect(prismaMock.opsFinding.create).toHaveBeenCalled();
  });

  it("sets schoolId on created findings for tenant isolation", async () => {
    prismaMock.metricEvent.findMany.mockResolvedValue([
      ...Array(2).fill({ name: "sms.sent",   payloadJson: {} }),
      ...Array(8).fill({ name: "sms.failed", payloadJson: {} }),
    ]);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.opsFinding.findFirst.mockResolvedValue(null);
    prismaMock.opsFinding.create.mockImplementation((args: any) => ({ id: "f-1", ...args.data }));

    await runFindingsEngine("school-tenant-42");

    const createCall = prismaMock.opsFinding.create.mock.calls[0]?.[0];
    if (createCall) {
      expect(createCall.data.schoolId).toBe("school-tenant-42");
    }
  });
});

// ── buildSafePromptContext (PII-free) ─────────────────────────────────────────

describe("buildSafePromptContext", () => {
  const mockFinding = {
    signalKey:  "sms.high_failure_rate",
    severity:   "critical",
    category:   "sms",
    windowHours: 24,
    baseline:   0.1,
    current:    0.65,
    deltaPct:   550,
    recommendedActions: ["Check provider", "Review logs"],
    recommendedFlags:   [{ flag: "SMS_THROTTLE_ENABLED", setValue: "false" }],
  };

  it("returns an object with the expected signal keys", () => {
    const ctx = buildSafePromptContext(mockFinding);
    expect(ctx).toHaveProperty("signalKey", "sms.high_failure_rate");
    expect(ctx).toHaveProperty("severity", "critical");
    expect(ctx).toHaveProperty("category", "sms");
    expect(ctx).toHaveProperty("windowHours", 24);
    expect(ctx).toHaveProperty("baseline", 0.1);
    expect(ctx).toHaveProperty("current", 0.65);
  });

  it("contains no PII keys", () => {
    const ctx = buildSafePromptContext(mockFinding);
    const piiKeys = ["phone", "email", "name", "studentId", "guardianId", "userId", "teacherId"];
    for (const key of piiKeys) {
      expect(ctx).not.toHaveProperty(key);
    }
  });

  it("includes recommendedActions as an array", () => {
    const ctx = buildSafePromptContext(mockFinding);
    expect(Array.isArray(ctx.recommendedActions)).toBe(true);
  });

  it("handles null recommendedActions gracefully", () => {
    const ctx = buildSafePromptContext({ ...mockFinding, recommendedActions: null as any });
    expect(ctx.recommendedActions).toEqual([]);
  });

  it("handles null recommendedFlags gracefully", () => {
    const ctx = buildSafePromptContext({ ...mockFinding, recommendedFlags: null as any });
    expect(ctx.recommendedFlags).toEqual([]);
  });
});
