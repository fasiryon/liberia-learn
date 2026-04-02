import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsAccountRecoveryEnabled = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockSendPasswordReset = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockPasswordResetCreate = vi.hoisted(() => vi.fn());
const mockPasswordResetFindFirst = vi.hoisted(() => vi.fn());
const mockPasswordResetUpdate = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockSessionDeleteMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/serverFlags", () => ({
  isAccountRecoveryEnabled: mockIsAccountRecoveryEnabled,
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitHeaders: vi.fn(() => ({
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + 60),
    "Retry-After": "60",
  })),
  rateLimitExceededResponse: vi.fn((result: any) =>
    Response.json(
      { error: "Too many requests", retryAfter: result?.retryAfter ?? 60 },
      { status: 429 }
    )
  ),
  RATE_LIMIT_POLICIES: {
    AUTH: { windowMs: 900_000, limit: 5 },
    ADMIN: { windowMs: 3_600_000, limit: 200 },
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordReset: mockSendPasswordReset,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    passwordResetToken: {
      create: mockPasswordResetCreate,
      findFirst: mockPasswordResetFindFirst,
      update: mockPasswordResetUpdate,
    },
    session: { deleteMany: mockSessionDeleteMany },
    $transaction: mockTransaction,
  },
}));

import { POST as forgotPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPOST } from "@/app/api/auth/reset-password/route";

function makeReq(path: string, body?: any) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAccountRecoveryEnabled.mockReturnValue(true);
  mockCheckRateLimit.mockReturnValue({
    allowed: true,
    remaining: 1,
    resetAt: Date.now() + 60000,
    limit: 5,
    retryAfter: 60,
  });
  mockSendPasswordReset.mockResolvedValue({ ok: true });
  mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
  mockPasswordResetCreate.mockResolvedValue({ id: "reset-1" });
});

describe("RR-3 account recovery", () => {
  it("forgot password is non-enumerating for unknown email", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await forgotPOST(
      makeReq("/api/auth/forgot-password", { email: "nope@test.lr" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("forgot password returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      limit: 5,
      retryAfter: 60,
    });
    const res = await forgotPOST(
      makeReq("/api/auth/forgot-password", { email: "user@test.lr" })
    );
    expect(res.status).toBe(429);
  });

  it("reset rejects expired tokens", async () => {
    mockPasswordResetFindFirst.mockResolvedValue({
      id: "reset-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      User: { schoolId: "school-1" },
    });
    const res = await resetPOST(
      makeReq("/api/auth/reset-password", {
        token: "tok-expired",
        password: "Password123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("reset rejects reused tokens", async () => {
    mockPasswordResetFindFirst.mockResolvedValue({
      id: "reset-2",
      userId: "user-2",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      User: { schoolId: "school-1" },
    });
    const res = await resetPOST(
      makeReq("/api/auth/reset-password", {
        token: "tok-used",
        password: "Password123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("account recovery routes return 404 when flag is off", async () => {
    mockIsAccountRecoveryEnabled.mockReturnValue(false);
    const res1 = await forgotPOST(
      makeReq("/api/auth/forgot-password", { email: "user@test.lr" })
    );
    const res2 = await resetPOST(
      makeReq("/api/auth/reset-password", {
        token: "tok-any",
        password: "Password123",
      })
    );
    expect(res1.status).toBe(404);
    expect(res2.status).toBe(404);
  });
});
