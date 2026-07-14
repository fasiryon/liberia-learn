import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    smsDeliveryLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    guardianConsent: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    metricEvent: {
      findMany: vi.fn(),
    },
  },
}));

const { recordMetricEventMock, enqueueEscalationMock } = vi.hoisted(() => ({
  recordMetricEventMock: vi.fn(),
  enqueueEscalationMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: recordMetricEventMock,
}));

vi.mock("@/lib/agents/escalation", () => ({
  enqueueEscalation: enqueueEscalationMock,
}));

import { sendGuardianSMS } from "@/lib/guardian/sms-service";

function baseStudent() {
  return {
    id: "student-1",
    user: { name: "Student One", schoolId: "school-1" },
    guardians: [
      {
        guardian: {
          id: "guardian-1",
          guardianPhoneE164: "+231770000000",
          preferredChannel: "SMS",
          smsOptIn: true,
        },
      },
    ],
  };
}

function baseInput(overrides?: Record<string, unknown>) {
  return {
    schoolId: "school-1",
    studentId: "student-1",
    guardianId: "guardian-1",
    messageType: "absence" as const,
    payload: { studentName: "Student One", date: "2026-02-20" },
    ...overrides,
  };
}

function mockProvider(sendResult = { ok: true, providerMessageId: "sid-1" }) {
  return {
    name: "twilio",
    send: vi.fn().mockResolvedValue(sendResult),
    normalizeError: vi.fn(),
  };
}

// Throttle disabled by default in tests so existing cases are unaffected.
const NO_THROTTLE = { throttlePolicy: { enabled: false } };

