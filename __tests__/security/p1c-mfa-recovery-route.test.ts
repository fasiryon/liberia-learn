import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformAdmin: vi.fn(),
  requirePrivilegedStepUp: vi.fn(),
  userFindUnique: vi.fn(),
  identityUpdate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  transaction: vi.fn(),
  logAuditRequired: vi.fn(),
  resetAuth0Mfa: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mocks.requirePlatformAdmin,
  requirePrivilegedStepUp: mocks.requirePrivilegedStepUp,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/audit", () => ({ logAuditRequired: mocks.logAuditRequired }));
vi.mock("@/lib/auth/auth0Management", () => ({ resetAuth0Mfa: mocks.resetAuth0Mfa }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRateLimitHeaders: () => ({}),
}));

import { POST } from "@/app/api/admin/security/mfa/recovery/reset/route";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/security/mfa/recovery/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("P1-C privileged MFA recovery reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformAdmin.mockResolvedValue({
      id: "actor-1",
      role: "ADMIN",
      isPlatformAdmin: true,
      authProvider: "auth0",
      mfaVerifiedAt: Date.now(),
      assuranceExpiresAt: Date.now() + 60_000,
    });
    mocks.requirePrivilegedStepUp.mockResolvedValue({ id: "actor-1" });
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      retryAfter: 0,
      resetAt: Date.now() + 60_000,
      limit: 3,
    });
    mocks.userFindUnique.mockResolvedValue({
      id: "target-1",
      role: "MOE_OFFICIAL",
      schoolId: null,
      isPlatformAdmin: false,
      privilegedIdentity: {
        id: "identity-1",
        provider: "auth0",
        providerSubject: "auth0|target-1",
      },
    });
    mocks.identityUpdate.mockResolvedValue({ id: "identity-1", securityVersion: 4 });
    mocks.sessionUpdateMany.mockResolvedValue({ count: 2 });
    mocks.transaction.mockImplementation(async (callback: any) =>
      callback({
        privilegedIdentity: { update: mocks.identityUpdate },
        privilegedSessionAssurance: { updateMany: mocks.sessionUpdateMany },
      })
    );
    mocks.logAuditRequired.mockResolvedValue(undefined);
    mocks.resetAuth0Mfa.mockResolvedValue(undefined);
  });

  it("requires step-up, resets Auth0, bumps the version, revokes sessions, and audits", async () => {
    const response = await POST(request({
      targetUserId: "target-1",
      reason: "Support incident INC-1042",
    }));
    expect(response.status).toBe(200);
    expect(mocks.requirePrivilegedStepUp).toHaveBeenCalled();
    expect(mocks.resetAuth0Mfa).toHaveBeenCalledWith("auth0|target-1");
    expect(mocks.identityUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ securityVersion: { increment: 1 }, mfaEnrolledAt: null }),
    }));
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { identityId: "identity-1", revokedAt: null },
    }));
    expect(mocks.logAuditRequired).toHaveBeenCalledTimes(2);
  });

  it("rate limits before looking up or mutating the target identity", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfter: 120,
      resetAt: Date.now() + 120_000,
      limit: 3,
    });
    const response = await POST(request({
      targetUserId: "target-1",
      reason: "Support incident INC-1042",
    }));
    expect(response.status).toBe(429);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.resetAuth0Mfa).not.toHaveBeenCalled();
  });

  it("does not call Auth0 when the required request audit fails", async () => {
    mocks.logAuditRequired.mockRejectedValueOnce(new Error("audit unavailable"));
    const response = await POST(request({
      targetUserId: "target-1",
      reason: "Support incident INC-1042",
    }));
    expect(response.status).toBe(500);
    expect(mocks.resetAuth0Mfa).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
