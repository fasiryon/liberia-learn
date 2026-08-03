import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireMoePlatformAdmin = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserCount = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockTransferCreate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/moeAccess", () => ({ requireMoePlatformAdmin: mockRequireMoePlatformAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit, logAuditRequired: mockLogAudit }));
vi.mock("@/lib/db", () => {
  const tx = {
    user: {
      findUnique: mockUserFindUnique,
      count: mockUserCount,
      update: mockUserUpdate,
    },
    platformTransferToken: {
      create: mockTransferCreate,
    },
  };
  return { prisma: { ...tx, $transaction: vi.fn(async (callback: any) => callback(tx)) } };
});

import { POST as transferPOST } from "@/app/api/platform/security/transfer/route";
import { POST as demotePOST } from "@/app/api/platform/security/demote/route";

function makeTransferReq(body: unknown) {
  return new Request("http://localhost/api/platform/security/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMoePlatformAdmin.mockResolvedValue({ id: "platform-admin-1" });
  mockUserFindUnique.mockResolvedValue({ id: "recipient-1" });
  mockUserCount.mockResolvedValue(2);
  mockUserUpdate.mockResolvedValue({});
  mockTransferCreate.mockResolvedValue({ id: "token-1" });
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/platform/security/transfer", () => {
  it("rejects unbound platform transfer token generation", async () => {
    const res = await transferPOST(makeTransferReq({}));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/intendedUserId required/i);
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("rejects missing intended recipients", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const res = await transferPOST(makeTransferReq({ intendedUserId: "missing-user" }));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/recipient not found/i);
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("creates a recipient-bound one-time transfer token without URL embedding", async () => {
    const res = await transferPOST(makeTransferReq({ intendedUserId: "recipient-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(body.acceptUrl).toBeUndefined();
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intendedUserId: "recipient-1",
          createdBy: "platform-admin-1",
        }),
      })
    );
  });

  it("does not report token generation as successful when required audit storage fails", async () => {
    mockLogAudit.mockRejectedValueOnce(new Error("audit unavailable"));
    const res = await transferPOST(makeTransferReq({ intendedUserId: "recipient-1" }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/platform/security/demote", () => {
  it("blocks self-demotion when it would leave fewer than two platform admins", async () => {
    mockUserCount.mockResolvedValueOnce(1);
    const res = await demotePOST();
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/at least 2 platform admins/i);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("demotes the current platform admin and writes audit log", async () => {
    const res = await demotePOST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.demoted).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "platform-admin-1" },
      data: { isPlatformAdmin: false },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "platform-admin-1",
        action: "platform.admin.demote",
      }),
      expect.anything()
    );
  });

  it("does not report demotion as successful when required audit storage fails", async () => {
    mockLogAudit.mockRejectedValueOnce(new Error("audit unavailable"));
    const res = await demotePOST();
    expect(res.status).toBe(500);
  });
});
