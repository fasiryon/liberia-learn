// __tests__/platform.security.accept.test.ts
// Verifies token security for the platform admin transfer accept route.
import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockTokenFindUnique = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: mockIsMoePortalEnabled }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    platformTransferToken: { findUnique: mockTokenFindUnique },
    $transaction: mockTransaction,
  },
}));

import { POST } from "@/app/api/platform/security/accept/route";

const VALID_TOKEN = "valid-transfer-token-abc123";
const TOKEN_HASH = crypto.createHash("sha256").update(VALID_TOKEN).digest("hex");

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    token: VALID_TOKEN,
    tokenHash: TOKEN_HASH,
    createdBy: "sender-1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    intendedUserId: null,
    ...overrides,
  };
}

function makeReq(body: unknown) {
  return new Request("http://localhost/api/platform/security/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsMoePortalEnabled.mockReturnValue(true);
  mockRequireUser.mockResolvedValue({ id: "recipient-1" });
  mockTokenFindUnique.mockResolvedValue(makeRecord());
  mockTransaction.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/platform/security/accept", () => {
  it("returns 404 when portal is disabled", async () => {
    mockIsMoePortalEnabled.mockReturnValueOnce(false);
    const res = await POST(makeReq({ token: VALID_TOKEN }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when no token is provided", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/token required/i);
  });

  it("returns 404 when token is not in database", async () => {
    mockTokenFindUnique.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ token: VALID_TOKEN }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when token has already been used", async () => {
    mockTokenFindUnique.mockResolvedValueOnce(makeRecord({ usedAt: new Date() }));
    const res = await POST(makeReq({ token: VALID_TOKEN }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already used/i);
  });

  it("returns 400 when token is expired", async () => {
    mockTokenFindUnique.mockResolvedValueOnce(
      makeRecord({ expiresAt: new Date(Date.now() - 1000) })
    );
    const res = await POST(makeReq({ token: VALID_TOKEN }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("returns 403 when token intendedUserId does not match requester", async () => {
    mockTokenFindUnique.mockResolvedValueOnce(
      makeRecord({ intendedUserId: "different-user" })
    );
    const res = await POST(makeReq({ token: VALID_TOKEN }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not issued to this user/i);
  });

  it("promotes the user and returns ok on a valid token", async () => {
    const res = await POST(makeReq({ token: VALID_TOKEN }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.promoted).toBe(true);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("accepts token when intendedUserId matches requester", async () => {
    mockTokenFindUnique.mockResolvedValueOnce(
      makeRecord({ intendedUserId: "recipient-1" })
    );
    const res = await POST(makeReq({ token: VALID_TOKEN }));
    expect(res.status).toBe(200);
  });
});