describe("guardian SMS reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.smsDeliveryLog.findUnique.mockResolvedValue(null);
    prismaMock.student.findUnique.mockResolvedValue(baseStudent());
    prismaMock.guardianConsent.findFirst.mockResolvedValue(null);
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "queued" });
    prismaMock.smsDeliveryLog.update.mockResolvedValue({ id: "log-1", status: "sent" });
    prismaMock.smsDeliveryLog.count.mockResolvedValue(0); // not throttled by default
    prismaMock.metricEvent.findMany.mockResolvedValue([]); // no failure clustering by default
    recordMetricEventMock.mockResolvedValue(undefined);
    enqueueEscalationMock.mockResolvedValue({ id: "esc-1" });
  });

  // ----------------------------------------------------------------
  // Core delivery path
  // ----------------------------------------------------------------

  it("logs delivery row on send", async () => {
    const provider = mockProvider();

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    expect(result.status).toBe("sent");
    expect(prismaMock.smsDeliveryLog.create).toHaveBeenCalled();
    expect(prismaMock.smsDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: 1, status: "sent" }),
      })
    );
  });

  it("retries on transient failure", async () => {
    const provider = {
      name: "twilio",
      send: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: "timeout", retryable: true })
        .mockResolvedValueOnce({ ok: true, providerMessageId: "sid-2" }),
      normalizeError: vi.fn(),
    };

    const result = await sendGuardianSMS(
      baseInput({ messageType: "at_risk", payload: { studentName: "Student One", note: "Needs support" } }),
      { provider, retryPolicy: { maxAttempts: 3, baseBackoffMs: 1 }, sleep: async () => {}, ...NO_THROTTLE }
    );

    expect(result.status).toBe("sent");
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(recordMetricEventMock).toHaveBeenCalledWith(
      "sms.retry",
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("does not retry on non-retryable failure", async () => {
    const provider = {
      name: "twilio",
      send: vi.fn().mockResolvedValue({ ok: false, error: "invalid_number", retryable: false }),
      normalizeError: vi.fn(),
    };
    prismaMock.smsDeliveryLog.update.mockResolvedValue({ id: "log-1", status: "failed" });

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      retryPolicy: { maxAttempts: 3, baseBackoffMs: 1 },
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    expect(result.status).toBe("failed");
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(recordMetricEventMock).not.toHaveBeenCalledWith(
      "sms.retry",
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("returns failed after exhausting all retry attempts", async () => {
    const provider = {
      name: "twilio",
      send: vi.fn().mockResolvedValue({ ok: false, error: "gateway_error", retryable: true }),
      normalizeError: vi.fn(),
    };
    prismaMock.smsDeliveryLog.update.mockResolvedValue({ id: "log-1", status: "failed" });

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      retryPolicy: { maxAttempts: 3, baseBackoffMs: 1 },
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    expect(result.status).toBe("failed");
    expect(provider.send).toHaveBeenCalledTimes(3);
  });

  // ----------------------------------------------------------------
  // Idempotency
  // ----------------------------------------------------------------

  it("returns existing log when idempotency key already exists", async () => {
    prismaMock.smsDeliveryLog.findUnique.mockResolvedValue({
      id: "existing-log",
      status: "sent",
    });
    const provider = mockProvider();

    const result = await sendGuardianSMS(
      baseInput({ idempotencyKey: "event-abc" }),
      { provider, sleep: async () => {}, ...NO_THROTTLE }
    );

    expect(result).toEqual({
      status: "sent",
      deliveryLogId: "existing-log",
      idempotent: true,
    });
    expect(prismaMock.smsDeliveryLog.create).not.toHaveBeenCalled();
    expect(provider.send).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Opt-out / blocking paths
  // ----------------------------------------------------------------

  it("respects explicit opt-out consent and blocks without provider call", async () => {
    prismaMock.guardianConsent.findFirst.mockResolvedValue({
      id: "consent-1",
      smsOptIn: false,
      optedOutAt: new Date("2026-02-19T00:00:00.000Z"),
    });
    const provider = mockProvider();
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "opted_out" });

    const result = await sendGuardianSMS(
      baseInput({ messageType: "praise", payload: { studentName: "Student One", achievement: "Excellent work" } }),
      { provider, sleep: async () => {}, ...NO_THROTTLE }
    );

    expect(result.status).toBe("opted_out");
    expect(provider.send).not.toHaveBeenCalled();
    expect(prismaMock.smsDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "opted_out" }),
      })
    );
    expect(recordMetricEventMock).toHaveBeenCalledWith(
      "sms.blocked.opted_out",
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("treats smsOptIn=false consent record as opt-out even without optedOutAt timestamp", async () => {
    prismaMock.guardianConsent.findFirst.mockResolvedValue({
      id: "consent-2",
      smsOptIn: false,
      optedOutAt: null,
    });
    const provider = mockProvider();
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "opted_out" });

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    expect(result.status).toBe("opted_out");
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("applies fallback opt-out when no consent record exists and guardian.smsOptIn is false", async () => {
    prismaMock.guardianConsent.findFirst.mockResolvedValue(null);
    prismaMock.student.findUnique.mockResolvedValue({
      ...baseStudent(),
      guardians: [
        {
          guardian: {
            ...baseStudent().guardians[0].guardian,
            smsOptIn: false,
          },
        },
      ],
    });
    const provider = mockProvider();
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "opted_out" });

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    expect(result.status).toBe("opted_out");
    expect(provider.send).not.toHaveBeenCalled();
    expect(prismaMock.smsDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "opted_out" }),
      })
    );
  });

  it("blocks without opted_out status when guardian prefers EMAIL channel", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      ...baseStudent(),
      guardians: [
        {
          guardian: {
            ...baseStudent().guardians[0].guardian,
            preferredChannel: "EMAIL",
          },
        },
      ],
    });
    const provider = mockProvider();
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "blocked" });

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    expect(result.status).toBe("blocked");
    expect(provider.send).not.toHaveBeenCalled();
    expect(prismaMock.smsDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "blocked" }),
      })
    );
  });

  it("blocks when guardian has no phone number on record", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      ...baseStudent(),
      guardians: [
        {
          guardian: {
            ...baseStudent().guardians[0].guardian,
            guardianPhoneE164: null,
          },
        },
      ],
    });
    const provider = mockProvider();
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "blocked" });

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    expect(result.status).toBe("blocked");
    expect(provider.send).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Tenant isolation
  // ----------------------------------------------------------------

  it("throws 403 when student belongs to a different school (cross-tenant denial)", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      ...baseStudent(),
      user: { name: "Student One", schoolId: "school-OTHER" }, // different school
    });
    const provider = mockProvider();

    await expect(
      sendGuardianSMS(baseInput(), { provider, sleep: async () => {}, ...NO_THROTTLE })
    ).rejects.toMatchObject({ message: "Forbidden", status: 403 });

    expect(provider.send).not.toHaveBeenCalled();
    expect(prismaMock.smsDeliveryLog.create).not.toHaveBeenCalled();
  });

  it("includes schoolId in all Prisma queries to enforce tenant isolation", async () => {
    const provider = mockProvider();

    await sendGuardianSMS(baseInput(), {
      provider,
      sleep: async () => {},
      ...NO_THROTTLE,
    });

    // GuardianConsent lookup must be scoped by schoolId
    expect(prismaMock.guardianConsent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-1" }),
      })
    );
    // Delivery log must record schoolId for all downstream queries
    expect(prismaMock.smsDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: "school-1" }),
      })
    );
  });

  // ----------------------------------------------------------------
  // Rate-limit throttle
  // ----------------------------------------------------------------

  it("throttles when guardian exceeds per-window send limit", async () => {
    prismaMock.smsDeliveryLog.count.mockResolvedValue(3); // at limit
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "blocked" });
    const provider = mockProvider();

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      throttlePolicy: { enabled: true, windowHours: 24, maxPerWindow: 3 },
      sleep: async () => {},
    });

    expect(result.status).toBe("blocked");
    expect(provider.send).not.toHaveBeenCalled();
    expect(recordMetricEventMock).toHaveBeenCalledWith(
      "sms.throttled",
      expect.objectContaining({ windowHours: 24, maxPerWindow: 3 }),
      expect.any(Object)
    );
  });

  it("throttle count query is tenant-scoped by schoolId and guardianId", async () => {
    prismaMock.smsDeliveryLog.count.mockResolvedValue(0);
    const provider = mockProvider();

    await sendGuardianSMS(baseInput(), {
      provider,
      throttlePolicy: { enabled: true, windowHours: 24, maxPerWindow: 10 },
      sleep: async () => {},
    });

    expect(prismaMock.smsDeliveryLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          guardianId: "guardian-1",
        }),
      })
    );
  });

  it("allows send when below throttle limit", async () => {
    prismaMock.smsDeliveryLog.count.mockResolvedValue(2); // below limit of 3
    const provider = mockProvider();

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      throttlePolicy: { enabled: true, windowHours: 24, maxPerWindow: 3 },
      sleep: async () => {},
    });

    expect(result.status).toBe("sent");
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it("skips throttle check when throttle is disabled", async () => {
    const provider = mockProvider();

    await sendGuardianSMS(baseInput(), {
      provider,
      throttlePolicy: { enabled: false },
      sleep: async () => {},
    });

    expect(prismaMock.smsDeliveryLog.count).not.toHaveBeenCalled();
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it("skips throttle check when guardian is already opt-out blocked", async () => {
    prismaMock.guardianConsent.findFirst.mockResolvedValue({
      id: "consent-1",
      smsOptIn: false,
      optedOutAt: new Date("2026-02-19T00:00:00.000Z"),
    });
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "opted_out" });
    const provider = mockProvider();

    const result = await sendGuardianSMS(baseInput(), {
      provider,
      throttlePolicy: { enabled: true, windowHours: 24, maxPerWindow: 3 },
      sleep: async () => {},
    });

    // Throttle count should not be queried when already opted out
    expect(prismaMock.smsDeliveryLog.count).not.toHaveBeenCalled();
    expect(result.status).toBe("opted_out");
  });
});
