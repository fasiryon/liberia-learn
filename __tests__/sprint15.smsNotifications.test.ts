/**
 * Sprint 15: SMS notifications — validators, templates, STOP handler
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Phone validator tests ────────────────────────────────────────────────────
import { isValidLiberianPhone, normalizeLiberianPhone } from "@/lib/sms/validators";

describe("isValidLiberianPhone", () => {
  it("accepts a valid +231 number", () => {
    expect(isValidLiberianPhone("+231770000000")).toBe(true);
    expect(isValidLiberianPhone("+231880123456")).toBe(true);
  });

  it("rejects numbers without +231 prefix", () => {
    expect(isValidLiberianPhone("0770000000")).toBe(false);
    expect(isValidLiberianPhone("+1770000000")).toBe(false);
  });

  it("rejects numbers that are too short", () => {
    expect(isValidLiberianPhone("+231123")).toBe(false);
  });

  it("rejects numbers with spaces", () => {
    expect(isValidLiberianPhone("+231 77 000 0000")).toBe(false);
  });
});

describe("normalizeLiberianPhone", () => {
  it("passes through a valid E.164 number unchanged", () => {
    expect(normalizeLiberianPhone("+231770000000")).toBe("+231770000000");
  });

  it("adds + to a number starting with 231", () => {
    expect(normalizeLiberianPhone("231770000000")).toBe("+231770000000");
  });

  it("converts a local number with leading zero", () => {
    expect(normalizeLiberianPhone("0770000000")).toBe("+231770000000");
  });

  it("converts a 9-digit national number", () => {
    expect(normalizeLiberianPhone("770000000")).toBe("+231770000000");
  });

  it("returns null for clearly invalid input", () => {
    expect(normalizeLiberianPhone("abc")).toBeNull();
    expect(normalizeLiberianPhone("+1234567890")).toBeNull();
  });
});

// ─── Template tests ───────────────────────────────────────────────────────────
import { renderGuardianTemplate, getDefaultTemplateKey } from "@/lib/guardian/sms-templates";

describe("renderGuardianTemplate — Sprint 15 new types", () => {
  it("renders weekly_digest", () => {
    const msg = renderGuardianTemplate("weekly_digest", {
      studentName: "James",
      lessonsCompleted: 5,
      avgScore: 82,
    });
    expect(msg).toContain("James");
    expect(msg).toContain("5");
    expect(msg).toContain("82");
    expect(msg).toContain("STOP");
  });

  it("renders assignment_due", () => {
    const msg = renderGuardianTemplate("assignment_due", {
      studentName: "Mary",
      subject: "Mathematics",
      dueDate: "2026-04-20",
    });
    expect(msg).toContain("Mary");
    expect(msg).toContain("Mathematics");
    expect(msg).toContain("2026-04-20");
  });

  it("renders certificate_awarded", () => {
    const msg = renderGuardianTemplate("certificate_awarded", {
      studentName: "David",
      subject: "Science",
      certificateCode: "CERT-2026-XYZ",
    });
    expect(msg).toContain("David");
    expect(msg).toContain("Science");
    expect(msg).toContain("CERT-2026-XYZ");
  });

  it("throws when required fields are missing", () => {
    expect(() =>
      renderGuardianTemplate("weekly_digest", {
        studentName: "James",
        // missing lessonsCompleted and avgScore
      } as any)
    ).toThrow();
  });

  it("getDefaultTemplateKey maps new types", () => {
    expect(getDefaultTemplateKey("weekly_digest")).toBe("weekly_digest");
    expect(getDefaultTemplateKey("assignment_due")).toBe("assignment_due");
    expect(getDefaultTemplateKey("certificate_awarded")).toBe("certificate_awarded");
    expect(getDefaultTemplateKey("custom")).toBeNull();
  });
});

// ─── STOP route handler tests ─────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    guardianConsent: {
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/sms/stop/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, string>, contentType = "application/x-www-form-urlencoded") {
  const encoded = new URLSearchParams(body).toString();
  return new NextRequest("http://localhost/api/sms/stop", {
    method: "POST",
    headers: { "content-type": contentType },
    body: encoded,
  });
}

describe("POST /api/sms/stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when body is missing", async () => {
    const req = new NextRequest("http://localhost/api/sms/stop", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("acknowledges non-STOP messages without opting out", async () => {
    const req = makeRequest({ From: "+231770000000", Body: "Hello" });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("opts out a guardian when STOP is received and phone matches", async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: "guardian-1",
      schoolId: "school-1",
      guardianOf: [{ studentId: "student-1" }],
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.guardianConsent.upsert.mockResolvedValueOnce({});
    prismaMock.auditLog.create.mockResolvedValueOnce({});

    const req = makeRequest({ From: "+231770000000", Body: "STOP" });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.optedOut).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { smsOptIn: false } })
    );
  });

  it("returns 200 with received:true when no guardian found (no retry loops)", async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.auditLog.create.mockResolvedValueOnce({});

    const req = makeRequest({ From: "+231999999999", Body: "stop" });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.optedOut).toBeUndefined();
  });

  it("handles UNSUBSCRIBE keyword", async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: "guardian-2",
      schoolId: "school-1",
      guardianOf: [],
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.auditLog.create.mockResolvedValueOnce({});

    const req = makeRequest({ From: "+231770111222", Body: "UNSUBSCRIBE" });
    const res = await POST(req);
    const data = await res.json();
    expect(data.optedOut).toBe(true);
  });
});

// ─── dispatchSmsNotification tests ───────────────────────────────────────────
const { sendGuardianSMSMock } = vi.hoisted(() => ({
  sendGuardianSMSMock: vi.fn(),
}));

vi.mock("@/lib/guardian/sms-service", () => ({
  sendGuardianSMS: sendGuardianSMSMock,
}));

describe("dispatchSmsNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it("blocks dispatch when guardianPhone is not a valid Liberian E.164 number", async () => {
    const { dispatchSmsNotification } = await import("@/lib/guardian/sms-notifications");
    const result = await dispatchSmsNotification({
      schoolId: "school-1",
      studentId: "student-1",
      guardianId: "guardian-1",
      messageType: "weekly_digest",
      payload: { studentName: "James", lessonsCompleted: 3, avgScore: 75 },
      guardianPhone: "+1555000000", // US number — invalid for Liberia
    });
    expect(result.dispatched).toBe(false);
    expect(result.reason).toBe("invalid_phone_format");
    expect(sendGuardianSMSMock).not.toHaveBeenCalled();
  });

  it("dispatches when phone is valid Liberian E.164", async () => {
    sendGuardianSMSMock.mockResolvedValueOnce({ status: "sent", deliveryLogId: "log-1" });

    const { dispatchSmsNotification } = await import("@/lib/guardian/sms-notifications");
    const result = await dispatchSmsNotification({
      schoolId: "school-1",
      studentId: "student-1",
      guardianId: "guardian-1",
      messageType: "assignment_due",
      payload: { studentName: "Mary", subject: "Math", dueDate: "2026-04-20" },
      guardianPhone: "+231770000000",
    });
    expect(result.dispatched).toBe(true);
  });

  it("dispatches when no phone provided (phone validation skipped)", async () => {
    sendGuardianSMSMock.mockResolvedValueOnce({ status: "sent", deliveryLogId: "log-2" });

    const { dispatchSmsNotification } = await import("@/lib/guardian/sms-notifications");
    const result = await dispatchSmsNotification({
      schoolId: "school-1",
      studentId: "student-1",
      guardianId: "guardian-1",
      messageType: "certificate_awarded",
      payload: {
        studentName: "David",
        subject: "Science",
        certificateCode: "CERT-001",
      },
    });
    expect(result.dispatched).toBe(true);
  });
});
