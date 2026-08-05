import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return { ...actual, getServerSession: mocks.getServerSession };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    privilegedSessionAssurance: { create: vi.fn() },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAuditRequired: vi.fn() }));

import { requireUser } from "@/lib/auth";

const originalEnforcement = process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;

function sessionUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "admin-1",
    email: "admin@example.com",
    role: "ADMIN",
    schoolId: "school-1",
    isPlatformAdmin: false,
    iat: Math.floor(Date.now() / 1000) - 60,
    authProvider: "auth0",
    mfaVerifiedAt: Date.now() - 30_000,
    assuranceExpiresAt: Date.now() + 60_000,
    securityVersion: 3,
    privilegedSessionId: "session-1",
    ...overrides,
  };
}

function freshRecord(overrides: Record<string, unknown> = {}) {
  return {
    role: "ADMIN",
    passwordChangedAt: null,
    schoolId: "school-1",
    isPlatformAdmin: false,
    school: { status: "ACTIVE" },
    privilegedIdentity: {
      id: "identity-1",
      securityVersion: 3,
      breakGlassUntil: null,
      sessions: [{
        securityVersion: 3,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }],
    },
    ...overrides,
  };
}

describe("P1-C privileged session invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    mocks.getServerSession.mockResolvedValue({ user: sessionUser() });
    mocks.userFindUnique.mockResolvedValue(freshRecord());
  });

  afterEach(() => {
    if (originalEnforcement === undefined) {
      delete process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;
    } else {
      process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = originalEnforcement;
    }
  });

  it("accepts a session whose role, school, version, and assurance still match", async () => {
    await expect(requireUser()).resolves.toMatchObject({ id: "admin-1", role: "ADMIN" });
  });

  it("invalidates immediately after a role change", async () => {
    mocks.userFindUnique.mockResolvedValue(freshRecord({ role: "TEACHER" }));
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("invalidates immediately after a school change", async () => {
    mocks.userFindUnique.mockResolvedValue(freshRecord({ schoolId: "school-2" }));
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("invalidates immediately after an MFA security-version change", async () => {
    mocks.userFindUnique.mockResolvedValue(freshRecord({
      privilegedIdentity: {
        id: "identity-1",
        securityVersion: 4,
        breakGlassUntil: null,
        sessions: [{
          securityVersion: 3,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        }],
      },
    }));
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("fails closed when privileged assurance state cannot be read", async () => {
    mocks.userFindUnique.mockRejectedValue(new Error("database unavailable"));
    await expect(requireUser()).rejects.toThrow("database unavailable");
  });
});
