import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockLogAudit, mockLogAuditRequired, mockNotifySchoolSafeguarding, mockNotifyPlatformFallback } = vi.hoisted(() => ({
  mockPrisma: {
    escalationQueue: { findMany: vi.fn() },
    auditLog: { findFirst: vi.fn() },
  },
  mockLogAudit: vi.fn(),
  mockLogAuditRequired: vi.fn(),
  mockNotifySchoolSafeguarding: vi.fn(),
  mockNotifyPlatformFallback: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
  logAuditRequired: mockLogAuditRequired,
}));
vi.mock("@/lib/agents/safeguarding/notify", () => ({
  notifySchoolSafeguarding: mockNotifySchoolSafeguarding,
  notifyPlatformSafeguardingFallback: mockNotifyPlatformFallback,
}));

import { runSafeguardingSlaCheck } from "@/lib/agents/safeguarding/slaCheck";

const HOUR = 3600000;

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR);
}

describe("runSafeguardingSlaCheck", () => {
  beforeEach(() => {
    mockPrisma.escalationQueue.findMany.mockReset();
    mockPrisma.auditLog.findFirst.mockReset();
    mockLogAudit.mockReset();
    mockLogAuditRequired.mockReset();
    mockNotifySchoolSafeguarding.mockReset();
    mockNotifyPlatformFallback.mockReset();
    mockLogAudit.mockResolvedValue(true);
    mockLogAuditRequired.mockResolvedValue(undefined);
    mockNotifySchoolSafeguarding.mockResolvedValue({
      notifiedUserIds: ["admin-1"],
      intendedUserIds: ["admin-1"],
      pushDeliveredUserIds: ["admin-1"],
      fallback: null,
      delivered: true,
      failures: [],
    });
    mockNotifyPlatformFallback.mockResolvedValue({ ok: true });
    // Default: schoolId resolves, no existing SLA markers.
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
  });

  it("does nothing when there are no open safeguarding escalations", async () => {
    mockPrisma.escalationQueue.findMany.mockResolvedValue([]);

    const result = await runSafeguardingSlaCheck();

    expect(result).toEqual({
      checked: 0,
      fourHourAlertsSent: 0,
      fourHourAlertsFailed: 0,
      twentyFourHourAlertsSent: 0,
      twentyFourHourAlertsFailed: 0,
      errors: [],
    });
    expect(mockNotifySchoolSafeguarding).not.toHaveBeenCalled();
    expect(mockNotifyPlatformFallback).not.toHaveBeenCalled();
  });

  it("does not alert an escalation under 4 hours old", async () => {
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-1", reason: "safeguarding: x", createdAt: hoursAgo(1) },
    ]);

    const result = await runSafeguardingSlaCheck();

    expect(result.fourHourAlertsSent).toBe(0);
    expect(result.twentyFourHourAlertsSent).toBe(0);
    expect(mockNotifySchoolSafeguarding).not.toHaveBeenCalled();
  });

  it("fires the 4h re-notify tier once past 4 hours with no existing marker", async () => {
    mockPrisma.auditLog.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.action === "agent.escalation") return { schoolId: "school-1" };
      return null; // no SLA marker yet
    });
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-1", reason: "safeguarding: x", createdAt: hoursAgo(5) },
    ]);

    const result = await runSafeguardingSlaCheck();

    expect(result.fourHourAlertsSent).toBe(1);
    expect(result.twentyFourHourAlertsSent).toBe(0);
    expect(mockNotifySchoolSafeguarding).toHaveBeenCalledTimes(1);
    expect(mockNotifySchoolSafeguarding).toHaveBeenCalledWith("school-1", expect.stringContaining("4 hours"));
    expect(mockNotifyPlatformFallback).not.toHaveBeenCalled();
    expect(mockLogAuditRequired).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.escalation.sla_alert_4h", resourceId: "esc-1", schoolId: "school-1" })
    );
  });

  it("fires both tiers when an escalation is already over 24h old with no markers", async () => {
    mockPrisma.auditLog.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.action === "agent.escalation") return { schoolId: "school-1" };
      return null;
    });
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-1", reason: "safeguarding: x", createdAt: hoursAgo(30) },
    ]);

    const result = await runSafeguardingSlaCheck();

    expect(result.fourHourAlertsSent).toBe(1);
    expect(result.twentyFourHourAlertsSent).toBe(1);
    expect(mockNotifyPlatformFallback).toHaveBeenCalledTimes(1);
    // school gets re-notified for both the 4h and 24h tier
    expect(mockNotifySchoolSafeguarding).toHaveBeenCalledTimes(2);
  });

  it("does not re-fire the 4h tier when the marker already exists (idempotent)", async () => {
    mockPrisma.auditLog.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.action === "agent.escalation") return { schoolId: "school-1" };
      if (where.action === "agent.escalation.sla_alert_4h") return { id: "marker-1" };
      return null;
    });
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-1", reason: "safeguarding: x", createdAt: hoursAgo(5) },
    ]);

    const result = await runSafeguardingSlaCheck();

    expect(result.fourHourAlertsSent).toBe(0);
    expect(mockNotifySchoolSafeguarding).not.toHaveBeenCalled();
  });

  it("uses the platform fallback when no schoolId resolves", async () => {
    mockPrisma.auditLog.findFirst.mockResolvedValue(null); // no "agent.escalation" audit row found either
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-1", reason: "safeguarding: x", createdAt: hoursAgo(5) },
    ]);

    const result = await runSafeguardingSlaCheck();

    expect(result.fourHourAlertsSent).toBe(1);
    expect(mockNotifySchoolSafeguarding).not.toHaveBeenCalled();
    expect(mockNotifyPlatformFallback).toHaveBeenCalledTimes(1);
    expect(mockLogAuditRequired).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.escalation.sla_alert_4h", schoolId: null })
    );
  });

  it("records failure without a success marker so the next run can retry", async () => {
    mockPrisma.auditLog.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.action === "agent.escalation") return { schoolId: "school-1" };
      return null;
    });
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-1", reason: "safeguarding: x", createdAt: hoursAgo(5) },
    ]);
    mockNotifySchoolSafeguarding.mockResolvedValue({
      notifiedUserIds: [],
      intendedUserIds: ["admin-1"],
      pushDeliveredUserIds: [],
      fallback: null,
      delivered: false,
      failures: [{ channel: "inbox", userId: "admin-1", error: "database down" }],
    });

    const result = await runSafeguardingSlaCheck();

    expect(result.fourHourAlertsSent).toBe(0);
    expect(result.fourHourAlertsFailed).toBe(1);
    expect(mockLogAuditRequired).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.escalation.sla_alert_4h_failed" })
    );
  });

  it("requires confirmed platform delivery before marking the 24h tier sent", async () => {
    mockPrisma.auditLog.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.action === "agent.escalation") return { schoolId: "school-1" };
      if (where.action === "agent.escalation.sla_alert_4h") return { id: "marker-4h" };
      return null;
    });
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-1", reason: "safeguarding: x", createdAt: hoursAgo(30) },
    ]);
    mockNotifyPlatformFallback.mockResolvedValue({ ok: false, error: "domain not verified" });

    const result = await runSafeguardingSlaCheck();

    expect(result.twentyFourHourAlertsSent).toBe(0);
    expect(result.twentyFourHourAlertsFailed).toBe(1);
    expect(mockLogAuditRequired).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.escalation.sla_alert_24h_failed" })
    );
  });

  it("records an error and continues processing other escalations if one throws", async () => {
    mockPrisma.auditLog.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.action === "agent.escalation") return { schoolId: "school-1" };
      return null;
    });
    mockPrisma.escalationQueue.findMany.mockResolvedValue([
      { id: "esc-bad", reason: "safeguarding: x", createdAt: hoursAgo(5) },
      { id: "esc-good", reason: "safeguarding: y", createdAt: hoursAgo(5) },
    ]);
    mockNotifySchoolSafeguarding.mockImplementationOnce(() => {
      throw new Error("notify failed");
    });

    const result = await runSafeguardingSlaCheck();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].escalationId).toBe("esc-bad");
    expect(result.fourHourAlertsSent).toBe(1); // esc-good still succeeded
  });
});
