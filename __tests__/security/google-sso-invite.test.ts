import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserCreate = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockInviteTokenFindFirst = vi.hoisted(() => vi.fn());
const mockInviteTokenCreate = vi.hoisted(() => vi.fn());
const mockInviteTokenFindFirstAdmin = vi.hoisted(() => vi.fn());
const mockInviteTokenUpdate = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ allowed: true, remaining: 9 })
);
const mockRedisCache = vi.hoisted(() =>
  vi.fn().mockImplementation((_key: string, _ttl: number, fn: () => unknown) => fn())
);
const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: vi.fn(),
      create: mockUserCreate,
      update: mockUserUpdate,
    },
    inviteToken: {
      findFirst: mockInviteTokenFindFirst,
      findFirstAdmin: mockInviteTokenFindFirstAdmin,
      create: mockInviteTokenCreate,
      update: mockInviteTokenUpdate,
    },
    auditLog: { create: mockAuditLogCreate },
  },
}));

vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: mockRedisCache }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn().mockResolvedValue(false) },
  compare: vi.fn().mockResolvedValue(false),
}));

// Partial mock of @/lib/auth: keep real authOptions but allow requireRole to be overridden.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireRole: mockRequireRole };
});

import { authOptions } from "@/lib/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

const googleAccount = { provider: "google", providerAccountId: "gid-1" } as any;

function googleUser(email: string, name = "Test Teacher") {
  return { id: "google-uid-1", email, name } as any;
}

async function callSignIn(user: any, account: any) {
  return (authOptions.callbacks as any).signIn({ user, account, profile: undefined });
}

// ── Tests: SSO signIn callback ────────────────────────────────────────────────

describe("NR-8 Google SSO — signIn callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue({});
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("9. existing teacher, school SSO enabled → links googleId, returns true", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      role: "TEACHER",
      googleId: null,
      schoolId: "school-x",
      school: { googleSsoEnabled: true },
    });
    mockUserUpdate.mockResolvedValue({});

    const result = await callSignIn(googleUser("teacher@school.lr"), googleAccount);

    expect(result).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "teacher@school.lr" } })
    );
  });

  it("10. new Google user, no invite → returns /login?error=InviteRequired", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockInviteTokenFindFirst.mockResolvedValue(null);

    const result = await callSignIn(googleUser("new@school.lr"), googleAccount);

    expect(result).toBe("/login?error=InviteRequired");
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("11. new user, valid invite → creates account with schoolId from invite", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockInviteTokenFindFirst.mockResolvedValue({
      id: "inv-1",
      schoolId: "school-abc",
      role: "TEACHER",
    });
    mockUserCreate.mockResolvedValue({ id: "new-user-1", schoolId: "school-abc" });
    mockInviteTokenUpdate.mockResolvedValue({});

    const result = await callSignIn(googleUser("new@school.lr"), googleAccount);

    expect(result).toBe(true);
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-abc",
          role: "TEACHER",
          email: "new@school.lr",
        }),
      })
    );
    expect(mockInviteTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: { usedAt: expect.any(Date) },
      })
    );
  });

  it("12. new user, expired invite (DB returns null via filter) → returns error URL", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockInviteTokenFindFirst.mockResolvedValue(null);

    const result = await callSignIn(googleUser("expired@school.lr"), googleAccount);

    expect(result).toBe("/login?error=InviteRequired");
  });

  it("13. new user, already-used invite (DB returns null via filter) → returns error URL", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockInviteTokenFindFirst.mockResolvedValue(null);

    const result = await callSignIn(googleUser("used@school.lr"), googleAccount);

    expect(result).toBe("/login?error=InviteRequired");
  });

  it("14. existing teacher, school googleSsoEnabled=false → returns false", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-2",
      role: "TEACHER",
      googleId: "gid-existing",
      school: { googleSsoEnabled: false },
    });

    const result = await callSignIn(googleUser("teacher@disabled.lr"), googleAccount);

    expect(result).toBe(false);
  });

  it("15b. existing TEACHER with schoolId: null (nullable in schema, never checked by the invite gate) → returns /login?error=SchoolAssignmentRequired, no session issued", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-orphan",
      role: "TEACHER",
      googleId: "gid-existing",
      schoolId: null,
      school: null,
    });

    const result = await callSignIn(googleUser("orphan@school.lr"), googleAccount);

    expect(result).toBe("/login?error=SchoolAssignmentRequired");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("15. existing Google user with non-TEACHER role → returns false", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-3",
      role: "ADMIN",
      googleId: null,
      school: { googleSsoEnabled: true },
    });

    const result = await callSignIn(googleUser("admin@school.lr"), googleAccount);

    expect(result).toBe(false);
  });
});

// ── Tests: POST /api/admin/invites route ──────────────────────────────────────

describe("NR-8 POST /api/admin/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAudit.mockResolvedValue(undefined);
    mockInviteTokenCreate.mockResolvedValue({
      id: "inv-new",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    // No duplicate
    mockInviteTokenFindFirst.mockResolvedValue(null);
  });

  it("16. ADMIN creates SSO invite → 201 with invite details", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-x" });

    const { POST } = await import("@/app/api/admin/invites/route");
    const req = new Request("http://localhost/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "teacher@school.lr", role: "TEACHER" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toMatchObject({ email: "teacher@school.lr", role: "TEACHER" });
  });

  it("17. TEACHER role (requireRole throws) → 403", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

    const { POST } = await import("@/app/api/admin/invites/route");
    const req = new Request("http://localhost/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "t@s.lr", role: "TEACHER" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
