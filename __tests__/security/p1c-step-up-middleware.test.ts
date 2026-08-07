import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { getToken } from "next-auth/jwt";
import { middleware } from "../../middleware";

const mockGetToken = vi.mocked(getToken);
const originalEnforcement = process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;

function request(path: string, method = "GET") {
  return new NextRequest(new URL(path, "http://localhost"), { method });
}

function token(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    role: "ADMIN",
    isPlatformAdmin: false,
    authProvider: "auth0",
    mfaVerifiedAt: now - 10_000,
    assuranceExpiresAt: now + 60_000,
    ...overrides,
  } as any;
}

describe("P1-C middleware step-up backstop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
  });

  afterEach(() => {
    if (originalEnforcement === undefined) {
      delete process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;
    } else {
      process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = originalEnforcement;
    }
  });

  it("returns 428 and an encoded step-up URL for a stale privileged export", async () => {
    mockGetToken.mockResolvedValue(token({ mfaVerifiedAt: Date.now() - 700_000 }));
    const response = await middleware(request("/api/admin/governance/exports/jobs?page=2"));
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toMatchObject({
      code: "PRIVILEGED_STEP_UP_REQUIRED",
      stepUpUrl: expect.stringContaining("callbackUrl="),
    });
  });

  it("allows a recent privileged assurance to reach the sensitive route", async () => {
    mockGetToken.mockResolvedValue(token());
    const response = await middleware(request("/api/admin/curriculum/approve", "POST"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not impose privileged MFA on an allowed non-privileged backstop caller", async () => {
    mockGetToken.mockResolvedValue({ role: "TEACHER", isPlatformAdmin: false } as any);
    const response = await middleware(request("/api/admin/ops/approvals/request-1/approve", "POST"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not require step-up for a non-sensitive platform read", async () => {
    mockGetToken.mockResolvedValue(token({ isPlatformAdmin: true, mfaVerifiedAt: null }));
    const response = await middleware(request("/api/platform/stats"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
