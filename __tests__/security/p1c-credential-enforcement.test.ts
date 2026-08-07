import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  compare: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    privilegedSessionAssurance: { create: vi.fn() },
  },
}));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/cache/redisCache", () => ({
  withRedisCache: vi.fn((_key: string, _ttl: number, callback: () => unknown) => callback()),
}));
vi.mock("@/lib/audit", () => ({ logAuditRequired: vi.fn() }));

import { authorizeCredentials } from "@/lib/auth";

const originalEnforcement = process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "admin@example.com",
    loginId: null,
    name: "Admin",
    role: "ADMIN",
    hashedPwd: "hash",
    schoolId: "school-1",
    isPlatformAdmin: false,
    mustChangePIN: false,
    school: { status: "ACTIVE" },
    privilegedIdentity: null,
    ...overrides,
  };
}

describe("P1-C local credential enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.compare.mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalEnforcement === undefined) {
      delete process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;
    } else {
      process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = originalEnforcement;
    }
  });

  it("denies a privileged password login when no break-glass grant exists", async () => {
    mocks.userFindFirst.mockResolvedValue(user());
    await expect(authorizeCredentials({
      email: "admin@example.com",
      password: "correct-password",
    })).resolves.toBeNull();
  });

  it("allows only an active break-glass grant and binds its security version", async () => {
    mocks.userFindFirst.mockResolvedValue(user({
      privilegedIdentity: {
        id: "identity-1",
        securityVersion: 7,
        breakGlassUntil: new Date(Date.now() + 10 * 60_000),
      },
    }));
    const result = await authorizeCredentials({
      email: "admin@example.com",
      password: "correct-password",
    });
    expect(result).toMatchObject({
      authProvider: "break-glass",
      securityVersion: 7,
      privilegedIdentityId: "identity-1",
    });
  });

  it("keeps non-privileged credential login behavior unchanged", async () => {
    mocks.userFindFirst.mockResolvedValue(user({ role: "TEACHER" }));
    const result = await authorizeCredentials({
      email: "admin@example.com",
      password: "correct-password",
    });
    expect(result).toMatchObject({ role: "TEACHER" });
    expect(result).not.toHaveProperty("authProvider", "break-glass");
  });
});
