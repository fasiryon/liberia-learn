import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    smsDeliveryLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    guardianConsent: {
      findUnique: vi.fn(),
    },
  },
}));

const { recordMetricEventMock } = vi.hoisted(() => ({
  recordMetricEventMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: recordMetricEventMock,
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

describe("guardian SMS reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.smsDeliveryLog.findUnique.mockResolvedValue(null);
    prismaMock.student.findUnique.mockResolvedValue(baseStudent());
    prismaMock.guardianConsent.findUnique.mockResolvedValue(null);
    prismaMock.smsDeliveryLog.create.mockResolvedValue({ id: "log-1", status: "queued" });
    prismaMock.smsDeliveryLog.update.mockResolvedValue({ id: "log-1", status: "sent" });
    recordMetricEventMock.mockResolvedValue(undefined);
  });

  it("logs delivery row on send", async () => {
    const provider = {
      name: "twilio",
      send: vi.fn().mockResolvedValue({ ok: true, providerMessageId: "sid-1" }),
      normalizeError: vi.fn(),
    };

    const result = await sendGuardianSMS(
      {
        schoolId: "school-1",
        studentId: "student-1",
        guardianId: "guardian-1",
        messageType: "absence",
        payload: { studentName: "Student One", date: "2026-02-20" },
      },
      { provider, sleep: async () => {} }
    );

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
      {
        schoolId: "school-1",
        studentId: "student-1",
        guardianId: "guardian-1",
        messageType: "at_risk",
        payload: { studentName: "Student One", note: "Needs support" },
      },
      { provider, retryPolicy: { maxAttempts: 3, baseBackoffMs: 1 }, sleep: async () => {} }
    );

    expect(result.status).toBe("sent");
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(recordMetricEventMock).toHaveBeenCalledWith(
      "sms.retry",
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("respects opt-out consent and blocks without provider call", async () => {
    prismaMock.guardianConsent.findUnique.mockResolvedValue({
      id: "consent-1",
      smsOptIn: false,
      optedOutAt: new Date("2026-02-19T00:00:00.000Z"),
    });

    const provider = {
      name: "twilio",
      send: vi.fn(),
      normalizeError: vi.fn(),
    };

    const result = await sendGuardianSMS(
      {
        schoolId: "school-1",
        studentId: "student-1",
        guardianId: "guardian-1",
        messageType: "praise",
        payload: { studentName: "Student One", achievement: "Excellent work" },
      },
      { provider, sleep: async () => {} }
    );

    expect(result.status).toBe("opted_out");
    expect(provider.send).not.toHaveBeenCalled();
    expect(prismaMock.smsDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "opted_out" }),
      })
    );
  });

  it("returns existing log when idempotency key already exists", async () => {
    prismaMock.smsDeliveryLog.findUnique.mockResolvedValue({
      id: "existing-log",
      status: "sent",
    });
    const provider = {
      name: "twilio",
      send: vi.fn(),
      normalizeError: vi.fn(),
    };

    const result = await sendGuardianSMS(
      {
        schoolId: "school-1",
        studentId: "student-1",
        guardianId: "guardian-1",
        messageType: "absence",
        payload: { studentName: "Student One", date: "2026-02-20" },
        idempotencyKey: "event-abc",
      },
      { provider, sleep: async () => {} }
    );

    expect(result).toEqual({
      status: "sent",
      deliveryLogId: "existing-log",
      idempotent: true,
    });
    expect(prismaMock.smsDeliveryLog.create).not.toHaveBeenCalled();
    expect(provider.send).not.toHaveBeenCalled();
  });
});
