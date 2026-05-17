import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock("@/lib/login-identifiers", () => ({
  normalizeLoginId: vi.fn((v: string) => v),
  normalizeCredentialPhone: vi.fn((v: string) => v),
}));

const googleAccount = { provider: "google" };
const googleUser = { id: "google-uid-123", email: "teacher@school.lr", name: "Jane Teacher" };

async function getSignInCallback() {
  const { authOptions } = await import("@/lib/auth");
  return (authOptions.callbacks as any).signIn;
}

describe("Google SSO signIn callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("auto-provisions a TEACHER user on first Google sign-in", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "new-user-id" });

    const signIn = await getSignInCallback();
    const result = await signIn({ user: googleUser, account: googleAccount });

    expect(result).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "teacher@school.lr",
        role: "TEACHER",
        googleId: "google-uid-123",
        hashedPwd: "",
      }),
    });
  });

  it("links googleId on existing teacher without one — no duplicate user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing-id",
      role: "TEACHER",
      googleId: null,
      school: { googleSsoEnabled: true },
    });
    mockPrisma.user.update.mockResolvedValueOnce({});

    const signIn = await getSignInCallback();
    const result = await signIn({ user: googleUser, account: googleAccount });

    expect(result).toBe(true);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: "teacher@school.lr" },
      data: { googleId: "google-uid-123" },
    });
  });

  it("blocks non-teacher (STUDENT) from Google SSO", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "student-id",
      role: "STUDENT",
      googleId: null,
      school: { googleSsoEnabled: true },
    });

    const signIn = await getSignInCallback();
    const result = await signIn({ user: googleUser, account: googleAccount });

    expect(result).toBe(false);
  });

  it("blocks teacher when school has googleSsoEnabled=false", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "teacher-id",
      role: "TEACHER",
      googleId: null,
      school: { googleSsoEnabled: false },
    });

    const signIn = await getSignInCallback();
    const result = await signIn({ user: googleUser, account: googleAccount });

    expect(result).toBe(false);
  });

  it("does not update googleId when it is already set", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "teacher-id",
      role: "TEACHER",
      googleId: "google-uid-123",
      school: { googleSsoEnabled: true },
    });

    const signIn = await getSignInCallback();
    const result = await signIn({ user: googleUser, account: googleAccount });

    expect(result).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
