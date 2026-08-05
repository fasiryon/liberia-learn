import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  identityUpsert: vi.fn(),
  transaction: vi.fn(),
  logAuditRequired: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    privilegedSessionAssurance: { create: vi.fn() },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/audit", () => ({ logAuditRequired: mocks.logAuditRequired }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: vi.fn() }));

import { authOptions } from "@/lib/auth";

function idToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    provider: "auth0",
    providerAccountId: "auth0|admin-1",
    id_token: idToken({
      sub: "auth0|admin-1",
      amr: ["pwd", "mfa"],
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
    }),
    ...overrides,
  } as any;
}

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "admin-1",
    email: "admin@example.com",
    loginId: null,
    name: "Admin",
    role: "ADMIN",
    schoolId: "school-1",
    isPlatformAdmin: false,
    mustChangePIN: false,
    privilegedIdentity: null,
    ...overrides,
  };
}

async function signIn(user: Record<string, unknown>, auth0Account = account()) {
  return (authOptions.callbacks as any).signIn({
    user,
    account: auth0Account,
    profile: undefined,
  });
}

describe("P1-C Auth0 privileged sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue(dbUser());
    mocks.identityUpsert.mockResolvedValue({
      id: "identity-1",
      securityVersion: 1,
      mfaEnrolledAt: new Date(),
    });
    mocks.logAuditRequired.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: any) =>
      callback({ privilegedIdentity: { upsert: mocks.identityUpsert } })
    );
  });

  it("rejects an Auth0 response without the mfa AMR claim", async () => {
    const result = await signIn(
      { id: "provider-id", email: "admin@example.com" },
      account({
        id_token: idToken({
          sub: "auth0|admin-1",
          amr: ["pwd"],
          email_verified: true,
        }),
      })
    );
    expect(result).toBe("/login?error=MfaRequired");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects an unverified provider email", async () => {
    const result = await signIn(
      { id: "provider-id", email: "admin@example.com" },
      account({
        id_token: idToken({
          sub: "auth0|admin-1",
          amr: ["pwd", "mfa"],
          email_verified: false,
        }),
      })
    );
    expect(result).toBe("/login?error=MfaRequired");
  });

  it("rejects a non-privileged local account", async () => {
    mocks.userFindUnique.mockResolvedValue(dbUser({ role: "TEACHER" }));
    await expect(signIn({ id: "provider-id", email: "admin@example.com" })).resolves.toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects provider-subject substitution for an already linked identity", async () => {
    mocks.userFindUnique.mockResolvedValue(dbUser({
      privilegedIdentity: {
        id: "identity-1",
        providerSubject: "auth0|different-user",
        mfaEnrolledAt: new Date(),
      },
    }));
    await expect(signIn({ id: "provider-id", email: "admin@example.com" })).resolves.toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("links the verified provider subject and binds assurance fields to the local user", async () => {
    const user: Record<string, unknown> = { id: "provider-id", email: "ADMIN@example.com" };
    await expect(signIn(user)).resolves.toBe(true);
    expect(mocks.userFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "admin@example.com" },
    }));
    expect(mocks.identityUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ providerSubject: "auth0|admin-1" }),
    }));
    expect(mocks.logAuditRequired).toHaveBeenCalled();
    expect(user).toMatchObject({
      id: "admin-1",
      role: "ADMIN",
      authProvider: "auth0",
      securityVersion: 1,
      privilegedIdentityId: "identity-1",
    });
  });
});
